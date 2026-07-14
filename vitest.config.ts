import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Live end-to-end suites (flying-squid world, real HTTP boot, Playwright)
    // are opt-in via `npm run test:live` / `npm run test:e2e` — never in the
    // default hermetic run or CI.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/live/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});
