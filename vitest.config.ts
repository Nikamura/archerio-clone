import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // Default: only unit tests (no visual tests requiring server)
      include: ['src/**/*.test.ts'],
      exclude: ['node_modules', 'dist', 'test/visual.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.ts'],
        exclude: [
          'src/main.ts',
          'src/**/*.test.ts',
          'node_modules/**',
        ],
        thresholds: {
          // Can be increased as more tests are added
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
      },
    },
  })
)
