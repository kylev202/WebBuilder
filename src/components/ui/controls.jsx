/**
 * Small, reusable controls for the panels. They speak plain language and stay
 * quiet: no control shouts unless something is actually overridden.
 */
import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { parseValue, withUnit } from '../../core/css.js'
import { cx } from '../../core/util.js'

export function Field({ label, hint, children, inline = false, action }) {
  if (inline) {
    return (
      <div className="wb-field-row">
        <Label text={label} hint={hint} action={action} />
        <div className="wb-grow">{children}</div>
      </div>
    )
  }
  return (
    <div className="wb-field">
      {label && <Label text={label} hint={hint} action={action} />}
      {children}
    </div>
  )
}

function Label({ text, hint, action }) {
  if (!text) return null
  return (
    <div className="wb-label">
      <span>{text}</span>
      {hint && (
        <span className="wb-label-hint wb-tip" data-tip={hint}>
          <Icon name="Info" size={11} />
        </span>
      )}
      {action}
    </div>
  )
}

export function TextInput({ value = '', onChange, placeholder, multiline, rows = 3, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      className={multiline ? 'wb-textarea' : 'wb-input'}
      value={value ?? ''}
      rows={multiline ? rows : undefined}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

export function Select({ value, onChange, options, ...rest }) {
  return (
    <select className="wb-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o
        return <option key={opt.value} value={opt.value}>{opt.label}</option>
      })}
    </select>
  )
}

export function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      className="wb-switch"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
    />
  )
}

const UNITS = ['px', '%', 'rem', 'vh', 'vw', 'fr', 'auto']

/** A number with a unit picker. Arrow keys nudge; "auto" clears the number. */
export function UnitInput({ value, onChange, prop, placeholder = 'auto', units = UNITS, step = 1, min, max }) {
  const parsed = parseValue(value)
  const isKeyword = value && parsed.number === ''
  const [draft, setDraft] = useState(null)
  const shown = draft ?? (isKeyword ? value : parsed.number === '' ? '' : String(parsed.number))

  const commit = (next, unit = parsed.unit || 'px') => {
    setDraft(null)
    if (next === '' || next === null) return onChange('')
    if (/^[a-z]+$/i.test(String(next))) return onChange(String(next))
    onChange(withUnit(Number(next), unit, prop))
  }

  return (
    <div className="wb-unit">
      <input
        value={shown}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value.trim())
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const base = Number(parsed.number) || 0
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : step)
            let next = base + delta
            if (min !== undefined) next = Math.max(min, next)
            if (max !== undefined) next = Math.min(max, next)
            commit(next)
          }
        }}
      />
      {units.length > 0 && (
        <select
          value={isKeyword ? 'auto' : parsed.unit || 'px'}
          onChange={(e) => {
            if (e.target.value === 'auto') return onChange('auto')
            commit(parsed.number === '' ? 0 : parsed.number, e.target.value)
          }}
        >
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      )}
    </div>
  )
}

/** A row of icon toggles -- used for alignment, text style and direction. */
export function IconRow({ value, onChange, options, allowUnset = true }) {
  return (
    <div className="wb-iconrow">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className="wb-tip"
          data-tip={o.label}
          onClick={() => onChange(allowUnset && value === o.value ? '' : o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : <span style={{ fontSize: 11, fontWeight: 600 }}>{o.short || o.label}</span>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- popover */

export function Popover({ anchorRef, open, onClose, children, width = 244 }) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - width - 12)
    const top = Math.min(rect.bottom + 6, window.innerHeight - 260)
    setPos({ top, left: Math.max(12, left) })
  }, [open, anchorRef, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null
  return createPortal(
    <div ref={ref} className="wb-popover" style={{ top: pos.top, left: pos.left, width, position: 'fixed' }}>
      {children}
    </div>,
    document.body,
  )
}

/* --------------------------------------------------------------- colour */

const PALETTE = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#0f172a', '#000000',
  '#fee2e2', '#fecaca', '#ef4444', '#dc2626', '#fed7aa', '#fb923c', '#f97316', '#ea580c',
  '#fef3c7', '#fde047', '#facc15', '#eab308', '#dcfce7', '#86efac', '#22c55e', '#16a34a',
  '#cffafe', '#67e8f9', '#06b6d4', '#0891b2', '#dbeafe', '#93c5fd', '#3b82f6', '#2563eb',
  '#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5', '#f3e8ff', '#d8b4fe', '#a855f7', '#9333ea',
  '#fce7f3', '#f9a8d4', '#ec4899', '#db2777', 'transparent', 'rgba(0,0,0,0.5)', '#f5f5f4', '#78716c',
]

export function ColorControl({ value = '', onChange, tokens = [], resolve = (v) => v, allowClear = true }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const resolved = resolve(value)
  const isToken = typeof value === 'string' && value.startsWith('var(')

  return (
    <div className="wb-color">
      <button
        ref={anchor}
        type="button"
        className="wb-swatch wb-tip"
        data-tip="Pick a colour"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ background: resolved || 'transparent' }} />
      </button>
      <input
        className="wb-input"
        value={value}
        placeholder="none"
        onChange={(e) => onChange(e.target.value)}
        style={isToken ? { fontFamily: 'var(--ui-mono)', fontSize: 11 } : undefined}
      />
      <Popover anchorRef={anchor} open={open} onClose={() => setOpen(false)}>
        {tokens.length > 0 && (
          <>
            <div className="wb-label" style={{ marginBottom: 6 }}>Your theme colours</div>
            <div className="wb-tokenlist" style={{ marginBottom: 12 }}>
              {tokens.map((t) => (
                <button key={t.key} type="button" onClick={() => { onChange(t.value); setOpen(false) }}>
                  <span className="wb-tokenchip" style={{ background: t.resolved }} />
                  <span className="wb-grow">{t.label}</span>
                  {value === t.value && <Icon name="Check" size={13} />}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="wb-label" style={{ marginBottom: 6 }}>Any colour</div>
        <div className="wb-swatchgrid">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              data-active={value === c}
              style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px' : c }}
              onClick={() => { onChange(c); setOpen(false) }}
            />
          ))}
        </div>
        <div className="wb-row" style={{ marginTop: 10 }}>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(resolved) ? resolved : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 34, height: 30, padding: 0, border: '1px solid var(--ui-line)', borderRadius: 7, background: 'none' }}
          />
          <input className="wb-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" />
          {allowClear && (
            <button type="button" className="wb-btn wb-btn--icon wb-btn--ghost wb-tip" data-tip="Clear" onClick={() => { onChange(''); setOpen(false) }}>
              <Icon name="RotateCcw" size={14} />
            </button>
          )}
        </div>
      </Popover>
    </div>
  )
}

/* ------------------------------------------------------------- section */

export function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="wb-section">
      <button type="button" className="wb-section-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="ChevronRight" size={13} />
        {icon && <Icon name={icon} size={14} />}
        <span>{title}</span>
        {badge && <span className="wb-section-dot" />}
      </button>
      {open && <div className="wb-section-body">{children}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- modal */

export function Modal({ title, subtitle, icon, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="wb-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('wb-modal', size === 'sm' && 'wb-modal--sm')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="wb-modal-head">
          {icon && (
            <div className="wb-insp-icon" style={{ width: 34, height: 34 }}>
              <Icon name={icon} size={17} />
            </div>
          )}
          <div className="wb-grow">
            <div className="wb-modal-title">{title}</div>
            {subtitle && <div className="wb-modal-sub">{subtitle}</div>}
          </div>
          <button type="button" className="wb-btn wb-btn--icon wb-btn--ghost" onClick={onClose} aria-label="Close">
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="wb-modal-body">{children}</div>
        {footer && <div className="wb-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Segmented({ value, onChange, options, fill }) {
  return (
    <div className={cx('wb-seg', fill && 'wb-seg--fill')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon = 'Sparkles', title, children }) {
  return (
    <div className="wb-emptystate">
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: 'var(--ui-accent-soft)', color: 'var(--ui-accent)' }}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  )
}
