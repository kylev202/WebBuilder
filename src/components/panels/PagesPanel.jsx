/**
 * Pages: add, rename, reorder-by-duplication and switch between the pages of
 * the project. The "address" is what appears in the browser bar once exported.
 */
import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Field, TextInput } from '../ui/controls.jsx'
import { useStore } from '../../core/store.js'

export default function PagesPanel() {
  const pages = useStore((s) => s.project.pages)
  const activePageId = useStore((s) => s.activePageId)
  const setActivePage = useStore((s) => s.setActivePage)
  const addPage = useStore((s) => s.addPage)
  const renamePage = useStore((s) => s.renamePage)
  const setPagePath = useStore((s) => s.setPagePath)
  const duplicatePage = useStore((s) => s.duplicatePage)
  const removePage = useStore((s) => s.removePage)
  const [expanded, setExpanded] = useState(null)

  return (
    <>
      <div className="wb-panel-head">
        <span className="wb-panel-title">Pages</span>
        <button className="wb-btn wb-btn--sm" onClick={() => addPage(`Page ${pages.length + 1}`)}>
          <Icon name="Plus" size={13} /> Add
        </button>
      </div>
      <div className="wb-panel-sub">
        Every page is its own canvas. Link between them with a button set to “Go to a link” and the page address.
      </div>

      <div className="wb-panel-scroll" style={{ padding: '0 12px 12px' }}>
        <div className="wb-col" style={{ gap: 6 }}>
          {pages.map((page) => {
            const active = page.id === activePageId
            const open = expanded === page.id
            return (
              <div
                key={page.id}
                style={{
                  border: `1px solid ${active ? 'var(--ui-accent-line)' : 'var(--ui-line)'}`,
                  background: active ? 'var(--ui-accent-soft)' : 'var(--ui-panel)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="wb-row"
                  style={{ padding: '8px 9px', cursor: 'pointer' }}
                  onClick={() => setActivePage(page.id)}
                >
                  <Icon name="File" size={14} style={{ color: active ? 'var(--ui-accent)' : 'var(--ui-text-3)' }} />
                  <div className="wb-grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--ui-accent)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.name}
                    </div>
                    <div className="wb-small wb-muted" style={{ fontFamily: 'var(--ui-mono)', fontSize: 10.5 }}>{page.path}</div>
                  </div>
                  <button
                    className="wb-btn wb-btn--icon wb-btn--ghost wb-btn--sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(open ? null : page.id)
                    }}
                    aria-label="Page settings"
                  >
                    <Icon name={open ? 'ChevronUp' : 'Settings2'} size={13} />
                  </button>
                </div>

                {open && (
                  <div style={{ padding: '4px 9px 10px', borderTop: '1px solid var(--ui-line)', background: 'var(--ui-panel)' }}>
                    <div className="wb-col" style={{ gap: 8, paddingTop: 8 }}>
                      <Field label="Name">
                        <TextInput value={page.name} onChange={(v) => renamePage(page.id, v)} />
                      </Field>
                      <Field label="Address" hint="What visitors see in the browser bar. The home page is /">
                        <TextInput value={page.path} onChange={(v) => setPagePath(page.id, v)} placeholder="/about" />
                      </Field>
                      <div className="wb-row">
                        <button className="wb-btn wb-btn--sm wb-grow" onClick={() => duplicatePage(page.id)}>
                          <Icon name="Copy" size={12} /> Duplicate
                        </button>
                        <button
                          className="wb-btn wb-btn--sm wb-btn--danger"
                          disabled={pages.length <= 1}
                          onClick={() => removePage(page.id)}
                        >
                          <Icon name="Trash2" size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
