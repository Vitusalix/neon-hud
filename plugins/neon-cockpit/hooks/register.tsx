// neon-cockpit: a bar above the prompt with context fill, prompt-cache
// countdown, the 5h / weekly limits, details, Compact and keep-warm.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { CtxPoint, Sample, Usage, WarmInfo } from '../types'
import { compactTurnDone, startCompact, toggleWarm, warmTick } from './actions'
import { NO_FOCUS, PLAN_TOOL, WRAP_TOOL, applyPlan, applyWrapUp, clearAsk } from './focus'
import { addCtxPoint, addSample } from './model'
import { band } from './view'

// State refs (declared in ../types); repeated in actions.ts as the scan wants them per module.
const usageAtom = atom({ plugin: 'neon-cockpit', key: 'usage' } as const, null, { shape: 'usage-1' })
const samplesAtom = atom({ plugin: 'neon-cockpit', key: 'samples' } as const, [] as Sample[], {
  shape: 'samples-1',
})
const historyAtom = atom({ plugin: 'neon-cockpit', key: 'history' } as const, [] as CtxPoint[], {
  shape: 'history-1',
})
const focusAtom = atom({ plugin: 'neon-cockpit', key: 'focus' } as const, NO_FOCUS, { shape: 'focus-1' })
const lastRequestAtom = atom({ plugin: 'neon-cockpit', key: 'lastRequestAt' } as const, null)
const nowAtom = atom({ plugin: 'neon-cockpit', key: 'now' } as const, 0)
const expandedAtom = atom({ plugin: 'neon-cockpit', key: 'isExpanded' } as const, false)
const compactPhaseAtom = atom({ plugin: 'neon-cockpit', key: 'compactPhase' } as const, 'idle')
const keypointsAtom = atom({ plugin: 'neon-cockpit', key: 'keypoints' } as const, null)
const warmUntilAtom = atom({ plugin: 'neon-cockpit', key: 'warmUntil' } as const, null)

const NO_PINGS: WarmInfo = { pings: 0, lastPingAt: null, lastCacheRead: null, note: null }
const warmInfoAtom = atom({ plugin: 'neon-cockpit', key: 'warmInfo' } as const, NO_PINGS, {
  shape: 'warm-1',
})

async function record(
  $: EngineInterface,
  context: SessionContextUsage,
  rateLimits: SessionRateLimit[],
): Promise<void> {
  const t = await $.clock.now()
  await update($, usageAtom, prev => {
    const next: Usage = {
      tokens: context.tokens,
      window: context.window,
      percent: context.percent,
      limits: rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
      autoCompactAt: prev?.autoCompactAt,
    }
    return next
  })
  await update($, samplesAtom, s => addSample(s, rateLimits, t))
}

/** Remember the context size after each main-chat answer (for the history chart). */
async function recordAnswer($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    const tokens = u.context.tokens
    if (tokens === undefined) return
    const t = await $.clock.now()
    const percent = u.context.percent ?? (u.context.window ? (tokens / u.context.window) * 100 : 0)
    await update($, historyAtom, list => addCtxPoint(list, { t, tokens, percent }))
  } catch {
    // No figures: skip this point.
  }
}

async function markRequest($: EngineInterface): Promise<void> {
  const t = await $.clock.now()
  await update($, lastRequestAtom, () => t)
  await update($, nowAtom, () => t)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    try {
      const u = await $.session.usage()
      await record($, u.context, u.rateLimits)
      const full = await $.session.usage({ breakdown: 'summary' })
      const at = full.context.breakdown?.autoCompactThreshold
      if (at) await update($, usageAtom, prev => (prev ? { ...prev, autoCompactAt: at } : prev))
    } catch {
      // No figures yet: the band shows dashes until the first measurement.
    }
    await update($, nowAtom, () => Date.now())
    $.clock.every(1000, () => {
      void $.clock.now().then(async t => {
        await update($, nowAtom, () => t)
        await warmTick($, t)
      })
    })
    return result
  })

  on('session.measure', async ($, e, next) => {
    await record($, e.context, e.rateLimits)
    return next(e)
  })

  // A compaction (button, /compact or auto) shrinks the context at once, but
  // no measurement follows until the next answer: take the size it reports.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || !result.messages) return result
    const after = result.tokensAfter
    await update($, usageAtom, prev =>
      prev
        ? {
            ...prev,
            tokens: after,
            percent: after !== undefined && prev.window ? Math.round((after / prev.window) * 100) : undefined,
          }
        : prev,
    )
    // The cached prefix was the old conversation; the next request writes a new one.
    await update($, lastRequestAtom, () => null)
    return result
  })

  // Every main-thread model request reads/writes the prompt cache and
  // restarts its lifetime; subagents (agentId set) have caches of their own.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) await markRequest($)
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      await markRequest($)
      await recordAnswer($)
      await compactTurnDone($, e.answer)
    }
    return result
  })

  // Focus chip: follow the task list and the end-of-turn question of the main chat.
  on('tool.call', async ($, e, next) => {
    if (!e.agentId && (e.tool === PLAN_TOOL || e.tool === WRAP_TOOL)) {
      const args = e as unknown as Record<string, unknown>
      const t = await $.clock.now()
      await update($, focusAtom, f => (e.tool === PLAN_TOOL ? applyPlan(f, args, t) : applyWrapUp(f, args)))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, focusAtom, clearAsk)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const table = $.ui.resolve(e)
    const isDesktop = e.surface === 'desktop' || e.surface === 'vscode'
    const t = {
      Box: table.Box,
      Text: table.Text,
      Button: table.Button,
      Svg: isDesktop && 'Svg' in table ? table.Svg : undefined,
    }
    try {
      return await drawBand($, e, t)
    } catch (err) {
      // Show why instead of vanishing silently.
      return <t.Text color="#FF3B5C">{`neon-cockpit: ${err instanceof Error ? err.message : String(err)}`}</t.Text>
    }
  })
  on('ui.fault', async ($, e, next) => {
    $.ui.toast(`neon-cockpit ${e.phase}: ${e.reason}`.slice(0, 300))
    return next(e)
  })
}

async function drawBand($: EngineInterface, e: { props: { isWorking: boolean } }, t: Parameters<typeof band>[0]) {
    return band(t, {
      usage: await read($, usageAtom),
      samples: await read($, samplesAtom),
      history: await read($, historyAtom),
      focus: await read($, focusAtom),
      isWorking: e.props.isWorking,
      lastRequestAt: await read($, lastRequestAtom),
      now: await read($, nowAtom),
      isExpanded: await read($, expandedAtom),
      compactPhase: await read($, compactPhaseAtom),
      keypoints: await read($, keypointsAtom),
      warmUntil: await read($, warmUntilAtom),
      warmInfo: await read($, warmInfoAtom),
      on: {
        toggle: () => void update($, expandedAtom, v => !v),
        compact: () => void startCompact($),
        warm: () => void toggleWarm($),
      },
    })
}
