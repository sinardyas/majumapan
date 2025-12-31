import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pos/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@pos/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@pos/api-client': path.resolve(__dirname, '../../packages/api/src'),
    },
  },
});
