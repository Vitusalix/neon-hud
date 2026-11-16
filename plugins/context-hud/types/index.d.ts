export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  tokens?: number
  window: number
  percent?: number
  limits: Limit[]
  autoCompactAt?: number
}

/** One reading of the rate-limit windows, for the burn-rate estimate. */
export type Sample = { t: number; five?: number; seven?: number }

/** Context size after one main-chat answer. */
export type CtxPoint = { t: number; tokens: number; percent: number }

export type FocusStatus = 'pending' | 'in_progress' | 'completed'
export type FocusItem = { content: string; status: FocusStatus }

/** Claude's task list and end-of-turn question, for the focus chip. */
export type Focus = {
  items: FocusItem[]
  ask: string | null
  /** Number of answer buttons: two or more means a decision. */
  choices: number
  startedAt: number | null
}

/** Compact button: idle -> preparing (chat writes notes) -> ready (keypoints in hand). */
export type CompactPhase = 'idle' | 'preparing' | 'ready'

/** Keep-warm pings so far. */
export type WarmInfo = {
  pings: number
  lastPingAt: number | null
  /** Tokens the last ping read from the cache: near zero means it was already cold. */
  lastCacheRead: number | null
  note: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'context-hud': {
      usage: Shaped<Usage | null>
      samples: Shaped<Sample[]>
      history: Shaped<CtxPoint[]>
      focus: Shaped<Focus>
      lastRequestAt: number | null
      now: number
      isExpanded: boolean
      compactPhase: CompactPhase
      keypoints: string | null
      warmUntil: number | null
      warmInfo: Shaped<WarmInfo>
    }
  }
}
