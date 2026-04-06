import { defineConfig } from 'vite'

export default defineConfig({
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
