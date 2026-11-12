import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'jsdom',
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(three|@react-three)\//.test(id)) return 'three';
          if (id.includes('node_modules/zustand/')) return 'zustand';
        },
      },
    },
  },
});
