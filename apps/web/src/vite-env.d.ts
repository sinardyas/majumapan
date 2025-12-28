/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// PWA Background Sync types
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager;
  readonly periodicSync: {
    register(tag: string, options?: { minInterval: number }): Promise<void>;
  };
}
