import { expect, test } from 'claude-code/testing'
import { T } from './i18n'

import {
  C,
  CACHE_TTL_MS,
  cacheState,
  contextColor,
  countdown,
  extractKeypoints,
  groupDigits,
  growth,
  hoursMinutes,
  limitColor,
  percentText,
  project,
  shortTokens,
  sinceCompact,
} from './model'

const MIN = 60_000

test('context color: cyan below 50, yellow from 50, red from 60', async () => {
  expect(contextColor(49)).toBe(C.cyan)
  expect(contextColor(50)).toBe(C.yellow)
  expect(contextColor(59)).toBe(C.yellow)
  expect(contextColor(60)).toBe(C.red)
})

test('limit color follows how much is used', async () => {
  expect(limitColor(10)).toBe(C.cyan)
  expect(limitColor(55)).toBe(C.yellow)
  expect(limitColor(85)).toBe(C.red)
})

test('growth: per answer, per hour and time to auto-compact since the last compaction', async () => {
  const pts = [
    { t: 0, tokens: 500_000, percent: 50 },
    { t: 10 * MIN, tokens: 100_000, percent: 10 },
    { t: 20 * MIN, tokens: 120_000, percent: 12 },
    { t: 40 * MIN, tokens: 160_000, percent: 16 },
  ]
  expect(sinceCompact(pts).length).toBe(3)
  const g = growth(pts, 900_000, 160_000)
  expect(g.perAnswer).toBe(30_000)
  expect(Math.round(g.perHour ?? 0)).toBe(120_000)
  expect(Math.round((g.toAutoMs ?? 0) / MIN)).toBe(370)
})

test('growth needs two points and ten minutes for the hourly rate', async () => {
  expect(growth([{ t: 0, tokens: 1, percent: 0 }]).perAnswer).toBe(undefined)
  const g = growth([
    { t: 0, tokens: 1000, percent: 0 },
    { t: 5 * MIN, tokens: 3000, percent: 0 },
  ])
  expect(g.perAnswer).toBe(2000)
  expect(g.perHour).toBe(undefined)
})

test('short tokens', async () => {
  expect(shortTokens(18_400)).toBe(`18${T.dec}4k`)
  expect(shortTokens(380_000)).toBe('380k')
  expect(shortTokens(950)).toBe('950')
  expect(shortTokens(1_000_000)).toBe('1M')
  expect(shortTokens(1_500_000)).toBe(`1${T.dec}5M`)
})

test('number and percent sign never break apart', async () => {
  expect(percentText(34.4)).toBe('34 %')
  expect(groupDigits(630412)).toBe('630.412')
  expect(countdown(41 * MIN + 12_000)).toBe('41:12')
})

test('cache is warm for one hour after the last request', async () => {
  expect(cacheState(null, 0).kind).toBe('unknown')
  expect(cacheState(0, CACHE_TTL_MS - 1).kind).toBe('warm')
  expect(cacheState(0, CACHE_TTL_MS + 1).kind).toBe('cold')
})

test('projection: straight line from readings since the last reset', async () => {
  const samples = [
    { t: 0, five: 10 },
    { t: 20 * MIN, five: 30 },
  ]
  // 1 % per minute, 70 % left -> 70 minutes; reset far away.
  const p = project(samples, 'five', 20 * MIN, new Date(10 * 60 * MIN).toISOString())
  expect(p.kind).toBe('reaches')
  if (p.kind === 'reaches') expect(Math.round(p.inMs / MIN)).toBe(70)
  // Reset before the limit is reached.
  expect(project(samples, 'five', 20 * MIN, new Date(30 * MIN).toISOString()).kind).toBe('until-reset')
  // Too short a span.
  expect(project([{ t: 0, five: 1 }, { t: MIN, five: 2 }], 'five', MIN).kind).toBe('no-data')
  // A drop (window reset) starts the line over.
  expect(project([...samples, { t: 21 * MIN, five: 2 }], 'five', 21 * MIN).kind).toBe('no-data')
})

test('keypoints come out of the tagged block, one line each', async () => {
  const answer = 'Fertig.\n<compact-keypoints>\n- Ziel: Leiste\n- Stand: Anzeige läuft\n</compact-keypoints>'
  expect(extractKeypoints(answer)).toBe('Ziel: Leiste; Stand: Anzeige läuft')
  expect(extractKeypoints('kein Block')).toBe(null)
})

test('keep-warm remaining time reads h:mm', async () => {
  expect(hoursMinutes(4 * 60 * MIN)).toBe('4:00')
  expect(hoursMinutes(3 * 60 * MIN + 11 * MIN + 5_000)).toBe('3:12')
})
