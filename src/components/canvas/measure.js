/**
 * Measuring the live canvas.
 *
 * The canvas is real DOM inside a scaled stage, so every reading here converts
 * between three spaces:
 *   client  -- what getBoundingClientRect returns
 *   overlay -- the viewport's scrolled coordinate space, what the overlay draws in
 *   css     -- the numbers we write back into the document (overlay / zoom)
 */

import { flattenStyles } from '../../core/css.js'

export const nodeEl = (vp, id) => (vp && id ? vp.querySelector(`[data-node-id="${id}"]`) : null)

/** Pointer position in overlay space. */
export function overlayPoint(event, vp) {
  const r = vp.getBoundingClientRect()
  return { x: event.clientX - r.left + vp.scrollLeft, y: event.clientY - r.top + vp.scrollTop }
}

/** Client point -> overlay space. */
export function toOverlay(x, y, vp) {
  const r = vp.getBoundingClientRect()
  return { x: x - r.left + vp.scrollLeft, y: y - r.top + vp.scrollTop }
}

/** The rotation a node carries in the document, in degrees. */
export function angleOf(node, breakpoint) {
  const value = flattenStyles(node?.styles, breakpoint).rotate
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Layout size in css pixels -- unaffected by rotation, unlike the client rect. */
export function layoutSize(el, zoom) {
  const r = el.getBoundingClientRect()
  const w = el.offsetWidth || r.width / zoom
  const h = el.offsetHeight || r.height / zoom
  return { w, h }
}

/**
 * The oriented frame of an element in overlay space. The centre comes from the
 * client rect (rotation keeps it put) and the size from layout, so rotated
 * elements get a box that hugs them rather than their bounding square.
 */
export function frameOf(el, vp, zoom, angle = 0) {
  if (!el || !vp) return null
  const r = el.getBoundingClientRect()
  const vr = vp.getBoundingClientRect()
  const { w, h } = layoutSize(el, zoom)
  return {
    cx: r.left + r.width / 2 - vr.left + vp.scrollLeft,
    cy: r.top + r.height / 2 - vr.top + vp.scrollTop,
    w: w * zoom,
    h: h * zoom,
    angle,
  }
}

/** Plain, unrotated bounds of an element in overlay space. */
export function boxOf(el, vp, zoom) {
  const f = frameOf(el, vp, zoom, 0)
  return f && { left: f.cx - f.w / 2, top: f.cy - f.h / 2, right: f.cx + f.w / 2, bottom: f.cy + f.h / 2 }
}

const num = (v) => parseFloat(v) || 0

/** Padding of an element in css pixels. */
export function paddingOf(el) {
  const cs = getComputedStyle(el)
  return {
    top: num(cs.paddingTop), right: num(cs.paddingRight),
    bottom: num(cs.paddingBottom), left: num(cs.paddingLeft),
  }
}

export function borderOf(el) {
  const cs = getComputedStyle(el)
  return {
    top: num(cs.borderTopWidth), right: num(cs.borderRightWidth),
    bottom: num(cs.borderBottomWidth), left: num(cs.borderLeftWidth),
  }
}

/** The content box (inside padding and border) in overlay space. */
export function contentBox(el, vp, zoom) {
  const b = boxOf(el, vp, zoom)
  if (!b) return null
  const p = paddingOf(el)
  const bd = borderOf(el)
  return {
    left: b.left + (p.left + bd.left) * zoom,
    top: b.top + (p.top + bd.top) * zoom,
    right: b.right - (p.right + bd.right) * zoom,
    bottom: b.bottom - (p.bottom + bd.bottom) * zoom,
  }
}

/** The padding box (inside the border) -- what `position: absolute` measures from. */
export function paddingBox(el, vp, zoom) {
  const b = boxOf(el, vp, zoom)
  if (!b) return null
  const bd = borderOf(el)
  return {
    left: b.left + bd.left * zoom,
    top: b.top + bd.top * zoom,
    right: b.right - bd.right * zoom,
    bottom: b.bottom - bd.bottom * zoom,
  }
}

/**
 * Where an element sits inside a parent, in css pixels, as `left`/`top` would
 * need to be written for `position: absolute` to leave it exactly where it is.
 * Margins are subtracted because they still apply once positioned.
 */
export function offsetIn(el, parentEl, zoom) {
  const r = el.getBoundingClientRect()
  const pr = parentEl.getBoundingClientRect()
  const { w, h } = layoutSize(el, zoom)
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const pcs = getComputedStyle(parentEl)
  const ocs = getComputedStyle(el)
  return {
    left: (cx - (w * zoom) / 2 - pr.left) / zoom - num(pcs.borderLeftWidth) - num(ocs.marginLeft),
    top: (cy - (h * zoom) / 2 - pr.top) / zoom - num(pcs.borderTopWidth) - num(ocs.marginTop),
    width: w,
    height: h,
  }
}

/** The nearest ancestor element that is a document node. */
export const parentNodeEl = (el) => el?.parentElement?.closest('[data-node-id]') || null

/** Radius of one corner in css pixels. */
export function radiusOf(el, corner) {
  const cs = getComputedStyle(el)
  const map = { nw: 'borderTopLeftRadius', ne: 'borderTopRightRadius', se: 'borderBottomRightRadius', sw: 'borderBottomLeftRadius' }
  return num(cs[map[corner] || 'borderTopLeftRadius'])
}

export const RADIUS_PROP = {
  nw: 'borderTopLeftRadius', ne: 'borderTopRightRadius',
  se: 'borderBottomRightRadius', sw: 'borderBottomLeftRadius',
}

export function gapOf(el) {
  const cs = getComputedStyle(el)
  return { row: num(cs.rowGap), column: num(cs.columnGap) }
}

/** Is this container laying its children out in a row? */
export function isRowFlow(el) {
  const cs = getComputedStyle(el)
  if (cs.display === 'flex' || cs.display === 'inline-flex') return cs.flexDirection.startsWith('row')
  if (cs.display === 'grid') return true
  return false
}
