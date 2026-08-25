/* eslint-disable no-console */
/**
 * Alerts UI E2E: create a rule through the real UI against the
 * `e2e-alert-mock` plugin (seeded in global.setup), then inject a matching
 * payload through PluginManager -> dataBus and assert the toast + badge fire;
 * inject a non-matching payload and assert nothing new fires. A second test
 * disables a rule through the UI and asserts a would-be match stays silent.
 */
import { test, expect, type Page } from '@playwright/test';

const MOCK_ID = 'e2e-alert-mock';

interface HostGlobals {
  __WWV_HOST__?: {
    useStore: {
      getState: () => {
        initLayer: (id: string, enabled: boolean) => void;
      };
    };
    pluginManager: {
      enablePlugin: (id: string) => Promise<void>;
      fetchForPlugin: (id: string, timeRange: { start: Date; end: Date }) => Promise<void>;
    };
  };
  __setE2eAlertMockPayload?: (entities: Record<string, unknown>[]) => void;
}

async function enableMockLayer(page: Page): Promise<void> {
  await page.evaluate(async (id) => {
    const w = globalThis as unknown as HostGlobals;
    if (!w.__WWV_HOST__) throw new Error('__WWV_HOST__ missing');
    w.__WWV_HOST__.useStore.getState().initLayer(id, true);
    await w.__WWV_HOST__.pluginManager.enablePlugin(id);
  }, MOCK_ID);
}

function matchingPayload(overrides: Record<string, unknown>) {
  return {
    id: 'matching-quake',
    pluginId: MOCK_ID,
    latitude: 61.2,
    longitude: -149.4,
    timestamp: new Date().toISOString(),
    label: 'M6.5 Central Alaska',
    properties: { magnitude: 6.5, place: 'Central Alaska', felt: true },
    ...overrides,
  };
}

async function injectPayload(page: Page, entities: Record<string, unknown>[]): Promise<void> {
  await page.evaluate((payload) => {
    (globalThis as unknown as HostGlobals).__setE2eAlertMockPayload?.(payload);
  }, entities);
  await page.evaluate(async (id) => {
    const w = globalThis as unknown as HostGlobals;
    if (!w.__WWV_HOST__) throw new Error('__WWV_HOST__ missing');
    const range = { start: new Date(Date.now() - 60 * 60 * 1000), end: new Date() };
    await w.__WWV_HOST__.pluginManager.fetchForPlugin(id, range);
  }, MOCK_ID);
}

async function openAlertsPanel(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 60000 });
  const rightToggle = page.locator('[data-testid="panel-toggle-right"]');
  if (await rightToggle.count() > 0) {
    const isOpen = await rightToggle.evaluate((node) =>
      node.classList.contains('panel-toggle-btn--open'));
    if (!isOpen) await rightToggle.click();
  }
  await page.getByTestId('alerts-tab').click({ timeout: 20000 });
  await expect(page.getByTestId('alerts-panel')).toBeVisible({ timeout: 30000 });
}

async function createRuleViaUi(page: Page, name: string): Promise<void> {
  await page.getByTestId('alert-create-button').click();
  const pluginSelect = page.getByTestId('alert-rule-plugin-select');
  await expect(
    pluginSelect.locator('option', { hasText: 'E2E Alert Mock' }),
  ).toBeAttached({ timeout: 45000 });

  await page.getByTestId('alert-rule-name-input').fill(name);
  await pluginSelect.selectOption(MOCK_ID);
  await page.getByTestId('alert-rule-field-select').selectOption('magnitude');
  await page.getByTestId('alert-rule-op-select').selectOption('gt');
  await page.getByTestId('alert-rule-value-input').fill('5');
  await page.getByTestId('alert-rule-save').click();

  await expect(page.getByTestId('alerts-list').getByText(name)).toBeVisible({ timeout: 20000 });
}

test.describe('Alert UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAlertsPanel(page);
  });

  test('creates a rule and fires a toast/badge on match but not on non-match', async ({ page }) => {
    await expect(page.getByTestId('alerts-empty')).toBeVisible({ timeout: 30000 });
    await createRuleViaUi(page, 'Magnitude over five');
    await expect(page.getByTestId('alerts-list')).toContainText('greater than 5');

    // Enable the mock layer so PluginManager can fetch data for it.
    await enableMockLayer(page);
    // Give the alert engine a beat to refresh its rule set after the POST.
    await page.waitForTimeout(1000);

    // Inject a MATCHING payload (magnitude 6.5 > 5) -> toast + badge.
    await injectPayload(page, [matchingPayload({})]);
    await expect(page.getByTestId('alert-toasts')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Magnitude over five')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('alerts-tab-badge')).toHaveText('1');

    // Inject a NON-matching payload (magnitude 2, different entity) -> no new
    // alert: badge stays at 1 and no toast mentions the quiet quake.
    await injectPayload(page, [matchingPayload({
      id: 'quiet-quake',
      label: 'M2.0 Fiji',
      properties: { magnitude: 2, place: 'Fiji', felt: false },
    })]);
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('alerts-tab-badge')).toHaveText('1');
    await expect(page.getByTestId('alert-toasts')).not.toContainText('Fiji');
  });

  test('disabling a rule stops it from firing', async ({ page }) => {
    // Create through the UI, then flip the enable switch off.
    await createRuleViaUi(page, 'Will be disabled');
    const toggle = page.getByTestId('alerts-list').locator('[role="switch"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await enableMockLayer(page);
    await page.waitForTimeout(1000);

    // A payload that WOULD match if the rule were active.
    await injectPayload(page, [matchingPayload({})]);
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('alert-toasts')).toHaveCount(0);
    await expect(page.locator('[data-testid^="alert-toast-"]')).toHaveCount(0);
    await expect(page.getByTestId('alerts-tab-badge')).toHaveCount(0);
  });
});