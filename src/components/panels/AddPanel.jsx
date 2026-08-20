/**
 * "Add" panel: single elements on one side, whole ready-made sections on the
 * other. Everything can be dragged onto the canvas or added with one click.
 */
import { useEffect, useMemo, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Segmented, Empty } from '../ui/controls.jsx'
import { paletteGroups } from '../../core/elements.js'
import { BLOCKS, BLOCK_CATEGORIES } from '../../core/blocks.js'
import { useStore } from '../../core/store.js'

export default function AddPanel() {
  const [tab, setTab] = useState('elements')
  const [query, setQuery] = useState('')
  const leftTab = useStore((s) => s.leftTab)

  // Other parts of the app can ask for the sections list directly.
  useEffect(() => {
    if (leftTab === 'sections') setTab('sections')
  }, [leftTab])

  return (
    <>
      <div style={{ padding: '10px 12px 8px' }}>
        <Segmented
          fill
          value={tab}
          onChange={setTab}
          options={[
            { value: 'elements', label: 'Pieces', icon: 'Blocks' },
            { value: 'sections', label: 'Sections', icon: 'LayoutTemplate' },
          ]}
        />
      </div>

      <div className="wb-search">
        <Icon name="Search" size={14} />
        <input
          value={query}
          placeholder={tab === 'elements' ? 'Search pieces…' : 'Search sections…'}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="wb-panel-scroll">
        {tab === 'elements' ? <Elements query={query} /> : <Sections query={query} />}
      </div>
    </>
  )
}

/* -------------------------------------------------------------- pieces */

function Elements({ query }) {
  const addElement = useStore((s) => s.addElement)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return paletteGroups()
      .map((g) => ({
        ...g,
        items: g.items.filter((el) =>
          !q || el.label.toLowerCase().includes(q) || (el.keywords || '').includes(q) || el.type.includes(q)),
      }))
      .filter((g) => g.items.length)
  }, [query])

  if (!groups.length) {
    return <Empty icon="Search" title="Nothing matches">Try a simpler word, like “button” or “picture”.</Empty>
  }

  return groups.map((group) => (
    <div key={group.id}>
      <div className="wb-group-label">
        {group.label}
        <span className="wb-tip" data-tip={group.hint} style={{ color: 'var(--ui-text-3)', display: 'inline-flex' }}>
          <Icon name="Info" size={11} />
        </span>
      </div>
      <div className="wb-tilegrid">
        {group.items.map((el) => (
          <button
            key={el.type}
            className="wb-tile wb-tip"
            data-tip={el.hint}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('text/wb-element', el.type)
            }}
            onClick={() => addElement(el.type)}
          >
            <Icon name={el.icon} size={15} />
            <span>{el.label}</span>
          </button>
        ))}
      </div>
    </div>
  ))
}

/* ------------------------------------------------------------ sections */

function Sections({ query }) {
  const addBlock = useStore((s) => s.addBlock)
  const q = query.trim().toLowerCase()
  const matches = BLOCKS.filter((b) => !q || b.label.toLowerCase().includes(q) || b.hint.toLowerCase().includes(q))

  if (!matches.length) {
    return <Empty icon="Search" title="Nothing matches">Try “hero”, “pricing” or “footer”.</Empty>
  }

  return BLOCK_CATEGORIES.map((category) => {
    const items = matches.filter((b) => b.category === category)
    if (!items.length) return null
    return (
      <div key={category}>
        <div className="wb-group-label">{category}</div>
        <div className="wb-blocklist">
          {items.map((block) => (
            <div
              key={block.id}
              className="wb-block"
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('text/wb-block', block.id)
              }}
              onClick={() => addBlock(block.id)}
              onKeyDown={(e) => e.key === 'Enter' && addBlock(block.id)}
            >
              <Sketch spec={block.sketch} />
              <div className="wb-block-meta">
                <div className="wb-block-name">{block.label}</div>
                <div className="wb-block-hint">{block.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  })
}

/** A tiny wireframe drawn from the block's `sketch` description. */
function Sketch({ spec = [] }) {
  return (
    <div className="wb-block-sketch">
      {spec.map((line, i) => {
        if (line.startsWith('cols:')) {
          const n = Number(line.split(':')[1]) || 3
          return (
            <div key={i} className="wb-sk-cols">
              {Array.from({ length: n }, (_, c) => <div key={c} className="wb-sk-col" />)}
            </div>
          )
        }
        if (line.startsWith('row:')) {
          const items = line.slice(4).split(',')
          return (
            <div key={i} className="wb-sk-row">
              {items.map((item, c) => {
                if (item === 'spacer') return <div key={c} style={{ flex: 1 }} />
                if (item === 'logo' || item === 'avatar' || item === 'circle') return <div key={c} className="wb-sk--circle" />
                if (item === 'button') return <div key={c} className="wb-sk--btn" />
                if (item === 'input') return <div key={c} className="wb-sk" style={{ flex: 1, height: 12 }} />
                if (item === 'link') return <div key={c} className="wb-sk" style={{ width: 26 }} />
                return <div key={c} className="wb-sk" style={{ width: 40 }} />
              })}
            </div>
          )
        }
        if (line === 'title') return <div key={i} className="wb-sk wb-sk--title" />
        if (line === 'text') return <div key={i} className="wb-sk wb-sk--text" />
        if (line === 'image') return <div key={i} className="wb-sk--img" />
        if (line === 'divider') return <div key={i} className="wb-sk" style={{ height: 2, width: '100%' }} />
        if (line === 'badge') return <div key={i} className="wb-sk" style={{ width: 30, height: 8, borderRadius: 999 }} />
        if (line === 'button') return <div key={i} className="wb-sk--btn" />
        if (line === 'quote') return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="wb-sk wb-sk--text" />
            <div className="wb-sk wb-sk--text2" />
          </div>
        )
        return <div key={i} className="wb-sk wb-sk--text" />
      })}
    </div>
  )
}
