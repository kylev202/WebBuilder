/**
 * The inspector edits whatever is selected: first its content, then its look.
 * Content comes first deliberately -- most people want to change the words
 * long before they want to change the padding.
 */
import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Field, TextInput, Select, Switch, Section, Segmented, Empty, UnitInput } from '../ui/controls.jsx'
import {
  LayoutSection, SizeSection, SpacingSection, TypographySection,
  BackgroundSection, BorderSection, EffectsSection, PositionSection,
} from './StyleSections.jsx'
import { def } from '../../core/elements.js'
import { bp, createNode, findNode } from '../../core/doc.js'
import { flattenStyles } from '../../core/css.js'
import { ICON_NAMES, ICON_PATHS } from '../../core/icons.js'
import { useStore, useSelectedNode, useActivePage } from '../../core/store.js'

/* ------------------------------------------------ one-click style sets */

const PRESETS = {
  button: [
    { label: 'Solid', styles: { backgroundColor: 'var(--color-primary)', color: '#ffffff', borderWidth: '0px' } },
    { label: 'Outline', styles: { backgroundColor: 'transparent', color: 'var(--color-primary)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-primary)' } },
    { label: 'Soft', styles: { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', borderWidth: '0px' } },
    { label: 'Plain', styles: { backgroundColor: 'transparent', color: 'var(--color-text)', borderWidth: '0px' } },
    { label: 'Large', styles: { paddingTop: '16px', paddingBottom: '16px', paddingLeft: '30px', paddingRight: '30px', fontSize: '17px' } },
    { label: 'Small', styles: { paddingTop: '9px', paddingBottom: '9px', paddingLeft: '16px', paddingRight: '16px', fontSize: '13px' } },
    { label: 'Pill', styles: { borderRadius: '999px' } },
    { label: 'Full width', styles: { width: '100%' } },
  ],
  heading: [
    { label: 'Huge', styles: { fontSize: '60px', fontWeight: '700', lineHeight: '1.05' } },
    { label: 'Large', styles: { fontSize: '40px', fontWeight: '700', lineHeight: '1.15' } },
    { label: 'Medium', styles: { fontSize: '26px', fontWeight: '600', lineHeight: '1.25' } },
    { label: 'Small', styles: { fontSize: '18px', fontWeight: '600', lineHeight: '1.35' } },
    { label: 'Centred', styles: { textAlign: 'center' } },
    { label: 'Muted', styles: { color: 'var(--color-muted)' } },
  ],
  text: [
    { label: 'Lead', styles: { fontSize: '19px', lineHeight: '1.6', color: 'var(--color-muted)' } },
    { label: 'Body', styles: { fontSize: '16px', lineHeight: '1.65', color: 'var(--color-muted)' } },
    { label: 'Small', styles: { fontSize: '14px', lineHeight: '1.6' } },
    { label: 'Centred', styles: { textAlign: 'center' } },
    { label: 'Strong', styles: { color: 'var(--color-text)', fontWeight: '500' } },
  ],
  card: [
    { label: 'Bordered', styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', boxShadow: '', backgroundColor: 'var(--color-surface)' } },
    { label: 'Raised', styles: { borderWidth: '0px', boxShadow: '0 10px 24px rgba(16, 24, 40, 0.12)', backgroundColor: 'var(--color-surface)' } },
    { label: 'Filled', styles: { backgroundColor: 'var(--color-primary-soft)', borderWidth: '0px', boxShadow: '' } },
    { label: 'Plain', styles: { backgroundColor: 'transparent', borderWidth: '0px', boxShadow: '', padding: '0px' } },
  ],
  section: [
    { label: 'Roomy', styles: { paddingTop: '96px', paddingBottom: '96px' } },
    { label: 'Compact', styles: { paddingTop: '48px', paddingBottom: '48px' } },
    { label: 'Full height', styles: { minHeight: '100vh', justifyContent: 'center' } },
    { label: 'Tinted', styles: { backgroundColor: 'var(--color-primary-soft)' } },
    { label: 'Dark', styles: { backgroundColor: 'var(--color-text)', color: 'var(--color-bg)' } },
  ],
  image: [
    { label: 'Square', styles: { borderRadius: '0px' } },
    { label: 'Rounded', styles: { borderRadius: '14px' } },
    { label: 'Circle', styles: { borderRadius: '999px', aspectRatio: '1 / 1', objectFit: 'cover' } },
    { label: 'Wide', styles: { aspectRatio: '16 / 9', objectFit: 'cover', height: 'auto' } },
    { label: 'Shadow', styles: { boxShadow: '0 20px 48px rgba(16, 24, 40, 0.18)' } },
  ],
  container: [
    { label: 'Narrow', styles: { maxWidth: '720px' } },
    { label: 'Normal', styles: { maxWidth: '1120px' } },
    { label: 'Wide', styles: { maxWidth: '1320px' } },
    { label: 'Full width', styles: { maxWidth: 'none' } },
  ],
  row: [
    { label: 'Spread apart', styles: { justifyContent: 'space-between' } },
    { label: 'Centred', styles: { justifyContent: 'center' } },
    { label: 'Equal columns', styles: { display: 'flex', gap: '24px' } },
  ],
}

/**
 * Read the element's real size and place off the live canvas. The inspector
 * needs actual pixels the moment someone switches to an exact size or moves a
 * pin, so that nothing jumps when the CSS underneath changes shape.
 */
function measureOnCanvas(id) {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`.wb-canvas-root [data-node-id="${id}"]`)
  if (!el) return null
  const zoom = useStore.getState().zoom || 1
  const r = el.getBoundingClientRect()
  const parentEl = el.parentElement?.closest('[data-node-id]')
  const pr = parentEl?.getBoundingClientRect()
  const cs = parentEl ? getComputedStyle(parentEl) : null
  const border = (side) => (cs ? parseFloat(cs[`border${side}Width`]) || 0 : 0)

  return {
    width: r.width / zoom,
    height: r.height / zoom,
    left: pr ? (r.left - pr.left) / zoom - border('Left') : 0,
    top: pr ? (r.top - pr.top) / zoom - border('Top') : 0,
    parentWidth: pr ? pr.width / zoom - border('Left') - border('Right') : 0,
    parentHeight: pr ? pr.height / zoom - border('Top') - border('Bottom') : 0,
  }
}

export default function Inspector() {
  const node = useSelectedNode()
  const page = useActivePage()
  const theme = useStore((s) => s.project.theme)
  const breakpoint = useStore((s) => s.breakpoint)
  const styleState = useStore((s) => s.styleState)
  const setStyleState = useStore((s) => s.setStyleState)
  const setStyle = useStore((s) => s.setStyle)
  const setStyles = useStore((s) => s.setStyles)
  const clearStyleAt = useStore((s) => s.clearStyleAt)
  const rename = useStore((s) => s.rename)
  const remove = useStore((s) => s.remove)
  const duplicate = useStore((s) => s.duplicate)
  const setBreakpoint = useStore((s) => s.setBreakpoint)

  if (!node) return <NothingSelected />

  const d = def(node.type)
  const bucket = styleState === 'hover' ? 'hover' : bp(breakpoint).styleKey
  const bucketLabel = styleState === 'hover' ? 'hover' : bp(breakpoint).label.toLowerCase()
  const effective = flattenStyles(node.styles, breakpoint, styleState === 'hover')
  const own = node.styles?.[bucket] || {}

  // The box this element sits in decides what "fill" and "hug" have to mean.
  const parent = findNode(page.root, node.id)?.parent || null
  const parentStyle = flattenStyles(parent?.styles, breakpoint)
  const parentIsFlex = /flex/.test(parentStyle.display || '')

  const sx = {
    node, theme, bucket, bucketLabel, style: effective, own,
    ctx: {
      parentNode: parent,
      parentIsFlex,
      parentRow: parentIsFlex && (parentStyle.flexDirection || 'row').startsWith('row'),
    },
    get: (prop) => effective[prop] ?? '',
    isOwn: (prop) => own[prop] !== undefined,
    set: (prop, value) => setStyle(node.id, prop, value),
    setMany: (patch) => setStyles(node.id, patch),
    reset: (prop) => clearStyleAt(node.id, prop, bucket),
    measure: () => measureOnCanvas(node.id),
  }

  const presets = PRESETS[node.type]
  const stylable = !d.unstyled

  return (
    <aside className="wb-panel wb-panel--right">
      <div className="wb-insp-head">
        <div className="wb-insp-icon"><Icon name={d.icon} size={15} /></div>
        <div className="wb-insp-name">
          <input value={node.name} onChange={(e) => rename(node.id, e.target.value)} aria-label="Name" />
          <div className="wb-insp-type">{d.label}</div>
        </div>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Make a copy" data-tip-side="left" onClick={() => duplicate(node.id)}>
          <Icon name="Copy" size={14} />
        </button>
        <button className="wb-btn wb-btn--icon wb-btn--ghost wb-tip wb-btn--danger" data-tip="Delete" data-tip-side="left" onClick={() => remove(node.id)}>
          <Icon name="Trash2" size={14} />
        </button>
      </div>

      {stylable && (
        <div className="wb-statebar">
          <Segmented
            value={styleState}
            onChange={setStyleState}
            options={[
              { value: 'base', label: 'Normal' },
              { value: 'hover', label: 'Pointed at' },
            ]}
          />
          <div className="wb-spacer" />
          <span className="wb-small wb-muted wb-tip" data-tip="Changes apply to this screen size and smaller">
            {bp(breakpoint).label}
          </span>
          <Icon name={bp(breakpoint).icon} size={13} style={{ color: 'var(--ui-text-3)' }} />
        </div>
      )}

      {breakpoint !== 'desktop' && styleState === 'base' && (
        <div style={{ padding: '8px 12px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
          You are editing the <strong>{bp(breakpoint).label.toLowerCase()}</strong> version. Changes here only affect
          {' '}{bp(breakpoint).label.toLowerCase()} screens.{' '}
          <button
            onClick={() => setBreakpoint('desktop')}
            style={{ border: 0, background: 'none', padding: 0, color: '#92400e', textDecoration: 'underline', fontWeight: 600 }}
          >
            Back to desktop
          </button>
        </div>
      )}

      <div className="wb-panel-scroll">
        {d.fields?.length > 0 && (
          <Section title="Content" icon="Pencil">
            {d.fields.map((field) => (
              <ContentField key={field.key} node={node} field={field} />
            ))}
          </Section>
        )}

        {d.childType && <ItemsSection node={node} childType={d.childType} />}

        {presets && (
          <Section title="Quick styles" icon="Wand2">
            <div className="wb-hint">One click applies a whole set of settings.</div>
            <div className="wb-presets">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  className="wb-preset"
                  onClick={() => setStyles(node.id, preset.styles, { bucket, label: 'Apply a style' })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {stylable && (
          <>
            {(d.container || node.type === 'page') && <LayoutSection sx={sx} />}
            <SpacingSection sx={sx} />
            <TypographySection sx={sx} />
            <SizeSection sx={sx} />
            <BackgroundSection sx={sx} />
            <BorderSection sx={sx} />
            <EffectsSection sx={sx} />
            <PositionSection sx={sx} />
            <AdvancedSection node={node} sx={sx} page={page} />
          </>
        )}
      </div>
    </aside>
  )
}

/* ---------------------------------------------- list and dropdown items */

/** Lists and dropdowns are edited as a simple list of lines, not a tree. */
function ItemsSection({ node, childType }) {
  const setProp = useStore((s) => s.setProp)
  const remove = useStore((s) => s.remove)
  const insertNodeAt = useStore((s) => s.insertNodeAt)
  const nudgeOrder = useStore((s) => s.nudgeOrder)
  const items = node.children || []
  const label = childType === 'option' ? 'Choices' : 'Items'

  return (
    <Section title={label} icon="List">
      <div className="wb-col" style={{ gap: 5 }}>
        {items.map((item, index) => (
          <div key={item.id} className="wb-row" style={{ gap: 4 }}>
            <TextInput
              value={item.props?.text ?? ''}
              onChange={(v) => setProp(item.id, 'text', v)}
              placeholder={`${label.slice(0, -1)} ${index + 1}`}
            />
            <button
              className="wb-btn wb-btn--icon wb-btn--sm wb-btn--ghost wb-tip"
              data-tip="Move up"
              disabled={index === 0}
              onClick={() => nudgeOrder(item.id, -1)}
            >
              <Icon name="ArrowUp" size={12} />
            </button>
            <button
              className="wb-btn wb-btn--icon wb-btn--sm wb-btn--ghost wb-tip wb-btn--danger"
              data-tip="Remove"
              onClick={() => remove(item.id)}
            >
              <Icon name="Trash2" size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="wb-hint">Nothing here yet.</div>}
        <button
          className="wb-btn wb-btn--sm wb-btn--block"
          onClick={() => insertNodeAt(createNode(childType), node.id, items.length)}
        >
          <Icon name="Plus" size={12} /> Add {childType === 'option' ? 'a choice' : 'an item'}
        </button>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------- content field */

function ContentField({ node, field }) {
  const setProp = useStore((s) => s.setProp)
  const pages = useStore((s) => s.project.pages)
  const assets = useStore((s) => s.project.assets) || []
  const setLeftTab = useStore((s) => s.setLeftTab)
  const value = node.props?.[field.key]

  if (field.showIf && !field.showIf(node.props || {})) return null
  const onChange = (v) => setProp(node.id, field.key, v)

  switch (field.control) {
    case 'textarea':
      return (
        <Field label={field.label} hint={field.hint}>
          <TextInput multiline rows={field.rows || 3} value={value} onChange={onChange} placeholder={field.placeholder} />
        </Field>
      )
    case 'select':
      return (
        <Field label={field.label} hint={field.hint} inline>
          <Select value={value} onChange={onChange} options={field.options} />
        </Field>
      )
    case 'switch':
      return (
        <Field label={field.label} hint={field.hint} inline>
          <Switch checked={!!value} onChange={onChange} />
        </Field>
      )
    case 'number':
      return (
        <Field label={field.label} hint={field.hint} inline>
          <UnitInput value={String(value ?? '')} onChange={(v) => onChange(parseInt(v, 10) || '')} units={[]} min={field.min} max={field.max} />
        </Field>
      )
    case 'link':
      return (
        <Field label={field.label} hint={field.hint}>
          <TextInput value={value} onChange={onChange} placeholder="https://… or /about" />
          <div className="wb-presets" style={{ marginTop: 2 }}>
            {pages.map((p) => (
              <button key={p.id} className="wb-preset" onClick={() => onChange(p.path)}>{p.name}</button>
            ))}
          </div>
        </Field>
      )
    case 'image':
      return (
        <Field label={field.label} hint={field.hint}>
          {value && (
            <img
              src={value}
              alt=""
              style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ui-line)' }}
            />
          )}
          <TextInput value={value} onChange={onChange} placeholder="https://…" />
          <div className="wb-row">
            <button className="wb-btn wb-btn--sm wb-grow" onClick={() => setLeftTab('images')}>
              <Icon name="Image" size={12} /> Choose from my pictures
            </button>
          </div>
          {assets.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {assets.slice(0, 8).map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onChange(asset.src)}
                  style={{ padding: 0, border: '1px solid var(--ui-line)', borderRadius: 6, overflow: 'hidden', height: 34, background: 'none' }}
                >
                  <img src={asset.src} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </Field>
      )
    case 'icon':
      return <IconPicker label={field.label} value={value} onChange={onChange} />
    default:
      return (
        <Field label={field.label} hint={field.hint}>
          <TextInput value={value} onChange={onChange} placeholder={field.placeholder} />
        </Field>
      )
  }
}

function IconPicker({ label, value, onChange }) {
  const [query, setQuery] = useState('')
  const names = ICON_NAMES.filter((n) => !query || n.includes(query.toLowerCase()))
  return (
    <Field label={label}>
      <TextInput value={query} onChange={setQuery} placeholder="Search symbols…" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, maxHeight: 168, overflowY: 'auto' }}>
        {names.map((name) => (
          <button
            key={name}
            className="wb-tip"
            data-tip={name}
            onClick={() => onChange(name)}
            style={{
              display: 'grid', placeItems: 'center', aspectRatio: '1', padding: 0,
              border: `1px solid ${value === name ? 'var(--ui-accent)' : 'var(--ui-line)'}`,
              borderRadius: 7,
              background: value === name ? 'var(--ui-accent-soft)' : 'var(--ui-panel)',
              color: value === name ? 'var(--ui-accent)' : 'var(--ui-text-2)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON_PATHS[name]} />
            </svg>
          </button>
        ))}
      </div>
    </Field>
  )
}

/* -------------------------------------------------------------- advanced */

function AdvancedSection({ node, page }) {
  const setProp = useStore((s) => s.setProp)
  return (
    <Section title="Advanced" icon="Code2" defaultOpen={false}>
      <Field
        label="Section id"
        hint="Gives this element a name that buttons can scroll to, e.g. “pricing”."
      >
        <TextInput
          value={node.props?.htmlId || ''}
          onChange={(v) => setProp(node.id, 'htmlId', v.replace(/[^a-zA-Z0-9-_]/g, ''))}
          placeholder="pricing"
        />
      </Field>
      <div className="wb-hint">
        In the code this element is <code style={{ fontFamily: 'var(--ui-mono)', fontSize: 11 }}>.{`${node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${node.id}`}</code>
        {' '}on page “{page.name}”.
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- empty */

function NothingSelected() {
  const setLeftTab = useStore((s) => s.setLeftTab)
  const setModal = useStore((s) => s.setModal)
  return (
    <aside className="wb-panel wb-panel--right">
      <div className="wb-insp-head">
        <div className="wb-insp-icon"><Icon name="MousePointer2" size={15} /></div>
        <div className="wb-insp-name">
          <div style={{ fontSize: 13, fontWeight: 600, padding: '3px 5px' }}>Nothing selected</div>
        </div>
      </div>
      <div className="wb-panel-scroll">
        <Empty icon="MousePointerClick" title="Click anything on the page">
          Select something on the canvas and all of its settings appear here.
        </Empty>
        <div style={{ padding: '0 14px 16px' }} className="wb-col">
          <div className="wb-group-label" style={{ padding: '4px 0' }}>Things to try</div>
          {[
            ['Double-click any writing to change the words', 'Pencil'],
            ['Drag a section from the left onto the page', 'Blocks'],
            ['Switch to the phone view to check it fits', 'Smartphone'],
            ['Open the code panel to see what you have made', 'Code2'],
          ].map(([tip, icon]) => (
            <div key={tip} className="wb-row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Icon name={icon} size={13} style={{ color: 'var(--ui-text-3)', marginTop: 2, flexShrink: 0 }} />
              <span className="wb-small wb-muted" style={{ lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
          <button className="wb-btn wb-btn--block" style={{ marginTop: 6 }} onClick={() => setLeftTab('sections')}>
            <Icon name="LayoutTemplate" size={13} /> Browse ready-made sections
          </button>
          <button className="wb-btn wb-btn--block" onClick={() => setModal('shortcuts')}>
            <Icon name="Keyboard" size={13} /> Keyboard shortcuts
          </button>
        </div>
      </div>
    </aside>
  )
}
