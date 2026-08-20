/**
 * Direct manipulation on the canvas.
 *
 * One engine owns every pointer gesture -- moving, resizing, rotating,
 * rounding, padding, spacing, marquee and panning. Two ideas keep it honest:
 *
 *  1. While the pointer is down nothing is written to the document. The engine
 *     paints the change straight onto the DOM (inline styles) so dragging is
 *     as smooth as the browser can manage, then writes the result once, on
 *     release, as a single undo step.
 *
 *  2. How a drag behaves is decided by the *parent*, exactly the way a person
 *     would expect: children of a stack or grid reorder, children of a plain
 *     box are placed freely. Holding Cmd/Ctrl swaps the two.
 */

import { useRef } from 'react'
import { useStore } from '../../core/store.js'
import { getNode, contains } from '../../core/doc.js'
import { def } from '../../core/elements.js'
import { flattenStyles, isFree } from '../../core/css.js'
import { readPin } from '../../core/sizing.js'
import * as G from '../../core/geom.js'
import {
  nodeEl, overlayPoint, frameOf, boxOf, offsetIn, parentNodeEl,
  paddingOf, contentBox, paddingBox, radiusOf, RADIUS_PROP, gapOf,
  isRowFlow, layoutSize,
} from './measure.js'

/** The px pair a `translate` currently resolves to, or zero. */
function translateOf(el) {
  const value = getComputedStyle(el).translate
  if (!value || value === 'none') return { x: 0, y: 0 }
  const parts = value.split(/\s+/)
  return { x: parseFloat(parts[0]) || 0, y: parseFloat(parts[1]) || 0 }
}

/**
 * Where a moved element's offsets should be written, honouring how it is
 * pinned. Something measured from the right edge stays measured from the
 * right edge, so it keeps its place when the page changes width.
 */
function offsetPatch(item, left, top) {
  const patch = {}
  const room = item.parentInner
  const axes = [
    { pin: item.pins.x, near: 'left', far: 'right', start: left, size: item.off.width, room: room.width },
    { pin: item.pins.y, near: 'top', far: 'bottom', start: top, size: item.off.height, room: room.height },
  ]
  for (const a of axes) {
    const end = a.room - a.start - a.size
    if (a.pin === 'far') patch[a.far] = G.px(end)
    else if (a.pin === 'both') {
      patch[a.near] = G.px(a.start)
      patch[a.far] = G.px(end)
    } else if (a.pin === 'centre') {
      const fromMiddle = a.start + a.size / 2 - a.room / 2
      patch[a.near] = `calc(50% + ${Math.round(fromMiddle)}px)`
    } else {
      patch[a.near] = G.px(a.start)
    }
  }
  return patch
}

const DRAG_THRESHOLD = 3
const SNAP_RANGE = 6
const LINE = 3

const numOf = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** Stacks and grids arrange their children; a plain box lets them sit anywhere. */
export function isStack(el) {
  if (!el) return false
  const display = getComputedStyle(el).display
  return display === 'flex' || display === 'inline-flex' || display === 'grid' || display === 'inline-grid'
}

/* ------------------------------------------------------------ drop spots */

/**
 * The deepest container under a point that is willing to accept children.
 * Returns null when the point is over nothing -- callers decide what that
 * means, because "drop it on the page" and "leave it where it is" are very
 * different answers.
 */
export function containerAt(vp, root, clientX, clientY) {
  const point = document.elementFromPoint(clientX, clientY)
  let el = point?.closest?.('[data-node-id]') || null
  while (el) {
    const node = getNode(root, el.dataset.nodeId)
    if (node && def(node.type).container && node.type !== 'select' && !node.locked) return el
    el = el.parentElement?.closest('[data-node-id]') || null
  }
  return null
}

/**
 * Where would something dropped here land? Returns the parent, the index
 * among its children, and the line or box to draw for it.
 */
export function dropSpot(vp, root, clientX, clientY, opts = {}) {
  const rootEl = nodeEl(vp, root.id)
  if (!vp || !rootEl) return null

  const containerEl = opts.blockMode ? rootEl : (containerAt(vp, root, clientX, clientY) || rootEl)
  const parentId = containerEl.dataset.nodeId
  const exclude = new Set(opts.exclude || [])

  const kids = Array.from(containerEl.children).filter((c) => {
    const id = c.dataset?.nodeId
    if (!id || exclude.has(id)) return false
    const position = getComputedStyle(c).position
    return position !== 'absolute' && position !== 'fixed'
  })

  const vpRect = vp.getBoundingClientRect()
  const toLocal = (r) => ({
    top: r.top - vpRect.top + vp.scrollTop,
    left: r.left - vpRect.left + vp.scrollLeft,
    width: r.width,
    height: r.height,
  })

  if (!kids.length) {
    return { parentId, index: 0, indicator: { ...toLocal(containerEl.getBoundingClientRect()), box: true } }
  }

  const rects = kids.map((k) => k.getBoundingClientRect())
  const horizontal = rects.length > 1
    ? rects[1].left >= rects[0].right - 2
    : /row/.test(getComputedStyle(containerEl).flexDirection || '')

  let index = 0
  for (let i = 0; i < rects.length; i++) {
    const centre = horizontal ? rects[i].left + rects[i].width / 2 : rects[i].top + rects[i].height / 2
    const pointer = horizontal ? clientX : clientY
    if (pointer > centre) index = i + 1
  }

  // The index counts flowing children only; translate it back to the real one.
  const all = Array.from(containerEl.children).filter((c) => c.dataset?.nodeId)
  const anchor = kids[Math.min(index, kids.length - 1)]
  let realIndex = all.indexOf(anchor)
  if (index >= kids.length) realIndex = all.indexOf(kids[kids.length - 1]) + 1

  const container = toLocal(containerEl.getBoundingClientRect())
  const before = index === 0 ? null : toLocal(rects[index - 1])
  const after = index < rects.length ? toLocal(rects[index]) : null

  const indicator = horizontal
    ? {
      top: container.top + 4,
      left: (before ? before.left + before.width : after.left) - LINE / 2,
      width: LINE,
      height: Math.max(container.height - 8, 24),
    }
    : {
      top: (before ? before.top + before.height : after.top) - LINE / 2,
      left: container.left + 4,
      width: Math.max(container.width - 8, 24),
      height: LINE,
    }

  return { parentId, index: realIndex, indicator }
}

/* --------------------------------------------------------------- engine */

function createEngine(viewportRef) {
  let g = null // the gesture in flight
  const engineState = { space: false } // Space held down means "slide the canvas"

  const store = () => useStore.getState()
  const vp = () => viewportRef.current

  /* ---- live preview, painted straight onto the DOM ---- */

  const paint = (el, css) => {
    if (!g || !el) return
    if (!g.painted.has(el)) g.painted.set(el, el.getAttribute('style'))
    for (const [key, value] of Object.entries(css)) el.style[key] = value
  }

  const restore = (painted) => {
    for (const [el, previous] of painted) {
      if (previous === null) el.removeAttribute('style')
      else el.setAttribute('style', previous)
    }
  }

  /* ---- lifecycle ---- */

  const onPointerMove = (event) => {
    const view = vp()
    if (!g || !view) return
    g.pointer = overlayPoint(event, view)
    // A plain snapshot, so a modifier pressed mid-drag can replay the last move.
    g.event = {
      clientX: event.clientX, clientY: event.clientY,
      shiftKey: event.shiftKey, altKey: event.altKey,
      metaKey: event.metaKey, ctrlKey: event.ctrlKey,
    }
    g.move(g.event)
  }

  const onPointerUp = () => stop(true)

  const onKeyDown = (event) => {
    if (!g) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      stop(false)
      return
    }
    // Modifiers change what a drag means, so replay the last move as they go.
    if (['Shift', 'Alt', 'Meta', 'Control'].includes(event.key) && g.event && g.moved) {
      g.event = {
        ...g.event,
        shiftKey: event.shiftKey, altKey: event.altKey,
        metaKey: event.metaKey, ctrlKey: event.ctrlKey,
      }
      g.move(g.event)
    }
  }

  const onKeyUp = onKeyDown

  function start(gesture) {
    if (g) stop(false)
    g = { painted: new Map(), moved: false, ...gesture }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    store().setGesture({ kind: g.kind, ids: g.ids || [] })
  }

  function stop(commit) {
    if (!g) return
    const current = g
    g = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)

    if (commit && current.moved) current.commit?.(current)
    // Put the DOM back the way it was; the document now carries the change.
    requestAnimationFrame(() => restore(current.painted))
    store().setGesture(null)
    store().sealHistory()
    current.done?.(commit && current.moved)
  }

  const show = (patch) => store().setGesture({ kind: g.kind, ids: g.ids || [], ...patch })

  /* ---- what is being dragged ---- */

  function collect(ids) {
    const view = vp()
    const state = store()
    const page = state.activePage()
    const zoom = state.zoom
    const breakpoint = state.breakpoint
    return ids.map((id) => {
      const el = nodeEl(view, id)
      const node = getNode(page.root, id)
      if (!el || !node || node.locked || node.type === 'page') return null
      const style = flattenStyles(node.styles, breakpoint)
      const parentEl = parentNodeEl(el)
      if (!parentEl) return null
      const cs = getComputedStyle(el)
      const inner = paddingBox(parentEl, view, zoom)
      return {
        id,
        el,
        node,
        style,
        parentEl,
        parentId: parentEl.dataset.nodeId,
        free: isFree(style),
        frame: frameOf(el, view, zoom, numOf(style.rotate)),
        off: offsetIn(el, parentEl, zoom),
        margin: { left: numOf(cs.marginLeft), top: numOf(cs.marginTop) },
        pins: { x: readPin(style, 'x'), y: readPin(style, 'y') },
        shift: translateOf(el),
        parentInner: inner
          ? { width: (inner.right - inner.left) / zoom, height: (inner.bottom - inner.top) / zoom }
          : { width: 0, height: 0 },
      }
    }).filter(Boolean)
  }

  /** Edges and middles worth snapping to: the parent box and the neighbours. */
  function snapTargetsFor(items) {
    const view = vp()
    const zoom = store().zoom
    const rects = []
    const moving = new Set(items.map((i) => i.id))
    const parents = new Set(items.map((i) => i.parentId))
    for (const pid of parents) {
      const pel = nodeEl(view, pid)
      if (!pel) continue
      const cb = contentBox(pel, view, zoom)
      if (cb) rects.push(cb)
      for (const child of pel.children) {
        const cid = child.dataset?.nodeId
        if (!cid || moving.has(cid)) continue
        const b = boxOf(child, view, zoom)
        if (b) rects.push(b)
      }
    }
    return { targets: G.snapTargets(rects), rects }
  }

  /* ------------------------------------------------------------- moving */

  function startMove(event, { ids, duplicate = false }) {
    const view = vp()
    const state = store()
    const items = collect(ids)
    if (!view || !items.length) return

    const primary = items[0]
    const naturallyFree = items.every((i) => i.free || !isStack(i.parentEl))
    const { targets } = snapTargetsFor(items)

    start({
      kind: 'move',
      ids: items.map((i) => i.id),
      items,
      duplicate,
      naturallyFree,
      targets,
      bounds: G.boundsOf(items.map((i) => i.frame)),
      start: overlayPoint(event, view),
      dx: 0,
      dy: 0,

      move(e) {
        const zoom = store().zoom
        let dx = g.pointer.x - g.start.x
        let dy = g.pointer.y - g.start.y

        if (!g.moved) {
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
          g.moved = true
          // Let the pointer see straight through what it is dragging.
          for (const it of g.items) paint(it.el, { pointerEvents: 'none' })
        }

        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }

        const swap = e.metaKey || e.ctrlKey
        const free = swap ? !g.naturallyFree : g.naturallyFree
        g.free = free
        g.duplicate = e.altKey

        let guides = []
        if (free && store().snap) {
          const moved = {
            left: g.bounds.left + dx, right: g.bounds.right + dx,
            top: g.bounds.top + dy, bottom: g.bounds.bottom + dy,
          }
          const snapped = G.snapMove(moved, g.targets, SNAP_RANGE, store().snapGrid * zoom)
          dx += snapped.dx
          dy += snapped.dy
          guides = snapped.guides
        }

        g.dx = dx
        g.dy = dy
        for (const it of g.items) {
          paint(it.el, {
            translate: `${it.shift.x + dx}px ${it.shift.y + dy}px`,
            opacity: free ? '' : '0.55',
          })
        }

        if (free) {
          // Only re-home it when the pointer is genuinely over another box.
          g.over = containerAt(view, store().activePage().root, e.clientX, e.clientY)
          g.overParentId = g.over?.dataset?.nodeId || null
          const home = g.overParentId && g.overParentId !== primary.parentId ? g.overParentId : null
          g.drop = null
          show({
            guides,
            free: true,
            intoId: home,
            hud: {
              x: g.pointer.x, y: g.pointer.y,
              text: `${Math.round(primary.off.left + dx / zoom)}  ${Math.round(primary.off.top + dy / zoom)}`,
            },
          })
        } else {
          g.drop = dropSpot(view, store().activePage().root, e.clientX, e.clientY, { exclude: g.ids })
          show({ guides: [], free: false, drop: g.drop, hud: null })
        }
      },

      commit(cur) {
        const state2 = store()
        const zoom = state2.zoom
        const styles = []
        const moves = []
        const copies = cur.duplicate ? cur.items.map((i) => i.id) : null

        if (cur.free) {
          const parentsSeen = new Set()
          for (const it of cur.items) {
            let parentId = it.parentId
            let left = it.off.left + cur.dx / zoom
            let top = it.off.top + cur.dy / zoom

            if (cur.overParentId && cur.overParentId !== it.parentId && !contains(it.node, cur.overParentId)) {
              const pel = nodeEl(view, cur.overParentId)
              const pb = pel && paddingBox(pel, view, zoom)
              if (pb) {
                left = (it.frame.cx + cur.dx - it.frame.w / 2 - pb.left) / zoom - it.margin.left
                top = (it.frame.cy + cur.dy - it.frame.h / 2 - pb.top) / zoom - it.margin.top
                parentId = cur.overParentId
                moves.push({ id: it.id, parentId, index: null })
              }
            }

            const patch = { position: 'absolute', ...offsetPatch(it, left, top) }
            // Out of the flow, a box no longer stretches -- keep the size it had.
            if (!it.style.width) patch.width = G.px(it.off.width)
            if (!it.style.height && def(it.node.type).container && it.node.children?.length) {
              patch.height = G.px(it.off.height)
            }
            styles.push({ id: it.id, patch })
            parentsSeen.add(parentId)
          }

          for (const pid of parentsSeen) {
            const pel = nodeEl(view, pid)
            if (!pel) continue
            const patch = {}
            if (getComputedStyle(pel).position === 'static') patch.position = 'relative'
            // A box holding nothing but free children would collapse otherwise.
            const stillFlowing = Array.from(pel.children).some((c) => {
              const cid = c.dataset?.nodeId
              if (!cid || cur.items.some((i) => i.id === cid)) return false
              const p = getComputedStyle(c).position
              return p !== 'absolute' && p !== 'fixed'
            })
            if (!stillFlowing) {
              const size = layoutSize(pel, zoom)
              patch.minHeight = G.px(size.h)
            }
            if (Object.keys(patch).length) styles.push({ id: pid, patch, bucket: 'base' })
          }

          state2.applyEdit({ label: copies ? 'Copy' : 'Move', moves, styles, duplicate: copies })
        } else if (cur.drop) {
          cur.items.forEach((it, i) => {
            moves.push({ id: it.id, parentId: cur.drop.parentId, index: cur.drop.index + i })
          })
          state2.applyEdit({ label: copies ? 'Copy' : 'Move', moves, duplicate: copies })
        }
      },
    })
  }

  /* ----------------------------------------------------------- resizing */

  function startResize(event, { ids, handle }) {
    const view = vp()
    const items = collect(ids)
    if (!view || !items.length) return
    const single = items.length === 1
    const { targets } = snapTargetsFor(items)

    start({
      kind: 'resize',
      ids: items.map((i) => i.id),
      items,
      handle,
      targets,
      bounds: G.boundsOf(items.map((i) => i.frame)),
      start: overlayPoint(event, view),

      move(e) {
        const zoom = store().zoom
        const dir = G.handleDir(handle)
        let dx = g.pointer.x - g.start.x
        let dy = g.pointer.y - g.start.y

        if (!g.moved) {
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
          g.moved = true
        }

        const opts = { aspect: e.shiftKey, fromCentre: e.altKey, min: 4 }
        let guides = []

        // Snap the edge being dragged, but only when nothing is rotated.
        if (store().snap && single && !items[0].frame.angle) {
          const f = items[0].frame
          if (dir.x) {
            const edge = f.cx + (dir.x * f.w) / 2 + dx
            const hit = G.snapEdge(edge, g.targets.x, SNAP_RANGE, store().snapGrid * zoom)
            dx += hit.delta
            guides = guides.concat(G.guidesFor({ hits: hit.hits }, null, { top: f.cy - f.h / 2, bottom: f.cy + f.h / 2, left: 0, right: 0 }))
          }
          if (dir.y) {
            const edge = f.cy + (dir.y * f.h) / 2 + dy
            const hit = G.snapEdge(edge, g.targets.y, SNAP_RANGE, store().snapGrid * zoom)
            dy += hit.delta
            guides = guides.concat(G.guidesFor(null, { hits: hit.hits }, { left: f.cx - f.w / 2, right: f.cx + f.w / 2, top: 0, bottom: 0 }))
          }
        }

        g.dx = dx
        g.dy = dy
        g.results = []

        if (single) {
          const it = items[0]
          const next = G.resizeFrame(it.frame, handle, dx, dy, opts)
          g.results.push({ item: it, w: next.w / zoom, h: next.h / zoom, frame: next })
        } else {
          // Several at once: scale the group's box and take everything with it.
          const b = g.bounds
          const box = { cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2, w: b.right - b.left, h: b.bottom - b.top, angle: 0 }
          const next = G.resizeFrame(box, handle, dx, dy, opts)
          const sx = box.w ? next.w / box.w : 1
          const sy = box.h ? next.h / box.h : 1
          const originX = next.cx - next.w / 2
          const originY = next.cy - next.h / 2
          for (const it of items) {
            const f = it.frame
            const w = f.w * sx
            const h = f.h * sy
            const cx = originX + (f.cx - b.left) * sx
            const cy = originY + (f.cy - b.top) * sy
            g.results.push({ item: it, w: w / zoom, h: h / zoom, frame: { ...f, w, h, cx, cy } })
          }
        }

        for (const r of g.results) {
          const css = { width: G.px(r.w), height: G.px(r.h) }
          const dw = r.frame.w - r.item.frame.w
          const dh = r.frame.h - r.item.frame.h
          if (r.item.free) {
            css.left = G.px(r.item.off.left + (r.frame.cx - r.frame.w / 2 - (r.item.frame.cx - r.item.frame.w / 2)) / zoom)
            css.top = G.px(r.item.off.top + (r.frame.cy - r.frame.h / 2 - (r.item.frame.cy - r.item.frame.h / 2)) / zoom)
          } else {
            // In a stack the box grows to the right and down, so pull it back
            // with a margin when the handle being dragged is on the far side.
            if (G.handleDir(handle).x < 0) css.marginLeft = G.px(r.item.margin.left - dw / zoom)
            if (G.handleDir(handle).y < 0) css.marginTop = G.px(r.item.margin.top - dh / zoom)
          }
          paint(r.item.el, css)
        }

        const lead = g.results[0]
        show({
          guides,
          hud: { x: g.pointer.x, y: g.pointer.y, text: `${Math.round(lead.w)} x ${Math.round(lead.h)}` },
        })
      },

      commit(cur) {
        const zoom = store().zoom
        const styles = cur.results.map((r) => {
          const patch = { width: G.px(r.w), height: G.px(r.h) }
          const dw = (r.frame.w - r.item.frame.w) / zoom
          const dh = (r.frame.h - r.item.frame.h) / zoom
          if (r.item.free) {
            // Anything held to the far edge keeps that hold; only its size changes.
            if (r.item.pins.x === 'near' || r.item.pins.x === 'centre') {
              patch.left = G.px(r.item.off.left + (r.frame.cx - r.frame.w / 2 - (r.item.frame.cx - r.item.frame.w / 2)) / zoom)
            }
            if (r.item.pins.y === 'near' || r.item.pins.y === 'centre') {
              patch.top = G.px(r.item.off.top + (r.frame.cy - r.frame.h / 2 - (r.item.frame.cy - r.item.frame.h / 2)) / zoom)
            }
          } else {
            if (G.handleDir(cur.handle).x < 0) patch.marginLeft = G.px(r.item.margin.left - dw)
            if (G.handleDir(cur.handle).y < 0) patch.marginTop = G.px(r.item.margin.top - dh)
          }
          return { id: r.item.id, patch }
        })
        store().applyEdit({ label: 'Resize', styles })
      },
    })
  }

  /* ----------------------------------------------------------- rotating */

  function startRotate(event, { id }) {
    const view = vp()
    const items = collect([id])
    if (!view || !items.length) return
    const it = items[0]
    const from = overlayPoint(event, view)

    start({
      kind: 'rotate',
      ids: [id],
      items,
      start: from,
      angle0: numOf(it.style.rotate),
      grab: G.angleTo(it.frame.cx, it.frame.cy, from.x, from.y),

      move(e) {
        g.moved = true
        const now = G.angleTo(it.frame.cx, it.frame.cy, g.pointer.x, g.pointer.y)
        let angle = g.angle0 + (now - g.grab)
        if (e.shiftKey) angle = Math.round(angle / 15) * 15
        g.angle = angle
        paint(it.el, { rotate: G.deg(angle) })
        show({ hud: { x: g.pointer.x, y: g.pointer.y, text: `${Math.round(angle)} deg` } })
      },

      commit(cur) {
        store().applyEdit({ label: 'Rotate', styles: [{ id, patch: { rotate: cur.angle ? G.deg(cur.angle) : '' } }] })
      },
    })
  }

  /* ------------------------------------------------------------ rounding */

  function startRadius(event, { id, corner }) {
    const view = vp()
    const items = collect([id])
    if (!view || !items.length) return
    const it = items[0]
    const dir = G.handleDir(corner)

    start({
      kind: 'radius',
      ids: [id],
      items,
      corner,
      start: overlayPoint(event, view),
      radius0: radiusOf(it.el, corner),

      move(e) {
        g.moved = true
        const zoom = store().zoom
        const dx = (g.pointer.x - g.start.x) * -dir.x
        const dy = (g.pointer.y - g.start.y) * -dir.y
        const along = (dx + dy) / 2 / zoom
        const max = Math.min(it.frame.w, it.frame.h) / 2 / zoom
        const radius = G.clamp(g.radius0 + along, 0, max)
        g.radius = radius
        g.each = e.altKey
        paint(it.el, g.each ? { [RADIUS_PROP[corner]]: G.px(radius) } : { borderRadius: G.px(radius) })
        show({ hud: { x: g.pointer.x, y: g.pointer.y, text: `${Math.round(radius)} radius` } })
      },

      commit(cur) {
        const patch = cur.each
          ? { [RADIUS_PROP[cur.corner]]: G.px(cur.radius) }
          : { borderRadius: G.px(cur.radius), borderTopLeftRadius: '', borderTopRightRadius: '', borderBottomRightRadius: '', borderBottomLeftRadius: '' }
        store().applyEdit({ label: 'Round the corners', styles: [{ id, patch }] })
      },
    })
  }

  /* ------------------------------------------------------------- padding */

  const PAD_PROP = { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' }

  function startPadding(event, { id, side }) {
    const view = vp()
    const items = collect([id])
    if (!view || !items.length) return
    const it = items[0]
    const pad = paddingOf(it.el)
    const sign = side === 'left' || side === 'top' ? 1 : -1
    const axis = side === 'left' || side === 'right' ? 'x' : 'y'

    start({
      kind: 'padding',
      ids: [id],
      items,
      side,
      start: overlayPoint(event, view),
      pad,

      move(e) {
        g.moved = true
        const zoom = store().zoom
        const delta = (axis === 'x' ? g.pointer.x - g.start.x : g.pointer.y - g.start.y) * sign / zoom
        const value = Math.max(0, Math.round(g.pad[side] + delta))
        g.value = value
        g.all = e.altKey
        g.pair = e.shiftKey
        const css = {}
        if (g.all) Object.values(PAD_PROP).forEach((p) => { css[p] = G.px(value) })
        else if (g.pair) {
          const pairs = axis === 'x' ? ['paddingLeft', 'paddingRight'] : ['paddingTop', 'paddingBottom']
          pairs.forEach((p) => { css[p] = G.px(value) })
        } else css[PAD_PROP[side]] = G.px(value)
        g.css = css
        paint(it.el, css)
        show({ hud: { x: g.pointer.x, y: g.pointer.y, text: `${value} inside` } })
      },

      commit(cur) {
        const patch = { padding: '' }
        for (const [key, value] of Object.entries(cur.css)) patch[key] = value
        store().applyEdit({ label: 'Space inside', styles: [{ id, patch }] })
      },
    })
  }

  /* ----------------------------------------------------------- the gap */

  function startGap(event, { id }) {
    const view = vp()
    const items = collect([id])
    if (!view || !items.length) return
    const it = items[0]
    const row = isRowFlow(it.el)
    const gaps = gapOf(it.el)

    start({
      kind: 'gap',
      ids: [id],
      items,
      start: overlayPoint(event, view),
      gap0: row ? gaps.column : gaps.row,

      move() {
        g.moved = true
        const zoom = store().zoom
        const delta = (row ? g.pointer.x - g.start.x : g.pointer.y - g.start.y) / zoom
        const value = Math.max(0, Math.round(g.gap0 + delta))
        g.value = value
        paint(it.el, { gap: G.px(value) })
        show({ hud: { x: g.pointer.x, y: g.pointer.y, text: `${value} between` } })
      },

      commit(cur) {
        store().applyEdit({ label: 'Space between', styles: [{ id, patch: { gap: G.px(cur.value) } }] })
      },
    })
  }

  /* ------------------------------------------------------------ marquee */

  function startMarquee(event, { additive = false, clickSelects = null } = {}) {
    const view = vp()
    if (!view) return
    const from = overlayPoint(event, view)
    const state = store()
    const page = state.activePage()
    const zoom = state.zoom
    const before = additive ? state.selection() : []

    // Everything selectable, measured once so dragging stays cheap.
    const candidates = []
    const walkEl = (el, depth) => {
      for (const child of el.children) {
        const id = child.dataset?.nodeId
        if (!id) continue
        const node = getNode(page.root, id)
        if (node && !node.locked && !node.hidden) candidates.push({ id, depth, box: boxOf(child, view, zoom) })
        walkEl(child, depth + 1)
      }
    }
    const rootEl = nodeEl(view, page.root.id)
    if (rootEl) walkEl(rootEl, 0)

    start({
      kind: 'marquee',
      ids: [],
      start: from,

      move() {
        g.moved = true
        const box = {
          left: Math.min(from.x, g.pointer.x), right: Math.max(from.x, g.pointer.x),
          top: Math.min(from.y, g.pointer.y), bottom: Math.max(from.y, g.pointer.y),
        }
        // Take the outermost thing the rectangle touches, never its children too.
        const hits = []
        const taken = new Set()
        for (const c of [...candidates].sort((a, b) => a.depth - b.depth)) {
          if (!c.box || !G.boundsIntersect(box, c.box)) continue
          const page2 = store().activePage()
          const inside = hits.some((h) => contains(getNode(page2.root, h), c.id))
          if (inside || taken.has(c.id)) continue
          hits.push(c.id)
          taken.add(c.id)
        }
        g.hits = hits
        show({ marquee: G.rectOfBounds(box), ids: hits })
      },

      commit(cur) {
        store().selectMany([...before, ...(cur.hits || [])])
      },

      done(committed) {
        // A press that never moved is just a click on the background.
        if (!committed && !additive) store().select(clickSelects)
      },
    })
  }

  /* -------------------------------------------------------------- panning */

  function startPan(event) {
    const view = vp()
    if (!view) return
    start({
      kind: 'pan',
      ids: [],
      start: { x: event.clientX, y: event.clientY },
      from: { left: view.scrollLeft, top: view.scrollTop },
      move(e) {
        g.moved = true
        view.scrollLeft = g.from.left - (e.clientX - g.start.x)
        view.scrollTop = g.from.top - (e.clientY - g.start.y)
      },
    })
  }

  /* ---------------------------------------------------------- the press */

  function press(event, node) {
    const state = store()
    if (state.mode === 'preview') return
    if (event.button === 1 || state.tool === 'hand' || engineState.space) return startPan(event)
    if (event.button !== 0 || node.locked) return

    // The page itself is the backdrop: press and drag to sweep up a selection.
    if (node.type === 'page') {
      return startMarquee(event, { additive: event.shiftKey, clickSelects: node.id })
    }

    let ids
    if (event.shiftKey) {
      state.selectAlso(node.id)
      ids = store().selection()
    } else if (state.selection().includes(node.id)) {
      ids = state.selection()
    } else {
      state.select(node.id)
      ids = [node.id]
    }
    startMove(event, { ids, duplicate: event.altKey })
  }

  return {
    press, startMove, startResize, startRotate, startRadius, startPadding,
    startGap, startMarquee, startPan,
    setSpace: (value) => { engineState.space = value },
    cancel: () => stop(false),
    active: () => !!g,
  }
}

/** One engine per canvas, kept for the life of the component. */
export function useGestures(viewportRef) {
  const ref = useRef(null)
  if (!ref.current) ref.current = createEngine(viewportRef)
  return ref.current
}
