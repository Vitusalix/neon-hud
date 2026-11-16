// Focus chip logic: follows Claude's task list (update_plan) and the
import { T } from './i18n'
// end-of-turn question (wrap_up). Pure functions; no `$` here.
import type { Focus, FocusItem, FocusStatus } from '../types'

export const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
export const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'

export const NO_FOCUS: Focus = { items: [], ask: null, choices: 0, startedAt: null }

const STATUSES: FocusStatus[] = ['pending', 'in_progress', 'completed']

function toItems(raw: unknown): FocusItem[] | null {
  const list = typeof raw === 'string' ? safeJson(raw) : raw
  if (!Array.isArray(list)) return null
  return list
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map(x => ({
      content: String(x.content ?? ''),
      status: STATUSES.includes(x.status as FocusStatus) ? (x.status as FocusStatus) : 'pending',
    }))
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function toNumbers(raw: unknown): number[] {
  const list = typeof raw === 'string' ? safeJson(raw) : raw
  return Array.isArray(list) ? list.map(Number).filter(n => Number.isInteger(n)) : []
}

/** Applies one update_plan call: a whole new list, `advance`, or `done` / `start`. */
export function applyPlan(f: Focus, args: Record<string, unknown>, now: number): Focus {
  const items = toItems(args.items)
  if (items) {
    const isFresh = f.items.length === 0 || f.items.every(i => i.status === 'completed')
    return { ...f, items, startedAt: isFresh || f.startedAt === null ? now : f.startedAt }
  }
  let next = f.items.map(i => ({ ...i }))
  if (args.advance === true || args.advance === 'true') {
    const cur = next.findIndex(i => i.status === 'in_progress')
    if (cur >= 0) next[cur].status = 'completed'
    const pend = next.findIndex(i => i.status === 'pending')
    if (pend >= 0) next[pend].status = 'in_progress'
  }
  for (const n of toNumbers(args.done)) if (next[n - 1]) next[n - 1].status = 'completed'
  const start = Number(args.start)
  if (Number.isInteger(start) && next[start - 1]) next[start - 1].status = 'in_progress'
  return { ...f, items: next }
}

/** Applies a wrap_up call: the list is done, the question (if any) is for the person. */
export function applyWrapUp(f: Focus, args: Record<string, unknown>): Focus {
  const actions = typeof args.actions === 'string' ? safeJson(args.actions) : args.actions
  const ask = typeof args.ask === 'string' && args.ask.trim() ? args.ask.trim() : null
  return {
    ...f,
    items: f.items.map(i => ({ ...i, status: 'completed' as const })),
    ask,
    choices: ask && Array.isArray(actions) ? actions.length : 0,
  }
}

/** A new turn starts: the old question has been answered (or dropped). */
export function clearAsk(f: Focus): Focus {
  return f.ask === null ? f : { ...f, ask: null, choices: 0 }
}

export type FocusKind = 'none' | 'working' | 'turn' | 'decide' | 'read'

export type FocusView = {
  kind: FocusKind
  done: number
  total: number
  /** The step in progress, else the next one. */
  current: string | null
  /** What the person should do now. */
  you: string
}

export function focusView(f: Focus, isWorking: boolean): FocusView {
  const total = f.items.length
  const done = f.items.filter(i => i.status === 'completed').length
  const cur = f.items.find(i => i.status === 'in_progress') ?? f.items.find(i => i.status === 'pending')
  const base = { done, total, current: cur?.content ?? null }
  if (isWorking) return { ...base, kind: 'working', you: T.youIdle }
  if (f.ask) return { ...base, kind: f.choices >= 2 ? 'decide' : 'turn', you: f.ask }
  if (total === 0) return { ...base, kind: 'none', you: '' }
  return { ...base, kind: 'read', you: T.youRead }
}
