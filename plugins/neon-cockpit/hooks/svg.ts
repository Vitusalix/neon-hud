// SVG pieces of the Neon-HUD look. Strings in, strings out; no `$` here.
import { C } from './model'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const clamp = (n: number | undefined) => Math.min(100, Math.max(0, n ?? 0))

/** Soft glow behind a shape: blurred copy under the original. */
function glow(id: string, deviation = 1.6): string {
  return (
    `<defs><filter id="${id}" x="-20%" y="-60%" width="140%" height="220%">` +
    `<feGaussianBlur stdDeviation="${deviation}" result="b"/>` +
    '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
  )
}

/** Segmented context bar; a thin mark under the 50 / 60 % cells. */
export function segmentBarSvg(percent: number | undefined, color: string, width = 150): string {
  const seg = 6
  const gap = 2
  const barH = 9
  const count = Math.floor((width + gap) / (seg + gap))
  const lit = Math.round((clamp(percent) / 100) * count)
  let cells = ''
  for (let i = 0; i < count; i++) {
    const fill = i < lit ? color : C.track
    cells += `<rect x="${i * (seg + gap)}" y="1" width="${seg}" height="${barH}" fill="${fill}"/>`
  }
  const tick = (p: number, c: string) => {
    const x = Math.round((p / 100) * (count * (seg + gap) - gap))
    return `<rect x="${x - 0.5}" y="11" width="1" height="2" fill="${c}"/>`
  }
  return (
    `<svg ${NS} width="${width}" height="13" viewBox="0 0 ${width} 13">` +
    glow('sg') +
    `<g filter="url(#sg)">${cells}</g>` +
    tick(50, C.yellow) +
    tick(60, C.red) +
    '</svg>'
  )
}

/** Cache ring: fraction of the lifetime left, drawn clockwise from the top. */
export function ringSvg(fraction: number, color: string, size = 34): string {
  const r = size / 2 - 4
  const c = size / 2
  const len = 2 * Math.PI * r
  const on = Math.max(0, Math.min(1, fraction)) * len
  return (
    `<svg ${NS} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    glow('rg', 1.4) +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C.track}" stroke-width="3.5"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" ` +
    `stroke-dasharray="${on.toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 ${c} ${c})" filter="url(#rg)"/></svg>`
  )
}

/** Thin limit bar. */
export function miniBarSvg(percent: number | undefined, color: string, width = 44): string {
  const fill = (clamp(percent) / 100) * width
  return (
    `<svg ${NS} width="${width}" height="5" viewBox="0 0 ${width} 5">` +
    `<rect width="${width}" height="5" fill="${C.track}"/>` +
    `<rect width="${fill.toFixed(1)}" height="5" fill="${color}"/></svg>`
  )
}

/** Small dot; pulses when `pulse` is set (text cannot blink, an SVG can). */
export function dotSvg(color: string, pulse = false): string {
  const anim = pulse
    ? '<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>'
    : ''
  return (
    `<svg ${NS} width="12" height="12" viewBox="0 0 12 12">` +
    glow('dg', 1.5) +
    `<circle cx="6" cy="6" r="3.5" fill="${color}" filter="url(#dg)">${anim}</circle></svg>`
  )
}

/** Context history: line over the last points (percent values), with 50 / 60 % guides. */
export function historySvg(points: number[], color: string, width = 250, height = 60): string {
  const y = (p: number) => height - 4 - (clamp(p) / 100) * (height - 8)
  const guide = (p: number, c: string) =>
    `<line x1="0" y1="${y(p).toFixed(1)}" x2="${width}" y2="${y(p).toFixed(1)}" stroke="${c}" stroke-dasharray="3 3" opacity="0.6"/>`
  let line = ''
  if (points.length >= 2) {
    const step = (width - 8) / (points.length - 1)
    const pts = points.map((p, i) => `${(4 + i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
    const last = points[points.length - 1]
    line =
      `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" filter="url(#hg)"/>` +
      `<circle cx="${(width - 4).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="${C.magenta}"/>`
  }
  return (
    `<svg ${NS} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    glow('hg', 1.4) +
    guide(60, C.red) +
    guide(50, C.yellow) +
    line +
    '</svg>'
  )
}

/** Plan steps as blocks: done lit, the running one pulsing, the rest dark (max 12 shown). */
export function stepsSvg(done: number, total: number, isWorking: boolean): string {
  const n = Math.min(total, 12)
  const scale = total > 12 ? n / total : 1
  const lit = Math.round(done * scale)
  let cells = ''
  for (let i = 0; i < n; i++) {
    const x = i * 14
    if (i < lit) cells += `<rect x="${x}" y="2" width="11" height="6" fill="${C.cyan}"/>`
    else if (i === lit && isWorking)
      cells +=
        `<rect x="${x}" y="2" width="11" height="6" fill="${C.cyan}">` +
        '<animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite"/></rect>'
    else cells += `<rect x="${x}" y="2" width="11" height="6" fill="${C.track}"/>`
  }
  return `<svg ${NS} width="${n * 14}" height="10" viewBox="0 0 ${n * 14} 10">${cells}</svg>`
}
