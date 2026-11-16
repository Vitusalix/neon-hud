// Focus chip: a row under the band with the current step and what the person should do.
import { T } from './i18n'
import { focusView } from './focus'
import { C, duration } from './model'
import { dotSvg, stepsSvg } from './svg'
import type { BandData, Table } from './view-types'

const LOOK = {
  working: { head: T.focusNow, color: C.cyan, youHead: T.focusYou, youColor: C.sub, pulse: false },
  turn: { head: T.focusDone, color: C.sub, youHead: T.focusYourTurn, youColor: C.magenta, pulse: true },
  decide: { head: T.focusDone, color: C.sub, youHead: T.focusDecide, youColor: C.yellow, pulse: true },
  read: { head: T.focusDone, color: C.sub, youHead: T.focusYou, youColor: C.cyan, pulse: false },
} as const

export function focusRow(t: Table, d: BandData) {
  const { Box, Text } = t
  const v = focusView(d.focus, d.isWorking)
  if (v.kind === 'none') return null
  const look = LOOK[v.kind]
  const label = v.kind === 'working' ? v.current ?? T.focusWorking : v.total > 0 ? T.focusFinished(v.done, v.total) : T.focusAnswerReady

  return (
    <Box flexDirection="column" gap="xs" marginTop="sm" paddingTop="sm">
      <Box flexDirection="row" alignItems="center" columnGap="md" rowGap="xs" flexWrap="wrap">
        <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
          <Text size="caption" mono weight="semibold" color={look.color}>{look.head}</Text>
          {v.total > 0 && t.Svg ? (
            <t.Svg
              source={stepsSvg(v.done, v.total, d.isWorking)}
              alt={T.stepOf(Math.min(v.done + 1, v.total), v.total)}
              width={Math.min(v.total, 12) * 14}
              height={10}
            />
          ) : null}
          {v.total > 0 && v.kind === 'working' ? (
            <Text size="caption" mono tabular color={C.sub}>{`${Math.min(v.done + 1, v.total)}/${v.total}`}</Text>
          ) : null}
          <Text size="footnote" color={C.text} wrap="truncate-end">{label}</Text>
        </Box>
        <Box flexGrow={1} />
        <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
          {look.pulse && t.Svg ? <t.Svg source={dotSvg(look.youColor, true)} alt="" width={12} height={12} /> : null}
          <Text size="caption" mono weight="semibold" color={look.youColor}>{look.youHead}</Text>
          <Text
            size={look.pulse ? 'body' : 'footnote'}
            weight={look.pulse ? 'semibold' : 'regular'}
            color={look.youColor}
            wrap="truncate-end"
          >
            {v.you}
          </Text>
        </Box>
      </Box>
      {d.isExpanded && d.focus.items.length > 0 ? planList(t, d) : null}
    </Box>
  )
}

function planList(t: Table, d: BandData) {
  const { Box, Text } = t
  const items = d.focus.items
  return (
    <Box flexDirection="column" gap="xs" marginTop="xs" padding="sm" backgroundColor={C.panel} borderStyle="single" borderColor={C.border}>
      {items.map((item, i) => {
        const mark = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '▸' : '·'
        const color = item.status === 'completed' ? C.faint : item.status === 'in_progress' ? C.cyan : C.text
        return (
          <Text key={`step-${i}`} size="footnote" mono color={color} wrap="truncate-end">
            {`${mark} ${String(i + 1).padStart(2, ' ')}  ${item.content}`}
          </Text>
        )
      })}
      {d.focus.startedAt !== null ? (
        <Text size="caption" color={C.sub}>{T.planSince(duration(d.now - d.focus.startedAt))}</Text>
      ) : null}
    </Box>
  )
}
