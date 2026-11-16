// What the two buttons do: the Compact flow and the keep-warm pings.
import { T } from './i18n'
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { WarmInfo } from '../types'
import { WARM_LEAD_MS, WARM_MAX_MS, cacheState, extractKeypoints } from './model'

// The same state refs as register.tsx: the scan wants them declared in each module.
const lastRequestAtom = atom({ plugin: 'context-hud', key: 'lastRequestAt' } as const, null)
const compactPhaseAtom = atom({ plugin: 'context-hud', key: 'compactPhase' } as const, 'idle')
const keypointsAtom = atom({ plugin: 'context-hud', key: 'keypoints' } as const, null)
const warmUntilAtom = atom({ plugin: 'context-hud', key: 'warmUntil' } as const, null)

const NO_PINGS: WarmInfo = { pings: 0, lastPingAt: null, lastCacheRead: null, note: null }
const warmInfoAtom = atom({ plugin: 'context-hud', key: 'warmInfo' } as const, NO_PINGS, {
  shape: 'warm-1',
})

const COMPACT_PROMPT = T.compactPrompt

const PING_PROMPT =
  'Keep-alive ping from the context-hud mod. You have no tools. ' +
  'Do not think it over; reply with exactly: ok'

/** Turns without keypoints tolerated while preparing (a turn that was already running). */
let misses = 0
let isPinging = false
let nextTryAt = 0

export async function startCompact($: EngineInterface): Promise<void> {
  if ((await read($, compactPhaseAtom)) !== 'idle') return
  misses = 0
  await update($, keypointsAtom, () => null)
  await update($, compactPhaseAtom, () => 'preparing')
  await $.prompt.submit({ text: COMPACT_PROMPT })
}

export async function compactTurnDone($: EngineInterface, answer: string): Promise<void> {
  if ((await read($, compactPhaseAtom)) !== 'preparing') return
  const kp = extractKeypoints(answer)
  if (kp) {
    await update($, compactPhaseAtom, () => 'idle')
    // The person sends it: a plugin cannot compact in the desktop app (SDK session).
    const instructions = T.compactKeep(kp)
    await $.prompt.fill({ text: `/compact ${instructions}` })
    $.ui.toast(T.toastReady)
    return
  }
  misses += 1
  if (misses >= 2) {
    await update($, compactPhaseAtom, () => 'idle')
    $.ui.toast(T.toastNoKeypoints)
  }
}

export async function toggleWarm($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const until = await read($, warmUntilAtom)
  nextTryAt = 0
  await update($, warmInfoAtom, () => NO_PINGS)
  await update($, warmUntilAtom, () => (until ? null : now + WARM_MAX_MS))
}

/** Called every second: pings about 5 minutes before the cache would expire. */
export async function warmTick($: EngineInterface, now: number): Promise<void> {
  const until = await read($, warmUntilAtom)
  if (!until) return
  if (now >= until) {
    await update($, warmUntilAtom, () => null)
    $.ui.toast(T.toastWarmEnded)
    return
  }
  if (isPinging || now < nextTryAt) return
  const cache = cacheState(await read($, lastRequestAtom), now)
  if (cache.kind !== 'warm') {
    await setNote($, T.noteCold)
    return
  }
  if (cache.leftMs > WARM_LEAD_MS) return

  isPinging = true
  try {
    const r = await $.model.fork({ prompt: PING_PROMPT })
    const t = await $.clock.now()
    const cacheRead = 'usage' in r && r.usage ? r.usage.cache_read_input_tokens : 0
    if (r.isAnswered && cacheRead > 0) await update($, lastRequestAtom, () => t)
    else nextTryAt = t + 60_000
    await update($, warmInfoAtom, info => ({
      pings: info.pings + 1,
      lastPingAt: t,
      lastCacheRead: cacheRead,
      note: r.isAnswered ? (cacheRead > 0 ? null : T.noteNothingRead) : T.pingFailed(r.reason),
    }))
  } catch (err) {
    nextTryAt = now + 60_000
    await setNote($, T.pingFailed(String(err)))
  } finally {
    isPinging = false
  }
}

async function setNote($: EngineInterface, note: string): Promise<void> {
  if ((await read($, warmInfoAtom)).note === note) return
  await update($, warmInfoAtom, info => ({ ...info, note }))
}
