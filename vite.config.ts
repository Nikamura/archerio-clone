import { defineConfig } from 'vite'
import path from 'path'

// Use root path for Netlify, '/archerio-clone/' for GitHub Pages
const base = process.env.NETLIFY ? '/' : '/archerio-clone/'

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
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
})
