const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Short, css-class-safe id. */
export function uid(len = 5) {
  let out = ''
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'el'
}

export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** camelCase -> kebab-case (CSS property names). */
export const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
/** kebab-case -> camelCase. */
export const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

export function titleCase(s = '') {
  return String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Remove keys with empty/undefined values. */
export function compact(obj = {}) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function debounce(fn, ms = 250) {
  let t
  const wrapped = (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  wrapped.cancel = () => clearTimeout(t)
  return wrapped
}
