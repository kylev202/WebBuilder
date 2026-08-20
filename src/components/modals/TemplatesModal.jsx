import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Modal } from '../ui/controls.jsx'
import { TEMPLATES } from '../../core/templates.js'
import { THEME_PRESETS } from '../../core/theme.js'
import { useStore } from '../../core/store.js'

/** A little abstract drawing of what the template looks like. */
function TemplateArt({ template }) {
  const theme = THEME_PRESETS[template.preset]
  const bars = {
    blank: [],
    landing: ['nav', 'hero', 'cols', 'cta'],
    saas: ['nav', 'split', 'cols', 'cta'],
    portfolio: ['nav', 'split', 'grid'],
    agency: ['nav', 'split', 'cols', 'cta'],
    event: ['nav', 'hero', 'cols'],
    'coming-soon': ['hero', 'form'],
    onepager: ['nav', 'hero', 'grid'],
  }[template.id] || ['nav', 'hero']

  return (
    <div className="wb-template-art" style={{ background: theme.colors.bg }}>
      {bars.length === 0 && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: theme.colors.muted, fontSize: 11 }}>
          Empty page
        </div>
      )}
      {bars.map((kind, i) => {
        if (kind === 'nav') {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 5, borderRadius: 2, background: theme.colors.text, opacity: .8 }} />
              <span style={{ flex: 1 }} />
              <span style={{ width: 8, height: 4, borderRadius: 2, background: theme.colors.muted, opacity: .5 }} />
              <span style={{ width: 8, height: 4, borderRadius: 2, background: theme.colors.muted, opacity: .5 }} />
              <span style={{ width: 14, height: 7, borderRadius: 3, background: theme.colors.primary }} />
            </div>
          )
        }
        if (kind === 'hero') {
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0' }}>
              <span style={{ width: '62%', height: 8, borderRadius: 3, background: theme.colors.text, opacity: .85 }} />
              <span style={{ width: '44%', height: 4, borderRadius: 2, background: theme.colors.muted, opacity: .5 }} />
              <span style={{ width: 26, height: 8, borderRadius: 3, background: theme.colors.primary, marginTop: 2 }} />
            </div>
          )
        }
        if (kind === 'split') {
          return (
            <div key={i} style={{ display: 'flex', gap: 6, flex: 1, padding: '4px 0' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                <span style={{ width: '85%', height: 7, borderRadius: 3, background: theme.colors.text, opacity: .85 }} />
                <span style={{ width: '65%', height: 4, borderRadius: 2, background: theme.colors.muted, opacity: .5 }} />
                <span style={{ width: 22, height: 7, borderRadius: 3, background: theme.colors.primary }} />
              </div>
              <div style={{ flex: 1, borderRadius: 5, background: theme.colors.primary, opacity: .18 }} />
            </div>
          )
        }
        if (kind === 'cols' || kind === 'grid') {
          const n = kind === 'grid' ? 3 : 3
          return (
            <div key={i} style={{ display: 'flex', gap: 4, flex: 1 }}>
              {Array.from({ length: n }, (_, c) => (
                <div key={c} style={{ flex: 1, borderRadius: 4, background: theme.colors.surface, border: `1px solid ${theme.colors.border}` }} />
              ))}
            </div>
          )
        }
        if (kind === 'form') {
          return (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <span style={{ flex: 1, height: 8, borderRadius: 3, background: theme.colors.surface, border: `1px solid ${theme.colors.border}` }} />
              <span style={{ width: 20, height: 8, borderRadius: 3, background: theme.colors.primary }} />
            </div>
          )
        }
        return (
          <div key={i} style={{ borderRadius: 4, background: theme.colors.primary, opacity: .9, height: 14, display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 24, height: 4, borderRadius: 2, background: '#fff', opacity: .8 }} />
          </div>
        )
      })}
    </div>
  )
}

export default function TemplatesModal() {
  const setModal = useStore((s) => s.setModal)
  const newProjectFrom = useStore((s) => s.newProjectFrom)
  const [pending, setPending] = useState(null)

  const close = () => setModal(null)

  if (pending) {
    return (
      <Modal
        size="sm"
        icon="AlertTriangle"
        title="Start again with this template?"
        subtitle="Your current project will be replaced. If you want to keep it, export it first — the Export button offers a project file you can open later."
        onClose={() => setPending(null)}
        footer={
          <>
            <button className="wb-btn" onClick={() => setPending(null)}>Keep what I have</button>
            <button className="wb-btn wb-btn--primary" onClick={() => newProjectFrom(pending.id)}>
              Yes, use “{pending.label}”
            </button>
          </>
        }
      >
        <div className="wb-row" style={{ gap: 12 }}>
          <div style={{ width: 200, border: '1px solid var(--ui-line)', borderRadius: 10, overflow: 'hidden' }}>
            <TemplateArt template={pending} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{pending.label}</div>
            <div className="wb-small wb-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{pending.description}</div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      icon="LayoutTemplate"
      title="Pick a starting point"
      subtitle="Every template is fully editable — change the words, colours and pictures, or pull out the parts you do not need."
      onClose={close}
      footer={<button className="wb-btn" onClick={close}>Close</button>}
    >
      <div className="wb-templategrid">
        {TEMPLATES.map((template) => (
          <button key={template.id} className="wb-template" onClick={() => setPending(template)}>
            <TemplateArt template={template} />
            <div className="wb-template-meta">
              <div className="wb-template-name">
                {template.label}
                {template.tag && <span className="wb-chip">{template.tag}</span>}
              </div>
              <div className="wb-template-desc">{template.description}</div>
              <div className="wb-small wb-muted" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="Files" size={11} />
                {template.pages().length} page{template.pages().length > 1 ? 's' : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
