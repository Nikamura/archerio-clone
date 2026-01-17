import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true, // Allow access from network (for Capacitor live reload)
  },
  build: {
    // Phaser is ~1.5MB minified - this is expected for a game engine
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        editor: path.resolve(__dirname, "editor.html"),
      },
      output: {
        manualChunks: {
          phaser: ["phaser"],
          sentry: ["@sentry/browser"],
        },
      },
    },
  },
});
