import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLDivElement: "readonly",
        DOMRect: "readonly",
        window: "readonly",
        document: "readonly",
        Phaser: "readonly",
        localStorage: "readonly",
        __BUILD_DATE__: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // TypeScript handles these
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow console in game development
      "no-console": "off",
      // Phaser uses 'this' in callbacks
      "no-invalid-this": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.js"],
  },
];
