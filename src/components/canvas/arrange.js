/**
 * Lining things up and spreading them out.
 *
 * Both work the same way: measure where each thing is, work out how far it has
 * to shift, then express that shift the way the element is placed -- `left`
 * and `top` for anything placed freely, a margin for anything still in the
 * flow. That way alignment works on a mixed selection without surprises.
 */

const shift = (item, dx, dy) => {
  const patch = {}
  if (item.free) {
    if (dx) patch.left = `${Math.round(item.off.left + dx)}px`
    if (dy) patch.top = `${Math.round(item.off.top + dy)}px`
  } else {
    if (dx) patch.marginLeft = `${Math.round(item.margin.left + dx)}px`
    if (dy) patch.marginTop = `${Math.round(item.margin.top + dy)}px`
  }
  return Object.keys(patch).length ? { id: item.id, patch } : null
}

export const ALIGNMENTS = [
  { id: 'left', label: 'Line up on the left', icon: 'AlignStartVertical', axis: 'x' },
  { id: 'centreX', label: 'Line up down the middle', icon: 'AlignCenterVertical', axis: 'x' },
  { id: 'right', label: 'Line up on the right', icon: 'AlignEndVertical', axis: 'x' },
  { id: 'top', label: 'Line up along the top', icon: 'AlignStartHorizontal', axis: 'y' },
  { id: 'centreY', label: 'Line up across the middle', icon: 'AlignCenterHorizontal', axis: 'y' },
  { id: 'bottom', label: 'Line up along the bottom', icon: 'AlignEndHorizontal', axis: 'y' },
]

/**
 * @param items  [{ id, free, bounds, off, margin }] measured in overlay pixels
 * @param group  the bounds everything is aligned inside
 */
export function alignEntries(items, kind, group, zoom) {
  const out = []
  for (const item of items) {
    const b = item.bounds
    let dx = 0
    let dy = 0
    if (kind === 'left') dx = group.left - b.left
    else if (kind === 'right') dx = group.right - b.right
    else if (kind === 'centreX') dx = (group.left + group.right) / 2 - (b.left + b.right) / 2
    else if (kind === 'top') dy = group.top - b.top
    else if (kind === 'bottom') dy = group.bottom - b.bottom
    else if (kind === 'centreY') dy = (group.top + group.bottom) / 2 - (b.top + b.bottom) / 2
    const entry = shift(item, dx / zoom, dy / zoom)
    if (entry) out.push(entry)
  }
  return out
}

/** Even gaps between the outermost two, everything else spread between them. */
export function distributeEntries(items, axis, zoom) {
  if (items.length < 3) return []
  const near = axis === 'x' ? 'left' : 'top'
  const far = axis === 'x' ? 'right' : 'bottom'
  const sorted = [...items].sort((a, b) => a.bounds[near] - b.bounds[near])

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = last.bounds[far] - first.bounds[near]
  const used = sorted.reduce((total, i) => total + (i.bounds[far] - i.bounds[near]), 0)
  const gap = (span - used) / (sorted.length - 1)

  const out = []
  let cursor = first.bounds[near]
  for (const item of sorted) {
    const size = item.bounds[far] - item.bounds[near]
    const delta = cursor - item.bounds[near]
    if (item !== first && item !== last) {
      const entry = axis === 'x' ? shift(item, delta / zoom, 0) : shift(item, 0, delta / zoom)
      if (entry) out.push(entry)
    }
    cursor += size + gap
  }
  return out
}
