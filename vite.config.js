import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [
      ['src/__tests__/**', 'jsdom'],
    ],
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor': ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
});
