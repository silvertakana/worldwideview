# Setup & Installation

Follow these steps to set up your development environment and get WorldWideView running locally.

## Requirements

- **Node.js**: v18.17 or higher (tested on v20+)
- **NPM**: v9 or higher
- **Browser**: Chrome, Firefox, or Edge (CesiumJS requires WebGL support)

## Environment Setup

WorldWideView requires several API keys to function correctly. Create a `.env.local` file in the root directory:

```env
# Cesium Ion Access Token (Required for terrain and default imagery)
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here

# Bing Maps API Key (Optional, for high-res imagery)
NEXT_PUBLIC_BING_MAPS_KEY=your_key_here

# Supabase Configuration (Required for persistence and historical data)
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   *Note: Our `dev` script automatically runs `predev` to copy Cesium assets to the public directory.*

3. **Open Browser**:
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
