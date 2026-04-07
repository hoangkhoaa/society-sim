import { defineConfig } from 'vite'

export default defineConfig({
  base: '/society-sim/',
  server: {
    headers: {
      // Required for SharedArrayBuffer (Web Worker zero-copy)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
})
