/* eslint-disable no-console */
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
        } catch {
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

    test('verifies the bottom panel can be resized via the drag handle', async ({ page }) => {
        const panelTab = page.locator('.dock-btn', { hasText: 'E2E Bottom Panel Mock' });
        await expect(panelTab).toBeVisible();
        await panelTab.click();

        const bottomPanel = page.locator('.bottom-panel.open');
        await expect(bottomPanel).toBeVisible();

        // Get initial height
        const initialBox = await bottomPanel.boundingBox();
        expect(initialBox).not.toBeNull();

        // Find the drag handle
        const dragHandle = page.locator('[data-testid="bottom-panel-resize-handle"]');
        await expect(dragHandle).toBeVisible();

        const handleBox = await dragHandle.boundingBox();
        expect(handleBox).not.toBeNull();

        // Perform drag UP
        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100); // allow React to process mousedown and attach mousemove listener
        
        // Drag up by 100 pixels with steps to simulate smooth motion and trigger isDragging styles
        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 100, { steps: 10 });
        await page.waitForTimeout(100); // allow resize state to update
        await page.mouse.up();
        await page.waitForTimeout(400); // wait for CSS transition to settle since opacity/height transitions apply

        // Check new height
        const finalBox = await bottomPanel.boundingBox();
        expect(finalBox).not.toBeNull();
        expect(finalBox!.height).toBeGreaterThan(initialBox!.height + 50);

        // Get updated handle position for second drag
        const newHandleBox = await dragHandle.boundingBox();
        expect(newHandleBox).not.toBeNull();

        // Drag DOWN
        await page.mouse.move(newHandleBox!.x + newHandleBox!.width / 2, newHandleBox!.y + newHandleBox!.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        
        await page.mouse.move(newHandleBox!.x + newHandleBox!.width / 2, newHandleBox!.y + 100, { steps: 10 });
        await page.waitForTimeout(100);
        await page.mouse.up();
        await page.waitForTimeout(400);

        // Check height decreased
        const shrunkBox = await bottomPanel.boundingBox();
        expect(shrunkBox).not.toBeNull();
        expect(shrunkBox!.height).toBeLessThan(finalBox!.height - 50);
    });
});

