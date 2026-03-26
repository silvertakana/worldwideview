# Setup & Installation

Follow these steps to set up your development environment and get WorldWideView running locally.

## Requirements

- **Node.js**: v18.17 or higher (tested on v20+)
- **NPM**: v9 or higher
- **Browser**: Chrome, Firefox, or Edge (CesiumJS requires WebGL support)

## Environment Setup

Run the setup script to auto-generate `.env.local` with a secure `AUTH_SECRET`:

```bash
npm run setup
```

This copies `.env.example` → `.env.local` and fills in `AUTH_SECRET` automatically. You can then optionally add API keys for enhanced features (Cesium Ion, Bing Maps, OpenSky, etc.).

> [!NOTE]
> `AUTH_SECRET` must remain stable across restarts. The setup script generates it once and writes it to `.env.local`. Never commit `.env.local` to git.

## Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Generate environment file** (first time only):
   ```bash
   npm run setup
   ```

3. **Start Dev Server**:
   ```bash
   npm run dev
   ```

4. **Open Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

## Folder Structure Explanation

Understanding the project layout:

```text
worldwideview/
├── .agents/             # Agentic AI workflows and memory
├── docs/                # Project documentation (Markdowns)
├── public/              # Static assets (Imagery, GeoJSON, Cesium dependencies)
├── scripts/             # Build and utility scripts (e.g., copy-cesium.mjs)
└── src/
    ├── app/             # Next.js App Router (Layouts, Pages, API Routes)
    ├── components/      # React UI components (HUD, LayersPanel, Panels)
    ├── core/            # Core engine logic
    │   ├── data/        # Data management (DataBus, Polling, Cache)
    │   ├── globe/       # Cesium-specific hooks and view logic
    │   └── plugins/     # Plugin system base and registry
    ├── lib/             # Utility libraries and server-side polling
    └── plugins/         # Feature-specific plugins (Aviation, Maritime, etc.)
```

## Verification

To verify your setup:
1. Ensure the globe loads without errors in the console.
2. Check if the "Aviation" layer is visible in the Layers Panel.
3. Verify that the HUD (top bar) displays live camera coordinates.

---

> [!IMPORTANT]
> If you encounter issues with hot reloading (HMR), ensure you are running with the `--webpack` flag in the dev script (this is the default in our `package.json`).
