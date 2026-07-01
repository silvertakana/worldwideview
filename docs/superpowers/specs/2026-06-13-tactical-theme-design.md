# Tactical Theme Design Spec

## Overview

Add a 5th theme called **"Tactical"** to WorldWideView. Inspired by military C2 systems, submarine combat interfaces, and FUI (Fictional User Interface) design. Dark, dense, utilitarian, monospace-everything. No glassmorphism, no rounded corners, no decoration that doesn't serve a purpose.

## Design Tokens

Add `[data-theme='tactical']` block in `src/styles/theme-tokens.css`:

```css
[data-theme='tactical'] {
  /* Palette — Near-black with amber/orange accents */
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --bg-tertiary: #1a1a1a;
  --bg-glass: #111111;
  --bg-glass-hover: #1a1a1a;
  --bg-glass-active: #222222;

  --border-subtle: #2a2a2a;
  --border-medium: #333333;
  --border-bright: #444444;
  --border-glow: rgba(230, 126, 34, 0.3);

  --text-primary: #d4d4d4;
  --text-secondary: #7a7a7a;
  --text-muted: #555555;
  --text-accent: #e67e22;

  --accent-cyan: #e67e22;
  --accent-rgb: 230, 126, 34;
  --accent-teal: #d4d4d4;
  --accent-blue: #7a7a7a;
  --accent-purple: #555555;
  --accent-amber: #e67e22;
  --accent-red: #e74c3c;
  --accent-green: #27ae60;

  --glow-cyan: 0 0 12px rgba(230, 126, 34, 0.2);
  --glow-blue: 0 0 8px rgba(230, 126, 34, 0.1);

  --discord-color: #e67e22;
  --discord-color-hover: #d4d4d4;
  --discord-bg: rgba(230, 126, 34, 0.15);
  --discord-bg-hover: rgba(230, 126, 34, 0.25);
  --discord-border: rgba(230, 126, 34, 0.4);
  --discord-border-hover: rgba(230, 126, 34, 0.6);
  --discord-glow: rgba(230, 126, 34, 0.2);
}
```

## Typography Override

Within the `[data-theme='tactical']` block, override the global font:

```css
[data-theme='tactical'] {
  --font-ui: 'JetBrains Mono', 'Fira Code', monospace;
}
```

All UI text switches to monospace. The `--font-mono` token is already JetBrains Mono.

## Panel Style Overrides

Add tactical-specific overrides in `src/app/globals.css` scoped to `[data-theme='tactical']`:

```css
[data-theme='tactical'] .glass-panel,
[data-theme='tactical'] .sidebar,
[data-theme='tactical'] .header,
[data-theme='tactical'] .bottom-panel,
[data-theme='tactical'] .entity-info-card {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
}
```

This strips glassmorphism and rounded corners from all major panels when Tactical is active.

## Decorative HUD Elements

### Corner Brackets

Add a CSS utility class `.hud-corners` in `globals.css`:

```css
[data-theme='tactical'] .hud-corners {
  position: relative;
}
[data-theme='tactical'] .hud-corners::before,
[data-theme='tactical'] .hud-corners::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: var(--accent-amber);
  border-style: solid;
}
[data-theme='tactical'] .hud-corners::before {
  top: -1px;
  left: -1px;
  border-width: 1px 0 0 1px;
}
[data-theme='tactical'] .hud-corners::after {
  bottom: -1px;
  right: -1px;
  border-width: 0 1px 1px 0;
}
```

Apply `hud-corners` class to sidebar panels and the bottom panel in their JSX.

### Scanline Overlay (Optional, Toggleable)

Add a `.tactical-scanlines` overlay class:

```css
[data-theme='tactical'] .tactical-scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  z-index: 1;
}
```

Apply to the globe container in `AppShell.tsx` when theme is tactical.

## Theme Registration

### uiSlice.ts

Update the theme type union to include `'tactical'`:

- Line 39: `theme: "dark" | "light" | "legacy" | "black" | "tactical";`
- Line 69: `setTheme: (theme: "dark" | "light" | "legacy" | "black" | "tactical") => void;`
- Line 122: Add `"tactical"` to the localStorage cast type
- Cycle order in `toggleTheme`: add `"tactical"` between `"dark"` and `"black"` (or at end)

### Header.tsx

Add tactical to the THEMES array (line 38-43):

```ts
const THEMES = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "black", label: "Black", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "legacy", label: "Legacy", icon: Monitor },
    { id: "tactical", label: "Tactical", icon: Crosshair },
] as const;
```

Import `Crosshair` from `lucide-react`. Add the icon rendering case in the theme button (lines 153-156 and 284-287):

```tsx
{theme === "tactical" && <Crosshair size={16} />}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/styles/theme-tokens.css` | Add `[data-theme='tactical']` block (~30 lines) |
| `src/app/globals.css` | Add tactical panel overrides + `.hud-corners` + `.tactical-scanlines` (~40 lines) |
| `src/core/state/uiSlice.ts` | Add `'tactical'` to theme type union (4 locations) |
| `src/components/layout/Header.tsx` | Add tactical to THEMES array + icon rendering (3 locations) |
| `src/components/panels/LayerPanel.tsx` | Add `hud-corners` class to panel wrapper |
| `src/components/panels/DataConfig/index.tsx` | Add `hud-corners` class to panel wrapper |
| `src/components/layout/BottomPanelManager.tsx` | Add `hud-corners` class to panel wrapper |
| `src/components/layout/AppShell.tsx` | Conditionally add `tactical-scanlines` class to globe container |

## Scope Exclusions

- No new components
- No layout changes
- No state management changes beyond theme type
- No new dependencies
- Decorative HUD elements are CSS-only, applied via existing class attributes
- Scanline overlay is opt-in via class, not forced on all panels
