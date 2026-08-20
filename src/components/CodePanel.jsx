/**
 * The code panel.
 *
 * Left to itself it mirrors the canvas. Start typing and it becomes the source
 * of truth: after a short pause the edit is parsed and pushed back onto the
 * canvas. If the code does not parse, nothing is applied and the error is
 * shown -- the canvas is never left in a broken state.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { css as cssLang } from '@codemirror/lang-css'
import { html as htmlLang } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import Icon from './ui/Icon.jsx'
import { useStore, useActivePage } from '../core/store.js'
import { debounce } from '../core/util.js'

const FILES = [
  { name: 'App.jsx', language: 'jsx', editable: true, hint: 'The page, as React' },
  { name: 'styles.css', language: 'css', editable: true, hint: 'Every style on this page' },
  { name: 'index.html', language: 'html', editable: false, hint: 'The same page as plain HTML' },
]

const languageFor = (id) => (id === 'css' ? cssLang() : id === 'html' ? htmlLang() : javascript({ jsx: true }))

function CodeEditor({ value, language, readOnly, onChange }) {
  const host = useRef(null)
  const view = useRef(null)
  const onChangeRef = useRef(onChange)
  const applyingExternal = useRef(false)
  onChangeRef.current = onChange

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageFor(language),
        oneDark,
        EditorView.lineWrapping,
        EditorState.readOnly.of(!!readOnly),
        EditorView.updateListener.of((update) => {
          // Ignore the edits we make ourselves when the canvas changes.
          if (!update.docChanged || applyingExternal.current) return
          onChangeRef.current?.(update.state.doc.toString())
        }),
      ],
    })
    view.current = new EditorView({ state, parent: host.current })
    return () => {
      view.current?.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly])

  // Pull in changes that came from the canvas without disturbing the caret.
  useEffect(() => {
    const v = view.current
    if (!v || v.hasFocus) return
    const current = v.state.doc.toString()
    if (current === value) return
    applyingExternal.current = true
    v.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    applyingExternal.current = false
  }, [value])

  return <div className="wb-code-editor" ref={host} />
}

export default function CodePanel() {
  const page = useActivePage()
  const theme = useStore((s) => s.project.theme)
  const codeFile = useStore((s) => s.codeFile)
  const setCodeFile = useStore((s) => s.setCodeFile)
  const codeDraft = useStore((s) => s.codeDraft)
  const codeDirty = useStore((s) => s.codeDirty)
  const codeError = useStore((s) => s.codeError)
  const setCodeDraft = useStore((s) => s.setCodeDraft)
  const applyCode = useStore((s) => s.applyCode)
  const discardCodeDraft = useStore((s) => s.discardCodeDraft)
  const currentFiles = useStore((s) => s.currentFiles)
  const toggleCode = useStore((s) => s.toggleCode)
  const codePane = useStore((s) => s.codePane)
  const setCodePane = useStore((s) => s.setCodePane)
  const [autoApply, setAutoApply] = useState(true)

  const generated = useMemo(() => currentFiles(), [page.root, page.customCss, theme, currentFiles])
  const files = codeDraft || generated
  const file = FILES.find((f) => f.name === codeFile) || FILES[0]

  const scheduleApply = useMemo(() => debounce(() => useStore.getState().applyCode(), 900), [])

  useEffect(() => () => scheduleApply.cancel(), [scheduleApply])

  const status = codeError ? 'error' : codeDirty ? 'dirty' : 'synced'

  return (
    <div className="wb-code">
      <div className="wb-code-head">
        <div className="wb-code-tabs">
          {FILES.map((f) => (
            <button key={f.name} aria-selected={f.name === codeFile} onClick={() => setCodeFile(f.name)} title={f.hint}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="wb-spacer" />
        <button
          className="wb-tip"
          data-tip={codePane === 'right' ? 'Move to the bottom' : 'Move to the side'}
          data-tip-side="left"
          onClick={() => setCodePane(codePane === 'right' ? 'bottom' : 'right')}
          style={{ border: 0, background: 'transparent', color: '#98a2b3', padding: 4, borderRadius: 6 }}
        >
          <Icon name={codePane === 'right' ? 'PanelBottomClose' : 'PanelRightClose'} size={15} />
        </button>
        <button
          className="wb-tip"
          data-tip="Close the code panel"
          data-tip-side="left"
          onClick={toggleCode}
          style={{ border: 0, background: 'transparent', color: '#98a2b3', padding: 4, borderRadius: 6 }}
        >
          <Icon name="X" size={15} />
        </button>
      </div>

      <CodeEditor
        key={file.name}
        value={files[file.name] || ''}
        language={file.language}
        readOnly={!file.editable}
        onChange={(value) => {
          if (!file.editable) return
          setCodeDraft(file.name, value)
          if (autoApply) scheduleApply()
        }}
      />

      <div className="wb-code-status" data-state={status}>
        {status === 'error' && (
          <>
            <Icon name="AlertTriangle" size={13} />
            <span className="wb-grow">
              {codeError.file} {codeError.line ? `line ${codeError.line}: ` : ''}{codeError.message}
            </span>
            <button onClick={() => discardCodeDraft()}>Undo my edit</button>
          </>
        )}
        {status === 'dirty' && (
          <>
            <Icon name="Pencil" size={13} />
            <span className="wb-grow">Edited — {autoApply ? 'applying…' : 'not applied yet'}</span>
            <button onClick={() => applyCode()}>Apply now</button>
            <button onClick={() => discardCodeDraft()}>Discard</button>
          </>
        )}
        {status === 'synced' && (
          <>
            <Icon name="Check" size={13} />
            <span className="wb-grow">
              {file.editable ? 'In step with the canvas — type here and the page updates' : 'Generated from your page'}
            </span>
            <label className="wb-row" style={{ gap: 5, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
              <span>Live</span>
            </label>
          </>
        )}
      </div>
    </div>
  )
}
