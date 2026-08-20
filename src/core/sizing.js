/**
 * Sizing and pinning -- the two ideas that decide how a design behaves when
 * the screen changes size.
 *
 * Instead of asking someone to know that `flex: 1` means one thing in a row
 * and another in a column, every element gets one question per axis: should
 * this be an exact size, fill the space, or hug its contents? The answer is
 * turned into whichever CSS actually does that in the box it happens to sit in.
 */

export const SIZE_MODES = [
  { id: 'fixed', label: 'Exact', hint: 'A set number of pixels.' },
  { id: 'fill', label: 'Fill', hint: 'Take up whatever room is left over.' },
  { id: 'fit', label: 'Hug', hint: 'Only as big as the things inside.' },
  { id: 'relative', label: 'Share', hint: 'A percentage of the box around it.' },
  { id: 'viewport', label: 'Screen', hint: 'A percentage of the screen.' },
]

const AXIS = {
  x: { size: 'width', min: 'minWidth', max: 'maxWidth', vw: 'vw' },
  y: { size: 'height', min: 'minHeight', max: 'maxHeight', vw: 'vh' },
}

/** Is this axis the one the parent stack arranges along? */
export const isMainAxis = (axis, ctx) => !!ctx.parentIsFlex && (axis === 'x' ? ctx.parentRow : !ctx.parentRow)

/**
 * Work out which of the five modes the current CSS amounts to.
 * Reading is deliberately forgiving: hand-written CSS still lands somewhere
 * sensible rather than throwing the controls into a confused state.
 */
export function readSizeMode(style = {}, axis, ctx = {}) {
  const key = AXIS[axis].size
  const value = style[key]
  const main = isMainAxis(axis, ctx)

  if (main) {
    const flex = String(style.flex ?? '').trim()
    if (flex && flex !== '0 0 auto' && flex !== 'none' && !flex.startsWith('0 0')) return 'fill'
  }
  if (value === undefined || value === null || value === '' || value === 'auto') {
    if (!main && ctx.parentIsFlex && style.alignSelf === 'stretch') return 'fill'
    return 'fit'
  }
  if (value === '100%' && !main) return 'fill'
  if (/(vw|vh|svh|dvh|lvh)$/.test(value)) return 'viewport'
  if (/%$/.test(value)) return 'relative'
  return 'fixed'
}

/**
 * The CSS for a mode. Returns a patch, with '' meaning "drop this property".
 * @param measured  the element's current pixel size, so switching to an exact
 *                  size keeps it exactly where it already is
 */
export function writeSizeMode(mode, axis, ctx = {}, measured = 0) {
  const key = AXIS[axis].size
  const main = isMainAxis(axis, ctx)
  const patch = { [key]: '' }
  if (main) patch.flex = ''
  if (!main && ctx.parentIsFlex) patch.alignSelf = ''

  if (mode === 'fixed') {
    patch[key] = `${Math.round(measured) || 100}px`
    if (main) patch.flex = '0 0 auto'
  } else if (mode === 'fill') {
    if (main) patch.flex = '1 1 0%'
    else patch[key] = '100%'
  } else if (mode === 'fit') {
    patch[key] = 'auto'
    if (main) patch.flex = '0 0 auto'
  } else if (mode === 'relative') {
    patch[key] = '50%'
    if (main) patch.flex = '0 0 auto'
  } else if (mode === 'viewport') {
    patch[key] = `100${AXIS[axis].vw}`
    if (main) patch.flex = '0 0 auto'
  }
  return patch
}

/* ------------------------------------------------------------------ pins */

/**
 * Which edges a freely placed element is measured from. Pinning to the right
 * keeps a thing that many pixels from the right edge however wide the page
 * gets, which is the whole point of placing something by hand and still
 * having it survive a phone.
 */
export const PINS = {
  x: [
    { id: 'near', label: 'Measured from the left', icon: 'AlignStartVertical' },
    { id: 'centre', label: 'Centred across', icon: 'AlignCenterVertical' },
    { id: 'far', label: 'Measured from the right', icon: 'AlignEndVertical' },
    { id: 'both', label: 'Held to both sides', icon: 'MoveHorizontal' },
  ],
  y: [
    { id: 'near', label: 'Measured from the top', icon: 'AlignStartHorizontal' },
    { id: 'centre', label: 'Centred down', icon: 'AlignCenterHorizontal' },
    { id: 'far', label: 'Measured from the bottom', icon: 'AlignEndHorizontal' },
    { id: 'both', label: 'Held to top and bottom', icon: 'MoveVertical' },
  ],
}

const set = (v) => v !== undefined && v !== null && v !== '' && v !== 'auto'

/** Which edge (or edges) an element is currently measured from. */
export function readPin(style = {}, axis) {
  const [near, far] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom']
  const hasNear = set(style[near])
  const hasFar = set(style[far])
  if (hasNear && hasFar) return 'both'
  if (hasFar) return 'far'
  // Centred reads as "half way, then nudged": 50% or calc(50% + 20px).
  if (hasNear && /^(50%|calc\(\s*50%)/.test(String(style[near]).trim())) return 'centre'
  return 'near'
}

/**
 * Move the pins without moving the element: offsets are recomputed against
 * whichever edges are now in play, so switching from "from the left" to
 * "from the right" leaves it exactly where it was sitting.
 *
 * Both axes are written together because centring uses `translate`, and that
 * one property covers across and down at once.
 *
 * @param pins    { x: 'near'|'centre'|'far'|'both', y: same }
 * @param box     { left, top, width, height } inside the parent, in css px
 * @param parent  { width, height } of the parent's inner box, in css px
 */
export function pinPatch(pins, box, parent) {
  const patch = {}
  const axes = [
    { key: 'x', pin: pins.x, near: 'left', far: 'right', start: box.left, size: box.width, room: parent.width, dim: 'width' },
    { key: 'y', pin: pins.y, near: 'top', far: 'bottom', start: box.top, size: box.height, room: parent.height, dim: 'height' },
  ]

  for (const a of axes) {
    const end = a.room - a.start - a.size
    patch[a.near] = ''
    patch[a.far] = ''
    if (a.pin === 'near') patch[a.near] = `${Math.round(a.start)}px`
    else if (a.pin === 'far') patch[a.far] = `${Math.round(end)}px`
    else if (a.pin === 'both') {
      patch[a.near] = `${Math.round(a.start)}px`
      patch[a.far] = `${Math.round(end)}px`
      patch[a.dim] = 'auto'
    } else if (a.pin === 'centre') {
      patch[a.near] = '50%'
    }
  }

  const centred = pins.x === 'centre' || pins.y === 'centre'
  patch.translate = centred
    ? `${pins.x === 'centre' ? '-50%' : '0'} ${pins.y === 'centre' ? '-50%' : '0'}`
    : ''
  return patch
}

/** The offset property a drag should write, given how the element is pinned. */
export function pinnedEdge(style, axis) {
  const pin = readPin(style, axis)
  if (pin === 'far') return axis === 'x' ? 'right' : 'bottom'
  return axis === 'x' ? 'left' : 'top'
}
