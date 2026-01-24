/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string | undefined;
  readonly VITE_APP_VERSION: string | undefined;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
