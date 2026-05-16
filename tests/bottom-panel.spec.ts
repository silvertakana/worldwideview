import { test, expect } from '@playwright/test';

test.describe('Bottom Panel System', () => {
    test.beforeEach(async ({ page }) => {
        // Log in by loading the auth state (handled by global setup/playwright config)
        await page.goto('/');
        // Wait for hydration and basic UI to load
        await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 45000 });
        
        // Log console messages from the browser
        page.on('console', msg => {
            console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
            if (msg.type() === 'error') {
                console.log(`[Browser Error] ${msg.location().url}:${msg.location().lineNumber}`);
            }
        });

        // The unverified plugin dialog might appear for the mock plugin.
        const installBtn = page.getByRole('button', { name: /Install Selected/ });
        try {
            await installBtn.waitFor({ state: 'visible', timeout: 5000 });
            await installBtn.click();
            console.log('Clicked "Install Selected" in unverified plugin dialog.');
        } catch (e) {
            console.log('Unverified plugin dialog did not appear.');
        }

        // Toggle the layer ON so it appears in the bottom panel
        const layerItem = page.locator('.layer-item', { hasText: 'E2E Bottom Panel Mock' });
        await expect(layerItem).toBeVisible({ timeout: 10000 });
        
        // Find the toggle switch inside the layer item and click it if it's not already on
        const toggleBtn = layerItem.locator('.layer-item__toggle');
        const isToggledOn = await toggleBtn.evaluate(node => node.classList.contains('layer-item__toggle--on'));
        if (!isToggledOn) {
            await toggleBtn.click();
            console.log('Toggled plugin ON');
        } else {
            console.log('Plugin was already ON');
        }

        // Wait a short moment for the state to update
        await page.waitForTimeout(1000);
    });

    test('verifies the bottom panel can be activated and displays plugin content', async ({ page }) => {
        // 1. Identify the tab or button for the bottom panel plugin
        // The bottom panel creates tabs based on the plugin title/id.
        // The mock plugin returns "E2E Bottom Panel Mock" as the name, so the tab will have that text.
        const panelTab = page.locator('.dock-btn', { hasText: 'E2E Bottom Panel Mock' });
        
        // Ensure the tab is visible
        await expect(panelTab).toBeVisible();

        // 2. Click the tab to activate the bottom panel
        await panelTab.click();

        // 3. Verify the mock content appears in the active panel area
        const mockContent = page.locator('[data-testid="e2e-bottom-panel-content"]');
        await expect(mockContent).toBeVisible();
        await expect(mockContent).toHaveText('Mock Bottom Panel Active');
        
        // Also verify the container is the bottom panel container
        const bottomPanelContent = page.locator('.bottom-panel-content');
        await expect(bottomPanelContent).toBeVisible();

        // 4. Click the tab again to collapse/deactivate it
        await panelTab.click();
        
        // Wait a short moment for the CSS transition (optional but good for stability)
        await page.waitForTimeout(300);

        // Verify the content is no longer visible
        await expect(mockContent).not.toBeVisible();
    });
});
