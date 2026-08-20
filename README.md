# WebBuilder

A visual app builder for people who do not write code — with the code always
visible, always editable, and always yours.

You arrange the page by dragging and clicking. WebBuilder writes clean React
and CSS as you go. Open the code panel and type into it, and the canvas updates
to match. It works in both directions, on the same document.

```bash
npm install
npm run dev      # http://localhost:5180
```

The current build of `main` runs at
**<https://kylev202.github.io/WebBuilder/>**.

## What you can do

**Build without knowing anything**
- Drag pieces (headings, buttons, images, forms…) or whole ready-made sections
  (hero, pricing, testimonials, FAQ, footer…) onto the page.
- Double-click any writing to type over it, straight on the canvas.
- Eight starter templates, from a blank page to a multi-page business site.
- Plain-language controls everywhere: "Space inside" instead of `padding`,
  "Across / Down" instead of `justify-content` / `align-items`.

**Move things by hand**
- Drag anything straight on the canvas. What a drag *does* is decided by the
  box it sits in: children of a stack or a grid reorder, children of a plain
  box land exactly where you drop them. Hold Cmd to get the other one.
- Eight resize handles, corner rounding, and a rotate zone just past each
  corner. Shift keeps the shape, Alt grows from the middle.
- Drag the padding edges of a box, or the gap between the things inside it.
- Snapping to the edges and middles of everything nearby, with guides and the
  measurements while you drag. Optional 4–16px grid on top.
- Shift-click or sweep a box over the canvas to grab several things, then move,
  resize, line up or spread them out together.
- Alt-drag to pull off a copy. Arrow keys nudge by a pixel, ten with Shift.
- Space to slide the canvas, Cmd-scroll to zoom, Shift 1 and Shift 2 to fit the
  page or the selection.

**Say how it should behave, not what size it is**
- Every element answers one question per direction: an exact size, fill the
  space left over, hug its contents, a share of its parent, or a share of the
  screen. That becomes whichever CSS actually does it where the element sits.
- Anything placed by hand can be held to any edge, centred, or stretched
  between both — so a hand-placed thing still survives a narrower screen.

**Control everything**
- Full styling: layout, spacing, typography, colours, borders, shadows,
  backgrounds, gradients, position.
- Hover styles, and separate desktop / tablet / phone versions of any setting —
  a warning bar makes it obvious which one you are editing.
- Layers tree, drag-to-reorder, lock, hide, duplicate, wrap in a box.
- Undo and redo for every change, with typing coalesced into single steps.
- Multiple pages, each with its own address.

**Change the look in one place**
- A theme of colour and font tokens. Elements point at tokens, so changing
  "Main colour" restyles every button, link and highlight at once.
- Six ready-made looks, or set every token yourself.

**See and edit the code**
- `App.jsx`, `styles.css` and `index.html` for the current page, live.
- Type in the code panel and the canvas follows, about a second later.
- Broken code is reported with the line number and *not* applied — the canvas
  can never be left in a broken state by a typo.

**Take it with you**
- Export a ready-to-upload website (HTML + CSS), a Vite + React project, a
  single self-contained HTML file, or a project backup you can reopen later.
- Nothing in the export mentions WebBuilder. It is ordinary code.
- Work is saved to the browser continuously as you go.

## How a drag decides what to do

There is one rule, and it is the parent's to make:

- a box that **arranges** its children (a stack, a row, a grid) reorders them
  when you drag one, and shows a line where it will land;
- a box that **does not** lets you put things wherever you drop them, writing
  `position: absolute` with offsets measured from whichever edge the element is
  pinned to.

Holding Cmd swaps the two for one drag, so you can pull something out of a
stack or drop a free element back into the flow without opening a panel.

While the pointer is down nothing is written to the document: the gesture
engine paints the change onto the DOM directly, then commits once on release
as a single undo step. That is why dragging twenty things stays smooth and
undoes in one go.

## How the two-way sync works

Every element carries a class name that ends in its node id
(`hero-title-a3f2x`). That is the whole trick:

- **Canvas → code** (`src/core/codegen.js`) walks the document and emits JSX or
  HTML, plus a stylesheet where each node's styles become one rule, with
  `:hover` rules and `@media` blocks for the smaller breakpoints.
- **Code → canvas** (`src/core/codeparse.js`) parses the JSX with Babel and the
  CSS with a small purpose-built parser, then matches each element back to the
  node whose id is in its class name. Matched nodes keep their identity, so an
  edit is a change rather than a rebuild. Elements you type by hand are adopted
  as new nodes; CSS the parser does not recognise is preserved verbatim.

The canvas and the export share one code path (`src/core/css.js`), so what you
see is what you ship. The only difference: the canvas asks for one breakpoint
flattened, because its frame is only as wide as a phone in pixels and real
media queries would not fire.

## Layout of the project

```
src/
  core/            no UI in here -- this is the engine
    elements.js    the element registry: every building block
    doc.js         the document model and tree operations
    geom.js        the maths behind dragging: frames, resizing, snapping
    sizing.js      fill / hug / exact sizing, and pinning to edges
    css.js         style objects -> CSS (canvas and export)
    codegen.js     canvas -> React / HTML
    codeparse.js   code -> canvas
    theme.js       design tokens
    blocks.js      ready-made sections
    templates.js   starter projects
    store.js       state, history, autosave, code sync
    export.js      zips, single files, project backups
  components/
    canvas/        the rendered page, selection and direct manipulation
      gestures.js  one engine for every pointer gesture
      Overlay.jsx  handles, guides, measurements: never touches the document
      measure.js   reading the live canvas, and the three coordinate spaces
    panels/        add, layers, pages, look, images
    inspector/     the settings panel on the right
    ui/            shared controls
    modals/        templates, export, help
```

## Checks

```bash
npm run check             # both suites
npm run check:roundtrip   # canvas -> code -> canvas keeps the document intact
npm run check:app         # mounts the real app in jsdom and drives it
```

`check:roundtrip` also covers the geometry on its own — resizing from any
handle, snapping, rotation, lining up and spreading out -- and `check:app`
drives real pointer gestures against the mounted app, so a drag that should
reorder still reorders and one that should place freely still writes a
position.

`check:roundtrip` proves the sync: ids, text, styles, breakpoints, hover rules
and theme tokens all survive a trip through generated code, hand edits land on
the right nodes, and invalid code throws instead of destroying anything.
`check:app` mounts the whole app and clicks through it — adding elements,
editing, undo/redo, panels, the code panel, templates and saving.

## Deploying

Every push to `main` builds the app and publishes it to GitHub Pages, via
`.github/workflows/deploy.yml`. The checks above run first, so a failing suite
stops the deploy rather than shipping past it. You can also trigger a run by
hand from the Actions tab.

The site is served from the `gh-pages` branch, which holds build output and
nothing else — each deploy replaces it wholesale, so no history of generated
files piles up in the repository.

Vite's `base` is relative, so the built bundle resolves its own assets wherever
it is served from — the `/WebBuilder/` project-site path, a custom domain, or
`dist/index.html` opened straight off disk.

## The icon

`npm run icons` regenerates the favicon set in `public/` — the SVG, a
multi-resolution `.ico`, the Apple touch icon and a 512px version for link
previews. All of them come from the single geometry definition at the top of
`scripts/make-icons.mjs`, so editing that one block moves every size at once
and the vector can never drift from the raster.

## Notes and limits

- Uploaded images are stored inside the project as data URLs, capped at 900 KB
  each, so a project stays portable. Larger pictures are better linked by URL.
- The code panel understands the elements in the registry. Custom React
  components typed into `App.jsx` are not turned into canvas elements — the
  parser reports it rather than guessing.
- `index.html` in the code panel is generated output and is read-only; edit the
  page or `App.jsx` instead.
