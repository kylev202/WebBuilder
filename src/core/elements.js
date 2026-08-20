/**
 * The element registry: every building block the canvas can hold.
 *
 * A node in the document looks like:
 *   { id, type, name, props, styles: { base, hover, tablet, mobile }, children, hidden, locked }
 *
 * `styles` keys are camelCase CSS properties -- the same shape React accepts
 * inline, and the same shape the code generator turns into real CSS rules.
 */

const T = 'var(--color-text)'
const MUTED = 'var(--color-muted)'
const PRIMARY = 'var(--color-primary)'
const SURFACE = 'var(--color-surface)'
const BORDER = 'var(--color-border)'

const s = (base, extra = {}) => ({ base, hover: {}, tablet: {}, mobile: {}, ...extra })

export const GROUPS = [
  { id: 'layout', label: 'Layout', hint: 'Boxes that hold and arrange other things' },
  { id: 'content', label: 'Content', hint: 'Words, buttons and links' },
  { id: 'media', label: 'Media', hint: 'Pictures, icons and video' },
  { id: 'form', label: 'Forms', hint: 'Collect information from visitors' },
]

export const ELEMENTS = {
  /* ------------------------------------------------------------- layout */
  page: {
    type: 'page', label: 'Page', icon: 'File', group: 'layout', tag: 'div',
    container: true, hiddenInPalette: true, undeletable: true,
    hint: 'The page itself.',
    create: () => ({
      name: 'Page',
      props: {},
      styles: s({
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        minHeight: '100vh', backgroundColor: 'var(--color-bg)', fontFamily: 'var(--font-body)',
      }),
    }),
  },

  section: {
    type: 'section', label: 'Section', icon: 'Rows3', group: 'layout', tag: 'section',
    container: true, keywords: 'band strip area full width',
    hint: 'A full-width band of the page. Stack sections to build a page.',
    create: () => ({
      name: 'Section',
      props: {},
      styles: s({
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
        paddingTop: '80px', paddingBottom: '80px', paddingLeft: '24px', paddingRight: '24px',
        width: '100%',
      }, { mobile: { paddingTop: '48px', paddingBottom: '48px' } }),
    }),
  },

  container: {
    type: 'container', label: 'Container', icon: 'Square', group: 'layout',
    tag: 'div', container: true, keywords: 'wrapper center width limit',
    hint: 'Keeps content centred and stops it stretching too wide.',
    create: () => ({
      name: 'Container',
      props: {},
      styles: s({
        width: '100%', maxWidth: '1120px', marginLeft: 'auto', marginRight: 'auto',
        display: 'flex', flexDirection: 'column', gap: '24px',
      }),
    }),
  },

  stack: {
    type: 'stack', label: 'Stack', icon: 'AlignVerticalJustifyStart', group: 'layout',
    tag: 'div', container: true, keywords: 'column vertical list',
    hint: 'Stacks things one under another.',
    create: () => ({
      name: 'Stack',
      props: {},
      styles: s({ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'stretch', width: '100%' }),
    }),
  },

  row: {
    type: 'row', label: 'Row', icon: 'AlignHorizontalJustifyStart', group: 'layout',
    tag: 'div', container: true, keywords: 'horizontal side by side columns flex',
    hint: 'Places things side by side.',
    create: () => ({
      name: 'Row',
      props: {},
      styles: s(
        { display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', flexWrap: 'wrap' },
        { mobile: { flexDirection: 'column', alignItems: 'stretch' } },
      ),
    }),
  },

  grid: {
    type: 'grid', label: 'Grid', icon: 'LayoutGrid', group: 'layout',
    tag: 'div', container: true, keywords: 'columns cards tiles gallery',
    hint: 'An even grid of equal-sized cells.',
    create: () => ({
      name: 'Grid',
      props: {},
      styles: s(
        { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px', width: '100%' },
        {
          tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          mobile: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
        },
      ),
    }),
  },

  card: {
    type: 'card', label: 'Card', icon: 'CreditCard', group: 'layout',
    tag: 'div', container: true, keywords: 'panel box tile surface',
    hint: 'A raised box with a border -- great for features and pricing.',
    create: () => ({
      name: 'Card',
      props: {},
      styles: s({
        display: 'flex', flexDirection: 'column', gap: '12px', padding: '28px',
        backgroundColor: SURFACE, borderRadius: '16px',
        borderWidth: '1px', borderStyle: 'solid', borderColor: BORDER,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }),
    }),
  },

  spacer: {
    type: 'spacer', label: 'Spacer', icon: 'MoveVertical', group: 'layout',
    tag: 'div', keywords: 'gap empty space breathing room',
    hint: 'Empty breathing room between things.',
    create: () => ({
      name: 'Spacer',
      props: {},
      styles: s({ height: '48px', width: '100%', flexShrink: '0' }),
    }),
  },

  divider: {
    type: 'divider', label: 'Divider', icon: 'Minus', group: 'layout',
    tag: 'div', keywords: 'line rule separator hr',
    hint: 'A thin line that separates content.',
    create: () => ({
      name: 'Divider',
      props: {},
      styles: s({ width: '100%', height: '1px', backgroundColor: BORDER, flexShrink: '0' }),
    }),
  },

  /* ------------------------------------------------------------ content */
  heading: {
    type: 'heading', label: 'Heading', icon: 'Heading1', group: 'content',
    textual: true, keywords: 'title h1 h2 headline',
    tag: (n) => n.props.level || 'h2',
    hint: 'A title. Big text that introduces a section.',
    fields: [
      { key: 'text', label: 'Text', control: 'textarea' },
      {
        key: 'level', label: 'Importance', control: 'select',
        hint: 'H1 is the main page title. Use one per page.',
        options: [
          { value: 'h1', label: 'H1 - page title' },
          { value: 'h2', label: 'H2 - section title' },
          { value: 'h3', label: 'H3 - sub-section' },
          { value: 'h4', label: 'H4 - small title' },
        ],
      },
    ],
    create: () => ({
      name: 'Heading',
      props: { text: 'A headline that sells the idea', level: 'h2' },
      styles: s(
        {
          fontSize: '40px', fontWeight: '700', lineHeight: '1.15', letterSpacing: '-0.02em',
          color: T, margin: '0px', fontFamily: 'var(--font-heading)',
        },
        { mobile: { fontSize: '30px' } },
      ),
    }),
  },

  text: {
    type: 'text', label: 'Text', icon: 'Type', group: 'content',
    textual: true, keywords: 'paragraph body copy words',
    tag: 'p',
    hint: 'A paragraph of writing.',
    fields: [{ key: 'text', label: 'Text', control: 'textarea', rows: 5 }],
    create: () => ({
      name: 'Text',
      props: { text: 'Write something friendly here. Explain what you do in plain language your visitors will understand.' },
      styles: s({ fontSize: '16px', lineHeight: '1.65', color: MUTED, margin: '0px', whiteSpace: 'pre-wrap' }),
    }),
  },

  button: {
    type: 'button', label: 'Button', icon: 'MousePointerClick', group: 'content',
    textual: true, keywords: 'cta action click submit',
    tag: (n) => (n.props.action === 'link' ? 'a' : 'button'),
    hint: 'Something to click. Send people to a page or a link.',
    fields: [
      { key: 'text', label: 'Label', control: 'text' },
      {
        key: 'action', label: 'When clicked', control: 'select',
        options: [
          { value: 'link', label: 'Go to a link or page' },
          { value: 'scroll', label: 'Scroll to a section' },
          { value: 'submit', label: 'Send the form' },
          { value: 'none', label: 'Do nothing (yet)' },
        ],
      },
      { key: 'href', label: 'Destination', control: 'link', showIf: (p) => p.action === 'link' },
      { key: 'newTab', label: 'Open in a new tab', control: 'switch', showIf: (p) => p.action === 'link' },
      { key: 'target', label: 'Section id', control: 'text', placeholder: 'pricing', showIf: (p) => p.action === 'scroll' },
    ],
    create: () => ({
      name: 'Button',
      props: { text: 'Get started', action: 'link', href: '#', newTab: false },
      styles: s(
        {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          paddingTop: '13px', paddingBottom: '13px', paddingLeft: '24px', paddingRight: '24px',
          backgroundColor: PRIMARY, color: '#ffffff', borderRadius: '10px',
          fontSize: '15px', fontWeight: '600', textDecoration: 'none',
          borderWidth: '0px', borderStyle: 'solid', borderColor: 'transparent',
          cursor: 'pointer', width: 'auto', transition: 'all .18s ease',
        },
        { hover: { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } },
      ),
    }),
  },

  link: {
    type: 'link', label: 'Link', icon: 'Link2', group: 'content',
    textual: true, keywords: 'anchor href navigate',
    tag: 'a',
    hint: 'Text that takes people somewhere.',
    fields: [
      { key: 'text', label: 'Text', control: 'text' },
      { key: 'href', label: 'Destination', control: 'link' },
      { key: 'newTab', label: 'Open in a new tab', control: 'switch' },
    ],
    create: () => ({
      name: 'Link',
      props: { text: 'Learn more', href: '#', newTab: false },
      styles: s(
        { color: PRIMARY, textDecoration: 'none', fontWeight: '500', fontSize: '16px' },
        { hover: { textDecoration: 'underline' } },
      ),
    }),
  },

  badge: {
    type: 'badge', label: 'Badge', icon: 'Tag', group: 'content',
    textual: true, keywords: 'pill label chip tag new',
    tag: 'span',
    hint: 'A small pill of text -- "New", "Popular", "Beta".',
    fields: [{ key: 'text', label: 'Text', control: 'text' }],
    create: () => ({
      name: 'Badge',
      props: { text: 'New' },
      styles: s({
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        paddingTop: '6px', paddingBottom: '6px', paddingLeft: '14px', paddingRight: '14px',
        backgroundColor: 'var(--color-primary-soft)', color: PRIMARY,
        borderRadius: '999px', fontSize: '13px', fontWeight: '600', width: 'auto',
      }),
    }),
  },

  quote: {
    type: 'quote', label: 'Quote', icon: 'Quote', group: 'content',
    textual: true, keywords: 'testimonial blockquote review',
    tag: 'blockquote',
    hint: 'A highlighted quote or testimonial.',
    fields: [{ key: 'text', label: 'Quote', control: 'textarea', rows: 4 }],
    create: () => ({
      name: 'Quote',
      props: { text: 'This changed how our whole team works. We shipped in a weekend.' },
      styles: s({
        borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: PRIMARY,
        paddingLeft: '20px', margin: '0px', fontSize: '20px', lineHeight: '1.5', color: T, fontStyle: 'italic',
      }),
    }),
  },

  list: {
    type: 'list', label: 'List', icon: 'List', group: 'content',
    tag: 'ul', container: true, childType: 'listitem', keywords: 'bullets points items checklist',
    hint: 'A bulleted list of points.',
    create: () => ({
      name: 'List',
      props: {},
      styles: s({
        display: 'flex', flexDirection: 'column', gap: '10px',
        margin: '0px', paddingLeft: '20px', listStyle: 'disc',
      }),
      children: [
        { type: 'listitem', props: { text: 'Everything you need to launch' } },
        { type: 'listitem', props: { text: 'No code required, ever' } },
        { type: 'listitem', props: { text: 'Export real code any time' } },
      ],
    }),
  },

  listitem: {
    type: 'listitem', label: 'List item', icon: 'Dot', group: 'content',
    tag: 'li', textual: true, hiddenInPalette: true,
    fields: [{ key: 'text', label: 'Text', control: 'text' }],
    create: () => ({
      name: 'Item',
      props: { text: 'A list item' },
      styles: s({ fontSize: '16px', lineHeight: '1.6', color: MUTED }),
    }),
  },

  /* -------------------------------------------------------------- media */
  image: {
    type: 'image', label: 'Image', icon: 'Image', group: 'media',
    tag: 'img', void: true, keywords: 'picture photo logo graphic',
    hint: 'A picture. Paste a link or pick from your uploads.',
    fields: [
      { key: 'src', label: 'Picture', control: 'image' },
      { key: 'alt', label: 'Description', control: 'text', hint: 'Describes the picture for screen readers and search engines.' },
    ],
    create: () => ({
      name: 'Image',
      props: { src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80', alt: 'A team working together' },
      styles: s({ width: '100%', height: 'auto', borderRadius: '14px', objectFit: 'cover', display: 'block' }),
    }),
  },

  icon: {
    type: 'icon', label: 'Icon', icon: 'Sparkles', group: 'media',
    tag: 'svg', void: true, keywords: 'symbol glyph pictogram',
    hint: 'A small symbol. Exports as plain SVG -- no libraries needed.',
    fields: [{ key: 'icon', label: 'Symbol', control: 'icon' }],
    create: () => ({
      name: 'Icon',
      props: { icon: 'sparkles' },
      styles: s({ width: '28px', height: '28px', color: PRIMARY, flexShrink: '0' }),
    }),
  },

  video: {
    type: 'video', label: 'Video', icon: 'Youtube', group: 'media',
    tag: 'iframe', void: true, keywords: 'youtube vimeo embed movie player',
    hint: 'Embed a YouTube or Vimeo video. Just paste the normal link.',
    fields: [{ key: 'src', label: 'Video link', control: 'text', placeholder: 'https://youtube.com/watch?v=...' }],
    create: () => ({
      name: 'Video',
      props: { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ' },
      styles: s({ width: '100%', aspectRatio: '16 / 9', height: 'auto', borderWidth: '0px', borderRadius: '14px', display: 'block' }),
    }),
  },

  /* --------------------------------------------------------------- form */
  form: {
    type: 'form', label: 'Form', icon: 'ClipboardList', group: 'form',
    tag: 'form', container: true, keywords: 'contact signup subscribe collect',
    hint: 'Collects answers from visitors.',
    fields: [{
      key: 'action', label: 'Send answers to', control: 'text',
      placeholder: 'https://formspree.io/f/xxxx',
      hint: 'Paste a form service URL, or leave blank for now.',
    }],
    create: () => ({
      name: 'Form',
      props: { action: '' },
      styles: s({ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '460px' }),
      children: [
        { type: 'label', props: { text: 'Email address' } },
        { type: 'input' },
        { type: 'button', props: { text: 'Subscribe', action: 'submit' } },
      ],
    }),
  },

  label: {
    type: 'label', label: 'Field label', icon: 'CaseSensitive', group: 'form',
    tag: 'label', textual: true, keywords: 'caption field name',
    hint: 'The caption above an input box.',
    fields: [{ key: 'text', label: 'Text', control: 'text' }],
    create: () => ({
      name: 'Label',
      props: { text: 'Your name' },
      styles: s({ fontSize: '14px', fontWeight: '600', color: T }),
    }),
  },

  input: {
    type: 'input', label: 'Input box', icon: 'TextCursorInput', group: 'form',
    tag: 'input', void: true, keywords: 'text field email entry',
    hint: 'A single-line box people can type into.',
    fields: [
      { key: 'placeholder', label: 'Hint text', control: 'text' },
      {
        key: 'inputType', label: 'Kind of answer', control: 'select',
        options: [
          { value: 'text', label: 'Any text' }, { value: 'email', label: 'Email address' },
          { value: 'tel', label: 'Phone number' }, { value: 'number', label: 'Number' },
          { value: 'password', label: 'Password' }, { value: 'date', label: 'Date' },
        ],
      },
      { key: 'name', label: 'Field name', control: 'text', hint: 'How this answer is labelled when the form is sent.' },
      { key: 'required', label: 'Must be filled in', control: 'switch' },
    ],
    create: () => ({
      name: 'Input',
      props: { placeholder: 'you@example.com', inputType: 'email', name: 'email', required: false },
      styles: s({
        width: '100%', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '14px', paddingRight: '14px',
        borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderColor: BORDER,
        fontSize: '15px', color: T, backgroundColor: 'var(--color-bg)', fontFamily: 'inherit',
      }),
    }),
  },

  textarea: {
    type: 'textarea', label: 'Message box', icon: 'FileText', group: 'form',
    tag: 'textarea', void: true, keywords: 'multiline message comment long',
    hint: 'A bigger box for longer answers.',
    fields: [
      { key: 'placeholder', label: 'Hint text', control: 'text' },
      { key: 'name', label: 'Field name', control: 'text' },
      { key: 'rows', label: 'Height in lines', control: 'number', min: 2, max: 20 },
    ],
    create: () => ({
      name: 'Message box',
      props: { placeholder: 'How can we help?', name: 'message', rows: 4 },
      styles: s({
        width: '100%', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '14px', paddingRight: '14px',
        borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderColor: BORDER,
        fontSize: '15px', color: T, backgroundColor: 'var(--color-bg)', fontFamily: 'inherit', resize: 'vertical',
      }),
    }),
  },

  select: {
    type: 'select', label: 'Dropdown', icon: 'ChevronDown', group: 'form',
    tag: 'select', container: true, childType: 'option', keywords: 'choice picker options menu',
    hint: 'A dropdown list of choices.',
    fields: [{ key: 'name', label: 'Field name', control: 'text' }],
    create: () => ({
      name: 'Dropdown',
      props: { name: 'choice' },
      styles: s({
        width: '100%', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '14px', paddingRight: '14px',
        borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderColor: BORDER,
        fontSize: '15px', color: T, backgroundColor: 'var(--color-bg)', fontFamily: 'inherit',
      }),
      children: [
        { type: 'option', props: { text: 'Choose an option' } },
        { type: 'option', props: { text: 'Starter' } },
        { type: 'option', props: { text: 'Pro' } },
      ],
    }),
  },

  option: {
    type: 'option', label: 'Choice', icon: 'Dot', group: 'form',
    tag: 'option', textual: true, hiddenInPalette: true, unstyled: true,
    fields: [{ key: 'text', label: 'Text', control: 'text' }],
    create: () => ({ name: 'Choice', props: { text: 'An option' }, styles: s({}) }),
  },

  checkbox: {
    type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare', group: 'form',
    tag: 'input', void: true, keywords: 'tick agree consent toggle',
    hint: 'A box people can tick.',
    fields: [
      { key: 'name', label: 'Field name', control: 'text' },
      { key: 'checked', label: 'Ticked by default', control: 'switch' },
    ],
    create: () => ({
      name: 'Checkbox',
      props: { name: 'agree', checked: false },
      styles: s({ width: '18px', height: '18px', accentColor: PRIMARY, flexShrink: '0' }),
    }),
  },
}

/** Palette-visible elements, grouped. */
export function paletteGroups() {
  return GROUPS.map((g) => ({
    ...g,
    items: Object.values(ELEMENTS).filter((e) => e.group === g.id && !e.hiddenInPalette),
  })).filter((g) => g.items.length)
}

export const def = (type) => ELEMENTS[type] || ELEMENTS.text

export function tagFor(node) {
  const d = def(node.type)
  return typeof d.tag === 'function' ? d.tag(node) : d.tag || 'div'
}

export const isContainer = (node) => !!def(node.type).container
export const isTextual = (node) => !!def(node.type).textual
export const isVoid = (node) => !!def(node.type).void

/** Every html tag we can emit, mapped back to the element type that owns it. */
export const TAG_TO_TYPE = {
  section: 'section', div: 'container', p: 'text', span: 'badge', a: 'link',
  button: 'button', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading',
  h5: 'heading', h6: 'heading', img: 'image', svg: 'icon', iframe: 'video',
  ul: 'list', li: 'listitem', blockquote: 'quote', form: 'form', label: 'label',
  input: 'input', textarea: 'textarea', select: 'select', option: 'option',
}
