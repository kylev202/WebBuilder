/**
 * Round-trip check: canvas -> code -> canvas must preserve the document.
 * Run with `node scripts/check-roundtrip.mjs`.
 */
import { createNode, findNode } from '../src/core/doc.js'
import { generateJsx, generateCss } from '../src/core/codegen.js'
import { parseCode } from '../src/core/codeparse.js'
import { defaultTheme } from '../src/core/theme.js'

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures++
    console.log(`  FAIL ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`)
  } else {
    console.log(`  ok   ${label}`)
  }
}

const theme = defaultTheme()

const page = {
  id: 'p1',
  name: 'Home',
  root: createNode('page', {
    children: [
      {
        type: 'section',
        props: { htmlId: 'hero' },
        children: [
          { type: 'badge', props: { text: 'New' } },
          { type: 'heading', props: { text: 'Build it without code', level: 'h1' } },
          { type: 'text', props: { text: 'Line one.\nLine two with <angle> and {braces}.' } },
          { type: 'button', props: { text: 'Start free', action: 'link', href: '/signup', newTab: true } },
          { type: 'image', props: { src: 'https://example.com/a.png', alt: 'A photo' } },
          { type: 'icon', props: { icon: 'rocket' } },
        ],
      },
      {
        type: 'section',
        children: [
          { type: 'grid', children: [{ type: 'card', children: [{ type: 'heading', props: { text: 'Fast', level: 'h3' } }] }] },
          { type: 'form', props: { action: 'https://formspree.io/f/abc' } },
          { type: 'list' },
          { type: 'select' },
        ],
      },
    ],
  }),
}

const jsx = generateJsx(page)
const css = generateCss(page, theme)

console.log('\n1. Generated code parses back cleanly')
const result = parseCode({ jsx, css, currentRoot: page.root, theme })
const back = result.root

const ids = (root) => {
  const out = []
  const walk = (n) => {
    out.push(`${n.type}:${n.id}`)
    n.children?.forEach(walk)
  }
  walk(root)
  return out
}

check('tree shape and ids survive', ids(back), ids(page.root))

const orig = (id) => findNode(page.root, id).node
const next = (id) => findNode(back, id).node

const headingId = page.root.children[0].children[1].id
check('heading text', next(headingId).props.text, 'Build it without code')
check('heading level', next(headingId).props.level, 'h1')
check('heading styles', next(headingId).styles, orig(headingId).styles)

const textId = page.root.children[0].children[2].id
check('multiline text with special chars', next(textId).props.text, orig(textId).props.text)

const btnId = page.root.children[0].children[3].id
check('button href', next(btnId).props.href, '/signup')
check('button new tab', next(btnId).props.newTab, true)

const imgId = page.root.children[0].children[4].id
check('image src', next(imgId).props.src, 'https://example.com/a.png')
check('image alt', next(imgId).props.alt, 'A photo')

const iconId = page.root.children[0].children[5].id
check('icon symbol', next(iconId).props.icon, 'rocket')

const sectionId = page.root.children[0].id
check('section html id', next(sectionId).props.htmlId, 'hero')
check('responsive styles (mobile padding)', next(sectionId).styles.mobile, orig(sectionId).styles.mobile)

const gridId = page.root.children[1].children[0].id
check('grid tablet columns', next(gridId).styles.tablet, orig(gridId).styles.tablet)
check('button hover styles', next(btnId).styles.hover, orig(btnId).styles.hover)

const formId = page.root.children[1].children[1].id
check('form action', next(formId).props.action, 'https://formspree.io/f/abc')

const selectId = page.root.children[1].children[3].id
check('dropdown keeps its choices', next(selectId).children.map((c) => c.props.text), orig(selectId).children.map((c) => c.props.text))

check('theme tokens survive', result.theme.colors, theme.colors)

console.log('\n2. Hand-edited code is applied')
const edited = jsx
  .replace('Build it without code', 'Edited in the code panel')
  .replace('<section className="section-', '<section data-x="1" className="section-')
const editedCss = css.replace('font-size: 40px;', 'font-size: 52px;')
const r2 = parseCode({ jsx: edited, css: editedCss, currentRoot: page.root, theme })
check('text edit lands on the node', findNode(r2.root, headingId).node.props.text, 'Edited in the code panel')
check('css edit lands on the node', findNode(r2.root, headingId).node.styles.base.fontSize, '52px')
check('unknown attributes are ignored safely', findNode(r2.root, sectionId).node.type, 'section')

console.log('\n3. New elements typed in code are adopted')
const withNew = jsx.replace('</section>', '  <p className="note">Typed by hand</p>\n    </section>')
const r3 = parseCode({ jsx: withNew, css, currentRoot: page.root, theme })
const added = findNode(r3.root, page.root.children[0].id).node.children.at(-1)
check('new node type', added.type, 'text')
check('new node text', added.props.text, 'Typed by hand')

console.log('\n4. Broken code fails loudly instead of wiping the canvas')
try {
  parseCode({ jsx: 'export default function X() { return ( <div ) }', css, currentRoot: page.root, theme })
  failures++
  console.log('  FAIL broken jsx should throw')
} catch (err) {
  console.log(`  ok   throws with a message: "${err.message.slice(0, 60)}..." (line ${err.line})`)
}

console.log('\n5. Unknown CSS is preserved rather than dropped')
const r5 = parseCode({ jsx, css: css + '\n.my-own-class .child { color: red; }\n', currentRoot: page.root, theme })
check('custom css kept', r5.customCss.includes('.my-own-class .child'), true)
// The reset is generated, so it must not come back as "your own CSS" -- it
// would be stapled onto the stylesheet again on every trip through the panel.
check('the generated reset is not mistaken for your own css', /box-sizing/.test(r5.customCss), false)

console.log('\n6. Exported files stand on their own')
const { buildSiteFiles, buildReactFiles } = await import('../src/core/export.js')
const { newProject } = await import('../src/core/templates.js')
const project = newProject('agency')

const site = buildSiteFiles(project)
check('a page per site page, plus styles', Object.keys(site).sort(), ['about.html', 'contact.html', 'index.html', 'styles.css'])
check('home page is real html', site['index.html'].startsWith('<!doctype html>'), true)
check('stylesheet is linked, not inlined', site['index.html'].includes('<link rel="stylesheet" href="styles.css" />'), true)
check('internal links point at exported files', site['index.html'].includes('href="about.html"'), true)
check('theme tokens are in the stylesheet', site['styles.css'].includes('--color-primary:'), true)
check('responsive rules survive', site['styles.css'].includes('@media (max-width: 640px)'), true)
check('no builder traces in the output', /webbuilder|data-node-id|wb-canvas/i.test(site['index.html']), false)

const react = buildReactFiles(project)
const expectedFiles = ['index.html', 'package.json', 'src/App.jsx', 'src/main.jsx', 'src/pages/AboutPage.jsx', 'src/pages/ContactPage.jsx', 'src/pages/HomePage.jsx', 'src/styles.css', 'vite.config.js']
check('react project is complete', Object.keys(react).sort(), expectedFiles)
check('router lists every page', project.pages.every((p) => react['src/App.jsx'].includes(`path: '${p.path}'`)), true)
check('pages export a component', react['src/pages/HomePage.jsx'].includes('export default function HomePage()'), true)
check('react app has no extra dependencies', Object.keys(JSON.parse(react['package.json']).dependencies).sort(), ['react', 'react-dom'])

console.log('\n7. The maths behind dragging on the canvas')
const geom = await import('../src/core/geom.js')

// Dragging the right edge 20px right widens the box and keeps the left edge put.
const box = { cx: 100, cy: 100, w: 100, h: 60, angle: 0 }
const wider = geom.resizeFrame(box, 'e', 20, 0)
check('dragging an edge resizes', [wider.w, wider.h], [120, 60])
check('the far edge stays where it was', wider.cx - wider.w / 2, box.cx - box.w / 2)

const corner = geom.resizeFrame(box, 'se', 50, 0, { aspect: true })
check('holding shift keeps the proportions', Math.round(corner.h * 100) / 100, 90)

const centred = geom.resizeFrame(box, 'e', 20, 0, { fromCentre: true })
check('holding alt grows both ways at once', [centred.w, centred.cx], [140, 100])

// A turned box resizes along its own axes, not the screen's.
const turned = geom.resizeFrame({ ...box, angle: 90 }, 'e', 0, 30)
check('a turned box resizes along its own edge', Math.round(turned.w), 130)

check('a box never resizes below the minimum', geom.resizeFrame(box, 'e', -500, 0, { min: 4 }).w, 4)

// Snapping: a box 3px from a neighbour's left edge should click onto it.
const targets = geom.snapTargets([{ left: 200, right: 300, top: 0, bottom: 50 }])
const snapped = geom.snapMove({ left: 197, right: 297, top: 0, bottom: 40 }, targets, 6)
check('a near miss snaps to the edge', snapped.dx, 3)
check('and a guide is drawn for it', snapped.guides.length > 0, true)
check('a far miss is left alone', geom.snapMove({ left: 150, right: 250, top: 0, bottom: 40 }, targets, 6).dx, 0)
check('with no neighbour near, the grid catches it', geom.snapMove({ left: 103, right: 200, top: 0, bottom: 40 }, { x: [], y: [] }, 6, 8).dx, 1)

// Rotation is measured from straight up, clockwise.
check('rotation is measured from the top', Math.round(geom.angleTo(0, 0, 10, 0)), 90)
check('bounds of a turned box grow to fit it', Math.round(geom.frameBounds({ cx: 0, cy: 0, w: 100, h: 100, angle: 45 }).right), 71)

console.log('\n8. Lining things up')
const { alignEntries, distributeEntries } = await import('../src/components/canvas/arrange.js')
const placed = (id, left, width) => ({
  id, free: true, bounds: { left, right: left + width, top: 0, bottom: 20 },
  off: { left, top: 0 }, margin: { left: 0, top: 0 },
})
const group = { left: 0, right: 300, top: 0, bottom: 20 }
const lefts = alignEntries([placed('a', 40, 20), placed('b', 100, 20)], 'left', group, 1)
check('everything lines up on the left', lefts.map((e) => e.patch.left), ['0px', '0px'])
const middles = alignEntries([placed('a', 40, 20)], 'centreX', group, 1)
check('or down the middle', middles[0].patch.left, '140px')

const spread = distributeEntries([placed('a', 0, 20), placed('b', 30, 20), placed('c', 100, 20)], 'x', 1)
check('the middle one moves to an even gap', spread.map((e) => e.patch.left), ['50px'])
check('two things cannot be spread out', distributeEntries([placed('a', 0, 20), placed('b', 30, 20)], 'x', 1).length, 0)

// The canvas is scaled; the document is not.
const zoomed = alignEntries([placed('a', 80, 20)], 'left', { left: 0, right: 600, top: 0, bottom: 40 }, 2)
check('a shift at 200% zoom is halved for the document', zoomed[0].patch.left, '40px')

console.log('\n9. Sizing: exact, fill and hug')
const sizing = await import('../src/core/sizing.js')

const inRow = { parentIsFlex: true, parentRow: true }
const inColumn = { parentIsFlex: true, parentRow: false }
const inBlock = { parentIsFlex: false, parentRow: false }

// "Fill" has to mean different CSS depending on the box it sits in.
check('fill along a row is a flex share', sizing.writeSizeMode('fill', 'x', inRow, 100).flex, '1 1 0%')
check('fill across a column is full width', sizing.writeSizeMode('fill', 'x', inColumn, 100).width, '100%')
check('hug is auto', sizing.writeSizeMode('fit', 'x', inBlock, 100).width, 'auto')
check('an exact size keeps the size it already had', sizing.writeSizeMode('fixed', 'x', inBlock, 237.4).width, '237px')
check('screen sizing uses vh down the page', sizing.writeSizeMode('viewport', 'y', inBlock, 0).height, '100vh')

// Reading has to survive whatever the CSS actually says.
check('a flex share reads back as fill', sizing.readSizeMode({ flex: '1 1 0%' }, 'x', inRow), 'fill')
check('full width in a column reads as fill', sizing.readSizeMode({ width: '100%' }, 'x', inColumn), 'fill')
check('no width at all is hug', sizing.readSizeMode({}, 'x', inBlock), 'fit')
check('a percentage is a share', sizing.readSizeMode({ width: '40%' }, 'x', inBlock), 'relative')
check('pixels are exact', sizing.readSizeMode({ width: '240px' }, 'x', inBlock), 'fixed')
check('switching modes clears the old property', sizing.writeSizeMode('fill', 'x', inRow, 100).width, '')

console.log('\n10. Pinning things down')
// Moving a pin must not move the element.
const inside = { left: 100, top: 20, width: 200, height: 50 }
const around = { width: 500, height: 300 }
const toRight = sizing.pinPatch({ x: 'far', y: 'near' }, inside, around)
check('pinning right measures from the right edge', toRight.right, '200px')
check('and stops measuring from the left', toRight.left, '')
const toBoth = sizing.pinPatch({ x: 'both', y: 'near' }, inside, around)
check('holding both sides keeps both offsets', [toBoth.left, toBoth.right], ['100px', '200px'])
check('and lets the width follow the box', toBoth.width, 'auto')
const middled = sizing.pinPatch({ x: 'centre', y: 'near' }, inside, around)
check('centring measures from the middle', middled.left, '50%')
check('and shifts back by half its own width', middled.translate, '-50% 0')
check('a pin that is not centred needs no shift', toRight.translate, '')

check('a right offset reads back as a right pin', sizing.readPin({ right: '20px' }, 'x'), 'far')
check('both offsets read as held on both sides', sizing.readPin({ left: '0px', right: '0px' }, 'x'), 'both')
check('a nudged centre still reads as centred', sizing.readPin({ left: 'calc(50% + 8px)' }, 'x'), 'centre')
check('a drag writes to whichever edge is pinned', sizing.pinnedEdge({ right: '20px' }, 'x'), 'right')
check('and to the left when nothing says otherwise', sizing.pinnedEdge({}, 'x'), 'left')

console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll round-trip checks passed\n')
process.exit(failures ? 1 : 0)
