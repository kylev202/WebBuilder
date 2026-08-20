/**
 * Style objects -> CSS.
 *
 * The canvas and the exported code go through this same file, so what the user
 * sees on the canvas is literally the stylesheet they download. The only
 * difference: the canvas asks for one breakpoint flattened (its frame is only
 * as wide as a phone in pixels, so real media queries would not fire), while
 * the export keeps proper @media blocks.
 */
import { kebab } from './util.js'
import { classFor, flatten, BREAKPOINTS } from './doc.js'
import { themeCss, themeVars } from './theme.js'

/** Properties that must never get a `px` suffix added. */
export const UNITLESS = new Set([
  'fontWeight', 'lineHeight', 'opacity', 'zIndex', 'flexGrow', 'flexShrink',
  'order', 'aspectRatio', 'flex',
])

export function declarations(style = {}, indent = '  ') {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${indent}${kebab(k)}: ${v};`)
    .join('\n')
}

const hasDecls = (o) => o && Object.keys(o).some((k) => o[k] !== undefined && o[k] !== null && o[k] !== '')

export function rule(selector, style, indent = '') {
  if (!hasDecls(style)) return ''
  return `${indent}${selector} {\n${declarations(style, indent + '  ')}\n${indent}}`
}

/**
 * The styles that actually apply at a given breakpoint, cascaded the way the
 * browser would: base, then tablet (which also covers phones), then phone.
 */
export function flattenStyles(styles = {}, breakpointId = 'desktop', withHover = false) {
  let out = { ...(styles.base || {}) }
  if (breakpointId === 'tablet' || breakpointId === 'mobile') out = { ...out, ...(styles.tablet || {}) }
  if (breakpointId === 'mobile') out = { ...out, ...(styles.mobile || {}) }
  if (withHover) out = { ...out, ...(styles.hover || {}) }
  return out
}

/** Placed by hand -- taken out of the normal flow and positioned by left/top. */
export const isFree = (style = {}) => style.position === 'absolute' || style.position === 'fixed'

/** A tidy reset so exported pages look the same everywhere. */
export const RESET = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }
img, svg, video, iframe { max-width: 100%; }
button, input, textarea, select { font: inherit; color: inherit; }
button { cursor: pointer; }
a { color: inherit; }`

/**
 * Build the whole stylesheet for a page.
 * @param {object} opts.breakpoint  flatten to this breakpoint (canvas mode)
 * @param {boolean} opts.reset      include the reset block
 * @param {boolean} opts.theme      include :root tokens
 * @param {string} opts.scope       prefix every selector (canvas isolation)
 */
export function buildCss(root, theme, opts = {}) {
  const { breakpoint = null, reset = true, includeTheme = true, scope = '' } = opts
  const nodes = flatten(root)
  const parts = []

  // Tokens live on :root normally, but on the canvas they belong to the frame.
  if (includeTheme) parts.push(scope ? rule(scope, themeVars(theme)) : themeCss(theme))
  if (reset) parts.push(scope ? scopeCss(RESET, scope) : RESET)

  const sel = (node, suffix = '') => `${scope ? scope + ' ' : ''}.${classFor(node)}${suffix}`

  if (breakpoint) {
    // Canvas mode: one flattened rule per node, no media queries.
    for (const node of nodes) {
      const style = flattenStyles(node.styles, breakpoint)
      const r = rule(sel(node), style)
      if (r) parts.push(r)
      const hover = rule(sel(node, ':hover'), node.styles?.hover)
      if (hover) parts.push(hover)
    }
    return parts.filter(Boolean).join('\n\n') + '\n'
  }

  // Export mode: base rules, hover rules, then each breakpoint in a media query.
  for (const node of nodes) {
    const r = rule(sel(node), node.styles?.base)
    if (r) parts.push(r)
  }
  const hovers = nodes.map((n) => rule(sel(n, ':hover'), n.styles?.hover)).filter(Boolean)
  if (hovers.length) parts.push('/* Hover styles */\n' + hovers.join('\n\n'))

  for (const b of BREAKPOINTS) {
    if (!b.media) continue
    const inner = nodes.map((n) => rule(sel(n), n.styles?.[b.styleKey], '  ')).filter(Boolean)
    if (!inner.length) continue
    parts.push(`/* ${b.label} and below */\n@media ${b.media} {\n${inner.join('\n\n')}\n}`)
  }

  return parts.filter(Boolean).join('\n\n') + '\n'
}

/** Prefix top-level selectors so canvas styles cannot leak into the builder UI. */
export function scopeCss(css, scope) {
  return css.replace(/(^|\})\s*([^{}@]+)\{/g, (match, brace, selectors) => {
    const scoped = selectors
      .split(',')
      .map((sl) => {
        const t = sl.trim()
        if (!t) return t
        if (t === 'body' || t === 'html') return scope
        return `${scope} ${t}`
      })
      .join(', ')
    return `${brace}\n${scoped} {`
  })
}

/* ------------------------------------------------------- value utilities */

/** Split "24px" into { number: 24, unit: 'px' }. */
export function parseValue(value, fallbackUnit = 'px') {
  if (value === undefined || value === null || value === '') return { number: '', unit: fallbackUnit }
  const m = /^(-?[\d.]+)\s*(px|%|rem|em|vh|vw|fr|s|ms|deg)?$/.exec(String(value).trim())
  if (!m) return { number: '', unit: fallbackUnit, raw: String(value) }
  return { number: parseFloat(m[1]), unit: m[2] || '' }
}

export function withUnit(number, unit, prop) {
  if (number === '' || number === null || number === undefined || Number.isNaN(number)) return ''
  if (UNITLESS.has(prop)) return String(number)
  return `${number}${unit || 'px'}`
}

/** The four sides of a box property, e.g. padding -> paddingTop... */
export const SIDES = ['Top', 'Right', 'Bottom', 'Left']

export const sideKey = (base, side) => `${base}${side}`

/**
 * Read a box value, understanding both the shorthand ("padding: 10px 20px")
 * and the long form the inspector writes.
 */
export function readBox(style = {}, base = 'padding') {
  const out = {}
  const short = style[base]
  let parts = []
  if (typeof short === 'string' && short.trim()) parts = short.trim().split(/\s+/)
  const fromShort = (i) => {
    if (!parts.length) return undefined
    if (parts.length === 1) return parts[0]
    if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]][i]
    if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]][i]
    return parts[i]
  }
  SIDES.forEach((side, i) => {
    out[side.toLowerCase()] = style[sideKey(base, side)] ?? fromShort(i) ?? ''
  })
  return out
}
