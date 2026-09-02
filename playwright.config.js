import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  webServer: {
    command: 'npx vite --port 5175',
    port: 5175,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:5175',
    viewport: { width: 1280, height: 800 },
  },
});
