// The opened details: context history, cache, limits (Neon-HUD look).
import { T } from './i18n'
import {
  C,
  cacheState,
  clockTime,
  duration,
  findLimit,
  groupDigits,
  growth,
  percentText,
  project,
  projectionText,
  shortTokens,
  sinceCompact,
} from './model'
import { historySvg } from './svg'
import { LIMITS } from './view-types'
import type { BandData, Table } from './view-types'

export function details(t: Table, d: BandData) {
  const { Box, Text } = t
  const u = d.usage
  const cache = cacheState(d.lastRequestAt, d.now)
  const limits = u?.limits ?? []

  const head = (s: string, color: string) => (
    <Text size="caption" mono weight="semibold" color={color}>{s}</Text>
  )
  const line = (s: string, color: string = C.text) => (
    <Text size="footnote" mono color={color}>{s}</Text>
  )
  const card = (key: string, children: JSX.Element) => (
    <Box
      key={key}
      flexDirection="column"
      gap="xs"
      width="31%"
      padding="sm"
      backgroundColor={C.panel}
      borderStyle="single"
      borderColor={C.border}
    >
      {children}
    </Box>
  )

  const run = sinceCompact(d.history).slice(-12)
  const g = growth(d.history, u?.autoCompactAt, u?.tokens)
  const rate = [
    g.perAnswer !== undefined ? `+${shortTokens(g.perAnswer)} ${T.perAnswer}` : null,
    g.perHour !== undefined ? `+${shortTokens(g.perHour)} ${T.perHour}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box flexDirection="row" gap="md" marginTop="sm" flexWrap="wrap">
      {card(
        'ctx',
        <>
          {head(T.historyHead(run.length), C.cyan)}
          {run.length >= 2 && t.Svg ? (
            <t.Svg
              source={historySvg(run.map(p => p.percent), C.cyan)}
              alt={T.historyAlt(percentText(run[0].percent), percentText(run[run.length - 1].percent))}
              width={250}
              height={60}
            />
          ) : (
            line(T.historyEmpty, C.sub)
          )}
          {rate ? line(rate, C.sub) : null}
          {u?.autoCompactAt ? line(T.autoAt(groupDigits(u.autoCompactAt)), C.sub) : null}
          {g.toAutoMs !== undefined ? line(T.autoIn(duration(g.toAutoMs)), C.sub) : null}
        </>,
      )}
      {card(
        'cache',
        <>
          {head('CACHE', C.magenta)}
          {d.lastRequestAt !== null
            ? line(T.lastRequest(clockTime(d.lastRequestAt, d.now)))
            : line(T.noRequest)}
          {cache.kind === 'warm' ? line(T.expires(clockTime(cache.expiresAt, d.now))) : null}
          {cache.kind === 'cold' ? line(T.expiredSince(duration(cache.sinceMs)), C.sub) : null}
          {d.warmUntil
            ? line(
                T.warmUntil(clockTime(d.warmUntil, d.now), d.warmInfo.pings),
                C.sub,
              )
            : null}
          {d.warmUntil && d.warmInfo.lastCacheRead !== null
            ? line(T.lastPingRead(shortTokens(d.warmInfo.lastCacheRead)), C.sub)
            : null}
          {d.warmUntil && d.warmInfo.note ? line(d.warmInfo.note, C.yellow) : null}
        </>,
      )}
      {card(
        'limits',
        <>
          {head(T.limitsHead, C.yellow)}
          {LIMITS.map(l => {
            const lim = findLimit(limits, l.kind)
            if (!lim) return <Box key={l.kind}>{line(`${l.short} ${T.noData}`, C.sub)}</Box>
            const reset = lim.resetsAt ? Date.parse(lim.resetsAt) : NaN
            const resetText = Number.isNaN(reset)
              ? ''
              : ` · ${T.reset} ${clockTime(reset, d.now)} (${duration(reset - d.now)})`
            const p = project(d.samples, l.key, d.now, lim.resetsAt)
            return (
              <Box key={l.kind} flexDirection="column">
                {line(`${l.short} ${percentText(lim.percentUsed)}${resetText}`)}
                {line(projectionText(p), p.kind === 'reaches' ? C.red : C.sub)}
              </Box>
            )
          })}
        </>,
      )}
    </Box>
  )
}
