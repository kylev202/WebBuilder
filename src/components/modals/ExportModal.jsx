import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Modal } from '../ui/controls.jsx'
import { exportZip, exportSingleHtml, exportProjectFile } from '../../core/export.js'
import { flatten } from '../../core/doc.js'
import { useStore, useActivePage } from '../../core/store.js'

const OPTIONS = [
  {
    id: 'both',
    icon: 'Rocket',
    title: 'Everything (recommended)',
    desc: 'A zip containing the ready-to-upload website, the React project, and a backup of your work.',
  },
  {
    id: 'site',
    icon: 'Globe',
    title: 'Website only',
    desc: 'Plain HTML and CSS. Upload the folder to any host — Netlify, Vercel, GitHub Pages or ordinary web hosting.',
  },
  {
    id: 'react',
    icon: 'Code2',
    title: 'React project only',
    desc: 'A Vite + React app. Run npm install, then npm run dev. Hand this to a developer to carry on in code.',
  },
  {
    id: 'page',
    icon: 'FileCode',
    title: 'This page as one file',
    desc: 'A single HTML file with the styles inside it. Easy to email or open straight from your desktop.',
  },
  {
    id: 'backup',
    icon: 'FileJson',
    title: 'Project backup',
    desc: 'Save your project so you can open it again later, on this computer or another one.',
  },
]

export default function ExportModal() {
  const project = useStore((s) => s.project)
  const setModal = useStore((s) => s.setModal)
  const toast = useStore((s) => s.toast)
  const page = useActivePage()
  const [busy, setBusy] = useState(null)

  const elementCount = project.pages.reduce((sum, p) => sum + flatten(p.root).length - 1, 0)

  const run = async (id) => {
    setBusy(id)
    try {
      if (id === 'both') await exportZip(project, { site: true, react: true })
      else if (id === 'site') await exportZip(project, { site: true, react: false })
      else if (id === 'react') await exportZip(project, { site: false, react: true })
      else if (id === 'page') exportSingleHtml(project, page)
      else if (id === 'backup') exportProjectFile(project)
      toast('Downloaded')
      setModal(null)
    } catch (err) {
      toast(`Export failed: ${err.message}`, { kind: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      icon="Download"
      title="Take your work with you"
      subtitle={`“${project.name}” — ${project.pages.length} page${project.pages.length > 1 ? 's' : ''}, ${elementCount} elements. Everything you export is plain, readable code with no trace of this builder.`}
      onClose={() => setModal(null)}
      footer={<button className="wb-btn" onClick={() => setModal(null)}>Close</button>}
      size="sm"
    >
      <div className="wb-col" style={{ gap: 8 }}>
        {OPTIONS.map((option) => (
          <button key={option.id} className="wb-optioncard" disabled={!!busy} onClick={() => run(option.id)}>
            <span className="wb-optioncard-icon">
              <Icon name={busy === option.id ? 'RotateCcw' : option.icon} size={17} />
            </span>
            <span>
              <span className="wb-optioncard-title">{option.title}</span>
              <span className="wb-optioncard-desc" style={{ display: 'block' }}>{option.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div
        className="wb-row"
        style={{ marginTop: 14, padding: 10, borderRadius: 9, background: 'var(--ui-panel-2)', border: '1px solid var(--ui-line)', alignItems: 'flex-start' }}
      >
        <Icon name="Info" size={13} style={{ color: 'var(--ui-text-3)', flexShrink: 0, marginTop: 1 }} />
        <div className="wb-small wb-muted" style={{ lineHeight: 1.55 }}>
          Your work is also saved in this browser automatically. The project backup is the safe way to move it to
          another computer or keep a copy.
        </div>
      </div>
    </Modal>
  )
}
