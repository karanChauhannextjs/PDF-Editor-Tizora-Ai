import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const rootDir = fileURLToPath(new URL('.', import.meta.url))

function copyPdfWorker() {
  const source = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  const destination = resolve(rootDir, 'public/pdf.worker.min.mjs')
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
}

function pdfWorkerPlugin() {
  return {
    name: 'copy-pdfjs-worker',
    buildStart() {
      copyPdfWorker()
    },
    configureServer() {
      copyPdfWorker()
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfWorkerPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
  },
})
