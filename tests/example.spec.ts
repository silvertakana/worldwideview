import { test, expect } from '@playwright/test';

test('has title and boots app completely', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/PLTR Beta/i);

  // Wait for the boot sequence to finish and plugins to load
  await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 30000 });
  
  // Verify that the element is actually present
  const appReady = await page.locator('[data-testid="app-ready"]');
  await expect(appReady).toBeAttached();
});
