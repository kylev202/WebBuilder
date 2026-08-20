/**
 * Document model: creating nodes and the tree operations that edit them.
 * Every operation is pure -- it returns a new root -- so undo/redo is just
 * keeping the previous root around.
 */
import { def } from './elements.js'
import { uid, slugify, clone } from './util.js'

const EMPTY_STYLES = { base: {}, hover: {}, tablet: {}, mobile: {} }

export const BREAKPOINTS = [
  { id: 'desktop', label: 'Desktop', width: 1280, icon: 'Monitor', styleKey: 'base', media: null },
  { id: 'tablet', label: 'Tablet', width: 834, icon: 'Tablet', styleKey: 'tablet', media: '(max-width: 1024px)' },
  { id: 'mobile', label: 'Phone', width: 390, icon: 'Smartphone', styleKey: 'mobile', media: '(max-width: 640px)' },
]

export const bp = (id) => BREAKPOINTS.find((b) => b.id === id) || BREAKPOINTS[0]

/** Create a fresh node of `type`, deep-creating any default children. */
export function createNode(type, overrides = {}) {
  const d = def(type)
  const made = d.create ? d.create() : {}
  const node = {
    id: overrides.id || uid(),
    type,
    name: overrides.name || made.name || d.label || 'Element',
    props: { ...(made.props || {}), ...(overrides.props || {}) },
    styles: mergeStyleSets(EMPTY_STYLES, made.styles, overrides.styles),
    children: [],
    hidden: false,
    locked: false,
  }
  const kids = overrides.children || made.children || []
  node.children = kids.map((c) => (c && c.id && c.styles ? c : createNode(c.type, c)))
  return node
}

export function mergeStyleSets(...sets) {
  const out = clone(EMPTY_STYLES)
  for (const set of sets) {
    if (!set) continue
    for (const key of Object.keys(out)) {
      if (set[key]) out[key] = { ...out[key], ...set[key] }
    }
  }
  return out
}

/** Stable css class for a node -- also its identity when code is parsed back. */
export const classFor = (node) => `${slugify(node.name || node.type)}-${node.id}`

/** Pull the node id back out of a generated class name. */
export function idFromClass(cls = '') {
  const m = /^[a-z0-9-]*-([a-z0-9]{5})$/.exec(cls.trim())
  return m ? m[1] : null
}

/* ------------------------------------------------------------------ find */

export function walk(node, fn, parent = null, index = 0) {
  if (!node) return
  if (fn(node, parent, index) === false) return
  node.children?.forEach((c, i) => walk(c, fn, node, i))
}

export function findNode(root, id) {
  let found = null
  walk(root, (node, parent, index) => {
    if (node.id === id) {
      found = { node, parent, index }
      return false
    }
  })
  return found
}

export const getNode = (root, id) => findNode(root, id)?.node || null

export function pathTo(root, id, trail = []) {
  if (!root) return null
  const next = [...trail, root]
  if (root.id === id) return next
  for (const child of root.children || []) {
    const hit = pathTo(child, id, next)
    if (hit) return hit
  }
  return null
}

export const ancestorsOf = (root, id) => (pathTo(root, id) || []).slice(0, -1)

/** True when `maybeAncestor` contains `id` -- guards illegal drags. */
export function contains(maybeAncestor, id) {
  let hit = false
  walk(maybeAncestor, (n) => {
    if (n.id === id) hit = true
  })
  return hit
}

/* ---------------------------------------------------------------- mutate */

export function updateNode(root, id, updater) {
  const next = clone(root)
  const hit = findNode(next, id)
  if (hit) updater(hit.node, hit.parent)
  return next
}

export function insertNode(root, parentId, node, index = null) {
  const next = clone(root)
  const hit = findNode(next, parentId)
  if (!hit) return root
  const kids = hit.node.children || (hit.node.children = [])
  const at = index === null || index > kids.length ? kids.length : Math.max(0, index)
  kids.splice(at, 0, node)
  return next
}

export function removeNode(root, id) {
  if (root.id === id) return root
  const next = clone(root)
  const hit = findNode(next, id)
  if (!hit || !hit.parent) return root
  hit.parent.children.splice(hit.index, 1)
  return next
}

export function moveNode(root, id, newParentId, index) {
  const hit = findNode(root, id)
  if (!hit || !hit.parent) return root
  const moving = getNode(root, id)
  if (contains(moving, newParentId)) return root // no dropping a box inside itself

  const next = clone(root)
  const src = findNode(next, id)
  const [taken] = src.parent.children.splice(src.index, 1)
  const dest = findNode(next, newParentId)
  if (!dest) return root

  let at = index === null || index === undefined ? dest.node.children.length : index
  // Removing the node first can shift the target index inside the same parent.
  if (src.parent.id === dest.node.id && src.index < at) at -= 1
  dest.node.children.splice(Math.max(0, Math.min(at, dest.node.children.length)), 0, taken)
  return next
}

/** Deep copy with brand new ids, so duplicates are independent. */
export function reid(node) {
  const copy = clone(node)
  walk(copy, (n) => {
    n.id = uid()
  })
  return copy
}

export function duplicateNode(root, id) {
  const hit = findNode(root, id)
  if (!hit || !hit.parent) return { root, newId: null }
  const copy = reid(hit.node)
  copy.name = hit.node.name
  const next = insertNode(root, hit.parent.id, copy, hit.index + 1)
  return { root: next, newId: copy.id }
}

/** Wrap a node in a new container -- "put this inside a box". */
export function wrapNode(root, id, wrapperType = 'container') {
  const hit = findNode(root, id)
  if (!hit || !hit.parent) return { root, newId: null }
  const wrapper = createNode(wrapperType)
  wrapper.children = [clone(hit.node)]
  const next = clone(root)
  const target = findNode(next, id)
  target.parent.children.splice(target.index, 1, wrapper)
  return { root: next, newId: wrapper.id }
}

/** Remove a container but keep its children where they were. */
export function unwrapNode(root, id) {
  const hit = findNode(root, id)
  if (!hit || !hit.parent || !hit.node.children?.length) return root
  const next = clone(root)
  const target = findNode(next, id)
  target.parent.children.splice(target.index, 1, ...target.node.children)
  return next
}

export function reorderSibling(root, id, delta) {
  const hit = findNode(root, id)
  if (!hit || !hit.parent) return root
  const to = hit.index + delta
  if (to < 0 || to >= hit.parent.children.length) return root
  return moveNode(root, id, hit.parent.id, to)
}

/**
 * Where should a new element land when the user clicks "add" with `selectedId`
 * active? Into the selection if it accepts children, else next to it.
 */
export function dropTargetFor(root, selectedId) {
  if (!selectedId) return { parentId: root.id, index: null }
  const hit = findNode(root, selectedId)
  if (!hit) return { parentId: root.id, index: null }
  if (def(hit.node.type).container) return { parentId: hit.node.id, index: null }
  if (hit.parent) return { parentId: hit.parent.id, index: hit.index + 1 }
  return { parentId: root.id, index: null }
}

/** Collect every css class used in a tree -- lets codegen keep rules ordered. */
export function flatten(root) {
  const list = []
  walk(root, (n) => list.push(n))
  return list
}
