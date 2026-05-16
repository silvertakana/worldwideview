---
name: playwright-testing
description: Use when creating or modifying Playwright end-to-end tests, especially when injecting mock plugins to test platform features.
---

# Playwright E2E Testing & Mock Plugin Guide

When you are tasked with testing a new feature or plugin in WorldWideView using Playwright, you must use this skill to ensure you follow the strict architecture rules of the platform.

## 1. Mock Plugin Requirements
When creating a mock plugin (e.g., `public/e2e-fixtures/my-mock-plugin.js`) to test a specific UI feature, **you MUST implement the full Data Plugin interface**.

WorldWideView's `PluginManager` throws fatal runtime errors if a plugin is missing core data fetching methods, even if your plugin only tests a UI component like a bottom panel.

**Required Methods for EVERY Mock Plugin:**
```javascript
export default {
    id: "my-mock-plugin",
    name: "My Mock Plugin",
    // ...
    // MUST BE INCLUDED:
    fetch: async (timeRange) => { return []; },
    getPollingInterval: () => { return 60000; },
    getLayerConfig: () => { return { color: "#FFF", clusterEnabled: false, clusterDistance: 50 }; },
    renderEntity: (entity) => { return { type: "point", color: "#FFF", size: 5 }; },
    
    // Your UI testing component (e.g., Sidebar, Bottom Panel)
    getBottomPanelComponent: () => { ... }
}
```

## 2. Mock Plugin Manifest Capabilities
If your mock plugin needs to be toggled by the user in the Layers list, you MUST include the `"ui:sidebar"` capability in its `manifest.json`.
```json
{
  "capabilities": ["ui:bottom-panel", "ui:sidebar"],
  "extends": ["sidebar"]
}
```

## 3. Database Injection
The frontend reads plugins from the database. You MUST inject your mock plugin during `tests/global.setup.ts` using Prisma:

```typescript
    const manifestPath = path.join(process.cwd(), 'public', 'e2e-fixtures', 'my-mock-plugin-manifest.json');
    const manifestStr = fs.readFileSync(manifestPath, 'utf-8');
    await prisma.installedPlugin.create({
      data: {
        pluginId: 'my-mock-plugin',
        version: '1.0.0',
        config: manifestStr,
        enabled: true
      }
    });
```
Make sure to add your new mock plugin ID to the cleanup logic in `global.setup.ts` as well:
```typescript
    await prisma.installedPlugin.deleteMany({
        where: { pluginId: { in: ['e2e-mock-plugin', 'my-mock-plugin'] } }
    });
```

## 4. UI Selectors
**DO NOT use CSS classes for your locators.** CSS classes change frequently (e.g., `.dock-btn`, `.layer-item__toggle`).
You MUST either:
1. Add explicit `data-testid` attributes to the React components you are testing.
2. Use stable accessibility locators (e.g., `getByRole('button', { name: /Text/ })`).

## 5. Execution Environment
- Ensure `pnpm run dev:backends` is running before you execute tests locally.
- Run tests using `pnpm run test:e2e` or `npx playwright test tests/your-test.spec.ts`.
- **PowerShell Warning**: Remember you are running in Windows PowerShell. Do NOT chain commands with `&&`. Use `;` instead.
