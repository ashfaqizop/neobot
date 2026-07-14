import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end UI suite (opt-in: `npm run test:e2e`).
 *
 * Boots the REAL NeoBot server (built SPA + API + Socket.IO) on a test port
 * with in-memory persistence, so every run starts fresh (needsSetup=true) and
 * the spec can walk the whole first-run flow. Headed by default so you can
 * watch it drive the dashboard; set PWHEADLESS=1 for a headless run.
 */
const PORT = 3987;
const HEADLESS = process.env.PWHEADLESS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: HEADLESS,
    launchOptions: { slowMo: HEADLESS ? 0 : 350 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run e2e:serve',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'production',
      LOG_LEVEL: 'silent',
      SESSION_SECRET: 'e2e-playwright-secret',
    },
  },
});
