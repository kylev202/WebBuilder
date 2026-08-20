/**
 * Renders one document node as a real DOM element.
 *
 * The canvas is not a picture of the page -- it *is* the page, styled by the
 * very stylesheet that gets exported. In design mode we only intercept
 * interactions (so clicking a link selects it instead of navigating).
 */
import { memo, useEffect, useRef } from 'react'
import { def, tagFor } from '../../core/elements.js'
import { classFor } from '../../core/doc.js'
import { toEmbedUrl } from '../../core/codegen.js'
import { ICON_PATHS } from '../../core/icons.js'
import { useStore } from '../../core/store.js'
import { useCanvas } from './context.js'

/** Type straight onto the canvas. Uncontrolled, so the caret never jumps. */
function EditableText({ Tag, attrs, text, onCommit }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = text ?? ''
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = () => onCommit(ref.current?.innerText ?? '')

  return (
    <Tag
      {...attrs}
      ref={ref}
      draggable={false}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          commit()
        }
      }}
    />
  )
}

function NodeView({ node, preview }) {
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const startTextEdit = useStore((s) => s.startTextEdit)
  const stopTextEdit = useStore((s) => s.stopTextEdit)
  const setProp = useStore((s) => s.setProp)
  const editingTextId = useStore((s) => s.editingTextId)
  const canvas = useCanvas()

  if (node.hidden) return null

  const d = def(node.type)
  const Tag = tagFor(node)
  const isEditing = editingTextId === node.id
  const p = node.props || {}

  const attrs = {
    className: classFor(node),
    'data-node-id': node.id,
    'data-textual': d.textual ? 'true' : undefined,
    'data-editing': isEditing ? 'true' : undefined,
    'data-empty': d.container && !(node.children || []).length ? 'true' : undefined,
    id: p.htmlId || undefined,
  }

  if (!preview) {
    attrs.draggable = false
    // One press does everything: it selects, and if the pointer then moves it
    // becomes a drag. The engine decides whether that drag reorders or places.
    attrs.onPointerDown = (e) => {
      // While typing, the press belongs to the caret -- but the box around
      // this must not grab it and start dragging.
      if (isEditing) {
        e.stopPropagation()
        return
      }
      // A locked thing is not there as far as the pointer is concerned, so the
      // press falls through to whatever holds it.
      if (node.locked) return
      e.stopPropagation()
      // Stops links, buttons and inputs taking focus while designing.
      if (!d.container || d.textual) e.preventDefault()
      canvas?.engine.press(e, node)
    }
    attrs.onClick = (e) => {
      e.stopPropagation()
      if (!isEditing) e.preventDefault()
    }
    attrs.onDoubleClick = (e) => {
      e.stopPropagation()
      if (d.textual && !node.locked) startTextEdit(node.id)
      else if (!node.locked) select(node.id)
    }
    attrs.onMouseOver = (e) => {
      e.stopPropagation()
      hover(node.id)
    }
    attrs.onMouseOut = (e) => {
      e.stopPropagation()
      hover(null)
    }
  }

  /* ------------------------------------------------ element specifics */

  if (node.type === 'icon') {
    const path = ICON_PATHS[p.icon] || ICON_PATHS.star
    return (
      <svg
        {...attrs}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    )
  }

  if (node.type === 'image') {
    return <img {...attrs} src={p.src || ''} alt={p.alt || ''} />
  }

  if (node.type === 'video') {
    return (
      <iframe
        {...attrs}
        src={toEmbedUrl(p.src)}
        title={node.name}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        style={!preview ? { pointerEvents: 'none' } : undefined}
      />
    )
  }

  if (node.type === 'input' || node.type === 'checkbox') {
    return (
      <input
        {...attrs}
        type={node.type === 'checkbox' ? 'checkbox' : p.inputType || 'text'}
        name={p.name || undefined}
        placeholder={p.placeholder || undefined}
        required={!!p.required}
        defaultChecked={!!p.checked}
        readOnly={!preview}
        tabIndex={preview ? undefined : -1}
      />
    )
  }

  if (node.type === 'textarea') {
    return (
      <textarea
        {...attrs}
        name={p.name || undefined}
        placeholder={p.placeholder || undefined}
        rows={p.rows || 4}
        readOnly={!preview}
        tabIndex={preview ? undefined : -1}
        defaultValue=""
      />
    )
  }

  if (node.type === 'select') {
    return (
      <select {...attrs} name={p.name || undefined} disabled={!preview} defaultValue="">
        {(node.children || []).map((child) => (
          <option key={child.id} className={classFor(child)} value={child.props?.text || ''}>
            {child.props?.text || ''}
          </option>
        ))}
      </select>
    )
  }

  /* ------------------------------------------------------ text nodes */

  if (d.textual) {
    if (isEditing) {
      return (
        <EditableText
          key={`edit-${node.id}`}
          Tag={Tag}
          attrs={attrs}
          text={p.text}
          onCommit={(value) => {
            setProp(node.id, 'text', value)
            stopTextEdit()
          }}
        />
      )
    }
    const extra = {}
    if (Tag === 'a') extra.href = preview ? p.href || '#' : undefined
    if (Tag === 'button') extra.type = p.action === 'submit' ? 'submit' : 'button'
    return <Tag {...attrs} {...extra}>{p.text ?? ''}</Tag>
  }

  /* ------------------------------------------------------ containers */

  const extra = {}
  if (Tag === 'form') {
    extra.onSubmit = (e) => e.preventDefault()
    if (preview && p.action) extra.action = p.action
  }

  return (
    <Tag {...attrs} {...extra}>
      {(node.children || []).map((child) => (
        <NodeView key={child.id} node={child} preview={preview} />
      ))}
    </Tag>
  )
}

export default memo(NodeView)
