/**
 * Smoke test: mount the real app in jsdom and drive it the way a person would.
 * Catches the failures a build cannot -- bad hooks, missing store actions,
 * handlers that throw on click.
 *
 * Run with `npm run check` (bundles this file, then executes it).
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const { window } = dom
global.window = window
global.document = window.document
// Node 22 defines navigator as a getter-only global.
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true })
global.HTMLElement = window.HTMLElement
global.Element = window.Element
global.Node = window.Node
global.getComputedStyle = window.getComputedStyle
global.requestAnimationFrame = window.requestAnimationFrame
global.cancelAnimationFrame = window.cancelAnimationFrame
global.MutationObserver = window.MutationObserver
global.DOMParser = window.DOMParser
global.Range = window.Range
global.Blob = window.Blob
global.FileReader = window.FileReader
global.IS_REACT_ACT_ENVIRONMENT = true

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub
window.ResizeObserver = ResizeObserverStub
window.scrollTo = () => {}
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
document.elementFromPoint = () => null
window.URL.createObjectURL = () => 'blob:stub'
window.URL.revokeObjectURL = () => {}

const store = new Map()
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageStub, configurable: true })
global.localStorage = localStorageStub

// jsdom has no layout engine, so every box measures zero. That is fine here --
// we are checking behaviour, not pixels.
window.Element.prototype.getBoundingClientRect = function () {
  return { top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 40, x: 0, y: 0, toJSON() {} }
}

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const App = (await import('../src/App.jsx')).default
const { useStore } = await import('../src/core/store.js')
const { flatten, findNode } = await import('../src/core/doc.js')
const { generateJsx, generateCss } = await import('../src/core/codegen.js')

let failures = 0
const ok = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}`)
  else {
    failures++
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

const errors = []
const originalError = console.error
console.error = (...args) => {
  const text = args.map(String).join(' ')
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) errors.push(text)
  originalError(...args)
}

const container = document.getElementById('root')
const root = createRoot(container)

const click = (element) => {
  act(() => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

console.log('\n1. The app mounts')
await act(async () => {
  root.render(React.createElement(App))
})
ok('topbar rendered', !!document.querySelector('.wb-topbar'))
ok('left panel rendered', !!document.querySelector('.wb-tabs'))
ok('canvas rendered', !!document.querySelector('.wb-canvas-root'))
ok('sample project loaded', useStore.getState().project.pages.length > 0)
ok('welcome shown on first run', !!document.querySelector('.wb-modal'))

act(() => useStore.getState().setModal(null))
ok('welcome dismissed', !document.querySelector('.wb-modal'))

console.log('\n2. Adding things from the palette')
const before = flatten(useStore.getState().activePage().root).length
const tiles = [...document.querySelectorAll('.wb-tile')]
ok('palette has element tiles', tiles.length > 10, `found ${tiles.length}`)
click(tiles.find((t) => t.textContent.includes('Heading')))
const afterAdd = flatten(useStore.getState().activePage().root).length
ok('clicking a tile adds an element', afterAdd === before + 1, `${before} -> ${afterAdd}`)
ok('the new element is selected', !!useStore.getState().selectedId)
ok('it is rendered on the canvas', !!document.querySelector(`[data-node-id="${useStore.getState().selectedId}"]`))

console.log('\n3. The inspector edits the selection')
ok('inspector shows the element', !!document.querySelector('.wb-insp-name input'))
const headingId = useStore.getState().selectedId
act(() => useStore.getState().setProp(headingId, 'text', 'Hello from the test'))
ok('text change reaches the canvas',
  document.querySelector(`[data-node-id="${headingId}"]`)?.textContent === 'Hello from the test')
act(() => useStore.getState().setStyle(headingId, 'fontSize', '48px'))
ok('style change is stored', findNode(useStore.getState().activePage().root, headingId).node.styles.base.fontSize === '48px')
ok('style change reaches the stylesheet',
  document.querySelector('.wb-frame style')?.textContent.includes('font-size: 48px'))

console.log('\n4. Responsive edits stay on their own breakpoint')
const phoneSizeBefore = findNode(useStore.getState().activePage().root, headingId).node.styles.mobile.fontSize
act(() => useStore.getState().setBreakpoint('mobile'))
act(() => useStore.getState().setStyle(headingId, 'fontSize', '24px'))
const styles = findNode(useStore.getState().activePage().root, headingId).node.styles
ok('phone value written to the phone bucket', styles.mobile.fontSize === '24px')
ok('desktop value untouched', styles.base.fontSize === '48px')
act(() => useStore.getState().setBreakpoint('desktop'))

console.log('\n5. Undo and redo')
act(() => useStore.getState().undo())
ok('undo restores the previous value',
  findNode(useStore.getState().activePage().root, headingId).node.styles.mobile.fontSize === phoneSizeBefore,
  `expected ${phoneSizeBefore}, got ${findNode(useStore.getState().activePage().root, headingId).node.styles.mobile.fontSize}`)
act(() => useStore.getState().redo())
ok('redo puts it back',
  findNode(useStore.getState().activePage().root, headingId).node.styles.mobile.fontSize === '24px')

console.log('\n6. Sections, duplication and deletion')
const sectionsTab = [...document.querySelectorAll('.wb-seg button')].find((b) => b.textContent.includes('Sections'))
click(sectionsTab)
const blocks = [...document.querySelectorAll('.wb-block')]
ok('section library rendered', blocks.length > 8, `found ${blocks.length}`)
const rootChildrenBefore = useStore.getState().activePage().root.children.length
click(blocks[0])
ok('clicking a section adds it', useStore.getState().activePage().root.children.length === rootChildrenBefore + 1)

const addedId = useStore.getState().selectedId
act(() => useStore.getState().duplicate(addedId))
ok('duplicate adds a copy', useStore.getState().activePage().root.children.length === rootChildrenBefore + 2)
act(() => useStore.getState().remove(useStore.getState().selectedId))
ok('delete removes it', useStore.getState().activePage().root.children.length === rootChildrenBefore + 1)

console.log('\n7. Layers, pages and theme panels render')
for (const [tab, selector] of [['layers', '.wb-layer'], ['pages', '.wb-panel-title'], ['theme', '.wb-panel-title'], ['images', '.wb-panel-title']]) {
  act(() => useStore.getState().setLeftTab(tab))
  ok(`${tab} panel renders`, !!document.querySelector(selector))
}
act(() => useStore.getState().setLeftTab('add'))

console.log('\n8. The code panel')
act(() => useStore.getState().toggleCode())
ok('code panel opens', !!document.querySelector('.wb-code'))
ok('editor mounted', !!document.querySelector('.wb-code-editor .cm-editor'))
const shownFiles = [...document.querySelectorAll('.wb-code-tabs button')].map((b) => b.textContent)
ok('three files offered', shownFiles.join(',') === 'App.jsx,styles.css,index.html', shownFiles.join(','))

const page = useStore.getState().activePage()
const theme = useStore.getState().project.theme
const editedJsx = generateJsx(page).replace('Hello from the test', 'Edited in code')
act(() => {
  useStore.getState().setCodeDraft('App.jsx', editedJsx)
  useStore.getState().setCodeDraft('styles.css', generateCss(page, theme))
})
act(() => useStore.getState().applyCode())
ok('code edits land on the canvas',
  findNode(useStore.getState().activePage().root, headingId)?.node.props.text === 'Edited in code')
ok('canvas DOM updated too',
  document.querySelector(`[data-node-id="${headingId}"]`)?.textContent === 'Edited in code')

act(() => {
  useStore.getState().setCodeDraft('App.jsx', 'export default function X() { return ( <div ) }')
})
act(() => useStore.getState().applyCode())
ok('broken code is reported, not applied', !!useStore.getState().codeError)
ok('canvas survived the broken code', !!findNode(useStore.getState().activePage().root, headingId))
act(() => useStore.getState().discardCodeDraft())
act(() => useStore.getState().toggleCode())

console.log('\n9. Preview mode and modals')
act(() => useStore.getState().setMode('preview'))
ok('panels hidden in preview', !document.querySelector('.wb-tabs'))
act(() => useStore.getState().setMode('design'))
ok('panels return', !!document.querySelector('.wb-tabs'))

for (const modal of ['templates', 'export', 'shortcuts']) {
  act(() => useStore.getState().setModal(modal))
  ok(`${modal} modal opens`, !!document.querySelector('.wb-modal'))
  act(() => useStore.getState().setModal(null))
}

console.log('\n10. Templates build real pages')
act(() => useStore.getState().newProjectFrom('saas'))
const saas = useStore.getState().project
ok('template has pages', saas.pages.length === 2)
ok('template page has content', flatten(saas.pages[0].root).length > 40, `${flatten(saas.pages[0].root).length} nodes`)
ok('template rendered to the canvas', document.querySelectorAll('.wb-canvas-root [data-node-id]').length > 30)

console.log('\n11. Saving')
act(() => useStore.getState().saveNow())
ok('project written to storage', !!localStorage.getItem('webbuilder.project.v1'))

console.log('\n13. Dragging on the canvas')
const { isStack } = await import('../src/components/canvas/gestures.js')

// jsdom has no layout engine, so hand the gestures the geometry they need.
const rects = new Map()
const place = (target, left, top, width, height) => rects.set(target, { left, top, width, height })
window.Element.prototype.getBoundingClientRect = function () {
  const box = rects.get(this) || { left: 0, top: 0, width: 100, height: 40 }
  return {
    ...box, right: box.left + box.width, bottom: box.top + box.height,
    x: box.left, y: box.top, toJSON() {},
  }
}

const fire = (target, type, x, y, init = {}) => {
  target.dispatchEvent(new window.MouseEvent(type, {
    bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, ...init,
  }))
}

// A stack with two headings in it, built the way a person would build it.
act(() => useStore.getState().newProjectFrom('blank'))
act(() => useStore.getState().addElement('stack'))
const stackId = useStore.getState().selectedId
act(() => useStore.getState().addElement('heading'))
const firstId = useStore.getState().selectedId
act(() => useStore.getState().addElement('heading'))
const secondId = useStore.getState().selectedId

const stackNode = () => findNode(useStore.getState().activePage().root, stackId).node
ok('the stack holds both headings', stackNode().children.length === 2)
ok('in the order they were added', stackNode().children.map((c) => c.id).join() === [firstId, secondId].join())

const at = (id) => document.querySelector(`[data-node-id="${id}"]`)
const rootId = useStore.getState().activePage().root.id
place(document.querySelector('.wb-viewport'), 0, 0, 900, 700)
place(at(rootId), 0, 0, 900, 700)
place(at(stackId), 100, 100, 400, 200)
place(at(firstId), 100, 100, 400, 80)
place(at(secondId), 100, 200, 400, 80)

// Hit testing, so the gestures can work out what a drag is over.
const depthOf = (node) => {
  let n = 0
  for (let p = node.parentElement; p; p = p.parentElement) n++
  return n
}
document.elementFromPoint = (x, y) => {
  let best = null
  for (const [node, box] of rects) {
    if (!node || !node.closest) continue
    const inside = x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height
    if (inside && (!best || depthOf(node) > depthOf(best))) best = node
  }
  return best
}

const steps = () => useStore.getState().past.length
const styleOf = (id) => findNode(useStore.getState().activePage().root, id).node.styles.base

/* --- a press selects; a press with shift adds to the selection --- */
act(() => useStore.getState().select(null))
act(() => fire(at(firstId), 'pointerdown', 150, 140))
ok('pressing something selects it', useStore.getState().selectedId === firstId)
act(() => fire(window, 'pointerup', 150, 140))

act(() => fire(at(secondId), 'pointerdown', 150, 240, { shiftKey: true }))
act(() => fire(window, 'pointerup', 150, 240))
ok('shift-press adds to the selection', useStore.getState().selection().length === 2)
act(() => useStore.getState().select(null))

/* --- dragging places it freely, in one undo step --- */
// Cmd swaps whatever the parent does by default, so ask for the free one.
const freeNeedsMeta = isStack(at(stackId))
const stepsBefore = steps()
act(() => fire(at(secondId), 'pointerdown', 150, 240))
act(() => fire(window, 'pointermove', 210, 300, { metaKey: freeNeedsMeta }))
act(() => fire(window, 'pointerup', 210, 300, { metaKey: freeNeedsMeta }))

const dropped = styleOf(secondId)
ok('dragging takes it out of the flow', dropped.position === 'absolute', JSON.stringify(dropped))
ok('and writes down where it landed', dropped.left === '60px' && dropped.top === '160px', `${dropped.left} / ${dropped.top}`)
ok('the box it sits in becomes its frame of reference', styleOf(stackId).position === 'relative')
ok('the whole drag is one undo step', steps() === stepsBefore + 1, `${steps() - stepsBefore} steps`)

act(() => useStore.getState().undo())
ok('undo puts it back', !styleOf(secondId).position)

/* --- the same drag inside a stack reorders instead --- */
const order = () => stackNode().children.map((c) => c.id).join()
act(() => fire(at(secondId), 'pointerdown', 300, 240))
act(() => fire(window, 'pointermove', 300, 120, { metaKey: !freeNeedsMeta }))
act(() => fire(window, 'pointerup', 300, 120, { metaKey: !freeNeedsMeta }))
ok('dragging inside a stack reorders it', order() === [secondId, firstId].join(), order())
ok('and nothing is placed by hand', !styleOf(secondId).position)
act(() => useStore.getState().undo())
ok('undo restores the order', order() === [firstId, secondId].join())

/* --- a drag that is called off changes nothing --- */
const settled = steps()
act(() => fire(at(secondId), 'pointerdown', 150, 240))
act(() => fire(window, 'pointermove', 260, 340, { metaKey: freeNeedsMeta }))
act(() => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
act(() => fire(window, 'pointerup', 260, 340))
ok('Escape calls the drag off', steps() === settled && !styleOf(secondId).position)

/* --- a press that barely moves is a click, not a drag --- */
act(() => fire(at(firstId), 'pointerdown', 150, 140))
act(() => fire(window, 'pointermove', 151, 140))
act(() => fire(window, 'pointerup', 151, 140))
ok('a click is not a drag', steps() === settled)

/* --- resizing writes a size --- */
act(() => useStore.getState().select(firstId))
const grip = document.querySelector('.wb-handle[data-dir="se"]')
ok('the selection has resize handles', !!grip)
if (grip) {
  act(() => fire(grip, 'pointerdown', 500, 180))
  act(() => fire(window, 'pointermove', 560, 220))
  act(() => fire(window, 'pointerup', 560, 220))
  const sized = styleOf(firstId)
  ok('dragging a corner sets the size', sized.width === '460px' && sized.height === '120px', `${sized.width} x ${sized.height}`)
}

/* --- arrow keys nudge whatever is selected --- */
act(() => useStore.getState().select(secondId))
act(() => useStore.getState().nudgeSelection(0, 5))
ok('arrow keys move things', styleOf(secondId).marginTop === '5px' || styleOf(secondId).top === '5px')

/* --- several things at once --- */
act(() => useStore.getState().selectMany([firstId, secondId]))
ok('several things can be selected at once', useStore.getState().selection().length === 2)
ok('the quick bar offers alignment', !!document.querySelector('.wb-quickbar'))

console.log('\n14. Sizing and pinning in the inspector')
// Collapsed sections do not render, so open every one of them.
act(() => useStore.getState().select(firstId))
const heads = [...document.querySelectorAll('.wb-panel--right .wb-section-head')]
ok('the inspector has its sections', heads.length >= 6, `${heads.length} sections`)
for (const head of heads) {
  if (head.getAttribute('aria-expanded') === 'false') click(head)
}
ok('every section renders when opened', document.querySelectorAll('.wb-panel--right .wb-section-body').length === heads.length)

// Sizing: the mode picker offers all five, and choosing one writes real CSS.
const sizeSelects = [...document.querySelectorAll('.wb-panel--right select')]
const modePicker = sizeSelects.find((el) => [...el.options].some((o) => o.value === 'fill'))
ok('width offers fill, hug and the rest', !!modePicker)
if (modePicker) {
  act(() => {
    modePicker.value = 'fill'
    modePicker.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  const w = styleOf(firstId)
  ok('choosing fill writes the CSS that fills', w.width === '100%' || w.flex === '1 1 0%', JSON.stringify({ width: w.width, flex: w.flex }))
}

// Pins: place it by hand, then hold it to the right edge instead.
act(() => useStore.getState().applyEdit({
  label: 'test',
  styles: [{ id: firstId, patch: { position: 'absolute', left: '40px', top: '10px', width: '100px' } }],
}))
const pinButtons = [...document.querySelectorAll('.wb-panel--right .wb-iconrow button')]
const rightPin = pinButtons.find((b) => (b.dataset.tip || '').includes('from the right'))
ok('a placed element offers pins', !!rightPin)
if (rightPin) {
  click(rightPin)
  const pinned = styleOf(firstId)
  ok('pinning right stops measuring from the left', !pinned.left && pinned.right !== undefined, JSON.stringify(pinned))
}

console.log('\n12. No React errors during any of that')
ok('console stayed clean', errors.length === 0, errors.slice(0, 3).join('\n         '))

console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll smoke checks passed\n')
process.exit(failures ? 1 : 0)
