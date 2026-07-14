import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * Full first-run UI journey against the real, running dashboard: setup wizard →
 * admin creation → login → live dashboard → client-side nav to Config and Logs.
 * Fails on any uncaught page exception.
 */
const ADMIN = { username: 'e2eadmin', password: 'sup3r-secret' };

test('first-run journey: wizard → login → dashboard → nav', async ({ page }) => {
  // Uncaught JS exceptions are always a failure.
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Console errors are a failure too — EXCEPT the browser's "Failed to load
  // resource" line for the pre-login auth probe (`GET /api/auth/me` returns 401
  // by design so the SPA knows to show the login screen). That is expected and
  // not an application error.
  const consoleErrors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource/i.test(text) && /401/.test(text)) return;
    consoleErrors.push(text);
  });

  // Fresh instance boots into the setup wizard.
  await page.goto('/');
  await expect(page.locator('#admin-username')).toBeVisible();

  // Step 0 — admin account.
  await page.fill('#admin-username', ADMIN.username);
  await page.fill('#admin-password', ADMIN.password);
  await page.fill('#admin-confirm', ADMIN.password);

  // Steps 1–3 are optional; click through to the review step.
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  // Review → finish; the app redirects to /login.
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Log in.
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Land on the live dashboard.
  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByText('Uptime')).toBeVisible();

  // Client-side nav to Config.
  await page.getByRole('link', { name: 'Config' }).click();
  await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();

  // Client-side nav to Logs.
  await page.getByRole('link', { name: 'Logs' }).click();
  await expect(page.getByText('Recent events')).toBeVisible();

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
