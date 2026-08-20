/**
 * Generates the WebBuilder favicon set from a single geometry definition, so the
 * vector and raster versions can never drift apart.
 *
 *   npm run icons
 *
 * The mark is the editor's brand tile — the same indigo/violet gradient used by
 * `.wb-brand-mark` — carrying a white wireframe glyph: a header bar above a
 * sidebar and a canvas. It stays legible down to 16px because every shape is
 * filled, not stroked.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/* ------------------------------------------------------------------ design */

const S = 64            // design-space size; every number below is in these units
const TILE_R = 14       // squircle-ish corner on the app tile
const GRAD = ['#4f46e5', '#7c3aed']

const GLYPH = [
  { x: 11, y: 11, w: 42, h: 10, r: 4 },   // header bar
  { x: 11, y: 27, w: 14, h: 26, r: 4 },   // sidebar
  { x: 31, y: 27, w: 22, h: 26, r: 4 },   // canvas
]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="WebBuilder">
  <defs>
    <linearGradient id="wb" x1="0" y1="0" x2="${S}" y2="${S}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${GRAD[0]}"/>
      <stop offset="1" stop-color="${GRAD[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="${TILE_R}" fill="url(#wb)"/>
  <g fill="#fff">
${GLYPH.map((s) => `    <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}"/>`).join('\n')}
  </g>
</svg>
`

/* -------------------------------------------------------------- rasterizer */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const [C0, C1] = GRAD.map(hex)

/** Signed distance to a rounded rect; <= 0 is inside. */
function sdRoundRect(px, py, { x, y, w, h, r }) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r)
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r)
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

const TILE = { x: 0, y: 0, w: S, h: S, r: TILE_R }

/**
 * Renders the mark to straight-alpha RGBA. `rounded: false` fills the whole
 * square edge to edge — what Apple wants, since iOS applies its own mask.
 */
function render(size, { rounded = true } = {}) {
  const ss = size <= 64 ? 8 : 4          // supersampling; small icons need more
  const n = ss * ss
  const px = Buffer.alloc(size * size * 4)

  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      let r = 0, g = 0, b = 0, hits = 0

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const dx = ((ix + (sx + 0.5) / ss) / size) * S
          const dy = ((iy + (sy + 0.5) / ss) / size) * S
          if (rounded && sdRoundRect(dx, dy, TILE) > 0) continue

          if (GLYPH.some((s) => sdRoundRect(dx, dy, s) <= 0)) {
            r += 255; g += 255; b += 255
          } else {
            const t = (dx + dy) / (2 * S)
            r += C0[0] + (C1[0] - C0[0]) * t
            g += C0[1] + (C1[1] - C0[1]) * t
            b += C0[2] + (C1[2] - C0[2]) * t
          }
          hits++
        }
      }

      const o = (iy * size + ix) * 4
      if (hits) {
        px[o] = Math.round(r / hits)
        px[o + 1] = Math.round(g / hits)
        px[o + 2] = Math.round(b / hits)
        px[o + 3] = Math.round((hits / n) * 255)
      }
    }
  }
  return px
}

/* ------------------------------------------------------------ PNG encoding */

const CRC = (() => {
  const t = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8        // bit depth
  ihdr[9] = 6        // truecolour with alpha
  // 10..12 stay 0: deflate, adaptive filtering, no interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0        // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO container holding PNG-compressed entries (universally supported today). */
function ico(entries) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const dir = []
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4)          // colour planes
    e.writeUInt16LE(32, 6)         // bits per pixel
    e.writeUInt32LE(data.length, 8)  // bytes in resource
    e.writeUInt32LE(offset, 12)
    dir.push(e)
    offset += data.length
  }
  return Buffer.concat([head, ...dir, ...entries.map((e) => e.data)])
}

/* ---------------------------------------------------------------- emission */

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'favicon.svg'), svg)

const icoSizes = [16, 32, 48]
writeFileSync(
  join(OUT, 'favicon.ico'),
  ico(icoSizes.map((size) => ({ size, data: png(size, render(size)) })))
)

writeFileSync(join(OUT, 'apple-touch-icon.png'), png(180, render(180, { rounded: false })))
writeFileSync(join(OUT, 'icon-512.png'), png(512, render(512)))

console.log('icons written to public/:', ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-512.png'].join(', '))
