import { useRef } from 'react'
import Icon from './ui/Icon.jsx'
import { useStore, useCanUndo, useCanRedo } from '../core/store.js'
import { importProjectFile, openPreviewTab } from '../core/export.js'

export default function TopBar() {
  const project = useStore((s) => s.project)
  const renameProject = useStore((s) => s.renameProject)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const showCode = useStore((s) => s.showCode)
  const toggleCode = useStore((s) => s.toggleCode)
  const setModal = useStore((s) => s.setModal)
  const saveNow = useStore((s) => s.saveNow)
  const loadProject = useStore((s) => s.loadProject)
  const toast = useStore((s) => s.toast)
  const activePageId = useStore((s) => s.activePageId)
  const fileRef = useRef(null)

  const page = project.pages.find((p) => p.id === activePageId) || project.pages[0]

  return (
    <header className="wb-topbar">
      <div className="wb-brand">
        <span className="wb-brand-mark"><Icon name="Blocks" size={14} /></span>
        <span>WebBuilder</span>
      </div>

      <input
        className="wb-projectname"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        aria-label="Project name"
        title="Click to rename your project"
      />

      <div className="wb-row" style={{ gap: 2 }}>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Icon name="Undo2" size={15} />
        </button>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Icon name="Redo2" size={15} />
        </button>
      </div>

      <div className="wb-spacer" />

      <button className="wb-btn" onClick={() => setModal('templates')}>
        <Icon name="LayoutTemplate" size={14} /> Templates
      </button>

      <button className="wb-btn wb-tip" data-tip="Open a project file you saved earlier" onClick={() => fileRef.current?.click()}>
        <Icon name="FolderOpen" size={14} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.webbuilder.json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            loadProject(await importProjectFile(file))
          } catch (err) {
            toast(err.message, { kind: 'warn' })
          }
        }}
      />

      <div className="wb-spacer" />

      <button
        className="wb-btn wb-tip"
        data-tip="See it exactly as a visitor would (Ctrl+Enter)"
        data-active={mode === 'preview'}
        onClick={() => setMode(mode === 'preview' ? 'design' : 'preview')}
      >
        <Icon name="Eye" size={14} /> Preview
      </button>

      <button
        className="wb-btn wb-tip"
        data-tip="Show the code for this page (Ctrl+/)"
        data-active={showCode}
        onClick={toggleCode}
      >
        <Icon name="Code2" size={14} /> Code
      </button>

      <button className="wb-btn wb-btn--icon wb-tip" data-tip="Open this page in a new tab" onClick={() => openPreviewTab(project, page)}>
        <Icon name="Maximize2" size={14} />
      </button>

      <button className="wb-btn wb-btn--icon wb-tip" data-tip="Save now (Ctrl+S) — your work also saves automatically" onClick={saveNow}>
        <Icon name="Save" size={14} />
      </button>

      <button className="wb-btn wb-btn--primary" onClick={() => setModal('export')}>
        <Icon name="Download" size={14} /> Export
      </button>

      <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Help and shortcuts" data-tip-side="left" onClick={() => setModal('shortcuts')}>
        <Icon name="HelpCircle" size={15} />
      </button>
    </header>
  )
}
