/**
 * Canvas -> code.
 *
 * Produces React (JSX) or plain HTML from the same walk, so the two exports can
 * never drift apart. The generated markup is deliberately plain: real tags,
 * one class per element, no framework magic -- which is also what makes it
 * possible to parse the code back into the canvas (see codeparse.js).
 */
import { def, tagFor } from './elements.js'
import { classFor } from './doc.js'
import { buildCss } from './css.js'
import { ICON_PATHS } from './icons.js'
import { titleCase } from './util.js'

const VOID_HTML = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source'])

const escapeHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const jsString = (s = '') => JSON.stringify(String(s))

/** Attribute names differ slightly between JSX and HTML. */
const ATTR_HTML = {
  className: 'class', htmlFor: 'for', defaultChecked: 'checked', defaultValue: 'value',
  strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin',
  viewBox: 'viewBox', allowFullScreen: 'allowfullscreen', frameBorder: 'frameborder',
  autoComplete: 'autocomplete', tabIndex: 'tabindex', ariaLabel: 'aria-label',
}

/** Everything the node needs on the tag, before mode-specific renaming. */
function attributesFor(node, mode) {
  const p = node.props || {}
  const attrs = { className: classFor(node) }
  if (p.htmlId) attrs.id = p.htmlId

  switch (node.type) {
    case 'button': {
      if (p.action === 'link') {
        attrs.href = p.href || '#'
        if (p.newTab) {
          attrs.target = '_blank'
          attrs.rel = 'noreferrer'
        }
      } else {
        attrs.type = p.action === 'submit' ? 'submit' : 'button'
        if (p.action === 'scroll' && p.target) {
          attrs.onClick = mode === 'jsx'
            ? `{() => document.getElementById(${jsString(p.target)})?.scrollIntoView({ behavior: 'smooth' })}`
            : null
          if (mode === 'html') {
            attrs.onclick = `document.getElementById('${p.target}').scrollIntoView({behavior:'smooth'})`
            delete attrs.onClick
          }
        }
      }
      break
    }
    case 'link':
      attrs.href = p.href || '#'
      if (p.newTab) {
        attrs.target = '_blank'
        attrs.rel = 'noreferrer'
      }
      break
    case 'image':
      attrs.src = p.src || ''
      attrs.alt = p.alt || ''
      attrs.loading = 'lazy'
      break
    case 'video':
      attrs.src = toEmbedUrl(p.src)
      attrs.title = node.name || 'Video'
      attrs.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture'
      attrs.allowFullScreen = true
      break
    case 'icon':
      attrs.viewBox = '0 0 24 24'
      attrs.fill = 'none'
      attrs.stroke = 'currentColor'
      attrs.strokeWidth = '2'
      attrs.strokeLinecap = 'round'
      attrs.strokeLinejoin = 'round'
      attrs.ariaHidden = mode === 'jsx' ? undefined : undefined
      break
    case 'input':
      attrs.type = p.inputType || 'text'
      if (p.name) attrs.name = p.name
      if (p.placeholder) attrs.placeholder = p.placeholder
      if (p.required) attrs.required = true
      break
    case 'checkbox':
      attrs.type = 'checkbox'
      if (p.name) attrs.name = p.name
      if (p.checked) attrs[mode === 'jsx' ? 'defaultChecked' : 'checked'] = true
      break
    case 'textarea':
      if (p.name) attrs.name = p.name
      if (p.placeholder) attrs.placeholder = p.placeholder
      if (p.rows) attrs.rows = String(p.rows)
      break
    case 'select':
      if (p.name) attrs.name = p.name
      break
    case 'form':
      if (p.action) {
        attrs.action = p.action
        attrs.method = 'post'
      }
      break
    default:
      break
  }
  return attrs
}

/** Turn a normal YouTube/Vimeo link into its embeddable form. */
export function toEmbedUrl(url = '') {
  const s = String(url).trim()
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(s)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(s)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return s
}

function renderAttrs(attrs, mode) {
  const out = []
  for (const [rawKey, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    const key = mode === 'html' ? ATTR_HTML[rawKey] || rawKey.toLowerCase() : rawKey
    if (mode === 'jsx') {
      if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        out.push(`${key}=${value}`) // already an expression
      } else if (value === true) {
        out.push(key)
      } else {
        out.push(`${key}=${jsString(value)}`)
      }
    } else {
      if (value === true) out.push(key)
      else out.push(`${key}="${escapeHtml(value).replace(/"/g, '&quot;')}"`)
    }
  }
  return out
}

function renderText(text, mode, indent) {
  const value = String(text ?? '')
  if (mode === 'html') return indent + escapeHtml(value).replace(/\n/g, '\n' + indent)
  const needsExpression = /[{}<>]|\n/.test(value)
  return indent + (needsExpression ? `{${jsString(value)}}` : escapeJsxText(value))
}

const escapeJsxText = (s) => s.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`)

/** Recursively render one node. */
function renderNode(node, mode, depth) {
  if (node.hidden) return ''
  const indent = '  '.repeat(depth)
  const d = def(node.type)
  const tag = tagFor(node)
  const attrs = renderAttrs(attributesFor(node, mode), mode)
  const attrString = attrs.length ? ' ' + attrs.join(' ') : ''
  const selfClosing = mode === 'jsx' ? d.void && node.type !== 'icon' : VOID_HTML.has(tag)

  // Icons carry their path data inline so exports need no icon library.
  if (node.type === 'icon') {
    const path = ICON_PATHS[node.props?.icon] || ICON_PATHS.star
    return `${indent}<${tag}${attrString}>\n${indent}  <path d="${path}" />\n${indent}</${tag}>`
  }
  if (node.type === 'video' || (mode === 'html' && tag === 'iframe')) {
    return `${indent}<${tag}${attrString}></${tag}>`
  }
  if (selfClosing || (mode === 'jsx' && d.void)) {
    return `${indent}<${tag}${attrString} />`
  }
  if (mode === 'html' && VOID_HTML.has(tag)) {
    return `${indent}<${tag}${attrString}>`
  }

  if (d.textual) {
    const text = node.props?.text ?? ''
    const inline = !/[\n]/.test(String(text)) && String(text).length < 60
    if (inline) {
      const body = mode === 'html' ? escapeHtml(text) : escapeJsxText(String(text))
      return `${indent}<${tag}${attrString}>${body}</${tag}>`
    }
    return `${indent}<${tag}${attrString}>\n${renderText(text, mode, indent + '  ')}\n${indent}</${tag}>`
  }

  const kids = (node.children || []).map((c) => renderNode(c, mode, depth + 1)).filter(Boolean)
  if (!kids.length) return `${indent}<${tag}${attrString}></${tag}>`
  return `${indent}<${tag}${attrString}>\n${kids.join('\n')}\n${indent}</${tag}>`
}

export function componentName(page) {
  const base = titleCase(page.name || 'Page').replace(/[^A-Za-z0-9]/g, '')
  const named = /^[A-Za-z]/.test(base) ? base : `Page${base}`
  return named.endsWith('Page') ? named : `${named}Page`
}

/* --------------------------------------------------------------- outputs */

export function generateJsx(page, { withImport = true } = {}) {
  const body = renderNode(page.root, 'jsx', 2)
  const name = componentName(page)
  const header = withImport ? "import './styles.css'\n\n" : ''
  return `${header}export default function ${name}() {
  return (
${body}
  )
}
`
}

export function generateCss(page, theme) {
  return `/* Styles for ${page.name}. Generated from your canvas -- edit freely. */\n\n${buildCss(page.root, theme, { breakpoint: null })}`
}

export function generateHtml(page, theme, { inlineCss = true, title } = {}) {
  const body = renderNode(page.root, 'html', 2)
  const css = buildCss(page.root, theme, { breakpoint: null })
  const head = inlineCss
    ? `    <style>\n${css.split('\n').map((l) => (l ? '      ' + l : l)).join('\n')}\n    </style>`
    : '    <link rel="stylesheet" href="styles.css" />'
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title || page.name || 'My page')}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
${head}
  </head>
  <body>
${body}
  </body>
</html>
`
}

/** Everything the code panel shows for the active page. */
export function generateFiles(page, theme) {
  return {
    'App.jsx': generateJsx(page),
    'styles.css': generateCss(page, theme),
    'index.html': generateHtml(page, theme, { inlineCss: false }),
  }
}
