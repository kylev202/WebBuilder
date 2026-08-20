/**
 * Design tokens. One change here restyles the whole project, and the tokens
 * come out the other end as plain CSS custom properties.
 */

export const TOKEN_GROUPS = [
  {
    id: 'colors',
    label: 'Colours',
    tokens: [
      { key: 'primary', label: 'Main colour', hint: 'Buttons, links and highlights' },
      { key: 'primarySoft', label: 'Main colour, faded', hint: 'Soft backgrounds behind the main colour' },
      { key: 'accent', label: 'Accent', hint: 'A second colour for variety' },
      { key: 'bg', label: 'Page background' },
      { key: 'surface', label: 'Card background' },
      { key: 'text', label: 'Main text' },
      { key: 'muted', label: 'Quiet text', hint: 'Descriptions and captions' },
      { key: 'border', label: 'Lines and borders' },
    ],
  },
]

export const FONT_CHOICES = [
  { value: "'Inter', system-ui, -apple-system, sans-serif", label: 'Inter - clean and modern' },
  { value: "'Fraunces', Georgia, 'Times New Roman', serif", label: 'Fraunces - warm and editorial' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia - classic serif' },
  { value: "'Trebuchet MS', 'Segoe UI', sans-serif", label: 'Trebuchet - friendly' },
  { value: "'Courier New', monospace", label: 'Courier - typewriter' },
  { value: "system-ui, -apple-system, 'Segoe UI', sans-serif", label: 'System - matches the device' },
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono - technical' },
]

export const THEME_PRESETS = {
  indigo: {
    label: 'Indigo',
    colors: {
      primary: '#4f46e5', primarySoft: '#eef2ff', accent: '#f59e0b',
      bg: '#ffffff', surface: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0',
    },
    fonts: { heading: "'Fraunces', Georgia, 'Times New Roman', serif", body: "'Inter', system-ui, -apple-system, sans-serif" },
    radius: '12px',
  },
  emerald: {
    label: 'Emerald',
    colors: {
      primary: '#059669', primarySoft: '#ecfdf5', accent: '#0ea5e9',
      bg: '#ffffff', surface: '#f8fafc', text: '#052e2b', muted: '#5b7c78', border: '#d7e6e2',
    },
    fonts: { heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, -apple-system, sans-serif" },
    radius: '14px',
  },
  sunset: {
    label: 'Sunset',
    colors: {
      primary: '#e11d48', primarySoft: '#fff1f2', accent: '#f97316',
      bg: '#fffbf7', surface: '#ffffff', text: '#3b1618', muted: '#8a6a68', border: '#f2e0dc',
    },
    fonts: { heading: "'Fraunces', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
    radius: '18px',
  },
  midnight: {
    label: 'Midnight',
    colors: {
      primary: '#818cf8', primarySoft: '#1e1b4b', accent: '#22d3ee',
      bg: '#0b1020', surface: '#141a2e', text: '#e8ecf8', muted: '#93a0c0', border: '#26304d',
    },
    fonts: { heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
    radius: '12px',
  },
  mono: {
    label: 'Mono',
    colors: {
      primary: '#111827', primarySoft: '#f3f4f6', accent: '#6b7280',
      bg: '#ffffff', surface: '#fafafa', text: '#111827', muted: '#6b7280', border: '#e5e7eb',
    },
    fonts: { heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
    radius: '6px',
  },
  ocean: {
    label: 'Ocean',
    colors: {
      primary: '#0284c7', primarySoft: '#e0f2fe', accent: '#7c3aed',
      bg: '#f8fbff', surface: '#ffffff', text: '#0c2233', muted: '#5c7a91', border: '#dbe9f4',
    },
    fonts: { heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
    radius: '16px',
  },
}

export const defaultTheme = () => ({ preset: 'indigo', ...structuredClone(THEME_PRESETS.indigo) })

const VAR_NAMES = {
  primary: '--color-primary', primarySoft: '--color-primary-soft', accent: '--color-accent',
  bg: '--color-bg', surface: '--color-surface', text: '--color-text',
  muted: '--color-muted', border: '--color-border',
}

/** Theme -> the `:root { ... }` declarations, as an object. */
export function themeVars(theme) {
  const out = {}
  for (const [key, value] of Object.entries(theme.colors || {})) {
    if (VAR_NAMES[key]) out[VAR_NAMES[key]] = value
  }
  out['--font-heading'] = theme.fonts?.heading || "'Inter', sans-serif"
  out['--font-body'] = theme.fonts?.body || "'Inter', sans-serif"
  out['--radius'] = theme.radius || '12px'
  return out
}

export function themeCss(theme, indent = '  ') {
  const vars = themeVars(theme)
  const body = Object.entries(vars).map(([k, v]) => `${indent}${k}: ${v};`).join('\n')
  return `:root {\n${body}\n}`
}

/** The token swatches offered in every colour picker. */
export function tokenSwatches(theme) {
  return Object.entries(VAR_NAMES).map(([key, varName]) => ({
    key,
    label: TOKEN_GROUPS[0].tokens.find((t) => t.key === key)?.label || key,
    value: `var(${varName})`,
    resolved: theme.colors?.[key] || '#000000',
  }))
}

/** Resolve `var(--color-x)` against the theme so swatches show a real colour. */
export function resolveColor(value, theme) {
  if (typeof value !== 'string') return value
  const m = /^var\((--[a-z-]+)\)$/.exec(value.trim())
  if (!m) return value
  const entry = Object.entries(VAR_NAMES).find(([, v]) => v === m[1])
  return entry ? theme.colors?.[entry[0]] || '#000000' : value
}
