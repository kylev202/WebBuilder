/**
 * Everything drawn on top of the canvas: selection frames and their handles,
 * hover rings, alignment guides, the measurement badge, drop indicators and
 * the marquee.
 *
 * Nothing here touches the document. The overlay only ever reads the live DOM
 * and hands gestures to the engine, so the page underneath stays clean.
 */

import { useEffect, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useStore, useActivePage } from '../../core/store.js'
import { getNode } from '../../core/doc.js'
import { def } from '../../core/elements.js'
import { flattenStyles, isFree } from '../../core/css.js'
import * as G from '../../core/geom.js'
import {
  nodeEl, frameOf, boxOf, contentBox, paddingOf, offsetIn,
  parentNodeEl, isRowFlow,
} from './measure.js'
import { ALIGNMENTS, alignEntries, distributeEntries } from './arrange.js'

const PAD_SIDES = ['top', 'right', 'bottom', 'left']

/** True while Alt is held -- Framer's "show me the distances" key. */
function useAltHeld() {
  const [alt, setAlt] = useState(false)
  useEffect(() => {
    const sync = (event) => setAlt(event.altKey)
    const clear = () => setAlt(false)
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [])
  return alt
}

export default function Overlay({ viewportRef, engine }) {
  const page = useActivePage()
  const zoom = useStore((s) => s.zoom)
  const breakpoint = useStore((s) => s.breakpoint)
  const selectedIds = useStore((s) => s.selectedIds)
  const selectedId = useStore((s) => s.selectedId)
  const hoveredId = useStore((s) => s.hoveredId)
  const gesture = useStore((s) => s.gesture)
  const editingTextId = useStore((s) => s.editingTextId)
  const measuring = useAltHeld()

  const vp = viewportRef.current
  if (!vp) return null

  const measure = (id) => {
    const el = nodeEl(vp, id)
    const node = getNode(page.root, id)
    if (!el || !node) return null
    const style = flattenStyles(node.styles, breakpoint)
    return {
      id,
      el,
      node,
      style,
      free: isFree(style),
      frame: frameOf(el, vp, zoom, parseFloat(style.rotate) || 0),
    }
  }

  const ids = selectedIds.length ? selectedIds : (selectedId ? [selectedId] : [])
  const items = ids.map(measure).filter(Boolean)
  const primary = items.find((i) => i.id === selectedId) || items[items.length - 1] || null
  const hovered = hoveredId && !ids.includes(hoveredId) ? measure(hoveredId) : null

  const dragging = !!gesture && gesture.kind !== 'marquee'
  const group = items.length ? G.boundsOf(items.map((i) => i.frame)) : null
  const busy = !!gesture

  return (
    <div className="wb-overlay">
      {/* what the pointer is over */}
      {hovered && !busy && (
        <>
          <Frame frame={hovered.frame} className="wb-sel wb-sel--hover" />
          <div className="wb-tag wb-tag--hover" style={tagAt(hovered.frame)}>{hovered.node.name}</div>
        </>
      )}

      {/* where a free drag would drop it */}
      {gesture?.intoId && <IntoRing id={gesture.intoId} vp={vp} zoom={zoom} />}

      {/* the selection */}
      {items.map((item) => (
        <Frame
          key={item.id}
          frame={item.frame}
          className={`wb-sel${item.id === primary?.id ? ' wb-sel--primary' : ''}`}
        />
      ))}

      {items.length > 1 && group && (
        <div className="wb-sel-group" style={G.rectOfBounds(group)} />
      )}

      {primary && !busy && editingTextId !== primary.id && (
        <>
          <div className="wb-tag" style={tagAt(primary.frame)}>
            {primary.node.locked && <Icon name="Lock" size={10} className="wb-tag-lock" />}
            {items.length > 1 ? `${items.length} things` : primary.node.name}
            <span className="wb-tag-size">{Math.round(primary.frame.w / zoom)} x {Math.round(primary.frame.h / zoom)}</span>
          </div>
          <Handles items={items} primary={primary} group={group} engine={engine} />
          {items.length === 1 && <InsideHandles item={primary} vp={vp} zoom={zoom} engine={engine} />}
          <QuickBar items={items} primary={primary} group={group} vp={vp} zoom={zoom} />
        </>
      )}

      {/* live feedback while a gesture runs */}
      {gesture?.guides?.map((guide, i) => <Guide key={i} guide={guide} />)}
      {gesture?.drop && (
        <div
          className={gesture.drop.indicator.box ? 'wb-dropbox' : 'wb-dropline'}
          style={{
            top: gesture.drop.indicator.top,
            left: gesture.drop.indicator.left,
            width: gesture.drop.indicator.width,
            height: gesture.drop.indicator.height,
          }}
        />
      )}
      {gesture?.marquee && <div className="wb-marquee" style={gesture.marquee} />}
      {gesture?.hud && (
        <div className="wb-hud" style={{ left: gesture.hud.x + 16, top: gesture.hud.y + 18 }}>{gesture.hud.text}</div>
      )}
      {dragging && group && <Distances items={items} vp={vp} zoom={zoom} group={group} />}
      {measuring && !busy && hovered && primary && (
        <Between a={G.frameBounds(primary.frame)} b={G.frameBounds(hovered.frame)} zoom={zoom} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- pieces */

const tagAt = (f) => {
  const b = G.frameBounds(f)
  return { top: b.top, left: b.left }
}

function Frame({ frame, className }) {
  return (
    <div
      className={className}
      style={{
        left: frame.cx,
        top: frame.cy,
        width: frame.w,
        height: frame.h,
        transform: `translate(-50%, -50%) rotate(${frame.angle}deg)`,
      }}
    />
  )
}

function IntoRing({ id, vp, zoom }) {
  const el = nodeEl(vp, id)
  const box = el && boxOf(el, vp, zoom)
  if (!box) return null
  return <div className="wb-into" style={G.rectOfBounds(box)} />
}

function Guide({ guide }) {
  const style = guide.axis === 'x'
    ? { left: guide.value, top: guide.from, height: guide.to - guide.from, width: 1 }
    : { top: guide.value, left: guide.from, width: guide.to - guide.from, height: 1 }
  return <div className="wb-guide" data-centre={guide.centre ? 'true' : undefined} style={style} />
}

/* ---------------------------------------------------- resize and friends */

function Handles({ items, primary, group, engine }) {
  const ids = items.map((i) => i.id)
  const many = items.length > 1
  // A group is handled as one upright box; a single thing keeps its rotation.
  const frame = many && group
    ? { cx: (group.left + group.right) / 2, cy: (group.top + group.bottom) / 2, w: group.right - group.left, h: group.bottom - group.top, angle: 0 }
    : primary.frame
  const small = frame.w < 26 || frame.h < 26
  const rounded = primary.node.type !== 'page' && !many && frame.w > 40 && frame.h > 40

  const stop = (fn) => (event) => {
    event.stopPropagation()
    event.preventDefault()
    fn(event)
  }

  return (
    <div
      className="wb-handles"
      style={{
        left: frame.cx,
        top: frame.cy,
        width: frame.w,
        height: frame.h,
        transform: `translate(-50%, -50%) rotate(${frame.angle}deg)`,
      }}
    >
      {G.CORNERS.map((dir) => (
        <div
          key={`rot-${dir.id}`}
          className="wb-rot"
          style={{ left: pc(dir.x), top: pc(dir.y), translate: `${dir.x * 10}px ${dir.y * 10}px` }}
          title="Drag to turn it -- hold Shift for steps of 15 degrees"
          onPointerDown={stop((e) => engine.startRotate(e, { id: primary.id }))}
        />
      ))}

      {G.HANDLES.map((dir) => (
        <div
          key={dir.id}
          className={`wb-handle${small ? ' wb-handle--small' : ''}`}
          data-dir={dir.id}
          style={{ left: pc(dir.x), top: pc(dir.y), cursor: G.handleCursor(dir, frame.angle) }}
          onPointerDown={stop((e) => engine.startResize(e, { ids, handle: dir.id }))}
        />
      ))}

      {rounded && G.CORNERS.map((dir) => (
        <div
          key={`r-${dir.id}`}
          className="wb-radius"
          style={{ left: pc(dir.x), top: pc(dir.y), margin: `${dir.y * -14}px ${dir.x * -14}px` }}
          title="Drag to round the corner -- hold Alt for this corner only"
          onPointerDown={stop((e) => engine.startRadius(e, { id: primary.id, corner: dir.id }))}
        />
      ))}
    </div>
  )
}

const pc = (n) => `${50 + n * 50}%`

/** Padding edges and the gap between children -- Framer's inside handles. */
function InsideHandles({ item, vp, zoom, engine }) {
  const d = def(item.node.type)
  // The page itself is the backdrop -- pressing near its edge should sweep up
  // a selection, not drag the page's padding.
  if (!d.container || item.node.type === 'select' || item.node.type === 'page') return null

  const box = boxOf(item.el, vp, zoom)
  const content = contentBox(item.el, vp, zoom)
  if (!box || !content) return null

  const pad = paddingOf(item.el)
  const kids = Array.from(item.el.children).filter((c) => c.dataset?.nodeId)
  const row = isRowFlow(item.el)

  const stop = (fn) => (event) => {
    event.stopPropagation()
    event.preventDefault()
    fn(event)
  }

  const bars = PAD_SIDES.map((side) => {
    const vertical = side === 'left' || side === 'right'
    // The bar covers the padding band and always stays inside the element, so
    // a box with no padding never steals presses meant for its neighbours.
    const band = Math.max(0, pad[side] * zoom)
    const grab = Math.max(band, 6)
    const style = vertical
      ? {
        top: content.top,
        height: Math.max(0, content.bottom - content.top),
        left: side === 'left' ? content.left - band : content.right + band - grab,
        width: grab,
        cursor: 'ew-resize',
      }
      : {
        left: content.left,
        width: Math.max(0, content.right - content.left),
        top: side === 'top' ? content.top - band : content.bottom + band - grab,
        height: grab,
        cursor: 'ns-resize',
      }
    return (
      <div
        key={side}
        className="wb-pad"
        style={style}
        title={`Drag to change the space inside -- Alt for all sides, Shift for both ${vertical ? 'sides' : 'ends'}`}
        onPointerDown={stop((e) => engine.startPadding(e, { id: item.id, side }))}
      />
    )
  })

  let gapBar = null
  if (kids.length > 1) {
    const a = boxOf(kids[0], vp, zoom)
    const b = boxOf(kids[1], vp, zoom)
    if (a && b) {
      gapBar = row
        ? { left: a.right, width: Math.max(4, b.left - a.right), top: Math.max(a.top, b.top), height: Math.max(8, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)), cursor: 'ew-resize' }
        : { top: a.bottom, height: Math.max(4, b.top - a.bottom), left: Math.max(a.left, b.left), width: Math.max(8, Math.min(a.right, b.right) - Math.max(a.left, b.left)), cursor: 'ns-resize' }
    }
  }

  return (
    <>
      {bars}
      {gapBar && (
        <div
          className="wb-gap"
          style={gapBar}
          title="Drag to change the space between"
          onPointerDown={stop((e) => engine.startGap(e, { id: item.id }))}
        />
      )}
    </>
  )
}

/** The px readouts between what is moving and everything around it. */
function Distances({ items, vp, zoom, group }) {
  if (items.length !== 1) return null
  const item = items[0]
  const parentEl = parentNodeEl(item.el)
  if (!parentEl) return null
  const inner = contentBox(parentEl, vp, zoom)
  if (!inner) return null

  const marks = []
  const push = (axis, from, to, at) => {
    const size = Math.round(Math.abs(to - from) / zoom)
    if (size <= 0) return
    marks.push({ axis, from: Math.min(from, to), to: Math.max(from, to), at, size })
  }
  push('x', inner.left, group.left, (group.top + group.bottom) / 2)
  push('x', group.right, inner.right, (group.top + group.bottom) / 2)
  push('y', inner.top, group.top, (group.left + group.right) / 2)
  push('y', group.bottom, inner.bottom, (group.left + group.right) / 2)

  return marks.map((m, i) => (
    <div
      key={i}
      className="wb-dist"
      data-axis={m.axis}
      style={m.axis === 'x'
        ? { left: m.from, width: m.to - m.from, top: m.at }
        : { top: m.from, height: m.to - m.from, left: m.at }}
    >
      <span>{m.size}</span>
    </div>
  ))
}

/** Hold Alt and point at something: how far is it from what is selected? */
function Between({ a, b, zoom }) {
  const marks = G.gapBetween(a, b)
  if (!marks.length) return null
  return marks.map((m, i) => (
    <div
      key={i}
      className="wb-dist"
      data-axis={m.axis}
      style={m.axis === 'x'
        ? { left: m.from, width: m.to - m.from, top: m.at }
        : { top: m.from, height: m.to - m.from, left: m.at }}
    >
      <span>{Math.round(m.size / zoom)}</span>
    </div>
  ))
}

/* ------------------------------------------------------------ quick bar */

function QuickBar({ items, primary, group, vp, zoom }) {
  const duplicate = useStore((s) => s.duplicate)
  const remove = useStore((s) => s.remove)
  const selectParent = useStore((s) => s.selectParent)
  const startTextEdit = useStore((s) => s.startTextEdit)
  const wrap = useStore((s) => s.wrap)
  const applyEdit = useStore((s) => s.applyEdit)
  const backIntoFlow = useStore((s) => s.backIntoFlow)

  if (primary.node.type === 'page' || !group) return null

  const many = items.length > 1
  const top = group.top > 60 ? group.top - 38 : group.bottom + 10
  const left = Math.max(4, group.left)

  const measured = () => items.map((item) => {
    const parentEl = parentNodeEl(item.el)
    const cs = getComputedStyle(item.el)
    return {
      id: item.id,
      free: item.free,
      bounds: G.frameBounds(item.frame),
      off: parentEl ? offsetIn(item.el, parentEl, zoom) : { left: 0, top: 0 },
      margin: { left: parseFloat(cs.marginLeft) || 0, top: parseFloat(cs.marginTop) || 0 },
    }
  })

  const align = (kind) => {
    const list = measured()
    const styles = alignEntries(list, kind, G.boundsOf(items.map((i) => i.frame)), zoom)
    if (styles.length) applyEdit({ label: 'Line up', styles })
  }

  const spread = (axis) => {
    const styles = distributeEntries(measured(), axis, zoom)
    if (styles.length) applyEdit({ label: 'Spread out', styles })
  }

  return (
    <div className="wb-quickbar" style={{ top, left }} onPointerDown={(e) => e.stopPropagation()}>
      {many ? (
        <>
          {ALIGNMENTS.map((a) => (
            <button key={a.id} className="wb-tip" data-tip={a.label} onClick={() => align(a.id)}>
              <Icon name={a.icon} size={14} />
            </button>
          ))}
          <span className="wb-quickbar-sep" />
          <button className="wb-tip" data-tip="Even gaps across" onClick={() => spread('x')} disabled={items.length < 3}>
            <Icon name="AlignHorizontalSpaceAround" size={14} />
          </button>
          <button className="wb-tip" data-tip="Even gaps down" onClick={() => spread('y')} disabled={items.length < 3}>
            <Icon name="AlignVerticalSpaceAround" size={14} />
          </button>
        </>
      ) : (
        <>
          <button className="wb-tip" data-tip="Select the box around this" onClick={() => selectParent()}>
            <Icon name="CornerDownRight" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          {primary.free ? (
            <button className="wb-tip" data-tip="Put it back in the flow" onClick={() => backIntoFlow(primary.id)}>
              <Icon name="Magnet" size={14} />
            </button>
          ) : (
            <button
              className="wb-tip"
              data-tip="Place it freely -- then drag it anywhere"
              onClick={() => {
                const parentEl = parentNodeEl(primary.el)
                if (!parentEl) return
                const off = offsetIn(primary.el, parentEl, zoom)
                applyEdit({
                  label: 'Place freely',
                  styles: [
                    { id: primary.id, patch: { position: 'absolute', left: G.px(off.left), top: G.px(off.top), width: primary.style.width || G.px(off.width) } },
                    { id: parentEl.dataset.nodeId, patch: getComputedStyle(parentEl).position === 'static' ? { position: 'relative' } : {}, bucket: 'base' },
                  ],
                })
              }}
            >
              <Icon name="Move" size={14} />
            </button>
          )}
          {def(primary.node.type).textual && (
            <button className="wb-tip" data-tip="Edit the words" onClick={() => startTextEdit(primary.id)}>
              <Icon name="Pencil" size={14} />
            </button>
          )}
          <button className="wb-tip" data-tip="Put it inside a box" onClick={() => wrap(primary.id)}>
            <Icon name="Box" size={14} />
          </button>
        </>
      )}
      <span className="wb-quickbar-sep" />
      <button className="wb-tip" data-tip="Make a copy" onClick={() => items.forEach((i) => duplicate(i.id))}>
        <Icon name="Copy" size={14} />
      </button>
      <button className="wb-tip" data-tip="Delete" onClick={() => items.forEach((i) => remove(i.id))}>
        <Icon name="Trash2" size={14} />
      </button>
    </div>
  )
}
