import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pos/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@pos/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@pos/api-client': path.resolve(__dirname, '../../packages/api/src'),
    },
  },
  server: {
    port: 4001,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@pos/ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          charts: ['recharts'],
        },
      },
    },
  },
});
