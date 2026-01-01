import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Full test suite configuration (unit + visual tests)
 * Requires dev server running at localhost:3000 for visual tests
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      exclude: ['node_modules', 'dist'],
      testTimeout: 60000,
      hookTimeout: 30000,
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
      },
    },
  })
)
