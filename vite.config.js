// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',                 // <-- important for file:// in Electron
  server: { port: 5173 },
  build: { outDir: 'dist' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
  },
  assetsInclude: ['**/*.PNG'],
})
