/**
 * Geometry for direct manipulation on the canvas.
 *
 * Everything here is pure maths in "overlay space" -- pixels as they appear on
 * screen, with the canvas zoom already baked in. Turning that into the CSS
 * pixels written back into the document is one divide by the zoom, done by the
 * caller at the last moment.
 *
 * A *frame* is an oriented box: { cx, cy, w, h, angle }. Rotation is about the
 * centre, which is what the browser does too, so a rotated element's centre is
 * the one point that never moves.
 */

export const DEG = Math.PI / 180

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** Rotate a vector by `angle` degrees. */
export function rotate(x, y, angle) {
  if (!angle) return { x, y }
  const a = angle * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

/* --------------------------------------------------------------- frames */

/** The eight resize handles, as unit directions out from the centre. */
export const HANDLES = [
  { id: 'nw', x: -1, y: -1 }, { id: 'n', x: 0, y: -1 }, { id: 'ne', x: 1, y: -1 },
  { id: 'w', x: -1, y: 0 }, { id: 'e', x: 1, y: 0 },
  { id: 'sw', x: -1, y: 1 }, { id: 's', x: 0, y: 1 }, { id: 'se', x: 1, y: 1 },
]

export const CORNERS = HANDLES.filter((h) => h.x && h.y)

export const handleDir = (id) => HANDLES.find((h) => h.id === id) || HANDLES[0]

/** Mouse cursor for a handle, turned to match the frame's rotation. */
export function handleCursor(dir, angle = 0) {
  const base = (Math.atan2(dir.y, dir.x) / DEG + angle + 360) % 180
  const names = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
  return names[Math.round(base / 45) % 4]
}

/** A point on the frame, given a unit direction from its centre. */
export function framePoint(f, dx, dy) {
  const p = rotate((dx * f.w) / 2, (dy * f.h) / 2, f.angle)
  return { x: f.cx + p.x, y: f.cy + p.y }
}

export const frameCorners = (f) =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => framePoint(f, x, y))

/** Axis-aligned bounds of a frame, rotation included. */
export function frameBounds(f) {
  const pts = frameCorners(f)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

export function boundsOf(frames) {
  const all = frames.map(frameBounds)
  return {
    left: Math.min(...all.map((b) => b.left)),
    top: Math.min(...all.map((b) => b.top)),
    right: Math.max(...all.map((b) => b.right)),
    bottom: Math.max(...all.map((b) => b.bottom)),
  }
}

export const rectOfBounds = (b) => ({ left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top })

export const boundsIntersect = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/* --------------------------------------------------------------- resize */

/**
 * Resize a frame by dragging `handleId` with a screen-space delta.
 * `aspect` keeps the proportions, `fromCentre` grows both ways at once.
 */
export function resizeFrame(f, handleId, dx, dy, opts = {}) {
  const { aspect = false, fromCentre = false, min = 1 } = opts
  const dir = handleDir(handleId)
  const local = rotate(dx, dy, -f.angle)
  const grow = fromCentre ? 2 : 1

  let w = dir.x ? f.w + local.x * dir.x * grow : f.w
  let h = dir.y ? f.h + local.y * dir.y * grow : f.h

  if (aspect && f.w > 0 && f.h > 0) {
    const ratio = f.w / f.h
    if (!dir.y) h = w / ratio
    else if (!dir.x) w = h * ratio
    else if (Math.abs(w - f.w) >= Math.abs(h - f.h)) h = w / ratio
    else w = h * ratio
  }

  w = Math.max(min, w)
  h = Math.max(min, h)

  let { cx, cy } = f
  if (!fromCentre) {
    // The opposite edge stays put, so the centre moves by half of the growth.
    const shift = rotate((dir.x * (w - f.w)) / 2, (dir.y * (h - f.h)) / 2, f.angle)
    cx += shift.x
    cy += shift.y
  }
  return { ...f, w, h, cx, cy }
}

/** Angle in degrees from a centre to a point, with 0 pointing up. */
export const angleTo = (cx, cy, x, y) => Math.atan2(y - cy, x - cx) / DEG + 90

/* -------------------------------------------------------------- snapping */

/**
 * Lines worth snapping to, gathered from a list of bounds. Each rect offers
 * its two edges and its middle on both axes.
 */
export function snapTargets(rects) {
  const x = []
  const y = []
  for (const r of rects) {
    x.push({ value: r.left, rect: r }, { value: (r.left + r.right) / 2, rect: r, centre: true }, { value: r.right, rect: r })
    y.push({ value: r.top, rect: r }, { value: (r.top + r.bottom) / 2, rect: r, centre: true }, { value: r.bottom, rect: r })
  }
  return { x, y }
}

/** Closest target for any of `own`'s lines, within `threshold` pixels. */
function bestSnap(own, targets, threshold) {
  let delta = null
  let dist = threshold
  let hits = []
  for (const o of own) {
    for (const t of targets) {
      const d = t.value - o.value
      const ad = Math.abs(d)
      if (ad > threshold) continue
      if (delta === null || ad < dist - 0.01) {
        delta = d
        dist = ad
        hits = [{ own: o, target: t }]
      } else if (Math.abs(d - delta) < 0.01) {
        hits.push({ own: o, target: t })
      }
    }
  }
  return delta === null ? null : { delta, hits }
}

const linesOf = (b, axis) => (axis === 'x'
  ? [{ value: b.left }, { value: (b.left + b.right) / 2 }, { value: b.right }]
  : [{ value: b.top }, { value: (b.top + b.bottom) / 2 }, { value: b.bottom }])

/**
 * Snap a moving box. Returns the nudge to apply and the guides to draw.
 * Falls back to a pixel grid on any axis nothing else caught.
 */
export function snapMove(bounds, targets, threshold, grid = 0) {
  const sx = bestSnap(linesOf(bounds, 'x'), targets.x, threshold)
  const sy = bestSnap(linesOf(bounds, 'y'), targets.y, threshold)

  let dx = sx ? sx.delta : 0
  let dy = sy ? sy.delta : 0
  if (!sx && grid) dx = Math.round(bounds.left / grid) * grid - bounds.left
  if (!sy && grid) dy = Math.round(bounds.top / grid) * grid - bounds.top

  const moved = { left: bounds.left + dx, right: bounds.right + dx, top: bounds.top + dy, bottom: bounds.bottom + dy }
  return { dx, dy, guides: guidesFor(sx, sy, moved) }
}

/** Snap one edge while resizing -- only the edge being dragged moves. */
export function snapEdge(value, targets, threshold, grid = 0) {
  const hit = bestSnap([{ value }], targets, threshold)
  if (hit) return { delta: hit.delta, hits: hit.hits }
  if (grid) return { delta: Math.round(value / grid) * grid - value, hits: [] }
  return { delta: 0, hits: [] }
}

export function guidesFor(sx, sy, moved) {
  const guides = []
  for (const hit of sx?.hits || []) {
    const r = hit.target.rect
    guides.push({
      axis: 'x',
      value: hit.target.value,
      from: Math.min(moved.top, r.top),
      to: Math.max(moved.bottom, r.bottom),
      centre: !!hit.target.centre,
    })
  }
  for (const hit of sy?.hits || []) {
    const r = hit.target.rect
    guides.push({
      axis: 'y',
      value: hit.target.value,
      from: Math.min(moved.left, r.left),
      to: Math.max(moved.right, r.right),
      centre: !!hit.target.centre,
    })
  }
  return guides
}

/* ------------------------------------------------------------- distances */

const midSpan = (a1, a2, b1, b2) => {
  const lo = Math.max(Math.min(a1, a2), Math.min(b1, b2))
  const hi = Math.min(Math.max(a1, a2), Math.max(b1, b2))
  return lo <= hi ? (lo + hi) / 2 : (a1 + a2 + b1 + b2) / 4
}

/**
 * The gap between two boxes on each axis, with the segment to draw for it.
 * Feeds the measuring overlay (hold Alt) and the spacing badges.
 */
export function gapBetween(a, b) {
  const out = []
  if (a.right < b.left) out.push({ axis: 'x', size: b.left - a.right, from: a.right, to: b.left, at: midSpan(a.top, a.bottom, b.top, b.bottom) })
  else if (b.right < a.left) out.push({ axis: 'x', size: a.left - b.right, from: b.right, to: a.left, at: midSpan(a.top, a.bottom, b.top, b.bottom) })
  if (a.bottom < b.top) out.push({ axis: 'y', size: b.top - a.bottom, from: a.bottom, to: b.top, at: midSpan(a.left, a.right, b.left, b.right) })
  else if (b.bottom < a.top) out.push({ axis: 'y', size: a.top - b.bottom, from: b.bottom, to: a.top, at: midSpan(a.left, a.right, b.left, b.right) })
  return out
}

/* -------------------------------------------------------------- rounding */

/** Round to a sensible number of decimals for a CSS length. */
export const px = (n) => `${Math.round(n * 10) / 10}px`
export const deg = (n) => `${Math.round(n * 10) / 10}deg`
