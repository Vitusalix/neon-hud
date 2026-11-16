// SVG pieces of layout B (Cockpit): wide context bar, labelled rings, button icons.
import { C } from './model'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const MONO = 'Consolas,monospace'
const clamp = (n: number | undefined) => Math.min(100, Math.max(0, n ?? 0))

function glow(id: string): string {
  return (
    `<defs><filter id="${id}" x="-20%" y="-80%" width="140%" height="260%">` +
    '<feGaussianBlur stdDeviation="1.5" result="b"/>' +
    '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
  )
}

export const WIDE_BAR_H = 32

/**
 * Wide segmented context bar with a scale under it: 0/25/75/100 grey, 50 yellow,
 * 60 red, AUTO magenta. `ghost` (percent) lights the next answer's cells faintly.
 */
export function wideBarSvg(percent: number | undefined, color: string, width: number, autoPercent?: number, ghost = 0): string {
  const seg = 6
  const gap = 2
  const h = 14
  const n = Math.floor((width + gap) / (seg + gap))
  const lit = Math.round((clamp(percent) / 100) * n)
  const faint = Math.round((clamp((percent ?? 0) + ghost) / 100) * n)
  let cells = ''
  for (let i = 0; i < n; i++) {
    const fill = i < faint ? color : C.track
    const op = i >= lit && i < faint ? ' opacity="0.3"' : ''
    cells += `<rect x="${i * (seg + gap)}" y="2" width="${seg}" height="${h}" fill="${fill}"${op}/>`
  }
  const w = n * (seg + gap) - gap
  const x = (p: number) => Math.round((p / 100) * w)
  const label = (px: number, c: string, s: string) =>
    `<text x="${px}" y="${h + 15}" fill="${c}" font-family="${MONO}" font-size="10" text-anchor="middle">${s}</text>`
  const mark = (p: number, c: string, s: string) =>
    `<rect x="${x(p) - 0.5}" y="0" width="1" height="${h + 4}" fill="${c}"/>` + label(x(p), c, s)
  let scale = label(5, C.faint, '0') + label(x(25), C.faint, '25') + label(x(75), C.faint, '75') + label(w - 10, C.faint, '100')
  scale += mark(50, C.yellow, '50') + mark(60, C.red, '60')
  if (autoPercent !== undefined && autoPercent > 62 && autoPercent < 97) scale += mark(autoPercent, C.magenta, 'AUTO')
  return (
    `<svg ${NS} width="${w}" height="${WIDE_BAR_H}" viewBox="0 0 ${w} ${WIDE_BAR_H}">` +
    glow('wb') +
    `<g filter="url(#wb)">${cells}</g>${scale}</svg>`
  )
}

/** Ring with an optional number in the middle (limits) or none (cache). */
export function labelRingSvg(fraction: number, color: string, size: number, label?: string): string {
  const sw = 3.5
  const r = size / 2 - sw - 1
  const m = size / 2
  const len = 2 * Math.PI * r
  const on = Math.max(0, Math.min(1, fraction)) * len
  const text = label
    ? `<text x="${m}" y="${m + 4}" fill="${C.text}" font-family="${MONO}" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>`
    : ''
  return (
    `<svg ${NS} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    glow('lr') +
    `<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${C.track}" stroke-width="${sw}"/>` +
    `<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" ` +
    `stroke-dasharray="${on.toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 ${m} ${m})" filter="url(#lr)"/>` +
    `${text}</svg>`
  )
}

/** Compact icon: arrows squeezing in; they move while the chat prepares. */
export function compactIconSvg(isPreparing: boolean): string {
  const col = isPreparing ? C.magenta : C.sub
  const move = (dx: number) =>
    isPreparing
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} 0;0 0" dur="0.9s" repeatCount="indefinite"/>`
      : ''
  return (
    `<svg ${NS} width="22" height="22" viewBox="0 0 24 24">` +
    glow('ci') +
    `<g filter="url(#ci)" stroke="${col}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g><path d="M3 7l5 5-5 5"/>${move(2)}</g><g><path d="M21 7l-5 5 5 5"/>${move(-2)}</g>` +
    '<path d="M12 4v16" opacity="0.6"/></g></svg>'
  )
}

const FLAME =
  'M12 2.5c1.2 4.2 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.2 2.7-5.5.3 1.8 1.1 2.8 2.2 3.1C11.2 8.2 10.8 5.6 12 2.5z'

/** Warm icon: grey flame when off, glowing flicker when on, yellow pulse when the cache runs low. */
export function warmIconSvg(isOn: boolean, isLow: boolean): string {
  let body: string
  if (isOn)
    body =
      '<defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">' +
      `<stop offset="0" stop-color="${C.magenta}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient></defs>` +
      `<path d="${FLAME}" fill="url(#fl)"><animate attributeName="opacity" values="1;0.7;1;0.85;1" dur="1.4s" repeatCount="indefinite"/></path>`
  else if (isLow)
    body =
      `<path d="${FLAME}" fill="none" stroke="${C.yellow}" stroke-width="1.8" stroke-linejoin="round">` +
      '<animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite"/></path>'
  else body = `<path d="${FLAME}" fill="none" stroke="${C.sub}" stroke-width="1.8" stroke-linejoin="round"/>`
  return `<svg ${NS} width="22" height="22" viewBox="0 0 24 24">${glow('wi')}<g filter="url(#wi)">${body}</g></svg>`
}
