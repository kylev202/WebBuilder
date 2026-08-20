import Icon from '../ui/Icon.jsx'
import { Modal } from '../ui/controls.jsx'
import { useStore } from '../../core/store.js'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')
const MOD = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS = [
  ['On the canvas', [
    ['Drag', 'Move it -- reorders in a stack, places freely in a plain box'],
    [`${MOD} + drag`, 'Do the opposite: break out of a stack, or snap back into one'],
    ['Alt + drag', 'Drag off a copy'],
    ['Shift + drag', 'Keep it to one direction'],
    ['Drag a corner', 'Resize -- Shift keeps the shape, Alt grows both ways'],
    ['Drag past a corner', 'Turn it'],
    ['Drag on empty space', 'Sweep up everything you cross'],
    ['Alt + point at something', 'How far it is from what is selected'],
  ]],
  ['Getting around', [
    ['Space + drag', 'Slide the canvas'],
    [`${MOD} + scroll`, 'Zoom in and out'],
    ['V  /  H', 'Move tool, hand tool'],
    ['Shift + 1  /  Shift + 2', 'Fit the page, fit the selection'],
    [`${MOD} + 0`, 'Back to 100%'],
  ]],
  ['Choosing things', [
    ['Click', 'Select something'],
    ['Shift + click', 'Add it to the selection'],
    ['Tab', 'Next thing alongside it'],
    ['Enter  /  Shift + Enter', 'Step inside, step out'],
    [`${MOD} + A`, 'Select everything on the page'],
    ['Esc', 'Deselect, or call off a drag'],
  ]],
  ['Editing', [
    ['Double-click', 'Change the words'],
    ['Arrows', 'Nudge by one pixel -- Shift for ten'],
    ['Alt + arrows', 'Move up or down among its neighbours'],
    [`${MOD} + D`, 'Duplicate'],
    [`${MOD} + G`, 'Put it inside a box'],
    ['Delete', 'Remove what is selected'],
    [`${MOD} + Z  /  ${MOD} + Shift + Z`, 'Undo and redo'],
  ]],
  ['Project', [
    [`${MOD} + S`, 'Save now'],
    [`${MOD} + E`, 'Export'],
    [`${MOD} + Enter`, 'Preview / back to editing'],
    [`${MOD} + /`, 'Show or hide the code'],
    ['?', 'This help'],
  ]],
]

export function ShortcutsModal() {
  const setModal = useStore((s) => s.setModal)
  return (
    <Modal
      icon="Keyboard"
      title="Help and shortcuts"
      subtitle="Everything can be done with the mouse. These just make it quicker."
      onClose={() => setModal(null)}
      footer={<button className="wb-btn wb-btn--primary" onClick={() => setModal(null)}>Got it</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {SHORTCUTS.map(([group, rows]) => (
          <div key={group}>
            <div className="wb-group-label" style={{ padding: '0 0 8px' }}>{group}</div>
            <div className="wb-col" style={{ gap: 7 }}>
              {rows.map(([keys, what]) => (
                <div key={keys} className="wb-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                  <span className="wb-small wb-muted" style={{ flex: 1 }}>{what}</span>
                  <span className="wb-kbd" style={{ whiteSpace: 'nowrap' }}>{keys}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="wb-divider-h" style={{ margin: '20px 0 14px' }} />

      <div className="wb-group-label" style={{ padding: '0 0 8px' }}>How this works</div>
      <div className="wb-col" style={{ gap: 10 }}>
        {[
          ['Move', 'Drag things where you want them', 'A box set to "a stack or a row" arranges what is inside it, so dragging reorders. A box set to "free" lets you drop things exactly where you like. Hold Cmd to get the other behaviour once.'],
          ['Blocks', 'Build by dragging', 'Drag pieces or whole sections from the left onto the page. Drop them inside any box.'],
          ['Palette', 'Change the look once', 'The Look tab sets colours and fonts for the whole project at once.'],
          ['Smartphone', 'Check every screen', 'Switch to tablet or phone at the top of the canvas. Changes made there only affect that size.'],
          ['Code2', 'The code is real', 'Open the code panel and edit it — the canvas updates as you type. Broken code is never applied.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="wb-row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--ui-accent-soft)', color: 'var(--ui-accent)', flexShrink: 0 }}>
              <Icon name={icon} size={14} />
            </span>
            <span>
              <span style={{ fontSize: 12.5, fontWeight: 600, display: 'block' }}>{title}</span>
              <span className="wb-small wb-muted" style={{ lineHeight: 1.5 }}>{text}</span>
            </span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function WelcomeModal() {
  const setModal = useStore((s) => s.setModal)
  const newProjectFrom = useStore((s) => s.newProjectFrom)

  return (
    <Modal
      size="sm"
      icon="Sparkles"
      title="Welcome to WebBuilder"
      subtitle="Make a website by pointing and clicking. Real code comes out of the other end — you can look at it, edit it, and take it with you."
      onClose={() => setModal(null)}
      footer={
        <>
          <button className="wb-btn" onClick={() => newProjectFrom('blank', 'My project')}>Start empty</button>
          <button className="wb-btn wb-btn--primary" onClick={() => setModal('templates')}>
            <Icon name="LayoutTemplate" size={14} /> Choose a template
          </button>
        </>
      }
    >
      <div className="wb-col" style={{ gap: 12 }}>
        {[
          ['MousePointerClick', 'Click anything to change it', 'Double-click writing to type over it. Everything else is in the panel on the right.'],
          ['Blocks', 'Drag in ready-made sections', 'Heroes, pricing tables, contact forms — drop one in and make it yours.'],
          ['Code2', 'Watch the code appear', 'Open the code panel to see exactly what you have built, and edit it if you like.'],
          ['Download', 'Take it anywhere', 'Export a finished website or a React project. Nothing locks you in.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="wb-row" style={{ alignItems: 'flex-start', gap: 11 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'var(--ui-accent-soft)', color: 'var(--ui-accent)', flexShrink: 0 }}>
              <Icon name={icon} size={15} />
            </span>
            <span>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{title}</span>
              <span className="wb-small wb-muted" style={{ lineHeight: 1.5 }}>{text}</span>
            </span>
          </div>
        ))}
        <div className="wb-small wb-muted" style={{ textAlign: 'center', marginTop: 2 }}>
          A sample project is already loaded, so you can start by changing something.
        </div>
      </div>
    </Modal>
  )
}
