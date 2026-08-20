/**
 * Starter projects. Every template is just blocks arranged on pages, so a
 * beginner starts from something real and can pull it apart piece by piece.
 */
import { createNode } from './doc.js'
import { blockById } from './blocks.js'
import { THEME_PRESETS } from './theme.js'
import { uid } from './util.js'

function makePage(name, path, blockIds) {
  return {
    id: uid(),
    name,
    path,
    customCss: '',
    root: createNode('page', {
      name: `${name} page`,
      children: blockIds.map((id) => blockById(id)?.build()).filter(Boolean),
    }),
  }
}

/**
 * Point navigation at the pages the template actually has, so a multi-page
 * template arrives already wired up rather than full of dead "#" links.
 */
function connectPages(pages) {
  const byName = new Map(pages.map((p) => [p.name.toLowerCase(), p.path]))
  const home = pages[0]?.path || '/'

  const visit = (node) => {
    const text = (node.props?.text || '').trim().toLowerCase()
    const isLink = node.type === 'link' || (node.type === 'button' && node.props?.action === 'link')
    if (isLink && byName.has(text)) node.props.href = byName.get(text)
    else if (isLink && (text === 'home' || node.name === 'Brand')) node.props.href = home
    node.children?.forEach(visit)
  }

  pages.forEach((page) => visit(page.root))
  return pages
}

export const TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank page',
    description: 'An empty canvas. Start from nothing.',
    tag: 'Start here',
    preset: 'indigo',
    accent: '#4f46e5',
    pages: () => [makePage('Home', '/', [])],
  },
  {
    id: 'landing',
    label: 'Landing page',
    description: 'Sell one idea, end with a sign-up. The classic.',
    tag: 'Most popular',
    preset: 'indigo',
    accent: '#4f46e5',
    pages: () => [makePage('Home', '/', ['navbar', 'hero', 'logos', 'features', 'steps', 'testimonial', 'pricing', 'faq', 'cta', 'footer'])],
  },
  {
    id: 'saas',
    label: 'Software product',
    description: 'For an app or tool, with plans and proof.',
    tag: 'Business',
    preset: 'ocean',
    accent: '#0284c7',
    pages: () => [
      makePage('Home', '/', ['navbar', 'hero-split', 'stats', 'features', 'split-feature', 'testimonial', 'pricing', 'cta', 'footer']),
      makePage('Contact', '/contact', ['navbar', 'contact', 'footer']),
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Show your work. Quiet, confident, image-led.',
    tag: 'Personal',
    preset: 'mono',
    accent: '#111827',
    pages: () => [
      makePage('Home', '/', ['navbar', 'hero-split', 'gallery', 'testimonial', 'cta', 'footer']),
      makePage('About', '/about', ['navbar', 'split-feature', 'team', 'contact', 'footer']),
    ],
  },
  {
    id: 'agency',
    label: 'Small business',
    description: 'A shop, studio or practice with a real address.',
    tag: 'Business',
    preset: 'emerald',
    accent: '#059669',
    pages: () => [
      makePage('Home', '/', ['navbar', 'hero-split', 'logos', 'features', 'testimonial', 'cta', 'footer']),
      makePage('About', '/about', ['navbar', 'team', 'faq', 'footer']),
      makePage('Contact', '/contact', ['navbar', 'contact', 'footer']),
    ],
  },
  {
    id: 'event',
    label: 'Event',
    description: 'A conference, launch or workshop with a date.',
    tag: 'Occasion',
    preset: 'sunset',
    accent: '#e11d48',
    pages: () => [makePage('Home', '/', ['navbar', 'hero', 'steps', 'team', 'faq', 'newsletter', 'footer'])],
  },
  {
    id: 'coming-soon',
    label: 'Coming soon',
    description: 'One page, one promise, one email box.',
    tag: 'Quick',
    preset: 'midnight',
    accent: '#818cf8',
    pages: () => [makePage('Home', '/', ['hero', 'newsletter', 'footer'])],
  },
  {
    id: 'onepager',
    label: 'One-page site',
    description: 'Everything on a single scrolling page.',
    tag: 'Quick',
    preset: 'emerald',
    accent: '#0ea5e9',
    pages: () => [makePage('Home', '/', ['navbar', 'hero', 'features', 'gallery', 'contact', 'footer'])],
  },
]

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]

export function newProject(templateId = 'landing', name) {
  const template = templateById(templateId)
  const pages = connectPages(template.pages())
  return {
    id: uid(8),
    name: name || (templateId === 'blank' ? 'My project' : template.label),
    templateId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme: { preset: template.preset, ...structuredClone(THEME_PRESETS[template.preset]) },
    pages,
    assets: [],
  }
}
