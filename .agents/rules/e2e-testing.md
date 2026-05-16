---
trigger: testing
description: Guidelines and architecture for the Playwright End-to-End (E2E) testing infrastructure.
globs:
  - "tests/**"
  - "public/e2e-fixtures/**"
  - "playwright.config.ts"
---

# E2E Testing Infrastructure

The WorldWideView project uses **Playwright** for end-to-end (E2E) testing. This document outlines the boundaries, architectural decisions, and conventions required when authoring or modifying E2E tests.

## 1. Resource Constraints & Parallelism
- **Worker Limits:** The Playwright configuration (`playwright.config.ts`) is strictly limited to a maximum of **2 workers**. 
- **Reasoning:** Running Next.js compilation alongside a heavy Prisma connection pool inside multiple parallel test workers will lead to database connection exhaustion and resource contention on CI and local environments. Do not increase the worker count beyond 2 without careful consideration of the database pool limits.

## 2. Test User Lifecycle
E2E tests require an authenticated user to access core application features. We manage this test user securely to ensure the environment stays pristine:

- **Setup (`tests/global.setup.ts`):** Before tests run, the global setup script defensively deletes any existing test user (`playwright-test@worldwideview.local`) and creates a fresh instance with the `ADMIN` role. It then performs a UI login to capture the authentication state, which is shared across all test files.
- **Teardown (`tests/global.teardown.ts`):** After the entire test suite completes (regardless of success or failure), the global teardown script runs and completely purges the test user from the database.
- **Safety:** Do not use `playwright-test@worldwideview.local` for manual testing. It is volatile and intended exclusively for the CI test runner.

## 3. UI Interaction Conventions
- **Strict Selector Usage**: ALWAYS use `data-testid` selectors (e.g., `getByTestId('panel-toggle-left')`) for DOM interactions. **NEVER rely on CSS classes** (like `.layer-item__toggle` or `.dock-btn`) or deep DOM structures, as these are brittle and break during design refactors. If a `data-testid` is missing from an element you need to test, you MUST add it to the React component source code first.
- **Dialog Interception:** WorldWideView relies on heavy frontend plugin discovery and dynamic rendering. For example, the `UnverifiedPluginBatchDialog` may unexpectedly appear and block UI interactions in a fresh browser context.
  - *Mitigation:* Ensure your test suites either explicitly handle these dialogs (e.g., in a `beforeEach` block) or inject mock plugins that bypass the verification flow entirely.

## 4. Mock Plugins
- **Data Interface Strictness**: WorldWideView's `PluginManager` is extremely strict. **ALL mock plugins MUST implement `getPollingInterval`, `fetch`, and `renderEntity`**, even if they are purely UI-focused (like a bottom-panel plugin). Failure to implement these will crash the renderer.
- **Capabilities**: If your mock UI plugin needs to be manually activated by the user, ensure its manifest includes the `"ui:sidebar"` capability so it appears in the layer list.
- **Injection:** We inject safe, deterministic mock plugins into the database during the `global.setup.ts` phase to test the core rendering pipeline without relying on external APIs. Ensure your mock plugin is registered in the setup and teardown cleanup arrays.
- **Location:** Mock plugin configurations and manifests are stored in `public/e2e-fixtures/`. When modifying the rendering engine, ensure you also update the mock plugin (`public/e2e-fixtures/mock-plugin.js`) to reflect any changes in the Plugin SDK capabilities.

## 5. Security Permissions
- When integrating Playwright tests into GitHub Actions (e.g., `.github/workflows/playwright.yml`), you MUST include an explicit permissions block (e.g., `permissions: { contents: read }`) to adhere to CodeQL and least-privilege scoping rules.

> [!WARNING]  
> If you encounter flaky tests or `ECONNREFUSED` errors during Playwright runs, check if the local Next.js dev server or the Docker engine stack is competing for ports (e.g., port 5432 or 3000). Ensure `pnpm run dev:backends` is running and stable before launching the test suite.
