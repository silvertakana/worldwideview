import { test, expect } from '@playwright/test';

test('smoke: app boots and alert mock is listed', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60000 });
  await expect(page.getByTestId('panel-toggle-right')).toBeVisible({ timeout: 20000 });
});
