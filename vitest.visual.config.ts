import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * Visual test configuration
 * Requires dev server running at localhost:3000
 * Run: pnpm run dev (in another terminal)
 * Then: pnpm run test:visual
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node", // Visual tests use Puppeteer, not jsdom
      include: ["test/visual.test.ts"],
      testTimeout: 60000, // Visual tests need more time
      hookTimeout: 30000,
    },
  }),
);
