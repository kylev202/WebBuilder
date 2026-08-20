import { useEffect } from 'react'
import TopBar from './components/TopBar.jsx'
import LeftPanel from './components/panels/LeftPanel.jsx'
import Canvas from './components/canvas/Canvas.jsx'
import Inspector from './components/inspector/Inspector.jsx'
import CodePanel from './components/CodePanel.jsx'
import TemplatesModal from './components/modals/TemplatesModal.jsx'
import ExportModal from './components/modals/ExportModal.jsx'
import { ShortcutsModal, WelcomeModal } from './components/modals/HelpModals.jsx'
import Icon from './components/ui/Icon.jsx'
import { Segmented } from './components/ui/controls.jsx'
import { useStore } from './core/store.js'
import { BREAKPOINTS } from './core/doc.js'
import { def } from './core/elements.js'

export default function App() {
  const mode = useStore((s) => s.mode)
  const showCode = useStore((s) => s.showCode)
  const codePane = useStore((s) => s.codePane)
  const modal = useStore((s) => s.modal)
  const setModal = useStore((s) => s.setModal)
  const isFirstRun = useStore((s) => s.isFirstRun)

  useKeyboardShortcuts()

  // A first-time visitor gets a short hello rather than a blank stare.
  useEffect(() => {
    if (isFirstRun) setModal('welcome')
  }, [isFirstRun, setModal])

  const preview = mode === 'preview'
  const codeOnRight = showCode && codePane === 'right'

  return (
    <div className="wb-app">
      <TopBar />
      <div className="wb-body" data-code={codeOnRight ? 'right' : undefined} data-preview={preview}>
        {!preview && <LeftPanel />}

        <div className="wb-center">
          <Canvas />
          {showCode && codePane === 'bottom' && !preview && (
            <div className="wb-code-dock"><CodePanel /></div>
          )}
        </div>

        {!preview && (codeOnRight ? <CodePanel /> : <Inspector />)}
      </div>

      {preview && <PreviewBar />}
      {modal === 'templates' && <TemplatesModal />}
      {modal === 'export' && <ExportModal />}
      {modal === 'shortcuts' && <ShortcutsModal />}
      {modal === 'welcome' && <WelcomeModal />}
      <Toasts />
    </div>
  )
}

/* --------------------------------------------------------- preview bar */

function PreviewBar() {
  const setMode = useStore((s) => s.setMode)
  const breakpoint = useStore((s) => s.breakpoint)
  const setBreakpoint = useStore((s) => s.setBreakpoint)

  return (
    <div
      style={{
        position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 250,
        padding: 6, borderRadius: 12, background: 'var(--ui-panel)',
        boxShadow: 'var(--ui-shadow-lg)', border: '1px solid var(--ui-line)',
      }}
    >
      <Segmented
        value={breakpoint}
        onChange={setBreakpoint}
        options={BREAKPOINTS.map((b) => ({ value: b.id, icon: b.icon, title: b.label }))}
      />
      <button className="wb-btn wb-btn--primary" onClick={() => setMode('design')}>
        <Icon name="Pencil" size={14} /> Back to editing
      </button>
    </div>
  )
}

/* -------------------------------------------------------------- toasts */

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismissToast = useStore((s) => s.dismissToast)
  if (!toasts.length) return null

  return (
    <div className="wb-toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="wb-toast" data-kind={toast.kind}>
          <Icon name={toast.kind === 'warn' ? 'AlertTriangle' : 'Check'} size={14} />
          <span>{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.onAction?.()
                dismissToast(toast.id)
              }}
            >
              {toast.action}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------- shortcuts */

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target
      const typing = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      const store = useStore.getState()
      const mod = event.metaKey || event.ctrlKey

      if (event.key === 'Escape') {
        if (store.editingTextId) store.stopTextEdit()
        else if (store.modal) store.setModal(null)
        else if (!typing) store.select(null)
        return
      }
      if (typing) return

      const selected = store.selectedId

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? store.redo() : store.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        store.saveNow()
        return
      }
      if (mod && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        store.setModal('export')
        return
      }
      if (mod && event.key === '/') {
        event.preventDefault()
        store.toggleCode()
        return
      }
      if (mod && event.key === 'Enter') {
        event.preventDefault()
        store.setMode(store.mode === 'preview' ? 'design' : 'preview')
        return
      }
      if (event.key === '?') {
        store.setModal('shortcuts')
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        store.selectSibling(event.shiftKey ? -1 : 1)
        return
      }
      if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        store.selectAll()
        return
      }
      // Framer's tool keys, and the same letters everyone else uses.
      if (!mod && event.key.toLowerCase() === 'v') {
        store.setTool('move')
        return
      }
      if (!mod && event.key.toLowerCase() === 'h') {
        store.setTool('hand')
        return
      }

      if (!selected) return
      const chosen = store.selection()

      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        chosen.forEach((id) => store.duplicate(id))
        return
      }
      if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        event.shiftKey ? store.unwrap(selected) : store.wrap(selected)
        return
      }
      if (mod && event.key.toLowerCase() === 'c') {
        store.copy(selected)
        return
      }
      if (mod && event.key.toLowerCase() === 'v') {
        store.paste()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        chosen.forEach((id) => store.remove(id))
        return
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        store.nudgeOrder(selected, event.key === 'ArrowUp' ? -1 : 1)
        return
      }
      // Arrow keys move the selection: one pixel, or ten with Shift.
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const by = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0],
          ArrowUp: [0, -step], ArrowDown: [0, step],
        }[event.key]
        if (by) store.nudgeSelection(by[0], by[1])
        return
      }
      if (event.key === 'Enter') {
        const node = store.selectedNode()
        if (!node) return
        event.preventDefault()
        if (event.shiftKey) store.selectParent()
        else if (def(node.type).textual) store.startTextEdit(node.id)
        else store.selectChild()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
