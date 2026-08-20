import Icon from '../ui/Icon.jsx'
import AddPanel from './AddPanel.jsx'
import LayersPanel from './LayersPanel.jsx'
import PagesPanel from './PagesPanel.jsx'
import ThemePanel from './ThemePanel.jsx'
import AssetsPanel from './AssetsPanel.jsx'
import { useStore } from '../../core/store.js'

const TABS = [
  { id: 'add', label: 'Add', icon: 'Plus', Panel: AddPanel },
  { id: 'layers', label: 'Layers', icon: 'Layers', Panel: LayersPanel },
  { id: 'pages', label: 'Pages', icon: 'Files', Panel: PagesPanel },
  { id: 'theme', label: 'Look', icon: 'Palette', Panel: ThemePanel },
  { id: 'images', label: 'Images', icon: 'Image', Panel: AssetsPanel },
]

export default function LeftPanel() {
  const leftTab = useStore((s) => s.leftTab)
  const setLeftTab = useStore((s) => s.setLeftTab)
  // "sections" is the Add panel opened on its second tab -- treat it as Add.
  const active = TABS.find((t) => t.id === leftTab) || TABS[0]
  const Panel = active.Panel

  return (
    <aside className="wb-panel">
      <div className="wb-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active.id === tab.id}
            onClick={() => setLeftTab(tab.id)}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <Panel />
    </aside>
  )
}
