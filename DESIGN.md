# Design System: PLTR Beta
**Project ID:** local-worldwideview-app

## 1. Visual Theme & Atmosphere
PLTR Beta renders a **flat, dense, instrument-panel** interface over the 3D globe, modelled on Palantir's Foundry Map / Gotham tooling and their Blueprint design system. Panels are opaque surfaces with 1px borders and tight 2–4px radii; emphasis comes from a single intent blue and typographic hierarchy, not from glow or blur. The globe stays the hero; the chrome reads as a tool, not a card.

Reference material (not shipped): Palantir Foundry Map documentation screenshots (`palantir.com/docs/foundry/map/*`) and the Blueprint `@blueprintjs/colors` palette.

The previous glassmorphism treatment survives only as the **Legacy** theme (`[data-theme='legacy']`), which re-enables `backdrop-filter` and large radii through tokens.

## 2. Color Palette & Roles
Tokens live in `src/styles/theme-tokens.css`. The default theme is **Foundry Light** (Blueprint light ramp: `#f6f7f9` canvas, white panels, `#1c2127` text, `#2d72d2` intent blue) over the Esri Light Gray Canvas basemap with the star field and atmosphere switched off, so the globe floats on a flat grey field like Foundry's map. **Foundry Dark** uses the Blueprint dark ramp:

* **Black** (`#111418`) - `--bg-primary`: canvas behind the app shell.
* **Dark Gray 1** (`#1c2127`) - `--bg-glass` / `--bg-secondary`: opaque panel, header and dialog surface.
* **Dark Gray 2/3** (`#252a31` / `#2f343c`) - `--bg-glass-hover` / `--bg-glass-active`: hover and pressed states.
* **Divider White** (`rgba(255,255,255,0.2)`) - `--border-subtle`: every panel edge and row divider.
* **Light Gray 5** (`#f6f7f9`) - `--text-primary`; **Gray 5** (`#c5cbd3`) - `--text-secondary`; **Gray 4** (`#abb3bf`) - `--text-muted`.
* **Blue 4** (`#4c90f0`) - `--accent-cyan` (intent primary): active tabs, toggles, scrubber, selected rows. `--glow-cyan` is a 1px intent ring, never a diffuse glow.
* **Green 4** (`#32a467`), **Orange 4** (`#ec9a3c`), **Red 4** (`#e76a6e`) - success / warning / danger intents.

The application bar is a docked 48px strip with a coloured app tile flush left (Foundry's square icon); panels float 12px from the edges with 4px corners.

## 3. Typography Rules
The system uses a dual-font strategy to balance clean user interfaces with technical precision.

* **UI Font (Source Sans 3):** Used for all general interface elements, headers, and buttons (Foundry's UI face; falls back to the system stack). 
  * Headers and brand elements use a bold `600/700` weight with tight letter-spacing (`-0.02em`) for a sleek, modern feel.
  * Section titles, keys, and subtitles use a very small size (`11px`), a medium weight, uppercase transformation, and wide letter-spacing (`0.05em` to `0.1em`) to mimic aerospace or military HUD interfaces.
* **Monospace Font (JetBrains Mono):** Used strictly for data values, coordinates, telemetry, and exact timestamps (`11px` to `12px`). Ensures tabular alignment, clear distinction between similar characters (e.g., 0 and O), and technical precision.

## 4. Component Stylings

* **Glass Panels (Cards/Containers):** 
  * **Shape:** Generously rounded corners (`16px` / `var(--radius-lg)`).
  * **Surface:** Dense frosted background blur (`24px`).
  * **Depth:** Elevated significantly above the map using a dual-layered drop shadow (`0 8px 32px rgba(0, 0, 0, 0.4)` combined with `0 2px 8px rgba(0, 0, 0, 0.2)`). Features a crisp inner border (`inset 0 1px 1px rgba(255, 255, 255, 0.1)`) to simulate physical glass thickness.
* **Buttons:**
  * **Shape:** Subtly rounded corners (`12px` / `var(--radius-md)`) with a standard height of `36px`.
  * **Surface:** Translucent glass background with a subtle border.
  * **Behavior:** Smooth, spring-based transitions. On hover, the background brightens, the element scales up/translates slightly (`translateY(-1px)`), and primary buttons emit a vivid neon glow. On click (active), buttons physically depress (`scale(0.97)`).
* **Tabs & Selectors:**
  * **Shape:** Softly rounded (`8px` / `var(--radius-sm)`).
  * **Surface:** Clean, flat, and transparent by default.
  * **Behavior:** Transitions to a soft glass hover or active state. Active tabs use a highlighted background (`rgba(var(--accent-rgb), 0.1)`) and bright cyan text with increased font weight.
* **Timeline Scrubber:**
  * **Track:** Slender `4px` tall track with softly rounded edges.
  * **Handle:** A circular `14px` handle that emits a cyan glow, expanding dynamically on hover (`scale(1.2)`).

## 5. Layout Principles
* **Absolute Overlays:** The UI does not push the map; instead, it floats over a full-screen, `z-index: 0` globe canvas. Elements are anchored to the edges (Header to top, Sidebar to sides, Timeline to bottom).
* **Strict 4/8dp Rhythm:** All spacing adheres to an 8-point grid base (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
* **Dynamic Containment:** Sidebars and bottom panels push each other dynamically to prevent overlap and optimize map visibility (e.g., when the bottom panel opens, sidebars slide upward).
* **Whitespace & Density:** Panels use a dense `16px` padding globally to maximize the amount of intelligence data visible while maintaining clear breathing room between individual data rows. Scrollable areas hide scrollbars until hovered to maintain the clean glass aesthetic.
