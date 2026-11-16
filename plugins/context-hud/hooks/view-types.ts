// Shared shapes of the band drawing (bar in view.tsx, details in view-details.tsx).
import type { Elements } from 'claude-code'

import type { CompactPhase, CtxPoint, Focus, Sample, Usage, WarmInfo } from '../types'

export type Table = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button'> & {
  Svg?: Elements['desktop']['Svg']
}

export type BandData = {
  usage: Usage | null
  samples: Sample[]
  history: CtxPoint[]
  focus: Focus
  isWorking: boolean
  lastRequestAt: number | null
  now: number
  isExpanded: boolean
  compactPhase: CompactPhase
  keypoints: string | null
  warmUntil: number | null
  warmInfo: WarmInfo
  on: {
    toggle: () => void
    compact: () => void
    warm: () => void
  }
}

export const LIMITS = [
  { kind: 'five_hour', key: 'five', short: '5H', long: '5h' },
  { kind: 'seven_day', key: 'seven', short: '7D', long: '7d' },
] as const
