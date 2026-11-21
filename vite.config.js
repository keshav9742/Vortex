import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'frontend',
  envDir: '..',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'frontend/index.html'),
        login: resolve(import.meta.dirname, 'frontend/login.html'),
        dashboard: resolve(import.meta.dirname, 'frontend/dashboard.html')
      }
    }
  }
});
