/**
 * The app's brain: one store holding the project, the selection, the history
 * and the UI state. Every document change goes through `transact`, which is
 * what makes undo, redo and autosave work everywhere without extra effort.
 */
import { create } from 'zustand'
import {
  createNode, insertNode, removeNode, moveNode, updateNode, duplicateNode,
  wrapNode, unwrapNode, reorderSibling, findNode, dropTargetFor, reid, bp,
} from './doc.js'
import { def } from './elements.js'
import { newProject, templateById } from './templates.js'
import { blockById } from './blocks.js'
import { THEME_PRESETS } from './theme.js'
import { parseCode } from './codeparse.js'
import { generateFiles } from './codegen.js'
import { flattenStyles, isFree } from './css.js'
import { uid, clone, debounce } from './util.js'

const STORAGE_KEY = 'webbuilder.project.v1'
const HISTORY_LIMIT = 80

/* --------------------------------------------------------- persistence */

const saveNow = (project) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: Date.now() }))
    return true
  } catch (err) {
    console.warn('Could not save project', err)
    return false
  }
}

const persist = debounce((project) => saveNow(project), 500)

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.pages?.length) return null
    // Older saves may predate a field; fill the gaps rather than crash.
    parsed.assets ||= []
    for (const page of parsed.pages) page.customCss ||= ''
    return parsed
  } catch {
    return null
  }
}

/* -------------------------------------------------------------- store */

const initialProject = loadSaved()

export const useStore = create((set, get) => ({
  /* ---------------- document ---------------- */
  project: initialProject || newProject('landing'),
  activePageId: (initialProject || {}).pages?.[0]?.id ?? null,
  isFirstRun: !initialProject,

  /* ---------------- selection ---------------- */
  selectedId: null,   // the primary selection -- what the inspector edits
  selectedIds: [],    // everything selected, including the primary
  hoveredId: null,
  editingTextId: null,
  clipboard: null,

  /* ---------------- history ---------------- */
  past: [],
  future: [],
  lastLabel: null,
  lastStamp: 0,

  /* ---------------- ui ---------------- */
  breakpoint: 'desktop',
  styleState: 'base', // 'base' | 'hover'
  zoom: 1,
  mode: 'design', // 'design' | 'preview'
  leftTab: 'add',
  rightTab: 'design',
  showCode: false,
  codePane: 'right', // 'right' | 'bottom'
  codeFile: 'App.jsx',
  codeDraft: null,
  codeDirty: false,
  codeError: null,
  toasts: [],
  modal: null, // 'templates' | 'export' | 'shortcuts' | 'welcome' | 'pages'
  showOutlines: true,

  /* ---------------- direct manipulation ---------------- */
  tool: 'move',      // 'move' | 'hand' | 'frame' | 'text' | 'scale'
  snap: true,        // snap to edges and middles of neighbouring things
  snapGrid: 0,       // extra pixel grid, 0 = off
  gesture: null,     // what the pointer is doing right now, for the overlay

  /* ------------------------------------------------- derived helpers */
  activePage() {
    const { project, activePageId } = get()
    return project.pages.find((p) => p.id === activePageId) || project.pages[0]
  },
  selectedNode() {
    const page = get().activePage()
    const { selectedId } = get()
    if (!page || !selectedId) return null
    return findNode(page.root, selectedId)?.node || null
  },

  /* ------------------------------------------------------ transactions */
  /**
   * Apply a change to the project with undo support.
   * `coalesce` merges rapid repeats (typing, dragging a slider) into one step.
   */
  transact(label, mutate, { coalesce = null } = {}) {
    const state = get()
    const before = state.project
    const draft = clone(before)
    const result = mutate(draft)
    if (result === false) return
    draft.updatedAt = Date.now()

    const now = Date.now()
    const canMerge = coalesce && state.lastLabel === coalesce && now - state.lastStamp < 900
    const past = canMerge ? state.past : [...state.past, before].slice(-HISTORY_LIMIT)

    set({ project: draft, past, future: [], lastLabel: coalesce, lastStamp: now, codeDirty: false, codeError: null })
    persist(draft)
  },

  undo() {
    const { past, project, future } = get()
    if (!past.length) return
    const previous = past[past.length - 1]
    set({
      project: previous,
      past: past.slice(0, -1),
      future: [project, ...future].slice(0, HISTORY_LIMIT),
      lastLabel: null,
      codeDirty: false,
    })
    persist(previous)
    get().ensureValidSelection()
  },

  redo() {
    const { future, project, past } = get()
    if (!future.length) return
    const next = future[0]
    set({
      project: next,
      future: future.slice(1),
      past: [...past, project].slice(-HISTORY_LIMIT),
      lastLabel: null,
      codeDirty: false,
    })
    persist(next)
    get().ensureValidSelection()
  },

  ensureValidSelection() {
    const page = get().activePage()
    const { selectedId, selectedIds } = get()
    const alive = (id) => !!(page && findNode(page.root, id))
    const kept = selectedIds.filter(alive)
    if (kept.length !== selectedIds.length) set({ selectedIds: kept })
    if (selectedId && !alive(selectedId)) set({ selectedId: kept[kept.length - 1] || null })
  },

  /** Close the current undo step so the next change starts a fresh one. */
  sealHistory: () => set({ lastLabel: null }),

  /* ------------------------------------------------------- page edits */
  updateActivePage(label, mutateRoot, options) {
    const { activePageId } = get()
    get().transact(label, (draft) => {
      const page = draft.pages.find((p) => p.id === activePageId) || draft.pages[0]
      if (!page) return false
      const next = mutateRoot(page.root, page, draft)
      if (next === false) return false
      if (next) page.root = next
    }, options)
  },

  /* ------------------------------------------------------- selection */
  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [], editingTextId: null }),
  hover: (id) => set({ hoveredId: id }),
  startTextEdit: (id) => set({ editingTextId: id, selectedId: id, selectedIds: id ? [id] : [] }),
  stopTextEdit: () => set({ editingTextId: null }),

  /** Everything currently selected, primary first-class citizen included. */
  selection() {
    const { selectedIds, selectedId } = get()
    if (selectedIds.length) return selectedIds
    return selectedId ? [selectedId] : []
  },

  /** Shift-click: add to or remove from the selection. */
  selectAlso(id) {
    if (!id) return
    const current = get().selection()
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    set({ selectedIds: next, selectedId: next[next.length - 1] || null, editingTextId: null })
  },

  selectMany(ids) {
    const list = [...new Set(ids.filter(Boolean))]
    set({ selectedIds: list, selectedId: list[list.length - 1] || null, editingTextId: null })
  },

  selectAll() {
    const page = get().activePage()
    get().selectMany((page.root.children || []).map((c) => c.id))
  },

  selectParent() {
    const page = get().activePage()
    const hit = findNode(page.root, get().selectedId)
    if (hit?.parent) get().select(hit.parent.id)
  },

  /** Tab through the things sitting alongside this one. */
  selectSibling(delta) {
    const page = get().activePage()
    const hit = findNode(page.root, get().selectedId)
    if (!hit?.parent) return
    const kids = hit.parent.children.filter((c) => !c.hidden)
    const at = kids.findIndex((c) => c.id === hit.node.id)
    if (at < 0 || !kids.length) return
    const next = kids[(at + delta + kids.length) % kids.length]
    if (next) get().select(next.id)
  },

  /** Step into the first child -- the other half of "select the box around this". */
  selectChild() {
    const node = get().selectedNode()
    const first = node?.children?.find((c) => !c.hidden)
    if (first) get().select(first.id)
  },

  /* --------------------------------------------------- adding things */
  addElement(type, target = null) {
    const page = get().activePage()
    const spot = target || dropTargetFor(page.root, get().selectedId)
    const node = createNode(type)
    get().updateActivePage(`Add ${def(type).label}`, (root) => insertNode(root, spot.parentId, node, spot.index))
    get().select(node.id)
    get().toast(`${def(type).label} added`)
    return node.id
  },

  addBlock(blockId, index = null) {
    const block = blockById(blockId)
    if (!block) return
    const node = createNode(block.build().type, block.build())
    get().updateActivePage(`Add ${block.label}`, (root) => insertNode(root, root.id, node, index))
    get().select(node.id)
    get().toast(`${block.label} added`)
    return node.id
  },

  insertNodeAt(node, parentId, index) {
    get().updateActivePage('Insert', (root) => insertNode(root, parentId, node, index))
    get().select(node.id)
  },

  /* -------------------------------------------------- editing things */
  setProp(id, key, value) {
    get().updateActivePage('Edit content', (root) =>
      updateNode(root, id, (node) => {
        node.props[key] = value
      }), { coalesce: `prop:${id}:${key}` })
  },

  setProps(id, patch) {
    get().updateActivePage('Edit content', (root) =>
      updateNode(root, id, (node) => Object.assign(node.props, patch)))
  },

  /** Write one CSS property into the bucket the user is currently editing. */
  setStyle(id, prop, value, options = {}) {
    const { breakpoint, styleState } = get()
    const bucket = options.bucket || (styleState === 'hover' ? 'hover' : bp(breakpoint).styleKey)
    get().updateActivePage('Restyle', (root) =>
      updateNode(root, id, (node) => {
        node.styles[bucket] ||= {}
        if (value === '' || value === null || value === undefined) delete node.styles[bucket][prop]
        else node.styles[bucket][prop] = value
      }), { coalesce: `style:${id}:${prop}:${bucket}` })
  },

  setStyles(id, patch, options = {}) {
    const { breakpoint, styleState } = get()
    const bucket = options.bucket || (styleState === 'hover' ? 'hover' : bp(breakpoint).styleKey)
    get().updateActivePage(options.label || 'Restyle', (root) =>
      updateNode(root, id, (node) => {
        node.styles[bucket] ||= {}
        for (const [prop, value] of Object.entries(patch)) {
          if (value === '' || value === null || value === undefined) delete node.styles[bucket][prop]
          else node.styles[bucket][prop] = value
        }
      }), { coalesce: options.coalesce })
  },

  /** Drop the override at this breakpoint so the value falls back again. */
  clearStyleAt(id, prop, bucket) {
    get().updateActivePage('Reset style', (root) =>
      updateNode(root, id, (node) => {
        if (node.styles[bucket]) delete node.styles[bucket][prop]
      }))
  },

  rename(id, name) {
    get().updateActivePage('Rename', (root) =>
      updateNode(root, id, (node) => {
        node.name = name
      }), { coalesce: `rename:${id}` })
  },

  toggleFlag(id, flag) {
    get().updateActivePage(flag === 'hidden' ? 'Show/hide' : 'Lock', (root) =>
      updateNode(root, id, (node) => {
        node[flag] = !node[flag]
      }))
  },

  /* --------------------------------------------------- moving things */
  moveTo(id, parentId, index) {
    get().updateActivePage('Move', (root) => moveNode(root, id, parentId, index))
    get().select(id)
  },

  nudgeOrder(id, delta) {
    get().updateActivePage('Reorder', (root) => reorderSibling(root, id, delta))
  },

  /**
   * One transaction for a whole canvas gesture: optionally copy some nodes,
   * re-home them, then write styles. Dragging three boxes at once is a single
   * undo step, and a copy made by alt-dragging lands with its new position
   * already on it.
   *
   *   applyEdit({ label, duplicate: [id], moves: [{ id, parentId, index }],
   *               styles: [{ id, patch, bucket }], coalesce })
   */
  applyEdit(edit = {}) {
    const { label = 'Edit', moves = [], styles = [], duplicate = null, bucket, coalesce } = edit
    const { breakpoint, styleState } = get()
    const fallback = bucket || (styleState === 'hover' ? 'hover' : bp(breakpoint).styleKey)
    let created = []

    get().updateActivePage(label, (root) => {
      let next = root
      const copies = new Map()

      for (const id of duplicate || []) {
        const res = duplicateNode(next, id)
        if (!res.newId) continue
        next = res.root
        copies.set(id, res.newId)
      }
      created = (duplicate || []).map((id) => copies.get(id)).filter(Boolean)

      for (const m of moves) {
        next = moveNode(next, copies.get(m.id) || m.id, m.parentId, m.index)
      }

      // `transact` already handed us a private copy of the project, so styles
      // can be written straight in. Dragging twenty things is one clone, not
      // twenty-one.
      for (const s of styles) {
        const hit = findNode(next, copies.get(s.id) || s.id)
        if (!hit) continue
        const into = s.bucket || fallback
        hit.node.styles[into] ||= {}
        for (const [prop, value] of Object.entries(s.patch)) {
          if (value === '' || value === null || value === undefined) delete hit.node.styles[into][prop]
          else hit.node.styles[into][prop] = value
        }
      }
      return next
    }, { coalesce })

    if (created.length) set({ selectedIds: created, selectedId: created[created.length - 1] })
    return created
  },

  /** Arrow keys: move freely placed things, nudge the rest with a margin. */
  nudgeSelection(dx, dy) {
    const page = get().activePage()
    const { breakpoint } = get()
    const styles = []
    for (const id of get().selection()) {
      const node = findNode(page.root, id)?.node
      if (!node || node.locked) continue
      const style = flattenStyles(node.styles, breakpoint)
      const at = (v) => {
        const n = parseFloat(v)
        return Number.isFinite(n) ? n : 0
      }
      styles.push(isFree(style)
        ? { id, patch: { left: `${at(style.left) + dx}px`, top: `${at(style.top) + dy}px` } }
        : { id, patch: { marginLeft: `${at(style.marginLeft) + dx}px`, marginTop: `${at(style.marginTop) + dy}px` } })
    }
    if (styles.length) get().applyEdit({ label: 'Nudge', styles, coalesce: `nudge:${styles.map((s) => s.id).join()}` })
  },

  /** Put a node back into the normal flow of the page. */
  backIntoFlow(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean)
    if (!list.length) return
    get().applyEdit({
      label: 'Back into the flow',
      styles: list.map((id) => ({
        id,
        patch: { position: '', left: '', top: '', right: '', bottom: '', zIndex: '' },
      })),
    })
  },

  /* -------------------------------------------------- removing things */
  remove(id) {
    const page = get().activePage()
    const hit = findNode(page.root, id)
    if (!hit || !hit.parent) return
    if (def(hit.node.type).undeletable) return
    const nextSelection = hit.parent.children[hit.index + 1]?.id || hit.parent.children[hit.index - 1]?.id || hit.parent.id
    get().updateActivePage('Delete', (root) => removeNode(root, id))
    get().select(nextSelection === page.root.id ? null : nextSelection)
    get().toast('Deleted', { action: 'Undo', onAction: () => get().undo() })
  },

  duplicate(id) {
    let newId = null
    get().updateActivePage('Duplicate', (root) => {
      const res = duplicateNode(root, id)
      newId = res.newId
      return res.root
    })
    if (newId) get().select(newId)
  },

  wrap(id, type = 'container') {
    let newId = null
    get().updateActivePage('Wrap in a box', (root) => {
      const res = wrapNode(root, id, type)
      newId = res.newId
      return res.root
    })
    if (newId) get().select(newId)
  },

  unwrap(id) {
    get().updateActivePage('Remove the box', (root) => unwrapNode(root, id))
    get().select(null)
  },

  copy(id) {
    const page = get().activePage()
    const hit = findNode(page.root, id || get().selectedId)
    if (!hit) return
    set({ clipboard: clone(hit.node) })
    get().toast('Copied')
  },

  paste() {
    const { clipboard, selectedId } = get()
    if (!clipboard) return
    const page = get().activePage()
    const spot = dropTargetFor(page.root, selectedId)
    const copy = reid(clipboard)
    get().updateActivePage('Paste', (root) => insertNode(root, spot.parentId, copy, spot.index))
    get().select(copy.id)
    get().toast('Pasted')
  },

  /* -------------------------------------------------------- the pages */
  setActivePage: (id) => set({ activePageId: id, selectedId: null, selectedIds: [], hoveredId: null }),

  addPage(name = 'New page') {
    const page = {
      id: uid(),
      name,
      path: '/' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'),
      customCss: '',
      root: createNode('page', { name: `${name} page` }),
    }
    get().transact('Add page', (draft) => {
      draft.pages.push(page)
    })
    set({ activePageId: page.id, selectedId: null })
    get().toast(`"${name}" created`)
  },

  duplicatePage(id) {
    const source = get().project.pages.find((p) => p.id === id)
    if (!source) return
    const copy = { ...clone(source), id: uid(), name: `${source.name} copy`, path: `${source.path}-copy`, root: reid(source.root) }
    get().transact('Duplicate page', (draft) => {
      draft.pages.splice(draft.pages.findIndex((p) => p.id === id) + 1, 0, copy)
    })
    set({ activePageId: copy.id })
  },

  renamePage(id, name) {
    get().transact('Rename page', (draft) => {
      const page = draft.pages.find((p) => p.id === id)
      if (page) page.name = name
    }, { coalesce: `page:${id}` })
  },

  setPagePath(id, path) {
    get().transact('Change address', (draft) => {
      const page = draft.pages.find((p) => p.id === id)
      if (page) page.path = path.startsWith('/') ? path : '/' + path
    }, { coalesce: `path:${id}` })
  },

  removePage(id) {
    if (get().project.pages.length <= 1) {
      get().toast('A project needs at least one page', { kind: 'warn' })
      return
    }
    const index = get().project.pages.findIndex((p) => p.id === id)
    get().transact('Delete page', (draft) => {
      draft.pages = draft.pages.filter((p) => p.id !== id)
    })
    const pages = get().project.pages
    if (get().activePageId === id) set({ activePageId: pages[Math.max(0, index - 1)].id, selectedId: null })
    get().toast('Page deleted', { action: 'Undo', onAction: () => get().undo() })
  },

  /* ------------------------------------------------------- the theme */
  setThemeToken(group, key, value) {
    get().transact('Change colours', (draft) => {
      draft.theme[group][key] = value
      draft.theme.preset = 'custom'
    }, { coalesce: `theme:${group}:${key}` })
  },

  applyThemePreset(presetId) {
    const preset = THEME_PRESETS[presetId]
    if (!preset) return
    get().transact('Apply a look', (draft) => {
      draft.theme = { preset: presetId, ...clone(preset) }
    })
    get().toast(`${preset.label} applied`)
  },

  setThemeValue(key, value) {
    get().transact('Change theme', (draft) => {
      draft.theme[key] = value
      draft.theme.preset = 'custom'
    }, { coalesce: `theme:${key}` })
  },

  /* ------------------------------------------------------- the assets */
  addAsset(asset) {
    get().transact('Add image', (draft) => {
      draft.assets.unshift({ id: uid(), addedAt: Date.now(), ...asset })
    })
  },

  removeAsset(id) {
    get().transact('Remove image', (draft) => {
      draft.assets = draft.assets.filter((a) => a.id !== id)
    })
  },

  /* --------------------------------------------------------- the code */
  currentFiles() {
    const page = get().activePage()
    const files = generateFiles(page, get().project.theme)
    if (page.customCss) files['styles.css'] += `\n/* Your own CSS */\n${page.customCss}\n`
    return files
  },

  setCodeDraft(file, value) {
    const files = get().codeDraft || get().currentFiles()
    set({ codeDraft: { ...files, [file]: value }, codeDirty: true })
  },

  discardCodeDraft: () => set({ codeDraft: null, codeDirty: false, codeError: null }),

  /** Push edited code back onto the canvas. Never destroys work on failure. */
  applyCode() {
    const { codeDraft } = get()
    if (!codeDraft) return true
    const page = get().activePage()
    try {
      const result = parseCode({
        jsx: codeDraft['App.jsx'],
        css: codeDraft['styles.css'],
        currentRoot: page.root,
        theme: get().project.theme,
      })
      get().transact('Edit code', (draft) => {
        const target = draft.pages.find((p) => p.id === page.id)
        target.root = result.root
        target.customCss = result.customCss || ''
        draft.theme = result.theme
      })
      set({ codeDraft: null, codeDirty: false, codeError: null })
      return true
    } catch (err) {
      set({ codeError: { message: err.message, line: err.line, file: err.file || 'App.jsx' } })
      return false
    }
  },

  /* ---------------------------------------------------------- project */
  newProjectFrom(templateId, name) {
    const project = newProject(templateId, name)
    set({
      project,
      activePageId: project.pages[0].id,
      selectedId: null,
      selectedIds: [],
      past: [],
      future: [],
      codeDraft: null,
      codeDirty: false,
      modal: null,
      isFirstRun: false,
    })
    saveNow(project)
    get().toast(`${templateById(templateId).label} ready`)
  },

  loadProject(project) {
    if (!project?.pages?.length) {
      get().toast('That file does not look like a WebBuilder project', { kind: 'warn' })
      return
    }
    set({
      project,
      activePageId: project.pages[0].id,
      selectedId: null,
      selectedIds: [],
      past: [],
      future: [],
      codeDraft: null,
      modal: null,
      isFirstRun: false,
    })
    saveNow(project)
    get().toast(`"${project.name}" opened`)
  },

  renameProject(name) {
    get().transact('Rename project', (draft) => {
      draft.name = name
    }, { coalesce: 'projectname' })
  },

  saveNow() {
    const ok = saveNow(get().project)
    get().toast(ok ? 'Saved' : 'Could not save -- your browser storage may be full', { kind: ok ? 'info' : 'warn' })
  },

  /* --------------------------------------------------------------- ui */
  setBreakpoint: (breakpoint) => set({ breakpoint }),
  setStyleState: (styleState) => set({ styleState }),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),
  setMode: (mode) => set({
    mode,
    selectedId: mode === 'preview' ? null : get().selectedId,
    selectedIds: mode === 'preview' ? [] : get().selectedIds,
  }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setRightTab: (rightTab) => set({ rightTab }),
  setCodeFile: (codeFile) => set({ codeFile }),
  setModal: (modal) => set({ modal }),
  setTool: (tool) => set({ tool }),
  toggleSnap: () => set({ snap: !get().snap }),
  setSnapGrid: (snapGrid) => set({ snapGrid }),
  setGesture: (gesture) => set({ gesture }),
  toggleCode: () => set({ showCode: !get().showCode }),
  setCodePane: (codePane) => set({ codePane }),
  toggleOutlines: () => set({ showOutlines: !get().showOutlines }),

  toast(text, options = {}) {
    const id = uid()
    set({ toasts: [...get().toasts, { id, text, kind: 'info', ...options }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), options.duration || 3200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/* ------------------------------------------------------------- selectors */

export const useActivePage = () => useStore((s) => s.project.pages.find((p) => p.id === s.activePageId) || s.project.pages[0])
export const useSelectedNode = () => {
  const page = useActivePage()
  const selectedId = useStore((s) => s.selectedId)
  return selectedId && page ? findNode(page.root, selectedId)?.node || null : null
}
export const useTheme = () => useStore((s) => s.project.theme)
export const useCanUndo = () => useStore((s) => s.past.length > 0)
export const useCanRedo = () => useStore((s) => s.future.length > 0)
