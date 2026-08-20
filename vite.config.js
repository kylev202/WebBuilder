import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative so the build runs from any path: a GitHub Pages project site
  // (/WebBuilder/), a custom domain, or dist/index.html opened directly.
  base: './',
  plugins: [react()],
  server: { port: 5180, open: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1400 },
})
