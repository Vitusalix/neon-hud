// Drawing of the band, layout B "Cockpit". Data in, tree out; no state writes here.
import { T } from './i18n'
import type { CompactPhase } from '../types'
import {
  C,
  CACHE_LOW_MS,
  CACHE_TTL_MS,
  cacheState,
  clockTime,
  contextColor,
  countdown,
  findLimit,
  growth,
  hoursMinutes,
  limitColor,
  percentText,
  shortTokens,
  textBar,
} from './model'
import { dotSvg } from './svg'
import { WIDE_BAR_H, compactIconSvg, labelRingSvg, warmIconSvg, wideBarSvg } from './svg-wide'
import { details } from './view-details'
import { focusRow } from './view-focus'
import { LIMITS } from './view-types'
import type { BandData, Table } from './view-types'

export type { BandData } from './view-types'

/** Width of the context bar in CSS px (the band itself is about 780 px wide). */
const BAR_W = 440
const RING = 40

export function band(t: Table, d: BandData) {
  const { Box, Text, Button } = t
  const u = d.usage
  const percent = u?.percent
  const ctxColor = contextColor(percent)
  const isWarn = (percent ?? 0) >= 50
  const isCrit = (percent ?? 0) >= 60

  const cache = cacheState(d.lastRequestAt, d.now)
  const isKept = d.warmUntil !== null
  const isLow = cache.kind === 'warm' && cache.leftMs < CACHE_LOW_MS
  const cacheColor = cache.kind !== 'warm' ? C.sub : isKept ? C.magenta : isLow ? C.yellow : C.cyan
  // Same width in every state, so the buttons never wrap below the tiles (magenta = kept warm).
  const cacheHead = 'CACHE'
  const cacheValue = cache.kind === 'warm' ? countdown(cache.leftMs) : T.cold
  const fraction = cache.kind === 'warm' ? cache.leftMs / CACHE_TTL_MS : 0

  const g = growth(d.history, u?.autoCompactAt, u?.tokens)
  const toAuto = u?.autoCompactAt && u.tokens !== undefined ? u.autoCompactAt - u.tokens : undefined
  const autoPercent = u?.autoCompactAt && u.window ? (u.autoCompactAt / u.window) * 100 : undefined
  const ghost = g.perAnswer && u?.window ? (g.perAnswer / u.window) * 100 : 0
  const hint = isCrit ? T.hintCrit : isWarn ? T.hintWarn : null
  const limits = u?.limits ?? []

  // Never name a variable `h` in .tsx: it hides the JSX factory ("h is not a function").
  const svg = (source: string, alt: string, width: number, height: number) =>
    t.Svg ? <t.Svg source={source} alt={alt} width={width} height={height} /> : <Text color={C.sub}>{alt}</Text>
  const tile = (key: string, ring: JSX.Element, head: string, headColor: string, value: JSX.Element) => (
    <Box key={key} flexDirection="row" alignItems="center" gap="sm" paddingX="sm" paddingY="xs" borderStyle="round" borderColor={C.border} flexGrow={1}>
      {ring}
      <Box flexDirection="column">
        <Text size="caption" mono color={headColor}>{head}</Text>
        {value}
      </Box>
    </Box>
  )
  const iconTile = (source: string, alt: string) => (
    <Box padding="xs" borderStyle="round" borderColor={C.border} flexShrink={0}>
      {svg(source, alt, 22, 22)}
    </Box>
  )

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isCrit ? C.red : isWarn ? C.yellow : C.border} paddingX="md" paddingY="sm">
      {/* No wrap here: when space runs out the tiles wrap inside, the buttons stay on the right. */}
      <Box flexDirection="row" alignItems="center" columnGap="lg">
        <Box flexDirection="column" gap="sm" flexGrow={1} flexShrink={1}>
          <Box flexDirection="row" alignItems="flex-start" gap="md">
            <Box flexDirection="column" flexShrink={0}>
              <Box flexDirection="row" alignItems="center" gap="xs">
                <Text size="caption" mono weight="semibold" color={ctxColor}>CTX</Text>
                {isCrit && t.Svg ? <t.Svg source={dotSvg(C.red, true)} alt="Kontext kritisch" width={12} height={12} /> : null}
              </Box>
              <Text size="title" mono weight="bold" tabular color={isWarn ? ctxColor : C.text}>{percentText(percent)}</Text>
              <Text size="caption" mono tabular color={C.sub}>
                {u?.tokens !== undefined ? `${shortTokens(u.tokens)} / ${shortTokens(u.window)}` : '–'}
              </Text>
            </Box>
            <Box flexDirection="column" gap="xs" flexShrink={1}>
              {t.Svg ? (
                <t.Svg source={wideBarSvg(percent, ctxColor, BAR_W, autoPercent, ghost)} alt={`${T.context} ${percentText(percent)}`} width={BAR_W} height={WIDE_BAR_H} />
              ) : (
                <Text color={ctxColor}>{textBar(percent)}</Text>
              )}
              <Box flexDirection="row" columnGap="md" flexWrap="wrap">
                {hint ? <Text size="caption" mono color={ctxColor}>{hint}</Text> : null}
                {g.perAnswer ? <Text size="caption" mono color={C.sub}>{`≈ +${shortTokens(g.perAnswer)} ${T.perAnswer}`}</Text> : null}
                {toAuto !== undefined ? <Text size="caption" mono color={C.faint}>{`${shortTokens(toAuto)} ${T.toAuto}`}</Text> : null}
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" alignItems="center" gap="sm" flexWrap="wrap">
            {tile(
              'cache',
              svg(labelRingSvg(fraction, cacheColor, RING), `Cache ${cacheValue}`, RING, RING),
              cacheHead,
              cacheColor,
              <Text size="body" mono weight="bold" tabular color={isLow && !isKept ? C.yellow : C.text}>{cacheValue}</Text>,
            )}
            {LIMITS.map(l => {
              const lim = findLimit(limits, l.kind)
              const used = lim?.percentUsed
              const color = lim ? limitColor(lim.percentUsed) : C.sub
              const label = used !== undefined ? String(Math.round(used)) : '–'
              return tile(
                l.kind,
                svg(labelRingSvg((used ?? 0) / 100, color, RING, label), `${l.long} ${T.limit} ${percentText(used)}`, RING, RING),
                l.kind === 'five_hour' ? T.fiveHours : T.week,
                color,
                <Text size="footnote" mono color={C.text}>{resetText(l.kind, lim?.resetsAt, d.now)}</Text>,
              )
            })}
            <Button key="toggle" label={d.isExpanded ? '▴' : '▾'} dimColor onPress={d.on.toggle} />
          </Box>
        </Box>
        <Box flexDirection="column" gap="sm" flexShrink={0}>
          <Box flexDirection="row" alignItems="center" gap="sm">
            {iconTile(compactIconSvg(d.compactPhase === 'preparing'), T.compact)}
            <Button key="compact" variant="primary" label={compactLabel(d.compactPhase)} onPress={d.on.compact} />
          </Box>
          <Box flexDirection="row" alignItems="center" gap="sm">
            {iconTile(warmIconSvg(isKept, isLow && !isKept), T.keepWarm)}
            <Button
              key="warm"
              label={d.warmUntil ? `${T.warm} · ${hoursMinutes(d.warmUntil - d.now)}` : T.keepWarm}
              variant={d.warmUntil ? 'primary' : 'secondary'}
              onPress={d.on.warm}
            />
          </Box>
        </Box>
      </Box>
      {focusRow(t, d)}
      {d.isExpanded ? details(t, d) : null}
    </Box>
  )
}

function resetText(kind: string, resetsAt: string | undefined, now: number): string {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (Number.isNaN(at)) return `${T.reset} –`
  // Short, steady width ("Reset in 4:45"), so the tiles do not push the buttons down.
  return kind === 'five_hour' ? `${T.resetIn} ${hoursMinutes(at - now)}` : `${T.reset} ${clockTime(at, now)}`
}

function compactLabel(phase: CompactPhase): string {
  return phase === 'preparing' ? T.preparing : T.compact
}
