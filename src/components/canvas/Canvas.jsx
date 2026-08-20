/**
 * The canvas: a real, scaled rendering of the page with an overlay layer for
 * selection, handles, guides and drop feedback. Nothing in the overlay touches
 * the document itself, so the design stays clean.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import NodeView from './NodeView.jsx'
import Overlay from './Overlay.jsx'
import Icon from '../ui/Icon.jsx'
import { Segmented } from '../ui/controls.jsx'
import { CanvasContext } from './context.js'
import { useGestures, dropSpot } from './gestures.js'
import { useStore, useActivePage } from '../../core/store.js'
import { buildCss, scopeCss } from '../../core/css.js'
import { BREAKPOINTS, bp } from '../../core/doc.js'
import { clamp } from '../../core/util.js'

const SCOPE = '.wb-canvas-root'

export default function Canvas() {
  const page = useActivePage()
  const theme = useStore((s) => s.project.theme)
  const breakpoint = useStore((s) => s.breakpoint)
  const zoom = useStore((s) => s.zoom)
  const mode = useStore((s) => s.mode)
  const tool = useStore((s) => s.tool)
  const selectedIds = useStore((s) => s.selectedIds)
  const hoveredId = useStore((s) => s.hoveredId)
  const showOutlines = useStore((s) => s.showOutlines)
  const gesture = useStore((s) => s.gesture)
  const hover = useStore((s) => s.hover)
  const setZoom = useStore((s) => s.setZoom)
  const addElement = useStore((s) => s.addElement)
  const addBlock = useStore((s) => s.addBlock)
  const moveTo = useStore((s) => s.moveTo)

  const viewportRef = useRef(null)
  const frameRef = useRef(null)
  const engine = useGestures(viewportRef)
  const [drop, setDrop] = useState(null)
  const [space, setSpace] = useState(false)
  const [, force] = useReducer((x) => x + 1, 0)

  const preview = mode === 'preview'
  const width = bp(breakpoint).width

  const css = useMemo(() => {
    const sheet = buildCss(page.root, theme, { breakpoint, scope: SCOPE })
    const custom = page.customCss ? '\n' + scopeCss(page.customCss, SCOPE) : ''
    return sheet + custom
  }, [page.root, page.customCss, theme, breakpoint])

  /* ------------------------------------------------- overlay geometry */

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onChange = () => force()
    vp.addEventListener('scroll', onChange, { passive: true })
    window.addEventListener('resize', onChange)
    const observer = new ResizeObserver(onChange)
    observer.observe(vp)
    if (frameRef.current) observer.observe(frameRef.current)
    return () => {
      vp.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
      observer.disconnect()
    }
  }, [])

  // Re-measure after the document, selection or scale changes.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => force())
    return () => cancelAnimationFrame(id)
    // Gestures are left out on purpose: the overlay watches those itself, and
    // re-measuring here as well would cost a second render on every pixel.
  }, [page.root, selectedIds, hoveredId, zoom, breakpoint, mode])

  /* --------------------------------------------------- space to pan */

  useEffect(() => {
    const isTyping = (el) => el instanceof HTMLElement
      && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
    const down = (e) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        if (!space) setSpace(true)
        if (!e.repeat) e.preventDefault()
      }
    }
    const up = (e) => {
      if (e.code === 'Space') setSpace(false)
    }
    const blur = () => setSpace(false)
    engine.setSpace(space)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [space, engine])

  /* ------------------------------------------- pinch and wheel zoom */

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const state = useStore.getState()
      const from = state.zoom
      const to = clamp(from * Math.exp(-event.deltaY / 400), 0.25, 2)
      if (to === from) return
      // Keep whatever is under the pointer under the pointer.
      const rect = vp.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const ratio = to / from
      state.setZoom(to)
      requestAnimationFrame(() => {
        vp.scrollLeft = (vp.scrollLeft + px) * ratio - px
        vp.scrollTop = (vp.scrollTop + py) * ratio - py
      })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  /* --------------------------------------------- fitting things on screen */

  // Scrolling so a rectangle sits in the middle is easier done after the fact:
  // change the zoom, let the browser lay it out, then measure and centre.
  const centreOn = useCallback((getRect) => {
    const vp = viewportRef.current
    if (!vp) return
    requestAnimationFrame(() => {
      const target = getRect()
      if (!target) return
      const view = vp.getBoundingClientRect()
      vp.scrollLeft += (target.left + target.width / 2) - (view.left + view.width / 2)
      vp.scrollTop += (target.top + target.height / 2) - (view.top + view.height / 2)
    })
  }, [])

  const zoomToFit = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const pageWidth = bp(useStore.getState().breakpoint).width
    setZoom(clamp((vp.clientWidth - 72) / pageWidth, 0.25, 2))
    requestAnimationFrame(() => { vp.scrollTop = 0 })
  }, [setZoom])

  const zoomToSelection = useCallback(() => {
    const vp = viewportRef.current
    const ids = useStore.getState().selection()
    if (!vp || !ids.length) return zoomToFit()
    const els = ids.map((id) => vp.querySelector(`[data-node-id="${id}"]`)).filter(Boolean)
    if (!els.length) return
    const rects = els.map((e) => e.getBoundingClientRect())
    const width = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))
    const height = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))
    const current = useStore.getState().zoom
    const fit = Math.min((vp.clientWidth - 96) / (width / current), (vp.clientHeight - 96) / (height / current))
    setZoom(clamp(fit, 0.25, 2))
    centreOn(() => {
      const again = els.map((e) => e.getBoundingClientRect())
      const left = Math.min(...again.map((r) => r.left))
      const top = Math.min(...again.map((r) => r.top))
      return { left, top, width: Math.max(...again.map((r) => r.right)) - left, height: Math.max(...again.map((r) => r.bottom)) - top }
    })
  }, [setZoom, zoomToFit, centreOn])

  useEffect(() => {
    const onKey = (event) => {
      const el = event.target
      if (el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && (event.key === '0' || event.key === ')')) {
        event.preventDefault()
        setZoom(1)
      } else if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        setZoom(useStore.getState().zoom * 1.25)
      } else if (mod && event.key === '-') {
        event.preventDefault()
        setZoom(useStore.getState().zoom / 1.25)
      } else if (!mod && event.shiftKey && event.key === '!') {
        event.preventDefault()
        zoomToFit()
      } else if (!mod && event.shiftKey && event.key === '@') {
        event.preventDefault()
        zoomToSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setZoom, zoomToFit, zoomToSelection])

  /* ------------------------------------------- dragging from the panels */

  const onDragOver = (event) => {
    if (preview) return
    const types = event.dataTransfer.types
    const isBlock = types.includes('text/wb-block')
    if (!types.includes('text/wb-element') && !isBlock && !types.includes('text/wb-move')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = types.includes('text/wb-move') ? 'move' : 'copy'
    setDrop(dropSpot(viewportRef.current, page.root, event.clientX, event.clientY, { blockMode: isBlock }))
  }

  const onDrop = (event) => {
    if (preview) return
    event.preventDefault()
    const target = drop || dropSpot(viewportRef.current, page.root, event.clientX, event.clientY)
    setDrop(null)
    if (!target) return

    const elementType = event.dataTransfer.getData('text/wb-element')
    const blockId = event.dataTransfer.getData('text/wb-block')
    const moveId = event.dataTransfer.getData('text/wb-move')

    if (elementType) addElement(elementType, { parentId: target.parentId, index: target.index })
    else if (blockId) addBlock(blockId, target.index)
    else if (moveId && moveId !== target.parentId) moveTo(moveId, target.parentId, target.index)
  }

  /* ------------------------------------------------------------ render */

  const onPointerDown = useCallback((event) => {
    if (preview || event.button === 2) return
    const onBackground = event.target === event.currentTarget || event.target.classList.contains('wb-stage')
    if (!onBackground) return
    if (space || tool === 'hand' || event.button === 1) engine.startPan(event)
    else engine.startMarquee(event, { additive: event.shiftKey, clickSelects: null })
  }, [engine, preview, space, tool])

  const isEmpty = !(page.root.children || []).length
  const panning = space || tool === 'hand' || gesture?.kind === 'pan'

  return (
    <CanvasContext.Provider value={{ engine, viewportRef, zoom, preview }}>
      <div className="wb-canvas-wrap">
        <CanvasBar onFit={zoomToFit} onFitSelection={zoomToSelection} />
        <div
          ref={viewportRef}
          className="wb-viewport"
          data-panning={panning ? 'true' : undefined}
          data-gesture={gesture?.kind}
          onPointerDown={onPointerDown}
          onMouseLeave={() => hover(null)}
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDrop(null)
          }}
          onDrop={onDrop}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="wb-stage" style={{ transform: `scale(${zoom})`, width: width * zoom, margin: '0 auto' }}>
            <div ref={frameRef} className="wb-frame" style={{ width }}>
              <style dangerouslySetInnerHTML={{ __html: css }} />
              <div
                className="wb-canvas-root"
                data-outlines={showOutlines && !preview ? 'true' : 'false'}
                data-design={preview ? undefined : 'true'}
              >
                <NodeView node={page.root} preview={preview} />
              </div>
              {isEmpty && !preview && <EmptyPage />}
            </div>
          </div>

          {!preview && <Overlay viewportRef={viewportRef} engine={engine} />}

          {!preview && drop && (
            <div className="wb-overlay">
              <div
                className={drop.indicator.box ? 'wb-dropbox' : 'wb-dropline'}
                style={{
                  top: drop.indicator.top,
                  left: drop.indicator.left,
                  width: drop.indicator.width,
                  height: drop.indicator.height,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </CanvasContext.Provider>
  )
}

/* --------------------------------------------------------- empty state */

function EmptyPage() {
  const setModal = useStore((s) => s.setModal)
  const setLeftTab = useStore((s) => s.setLeftTab)
  return (
    <div className="wb-empty-page">
      <div className="wb-empty-icon"><Icon name="Sparkles" size={24} /></div>
      <div className="wb-empty-title">This page is empty</div>
      <div className="wb-empty-text">
        Drag something from the left onto this space, or drop in a ready-made section and change the words.
      </div>
      <div className="wb-row" style={{ marginTop: 4 }}>
        <button className="wb-btn wb-btn--primary" onClick={() => setLeftTab('sections')}>
          <Icon name="Blocks" size={14} /> Browse sections
        </button>
        <button className="wb-btn" onClick={() => setModal('templates')}>
          <Icon name="LayoutTemplate" size={14} /> Start from a template
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- canvas toolbar */

const TOOLS = [
  { value: 'move', icon: 'MousePointer2', title: 'Pick things up and move them (V)' },
  { value: 'hand', icon: 'Hand', title: 'Slide the canvas around (H, or hold Space)' },
]

const GRIDS = [
  { value: 0, label: 'No grid' },
  { value: 4, label: '4 px grid' },
  { value: 8, label: '8 px grid' },
  { value: 12, label: '12 px grid' },
  { value: 16, label: '16 px grid' },
]

function CanvasBar({ onFit, onFitSelection }) {
  const breakpoint = useStore((s) => s.breakpoint)
  const setBreakpoint = useStore((s) => s.setBreakpoint)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const showOutlines = useStore((s) => s.showOutlines)
  const toggleOutlines = useStore((s) => s.toggleOutlines)
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const snap = useStore((s) => s.snap)
  const toggleSnap = useStore((s) => s.toggleSnap)
  const snapGrid = useStore((s) => s.snapGrid)
  const setSnapGrid = useStore((s) => s.setSnapGrid)
  const page = useActivePage()
  const pages = useStore((s) => s.project.pages)
  const setActivePage = useStore((s) => s.setActivePage)

  return (
    <div className="wb-canvasbar">
      <Segmented value={tool} onChange={setTool} options={TOOLS} />

      <select
        className="wb-select"
        style={{ width: 'auto', minWidth: 110, height: 28 }}
        value={page.id}
        onChange={(e) => setActivePage(e.target.value)}
      >
        {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="wb-spacer" />

      <Segmented
        value={breakpoint}
        onChange={setBreakpoint}
        options={BREAKPOINTS.map((b) => ({ value: b.id, icon: b.icon, title: `${b.label} (${b.width}px)` }))}
      />
      <span className="wb-small wb-muted" style={{ width: 54, textAlign: 'center' }}>{bp(breakpoint).width}px</span>

      <div className="wb-spacer" />

      <button
        className="wb-btn wb-btn--icon wb-btn--ghost wb-tip"
        data-tip={snap ? 'Stop snapping to edges' : 'Snap to edges and middles'}
        data-active={snap}
        onClick={toggleSnap}
      >
        <Icon name="Magnet" size={15} />
      </button>
      <select
        className="wb-select wb-tip"
        data-tip="Also snap to a fixed grid"
        style={{ width: 'auto', minWidth: 84, height: 28 }}
        value={snapGrid}
        onChange={(e) => setSnapGrid(Number(e.target.value))}
      >
        {GRIDS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <button
        className="wb-btn wb-btn--icon wb-btn--ghost wb-tip"
        data-tip={showOutlines ? 'Hide the guide lines' : 'Show guide lines'}
        data-active={showOutlines}
        onClick={toggleOutlines}
      >
        <Icon name="Scan" size={15} />
      </button>
      <button
        className="wb-btn wb-btn--icon wb-btn--ghost wb-tip"
        data-tip="Fit the page on screen (Shift 1)"
        onClick={onFit}
      >
        <Icon name="Maximize2" size={15} />
      </button>
      <button
        className="wb-btn wb-btn--icon wb-btn--ghost wb-tip"
        data-tip="Zoom to what is selected (Shift 2)"
        onClick={onFitSelection}
      >
        <Icon name="Scaling" size={15} />
      </button>
      <div className="wb-row" style={{ gap: 2 }}>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Zoom out" onClick={() => setZoom(zoom - 0.1)}>
          <Icon name="ZoomOut" size={15} />
        </button>
        <button className="wb-btn wb-btn--sm wb-btn--ghost" onClick={() => setZoom(1)} style={{ width: 46 }}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Zoom in" onClick={() => setZoom(zoom + 0.1)}>
          <Icon name="ZoomIn" size={15} />
        </button>
      </div>
    </div>
  )
}
