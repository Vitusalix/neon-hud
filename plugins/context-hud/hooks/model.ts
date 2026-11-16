// Pure helpers: colors, formatting and the limit projection. No `$` here.
import { T } from './i18n'
import type { CtxPoint, Limit, Sample } from '../types'

/** Neon-HUD palette (cyberpunk look chosen 2026-11-14). */
export const C = {
  // Neutral greys next to the app's own window grey (the band draws no background of its own).
  bg: '#262624',
  panel: '#2C2C2A',
  track: '#3A3A38',
  border: '#3A3A38',
  divider: '#454542',
  text: '#ECECEA',
  sub: '#A3A39E',
  faint: '#8A8A84',
  cyan: '#00F0FF',
  magenta: '#FF2BD6',
  yellow: '#FCEE0A',
  red: '#FF3B5C',
} as const

/** Prompt-cache lifetime of these sessions. */
export const CACHE_TTL_MS = 60 * 60 * 1000
/** Below this the cache countdown turns yellow. */
export const CACHE_LOW_MS = 10 * 60 * 1000
/** Projection needs readings spanning at least this long. */
const MIN_SPAN_MS = 10 * 60 * 1000
const NBSP = ' '

export function contextColor(percent?: number): string {
  if (percent === undefined) return C.sub
  if (percent >= 60) return C.red
  if (percent >= 50) return C.yellow
  return C.cyan
}

/** Limit color follows how much of the window is used. */
export function limitColor(used: number): string {
  if (used >= 80) return C.red
  if (used >= 50) return C.yellow
  return C.cyan
}

export function percentText(n?: number): string {
  return n === undefined ? `–${NBSP}%` : `${Math.round(n)}${NBSP}%`
}

/** 1234567 -> "1.234.567" (German grouping, independent of Intl). */
export function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Countdown as m:ss, or h:mm:ss past an hour. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Duration in words: "3 Std 12 Min", "45 Min", "2 Tg 4 Std". */
export function duration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return `${d}${NBSP}${T.days} ${h}${NBSP}${T.hours}`
  if (h > 0) return `${h}${NBSP}${T.hours} ${m}${NBSP}${T.minutes}`
  return `${m}${NBSP}${T.minutes}`
}

const WEEKDAYS = T.weekdays

/** Local wall-clock time "14:22", with the weekday when not today. */
export function clockTime(ms: number, now: number): string {
  const d = new Date(ms)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = new Date(now).toDateString() === d.toDateString()
  return sameDay ? hhmm : `${WEEKDAYS[d.getDay()]} ${hhmm}`
}

export type CacheState =
  | { kind: 'unknown' }
  | { kind: 'warm'; leftMs: number; expiresAt: number }
  | { kind: 'cold'; sinceMs: number; expiresAt: number }

export function cacheState(lastRequestAt: number | null, now: number): CacheState {
  if (lastRequestAt === null) return { kind: 'unknown' }
  const expiresAt = lastRequestAt + CACHE_TTL_MS
  const leftMs = expiresAt - now
  return leftMs > 0 ? { kind: 'warm', leftMs, expiresAt } : { kind: 'cold', sinceMs: -leftMs, expiresAt }
}

export function findLimit(limits: Limit[], kind: string): Limit | undefined {
  return limits.find(l => l.kind === kind)
}

/** Adds a reading; keeps the last 200. */
export function addSample(samples: Sample[], limits: Limit[], t: number): Sample[] {
  const five = findLimit(limits, 'five_hour')?.percentUsed
  const seven = findLimit(limits, 'seven_day')?.percentUsed
  if (five === undefined && seven === undefined) return samples
  return [...samples, { t, five, seven }].slice(-200)
}

export type Projection =
  | { kind: 'no-data' }
  | { kind: 'idle' }
  | { kind: 'until-reset' }
  | { kind: 'reaches'; inMs: number }

/**
 * Estimate when a window hits 100 % at the current pace: a straight line
 * from the first to the last reading since the window last reset.
 */
export function project(
  samples: Sample[],
  key: 'five' | 'seven',
  now: number,
  resetsAt?: string,
): Projection {
  const pts = samples.filter(s => s[key] !== undefined) as Array<Sample & Record<typeof key, number>>
  let start = 0
  for (let i = 1; i < pts.length; i++) if (pts[i][key] < pts[i - 1][key]) start = i
  const run = pts.slice(start)
  if (run.length < 2) return { kind: 'no-data' }
  const a = run[0]
  const b = run[run.length - 1]
  const span = Math.max(now, b.t) - a.t
  if (span < MIN_SPAN_MS) return { kind: 'no-data' }
  const rate = (b[key] - a[key]) / span
  if (rate <= 0) return { kind: 'idle' }
  const inMs = (100 - b[key]) / rate
  const reset = resetsAt ? Date.parse(resetsAt) : NaN
  if (!Number.isNaN(reset) && now + inMs >= reset) return { kind: 'until-reset' }
  return { kind: 'reaches', inMs }
}

export function projectionText(p: Projection): string {
  switch (p.kind) {
    case 'no-data':
      return T.projNoData
    case 'idle':
      return T.projIdle
    case 'until-reset':
      return T.projUntilReset
    case 'reaches':
      return T.projReaches(duration(p.inMs))
  }
}

/** Keep-warm: ping this long before the cache would expire. */
export const WARM_LEAD_MS = 5 * 60 * 1000
/** Keep-warm switches itself off after this long. */
export const WARM_MAX_MS = 4 * 60 * 60 * 1000

/** Remaining time as h:mm ("3:12"). */
export function hoursMinutes(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000))
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

/** The text between <compact-keypoints> tags, lines joined by "; ". */
export function extractKeypoints(answer: string): string | null {
  const m = /<compact-keypoints>([\s\S]*?)<\/compact-keypoints>/i.exec(answer)
  if (!m) return null
  const lines = m[1]
    .split('\n')
    .map(l => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
  return lines.length ? lines.join('; ') : null
}

/** Plain-text bar for the terminal: 20 cells. */
export function textBar(percent: number | undefined, cells = 20): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent ?? 0)) / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

/** Adds a point after an answer; keeps the last 24. */
export function addCtxPoint(history: CtxPoint[], point: CtxPoint): CtxPoint[] {
  return [...history, point].slice(-24)
}

/** The points since the last compaction (a drop in size starts a new run). */
export function sinceCompact(history: CtxPoint[]): CtxPoint[] {
  let start = 0
  for (let i = 1; i < history.length; i++) if (history[i].tokens < history[i - 1].tokens) start = i
  return history.slice(start)
}

export type Growth = { perAnswer?: number; perHour?: number; toAutoMs?: number }

/** Average growth per answer and per hour, and the time left until auto-compact (estimates). */
export function growth(history: CtxPoint[], autoCompactAt?: number, tokens?: number): Growth {
  const run = sinceCompact(history)
  if (run.length < 2) return {}
  const a = run[0]
  const b = run[run.length - 1]
  const out: Growth = { perAnswer: (b.tokens - a.tokens) / (run.length - 1) }
  const span = b.t - a.t
  if (span >= MIN_SPAN_MS) {
    out.perHour = ((b.tokens - a.tokens) / span) * 3_600_000
    const now = tokens ?? b.tokens
    if (autoCompactAt && out.perHour > 0 && autoCompactAt > now) {
      out.toAutoMs = ((autoCompactAt - now) / out.perHour) * 3_600_000
    }
  }
  return out
}

/** 18400 -> "18,4k", 380000 -> "380k". */
export function shortTokens(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', T.dec)}M`
  if (abs >= 100_000) return `${Math.round(n / 1000)}k`
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace('.', T.dec)}k`
  return String(Math.round(n))
}
