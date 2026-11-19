import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const isTest = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.VITEST
)

export default defineConfig({
  plugins: [
    ...(!isTest
      ? [
          cloudflare({ viteEnvironment: { name: 'ssr' } }),
          tanstackStart(),
        ]
      : []),
    react(),
    tailwindcss(),
  ],
  build: {
    cssMinify: 'esbuild',
  },
})
