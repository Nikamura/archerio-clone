import { defineConfig } from 'vite'
import path from 'path'

// Use root path for Netlify and Capacitor, '/archerio-clone/' for GitHub Pages
const base = process.env.NETLIFY || process.env.CAPACITOR ? '/' : '/archerio-clone/'

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // Phaser is ~1.5MB minified - this is expected for a game engine
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          sentry: ['@sentry/browser'],
        },
      },
    },
  },
})
