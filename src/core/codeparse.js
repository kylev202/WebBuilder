/**
 * Code -> canvas.
 *
 * The other half of the round trip. Because every generated element carries a
 * class name ending in its node id, edited code can be matched back to the
 * exact elements on the canvas -- so hand-written tweaks land as real changes
 * instead of rebuilding (and renumbering) the whole document.
 *
 * Anything the parser cannot express as an element is kept verbatim in
 * `customCss`, so nobody loses work they typed.
 */
import { parse as babelParse } from '@babel/parser'
import { createNode, idFromClass } from './doc.js'
import { RESET } from './css.js'
import { TAG_TO_TYPE, def } from './elements.js'
import { camel, titleCase, uid } from './util.js'
import { ICON_PATHS } from './icons.js'

/* ----------------------------------------------------------------- CSS */

/** Read a `{ ... }` block starting at `open`, honouring nesting. */
function readBlock(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return { body: text.slice(open + 1, i), end: i + 1 }
    }
  }
  return { body: text.slice(open + 1), end: text.length }
}

function parseDeclarations(body) {
  const out = {}
  let buf = ''
  let depth = 0
  const flush = () => {
    const decl = buf.trim()
    buf = ''
    if (!decl) return
    const colon = decl.indexOf(':')
    if (colon < 0) return
    const prop = decl.slice(0, colon).trim()
    const value = decl.slice(colon + 1).trim()
    if (!prop || !value) return
    out[prop.startsWith('--') ? prop : camel(prop)] = value
  }
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ';' && depth === 0) flush()
    else buf += ch
  }
  flush()
  return out
}

const mediaKey = (selector) => {
  const m = /max-width:\s*(\d+)/.exec(selector)
  if (!m) return null
  return Number(m[1]) <= 700 ? 'mobile' : 'tablet'
}

/**
 * @returns {{ classes: Object, rootVars: Object, custom: string[] }}
 *   classes: { [className]: { base, hover, tablet, mobile } }
 */
/**
 * The reset is generated, not written by anyone, so it must not come back as
 * "your own CSS" -- otherwise every trip through the code panel would staple
 * another copy of it onto the stylesheet. Matched on the whole rule, so a
 * hand-written `body { margin: 40px }` is still kept.
 */
const ruleSignature = (selector, decls) =>
  `${selector.replace(/\s+/g, ' ').trim()}|${Object.entries(decls).map(([k, v]) => `${k}:${String(v).trim()}`).sort().join(';')}`

let resetRules = null
function isGeneratedReset(selector, decls) {
  if (!resetRules) {
    resetRules = new Set()
    let i = 0
    while (i < RESET.length) {
      const open = RESET.indexOf('{', i)
      if (open < 0) break
      const sel = RESET.slice(i, open).trim()
      const { body, end } = readBlock(RESET, open)
      resetRules.add(ruleSignature(sel, parseDeclarations(body)))
      i = end
    }
  }
  return resetRules.has(ruleSignature(selector, decls))
}

export function parseCss(text = '') {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const classes = {}
  const rootVars = {}
  const custom = []

  const bucket = (cls) => (classes[cls] ||= { base: {}, hover: {}, tablet: {}, mobile: {} })

  const handleRule = (selector, body, breakpoint) => {
    const decls = parseDeclarations(body)
    if (!Object.keys(decls).length) return
    let recognised = false
    for (const raw of selector.split(',')) {
      const sel = raw.trim()
      if (!sel) continue
      if (sel === ':root' || sel === 'html' || sel === ':root, html') {
        Object.assign(rootVars, decls)
        recognised = true
        continue
      }
      const m = /^\.([A-Za-z0-9_-]+)(:hover)?$/.exec(sel)
      if (!m) continue
      const state = m[2] ? 'hover' : breakpoint || 'base'
      Object.assign(bucket(m[1])[state], decls)
      recognised = true
    }
    if (!recognised) {
      if (!breakpoint && isGeneratedReset(selector, decls)) return
      const block = `${selector.trim()} {\n${Object.entries(decls).map(([k, v]) => `  ${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}: ${v};`).join('\n')}\n}`
      custom.push(breakpoint ? `@media ${breakpoint === 'mobile' ? '(max-width: 640px)' : '(max-width: 1024px)'} {\n${block}\n}` : block)
    }
  }

  const scan = (text, breakpoint = null) => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open < 0) break
      const selector = text.slice(i, open).trim()
      const { body, end } = readBlock(text, open)
      if (selector.startsWith('@media')) scan(body, mediaKey(selector) || breakpoint)
      else if (selector.startsWith('@')) custom.push(`${selector} {${body}}`)
      else handleRule(selector, body, breakpoint)
      i = end
    }
  }

  scan(source)
  return { classes, rootVars, custom }
}

const VAR_TO_TOKEN = {
  '--color-primary': 'primary', '--color-primary-soft': 'primarySoft', '--color-accent': 'accent',
  '--color-bg': 'bg', '--color-surface': 'surface', '--color-text': 'text',
  '--color-muted': 'muted', '--color-border': 'border',
}

export function themeFromVars(rootVars = {}, theme) {
  const next = structuredClone(theme)
  for (const [name, value] of Object.entries(rootVars)) {
    const token = VAR_TO_TOKEN[name]
    if (token) next.colors[token] = value
    else if (name === '--font-heading') next.fonts.heading = value
    else if (name === '--font-body') next.fonts.body = value
    else if (name === '--radius') next.radius = value
  }
  return next
}

/* ----------------------------------------------------------------- JSX */

function attrValue(attr) {
  const v = attr.value
  if (v === null) return true
  if (v.type === 'StringLiteral') return v.value
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression
    if (e.type === 'StringLiteral') return e.value
    if (e.type === 'NumericLiteral') return e.value
    if (e.type === 'BooleanLiteral') return e.value
    if (e.type === 'TemplateLiteral' && e.quasis.length === 1) return e.quasis[0].value.cooked
    return { __expression: true }
  }
  return true
}

function readAttrs(el) {
  const out = {}
  for (const attr of el.openingElement.attributes || []) {
    if (attr.type !== 'JSXAttribute') continue
    const name = attr.name.name === 'class' ? 'className' : attr.name.name
    out[typeof name === 'string' ? name : String(name)] = attrValue(attr)
  }
  return out
}

function tagName(el) {
  const n = el.openingElement?.name
  if (!n) return null
  if (n.type === 'JSXIdentifier') return n.name
  return null
}

function textOf(el) {
  const parts = []
  for (const child of el.children || []) {
    if (child.type === 'JSXText') {
      const t = child.value.replace(/\s*\n\s*/g, '\n').trim()
      if (t) parts.push(t)
    } else if (child.type === 'JSXExpressionContainer') {
      const e = child.expression
      if (e.type === 'StringLiteral') parts.push(e.value)
      else if (e.type === 'TemplateLiteral' && e.quasis.length === 1) parts.push(e.quasis[0].value.cooked)
    }
  }
  return parts.join('')
}

const elementChildren = (el) => (el.children || []).filter((c) => c.type === 'JSXElement')

function typeForElement(tag, attrs, existingType) {
  if (tag === 'input') return attrs.type === 'checkbox' ? 'checkbox' : 'input'
  if (tag === 'svg') return 'icon'
  if (tag === 'iframe') return 'video'
  // A matched node keeps its identity as long as the tag still fits it.
  if (existingType) {
    const d = def(existingType)
    const expected = typeof d.tag === 'function' ? null : d.tag
    if (!expected || expected === tag || (existingType === 'heading' && /^h[1-6]$/.test(tag))) return existingType
    if (existingType === 'button' && (tag === 'a' || tag === 'button')) return existingType
  }
  return TAG_TO_TYPE[tag] || 'container'
}

const iconFromPath = (d) => Object.keys(ICON_PATHS).find((k) => ICON_PATHS[k] === d) || 'star'

/** Rebuild props from the attributes and children present in the code. */
function propsFromCode(type, tag, attrs, el, defaults) {
  const p = { ...defaults }
  if (attrs.id) p.htmlId = attrs.id
  const d = def(type)
  if (d.textual) p.text = textOf(el)

  switch (type) {
    case 'heading':
      if (/^h[1-6]$/.test(tag)) p.level = tag
      break
    case 'button':
      if (tag === 'a') {
        p.action = 'link'
        p.href = typeof attrs.href === 'string' ? attrs.href : '#'
        p.newTab = attrs.target === '_blank'
      } else if (attrs.type === 'submit') p.action = 'submit'
      else if (attrs.onClick && attrs.onClick.__expression) p.action = p.action === 'scroll' ? 'scroll' : p.action
      else if (p.action === 'link') p.action = 'none'
      break
    case 'link':
      if (typeof attrs.href === 'string') p.href = attrs.href
      p.newTab = attrs.target === '_blank'
      break
    case 'image':
      if (typeof attrs.src === 'string') p.src = attrs.src
      if (typeof attrs.alt === 'string') p.alt = attrs.alt
      break
    case 'video':
      if (typeof attrs.src === 'string') p.src = attrs.src
      break
    case 'icon': {
      const path = elementChildren(el).map((c) => readAttrs(c).d).find(Boolean)
      if (typeof path === 'string') p.icon = iconFromPath(path)
      break
    }
    case 'input':
      p.inputType = typeof attrs.type === 'string' ? attrs.type : 'text'
      if (typeof attrs.name === 'string') p.name = attrs.name
      p.placeholder = typeof attrs.placeholder === 'string' ? attrs.placeholder : ''
      p.required = attrs.required === true
      break
    case 'checkbox':
      if (typeof attrs.name === 'string') p.name = attrs.name
      p.checked = attrs.defaultChecked === true || attrs.checked === true
      break
    case 'textarea':
      if (typeof attrs.name === 'string') p.name = attrs.name
      p.placeholder = typeof attrs.placeholder === 'string' ? attrs.placeholder : ''
      if (attrs.rows) p.rows = Number(attrs.rows) || 4
      break
    case 'select':
      if (typeof attrs.name === 'string') p.name = attrs.name
      break
    case 'form':
      p.action = typeof attrs.action === 'string' ? attrs.action : ''
      break
    default:
      break
  }
  return p
}

/** One JSX element -> one document node. */
function nodeFromElement(el, ctx) {
  const tag = tagName(el)
  if (!tag) throw new Error('Only plain HTML tags are supported here (found a custom component).')
  const attrs = readAttrs(el)
  const className = typeof attrs.className === 'string' ? attrs.className : ''
  const primaryClass = className.trim().split(/\s+/)[0] || ''
  const id = idFromClass(primaryClass)
  const existing = id ? ctx.byId.get(id) : null

  const type = typeForElement(tag, attrs, existing?.type)
  const template = createNode(type)
  const node = {
    id: existing?.id || id || uid(),
    type,
    name: existing?.name || titleCase(primaryClass.replace(/-[a-z0-9]{5}$/, '')) || template.name,
    props: propsFromCode(type, tag, attrs, el, existing?.props || template.props),
    styles: ctx.styles(primaryClass, existing),
    children: [],
    hidden: false,
    locked: existing?.locked || false,
  }

  if (!def(type).textual && !def(type).void) {
    node.children = elementChildren(el).map((child) => nodeFromElement(child, ctx))
  } else if (type === 'icon') {
    node.children = []
  }
  return node
}

function indexById(root, map = new Map()) {
  if (!root) return map
  map.set(root.id, root)
  for (const c of root.children || []) indexById(c, map)
  return map
}

/**
 * Parse an edited App.jsx + styles.css back into a page root.
 * Throws an Error with a friendly message (and `.line`) when the code is invalid.
 */
export function parseCode({ jsx, css, currentRoot, theme }) {
  let ast
  try {
    ast = babelParse(jsx, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false })
  } catch (err) {
    const e = new Error(err.message.replace(/\s*\(\d+:\d+\)$/, ''))
    e.line = err.loc?.line
    e.file = 'App.jsx'
    throw e
  }

  const rootEl = findRootJsx(ast)
  if (!rootEl) {
    const e = new Error('Could not find the page markup. Keep the `return ( ... )` block in place.')
    e.file = 'App.jsx'
    throw e
  }

  const parsedCss = parseCss(css || '')
  const byId = indexById(currentRoot)
  const ctx = {
    byId,
    styles: (className, existing) => {
      const found = parsedCss.classes[className]
      if (found) {
        return {
          base: found.base || {},
          hover: found.hover || {},
          tablet: found.tablet || {},
          mobile: found.mobile || {},
        }
      }
      return existing ? structuredClone(existing.styles) : { base: {}, hover: {}, tablet: {}, mobile: {} }
    },
  }

  const root = nodeFromElement(rootEl, ctx)
  root.type = 'page'
  root.id = currentRoot.id
  root.name = currentRoot.name || 'Page'

  return {
    root,
    theme: themeFromVars(parsedCss.rootVars, theme),
    customCss: parsedCss.custom.join('\n\n'),
  }
}

function findRootJsx(ast) {
  let found = null
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return
    if (node.type === 'JSXElement') {
      found = node
      return
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue
      const value = node[key]
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value.type === 'string') visit(value)
    }
  }
  // Prefer the default export's return value; fall back to the first JSX found.
  const def = ast.program.body.find((n) => n.type === 'ExportDefaultDeclaration')
  visit(def || ast.program)
  if (!found) visit(ast.program)
  return found
}
