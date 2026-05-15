# Design System: WorldWideView
**Project ID:** local-worldwideview-app

## 1. Visual Theme & Atmosphere
The WorldWideView platform employs an **"Airy, High-Tech, and Geospatial-Focused"** aesthetic. The design philosophy centers around "Glassmorphism Pro Max"—keeping the user's primary focus on the rich, underlying 3D globe visualization while providing highly legible, structured, and floating Heads-Up Display (HUD) elements. 

The mood is utilitarian yet premium, heavily relying on dense background blurring, delicate inner borders, and vibrant glowing accent states to establish depth, interactivity, and a sense of "live" intelligence.

## 2. Color Palette & Roles
WorldWideView operates using a multi-theme architecture (Default Dark, Pure Black, Legacy OLED, and Light). The core semantic roles for the **Default Dark Theme** are outlined below:

* **Obsidian Canvas** (`#171717`) - `--bg-primary`: The foundational layer behind the application shell and globe.
* **Translucent Slate Glass** (`rgba(38, 38, 38, 0.85)`) - `--bg-glass`: The primary background for floating HUD panels, sidebars, and dialogs. Provides a frosted glass effect that allows the map to bleed through.
* **Frost White** (`#ffffff`) - `--text-primary`: Primary typography for headers, active states, and high-emphasis data.
* **Muted Ash** (`#a3a3a3`) - `--text-muted`: Secondary typography used for labels, subtitles, and inactive states to establish visual hierarchy.
* **Gossamer Edge** (`rgba(255, 255, 255, 0.15)`) - `--border-subtle`: Defines the subtle, crisp edges of glass panels, dividers, and default button states.
* **Starlight Cyan** (`#ffffff` / *Legacy:* `#22d3ee`) - `--accent-cyan`: Used for primary actions, active tabs, timeline scrubbers, and play buttons. Often paired with a diffuse glow (`0 0 24px rgba(255, 255, 255, 0.15)`) for emphasis and technical flair.
* **Telemetry Green** (`#22c55e`) - `--accent-green`: Used for live status indicators, pulsing connectivity badges, and positive data deltas.
* **Warning Amber** (`#f59e0b`) - `--accent-amber`: Used for warnings, "Alpha" badges, or unavailable data states.

## 3. Typography Rules
The system uses a dual-font strategy to balance clean user interfaces with technical precision.

* **UI Font (Inter):** Used for all general interface elements, headers, and buttons. 
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
