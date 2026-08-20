/**
 * Layers: the page as a tree. Handy when things overlap on the canvas or sit
 * inside one another, and the fastest way to rename, hide or reorder.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Empty } from '../ui/controls.jsx'
import { def } from '../../core/elements.js'
import { findNode, contains } from '../../core/doc.js'
import { useStore, useActivePage } from '../../core/store.js'

export default function LayersPanel() {
  const page = useActivePage()
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [dropHint, setDropHint] = useState(null)
  const selectedId = useStore((s) => s.selectedId)

  const toggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Keep the selected node visible by opening its ancestors.
  useEffect(() => {
    if (!selectedId) return
    setCollapsed((prev) => {
      if (!prev.size) return prev
      const next = new Set(prev)
      let changed = false
      for (const id of prev) {
        const node = findNode(page.root, id)?.node
        if (node && contains(node, selectedId) && node.id !== selectedId) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedId, page.root])

  const hasChildren = (page.root.children || []).length > 0

  return (
    <>
      <div className="wb-panel-head">
        <span className="wb-panel-title">Everything on this page</span>
        <span className="wb-small wb-muted">{page.name}</span>
      </div>
      <div className="wb-panel-scroll" style={{ padding: '0 8px 12px' }}>
        {hasChildren ? (
          <Row
            node={page.root}
            depth={0}
            collapsed={collapsed}
            toggle={toggle}
            dropHint={dropHint}
            setDropHint={setDropHint}
          />
        ) : (
          <Empty icon="Layers" title="Nothing here yet">
            Add a section or a piece from the Add tab and it will appear in this list.
          </Empty>
        )}
      </div>
    </>
  )
}

function Row({ node, depth, collapsed, toggle, dropHint, setDropHint }) {
  const selectedId = useStore((s) => s.selectedId)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const selectAlso = useStore((s) => s.selectAlso)
  const hover = useStore((s) => s.hover)
  const rename = useStore((s) => s.rename)
  const toggleFlag = useStore((s) => s.toggleFlag)
  const duplicate = useStore((s) => s.duplicate)
  const remove = useStore((s) => s.remove)
  const moveTo = useStore((s) => s.moveTo)
  const page = useActivePage()

  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)
  const d = def(node.type)
  const kids = node.children || []
  const isOpen = !collapsed.has(node.id)
  const isRoot = node.type === 'page'
  // Highlight everything in the selection, not just the one the panels edit.
  const selected = selectedId === node.id || selectedIds.includes(node.id)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const onDragOver = (e) => {
    if (isRoot) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const offset = (e.clientY - rect.top) / rect.height
    const zone = d.container && offset > 0.3 && offset < 0.7 ? 'inside' : offset < 0.5 ? 'before' : 'after'
    setDropHint({ id: node.id, zone })
  }

  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const movingId = e.dataTransfer.getData('text/wb-move')
    const elementType = e.dataTransfer.getData('text/wb-element')
    const hint = dropHint
    setDropHint(null)
    if (!hint) return

    const hit = findNode(page.root, node.id)
    const target = hint.zone === 'inside'
      ? { parentId: node.id, index: (node.children || []).length }
      : { parentId: hit?.parent?.id, index: hit ? hit.index + (hint.zone === 'after' ? 1 : 0) : 0 }
    if (!target.parentId) return

    if (movingId) moveTo(movingId, target.parentId, target.index)
    else if (elementType) useStore.getState().addElement(elementType, target)
  }

  return (
    <>
      {dropHint?.id === node.id && dropHint.zone === 'before' && <div className="wb-layer-drop" />}
      <div
        className="wb-layer"
        data-selected={selected}
        data-hidden={node.hidden}
        style={{
          paddingLeft: 4 + depth * 12,
          ...(dropHint?.id === node.id && dropHint.zone === 'inside'
            ? { boxShadow: 'inset 0 0 0 1.5px var(--ui-accent)' }
            : null),
        }}
        draggable={!isRoot}
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/wb-move', node.id)
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropHint(null)}
        onDrop={onDrop}
        onClick={(e) => (e.shiftKey ? selectAlso(node.id) : select(node.id))}
        onDoubleClick={() => setEditing(true)}
        onMouseEnter={() => hover(node.id)}
        onMouseLeave={() => hover(null)}
      >
        {kids.length > 0 ? (
          <button
            className="wb-layer-caret"
            onClick={(e) => {
              e.stopPropagation()
              toggle(node.id)
            }}
          >
            <Icon name="ChevronRight" size={12} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        <Icon name={d.icon} size={13} style={{ flexShrink: 0, opacity: 0.75 }} />

        <span className="wb-layer-name">
          {editing ? (
            <input
              ref={inputRef}
              defaultValue={node.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                rename(node.id, e.target.value.trim() || d.label)
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            node.name
          )}
        </span>

        {!isRoot && (
          <div className="wb-layer-actions">
            <button
              className="wb-tip"
              data-tip={node.hidden ? 'Show' : 'Hide'}
              data-tip-side="left"
              onClick={(e) => {
                e.stopPropagation()
                toggleFlag(node.id, 'hidden')
              }}
            >
              <Icon name={node.hidden ? 'EyeOff' : 'Eye'} size={12} />
            </button>
            <button
              className="wb-tip"
              data-tip={node.locked ? 'Unlock' : 'Lock so it cannot be moved'}
              data-tip-side="left"
              onClick={(e) => {
                e.stopPropagation()
                toggleFlag(node.id, 'locked')
              }}
            >
              <Icon name={node.locked ? 'Lock' : 'Unlock'} size={12} />
            </button>
            <button
              className="wb-tip"
              data-tip="Make a copy"
              data-tip-side="left"
              onClick={(e) => {
                e.stopPropagation()
                duplicate(node.id)
              }}
            >
              <Icon name="Copy" size={12} />
            </button>
            <button
              className="wb-tip"
              data-tip="Delete"
              data-tip-side="left"
              onClick={(e) => {
                e.stopPropagation()
                remove(node.id)
              }}
            >
              <Icon name="Trash2" size={12} />
            </button>
          </div>
        )}
      </div>
      {dropHint?.id === node.id && dropHint.zone === 'after' && <div className="wb-layer-drop" />}

      {isOpen && kids.map((child) => (
        <Row
          key={child.id}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          toggle={toggle}
          dropHint={dropHint}
          setDropHint={setDropHint}
        />
      ))}
    </>
  )
}
