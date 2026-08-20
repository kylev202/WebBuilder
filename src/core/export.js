/**
 * Export: take the project out of the builder as files that stand on their own.
 * Nothing here depends on WebBuilder -- the output is ordinary HTML/CSS or an
 * ordinary Vite + React project.
 */
import JSZip from 'jszip'
import { generateHtml, generateJsx, componentName } from './codegen.js'
import { buildCss } from './css.js'
import { themeCss } from './theme.js'
import { RESET } from './css.js'
import { download, slugify } from './util.js'

const fileNameFor = (page) => {
  const path = (page.path || '/').replace(/^\/+|\/+$/g, '')
  return (path === '' ? 'index' : slugify(path)) + '.html'
}

/** Rewrite in-project links (/about) to the exported file names (about.html). */
function rewriteLinks(html, project) {
  let out = html
  for (const page of project.pages) {
    const target = fileNameFor(page)
    const path = page.path || '/'
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`href="${escaped}"`, 'g'), `href="${target}"`)
  }
  return out
}

/** One stylesheet covering every page, so shared parts stay shared. */
function siteCss(project) {
  const parts = [themeCss(project.theme), RESET]
  for (const page of project.pages) {
    parts.push(`/* ---- ${page.name} ---- */`)
    parts.push(buildCss(page.root, project.theme, { includeTheme: false, reset: false }))
    if (page.customCss) parts.push(`/* Your own CSS (${page.name}) */\n${page.customCss}`)
  }
  return parts.join('\n\n') + '\n'
}

const README = (project) => `# ${project.name}

Built with WebBuilder and exported as plain code.

## The website version (websitepage folder)

Open \`index.html\` in a browser -- that is the whole site. To put it online,
upload every file in this folder to any static host (Netlify, Vercel, GitHub
Pages, or ordinary web hosting). No build step, no server, nothing to install.

## The React version (react-app folder)

\`\`\`bash
cd react-app
npm install
npm run dev
\`\`\`

Pages live in \`src/pages/\`. Styles live in \`src/styles.css\`.
`

/* ------------------------------------------------------------ web site */

export function buildSiteFiles(project) {
  const files = { 'styles.css': siteCss(project) }
  for (const page of project.pages) {
    const html = generateHtml(page, project.theme, { inlineCss: false, title: `${page.name} — ${project.name}` })
    files[fileNameFor(page)] = rewriteLinks(html, project)
  }
  return files
}

/* ---------------------------------------------------------- react app */

const MAIN_JSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`

function appJsx(project) {
  const pages = project.pages
  const imports = pages
    .map((p) => `import ${componentName(p)} from './pages/${componentName(p)}.jsx'`)
    .join('\n')
  const routes = pages
    .map((p) => `  { path: '${p.path || '/'}', name: '${p.name}', Component: ${componentName(p)} },`)
    .join('\n')

  return `import { useEffect, useState } from 'react'
${imports}

const routes = [
${routes}
]

/**
 * A tiny hash router -- no dependencies. Links like <a href="/about"> keep
 * working because we intercept clicks and translate them to hashes.
 */
export default function App() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '${pages[0]?.path || '/'}')

  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || '${pages[0]?.path || '/'}')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onClick = (event) => {
      const link = event.target.closest('a')
      if (!link) return
      const href = link.getAttribute('href') || ''
      if (!href.startsWith('/')) return
      if (!routes.some((r) => r.path === href)) return
      event.preventDefault()
      window.location.hash = href
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const route = routes.find((r) => r.path === path) || routes[0]
  return <route.Component />
}
`
}

export function buildReactFiles(project) {
  const files = {
    'package.json': JSON.stringify({
      name: slugify(project.name) || 'my-site',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.8' },
    }, null, 2) + '\n',
    'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n`,
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
    'src/main.jsx': MAIN_JSX,
    'src/App.jsx': appJsx(project),
    'src/styles.css': siteCss(project),
  }
  for (const page of project.pages) {
    files[`src/pages/${componentName(page)}.jsx`] = generateJsx(page, { withImport: false })
  }
  return files
}

/* ------------------------------------------------------------- bundles */

export async function exportZip(project, { site = true, react = true } = {}) {
  const zip = new JSZip()
  zip.file('README.md', README(project))

  if (site) {
    const folder = zip.folder('website')
    for (const [name, content] of Object.entries(buildSiteFiles(project))) folder.file(name, content)
  }
  if (react) {
    const folder = zip.folder('react-app')
    for (const [name, content] of Object.entries(buildReactFiles(project))) folder.file(name, content)
  }
  zip.file(`${slugify(project.name)}.webbuilder.json`, JSON.stringify(project, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  download(`${slugify(project.name) || 'my-project'}.zip`, blob)
}

export function exportSingleHtml(project, page) {
  const html = rewriteLinks(
    generateHtml(page, project.theme, { inlineCss: true, title: `${page.name} — ${project.name}` }),
    project,
  )
  download(`${slugify(page.name) || 'page'}.html`, html, 'text/html')
}

export function exportProjectFile(project) {
  download(`${slugify(project.name) || 'project'}.webbuilder.json`, JSON.stringify(project, null, 2), 'application/json')
}

export function importProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)))
      } catch {
        reject(new Error('That file could not be read.'))
      }
    }
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsText(file)
  })
}

/** Open the current page in a new tab, exactly as visitors would see it. */
export function openPreviewTab(project, page) {
  const html = rewriteLinks(generateHtml(page, project.theme, { inlineCss: true, title: page.name }), project)
  const blob = new Blob([html], { type: 'text/html' })
  window.open(URL.createObjectURL(blob), '_blank', 'noopener')
}
