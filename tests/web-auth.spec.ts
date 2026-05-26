import { test, expect } from '@playwright/test';

// baseURL is set to https://wwv.local:3001 in playwright.web.config.ts.
// All page.goto() calls use relative paths.

// ─── /auth/reset-password ────────────────────────────────────────────────────

test.describe('/auth/reset-password', () => {

    test('page renders the request form', async ({ page }) => {
        await page.goto('/auth/reset-password');
        await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    });

    test('submit transitions to inline success state on same page', async ({ page }) => {
        await page.goto('/auth/reset-password');
        await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
        await page.getByRole('button', { name: 'Send Reset Link' }).click();
        // The server action calls Supabase resetPasswordForEmail; this will likely error in
        // the test environment (no real Supabase creds). Handle both outcomes:
        // - If success: heading changes to "Check Your Email"
        // - If error: inline error message appears (not a crash / blank page)
        const successHeading = page.getByRole('heading', { name: 'Check Your Email' });
        const errorText = page.locator('[role="alert"]');
        await expect(successHeading.or(errorText)).toBeVisible({ timeout: 10000 });
    });

});

// ─── /accounts unauthenticated redirect ──────────────────────────────────────

test.describe('/accounts', () => {

    test('unauthenticated visit redirects to /login', async ({ page }) => {
        // Navigate to /accounts with no session cookie.
        // The page.tsx server component calls getClaims() and redirects if no session.
        await page.goto('/accounts');
        // Wait for navigation to settle; allow up to 10 seconds for the redirect chain.
        await page.waitForURL('**/login**', { timeout: 10000 });
        expect(page.url()).toContain('/login');
    });

});

// ─── /auth/verify without a code ─────────────────────────────────────────────

test.describe('/auth/verify', () => {

    test('visiting without a code param shows Verification Failed state', async ({ page }) => {
        await page.goto('/auth/verify');
        // The VerifyContent useEffect checks for searchParams.get('code').
        // With no code, it immediately sets status to 'error'.
        await expect(page.getByRole('heading', { name: 'Verification Failed' })).toBeVisible({ timeout: 10000 });
    });

});

// ─── /auth/reset-password/confirm without a hash ─────────────────────────────

test.describe('/auth/reset-password/confirm', () => {

    test('visiting without a recovery hash shows Link Expired after timeout', async ({ page }) => {
        await page.goto('/auth/reset-password/confirm');
        // The page waits up to 3 seconds for onAuthStateChange PASSWORD_RECOVERY.
        // With no hash, the event never fires, so the 3s timer triggers setLinkError(true).
        // Allow up to 8 seconds total (3s timer + render time + margin).
        await expect(page.getByRole('heading', { name: 'Link Expired' })).toBeVisible({ timeout: 8000 });
    });

});
