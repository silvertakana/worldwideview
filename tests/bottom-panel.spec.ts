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

        // Block the marketplace sync's window-focus re-sync. With 2 parallel
        // workers, the sibling test's browser activity fires focus/blur on this
        // page's window; useMarketplaceSync re-runs /api/marketplace/load on every
        // focus event, and each re-sync can re-mount the unverified-plugin dialog
        // (full-screen overlay, z-index 10000) that swallows drag mousedowns.
        // A capture-phase listener with stopImmediatePropagation prevents the
        // sync's bubble-phase focus listener from ever running.
        await page.evaluate(() => {
            const blocker = (e: Event) => {
                e.stopImmediatePropagation();
                e.preventDefault();
            };
            window.addEventListener('focus', blocker, true);
            window.addEventListener('blur', blocker, true);
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

        // Toggle the layer ON so it appears in the bottom panel.
        // The unverified-plugin gate dialog mounts asynchronously once the
        // /api/marketplace/load sync settles — sometimes AFTER the 5s wait above.
        // While it is up the mock plugin is gated and its layer item never
        // registers, so keep dismissing the dialog WHILE waiting for the item
        // (toPass re-runs the block until the layer item is visible).
        const layerItem = page.locator('.layer-item', { hasText: 'E2E Bottom Panel Mock' });
        await expect(async () => {
            const installBtn = page.getByRole('button', { name: /Install Selected/ });
            if (await installBtn.isVisible().catch(() => false)) {
                try {
                    await installBtn.click({ timeout: 3000 });
                } catch {
                    // Dialog is closing (button disabled/detached) — keep polling.
                }
                await page.waitForTimeout(200);
            }
            await expect(layerItem).toBeVisible({ timeout: 1000 });
        }).toPass({ timeout: 45000 });
        
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

        // The panel opens with a 400ms CSS height transition (0 -> bottomPanelHeight).
        // toBeVisible() passes on opacity while the panel is STILL growing, so the
        // handle position must not be read until the height is stable: a stale box
        // makes the next mousedown land on panel content instead of the handle, and
        // the drag silently never registers. Poll until two consecutive reads agree.
        const waitForSettledHeight = async (): Promise<number> => {
            let prev = -1;
            let current = 0;
            const deadline = Date.now() + 10000;
            do {
                current = (await bottomPanel.boundingBox())?.height ?? 0;
                if (prev >= 0 && Math.abs(current - prev) < 0.5) break;
                prev = current;
                await page.waitForTimeout(50);
            } while (Date.now() < deadline);
            return current;
        };
        await waitForSettledHeight();

        // Get initial height
        const initialBox = await bottomPanel.boundingBox();
        expect(initialBox).not.toBeNull();

        // Find the drag handle
        const dragHandle = page.locator('[data-testid="bottom-panel-resize-handle"]');
        await expect(dragHandle).toBeVisible();

        // Drag the resize handle by deltaY pixels using the real mouse (Chromium
        // synthesizes pointer events from mouse events, which drives the React
        // pointer handlers in BottomPanelManager). The handle position is
        // re-read IMMEDIATELY before each mousedown, and after each drag the
        // height is polled until it stops changing before any position is reused.
        const dragResizeHandle = async (deltaY: number): Promise<number> => {
            // The unverified-plugin gate dialog is a full-screen overlay
            // (z-index 10000) that mounts asynchronously once /api/marketplace/load
            // settles — which can happen AFTER the beforeEach's 5s window. While
            // it is up it swallows every mousedown, silently killing the drag.
            // If present, dismiss it and WAIT for the overlay to actually leave
            // the DOM: approveSelected loads every pending manifest before the
            // dialog hides, so the click alone does not clear the screen.
            const installBtn = page.getByRole('button', { name: /Install Selected/ });
            if (await installBtn.isVisible().catch(() => false)) {
                await installBtn.click();
                await expect(installBtn).toBeHidden({ timeout: 15000 });
                console.log('Resize test: dismissed late unverified plugin dialog.');
            }

            const box = await dragHandle.boundingBox();
            expect(box).not.toBeNull();
            const startX = box!.x + box!.width / 2;
            const startY = box!.y + box!.height / 2;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.waitForTimeout(100); // allow React to process mousedown and set drag state
            await page.mouse.move(startX, startY + deltaY, { steps: 10 });
            await page.waitForTimeout(100); // allow resize state to update
            await page.mouse.up();

            return waitForSettledHeight();
        };

        // Perform drag UP
        await dragResizeHandle(-100);

        // Check new height (poll: CSS transition + React state settle asynchronously)
        await expect.poll(async () => (await bottomPanel.boundingBox())?.height ?? 0, { timeout: 10000 })
            .toBeGreaterThan(initialBox!.height + 50);
        const finalBoxHeight = (await bottomPanel.boundingBox())!.height;

        // Drag DOWN (the helper re-reads the handle position from its settled
        // post-drag-up location, so this drag always starts on the handle)
        await dragResizeHandle(100);

        // Check height decreased from the dragged-up height (poll — same settle rationale)
        await expect.poll(async () => (await bottomPanel.boundingBox())?.height ?? 0, { timeout: 10000 })
            .toBeLessThan(finalBoxHeight - 50);
    });
});

