<!-- Generated: 2026-04-23 20:29:00 UTC -->
# End-to-End Tutorial: Building a Real-Time ISS Tracking Plugin

Welcome! This tutorial is designed for complete beginners. If you have never built a WorldWideView plugin before, you are in the right place. 

By following these steps exactly, you will build a complete, real-time International Space Station (ISS) tracker from scratch. You will learn how to set up your environment, stream live data using a backend seeder, render it in 3D on the globe, and publish your work to the world.

Let's get started.

---

## Step 1: Setting up your Workspace

Before we write any code, we need to prepare your computer. We will install the required tools and download the two main repositories that make up the WorldWideView platform.

### 1.1 Install Prerequisites

Ensure you have the following installed on your machine:
1. **Node.js**: Download and install [Node.js](https://nodejs.org/) (Version 18 or higher is required).
2. **Git**: Download and install [Git](https://git-scm.com/).
3. **pnpm**: This is the package manager we use. Open your terminal and run:
   ```bash
   npm install -g pnpm
   ```

### 1.2 Clone the Repository

You only need the main WorldWideView application. The data engine backend will run automatically via Docker. Open your terminal and navigate to the folder where you want to store your code (e.g., `C:\dev`).

Run this command to download the code:
```bash
git clone https://github.com/silvertakana/worldwideview.git
```

### 1.3 Install Dependencies

Next, install dependencies for the main WorldWideView application:
```bash
cd worldwideview
pnpm install
```

### 1.4 Setup Environment Variables

WorldWideView needs a few basic configuration keys to run. 

While still in the `worldwideview` folder, run the automated setup script. This will generate a `.env.local` file with the necessary secrets:
```bash
pnpm run setup
```

Your workspace is now ready!

---

## Step 2: Creating the Data Engine Seeder (Backend)

The ISS moves incredibly fast. If our frontend tries to ask for its location every second, it will lag. Instead, we use the **Bring Your Own Backend (BYOB)** pattern. We will write a "Seeder" script in the Data Engine that fetches the ISS location and instantly broadcasts it to the frontend via WebSockets.

### 2.1 Let's build a dedicated Seeder to poll the Open Notify ISS API. Note that seeders are organized into `community` or `private` tiers to prevent collisions.

1. **Create the Seeder Folder:** Under your WorldWideView repository root, create `local-seeders/community/wwv-iss-tracker/`. Inside that folder, create a file named `seeder.mjs`:
`c:\dev\worldwideview\local-seeders\community\wwv-iss-tracker\seeder.mjs`

> [!NOTE]
> **Dependency Management:** You do *not* need to create a `package.json` or manually install standard dependencies (like `axios`) for your seeder. The `wwv-data-engine-v2` runner dynamically resolves these via the pnpm workspace, keeping your seeder lightweight.

### 2.2 Write the Polling Logic

Open `seeder.mjs` in your text editor and paste the following code. The Data Engine Runner will dynamically discover this script and execute its `fetch(ctx)` function based on the interval you define.

```javascript
// seeder.mjs
const WTIA_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

export default {
  // Required: the unique namespace used by your plugin
  id: "iss",
  
  // Define polling interval inside the seeder
  intervalMs: 5000, 
  
  // The Data Engine will call this function every intervalMs
  async fetch(ctx) {
    const { axios, logger } = ctx;
    
    try {
      // 1. Fetch data from the API
      const response = await axios.get(WTIA_URL);
      const data = response.data;
      
      // 2. Format the data into a GeoEntity array
      const entities = [{
        id: "25544",
        name: "International Space Station",
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude * 1000, // Convert kilometers to meters
        velocity: data.velocity,
        visibility: data.visibility,
        footprint: data.footprint
      }];
      
      logger.info(`[ISS] Poll OK: updated position to ${data.latitude}, ${data.longitude}`);
      
      // 3. Return the array of entities, the engine runner will broadcast it over WebSockets
      return entities;
      
    } catch (error) {
      logger.error(`[ISS] Polling error: ${error.message}`);
      return [];
    }
  }
};
```

---

## Step 3: Testing the Data Engine

Before we build the frontend, let's prove that our backend is actually fetching the ISS data.

### 3.1 Start the Engine

In your terminal, navigate to the `worldwideview` folder and start the entire stack using Docker Compose:
```bash
pnpm dev:all
```
Wait for the Data Engine Docker container to start. You should see `[ISS] Poll OK: updated position` appearing in the terminal logs every 5 seconds. Leave this terminal running.

---

## Step 4: Creating the WorldWideView Plugin (Frontend)

Now we will build the visual part of the plugin that connects to our backend stream and draws the ISS on the 3D globe.

### 4.1 Scaffold the Plugin

In your terminal, navigate to your main `worldwideview` folder. We will use the workspace CLI tool to generate a blank plugin template in the local sandboxes folder. Run:

```bash
node packages/wwv-cli/dist/index.js create wwv-plugin-iss --local
pnpm install
```

This creates your plugin at `local-plugins/wwv-plugin-iss` and automatically registers it with the workspace.

### 4.2 Write the Plugin Logic

Open `c:\dev\worldwideview\local-plugins\wwv-plugin-iss\src\index.ts` in your text editor. Replace everything in the file with this code:

```typescript
import type { WorldPlugin, GeoEntity, PluginContext, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";

export class IssPlugin implements WorldPlugin {
  // The ID MUST match the namespace we used in the backend ('iss')
  id = "iss"; 
  name = "ISS Live Tracker";
  description = "Real-time International Space Station tracking.";
  icon = "Satellite"; 
  category = "space" as const;
  version = "1.0.0";

  async initialize(ctx: PluginContext): Promise<void> {
    console.log("ISS Plugin loaded!");
  }

  destroy(): void { }

  async fetch(): Promise<GeoEntity[]> {
    // We return an empty array because the WebSockets handle the data automatically.
    return [];
  }

  getPollingInterval(): number {
    return 0; // Disabled: we use continuous WebSockets instead of polling.
  }

  getLayerConfig(): LayerConfig {
    return {
      color: "#00ffcc",
      clusterEnabled: false
    };
  }

  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    // Level of Detail (LOD): Use a 2D billboard from far away, 
    // and transition to a 3D model when zooming in close.
    return {
      type: "billboard",
      color: "#ffffff",
      iconUrl: "https://unpkg.com/wwv-plugin-iss/assets/iss-icon.png",
      iconScale: 0.8,
      modelUrl: "https://unpkg.com/wwv-plugin-iss/assets/ISS_stationary.glb",
      modelScale: 2.5,
      heading: entity.heading || 0,
    };
  }
}
```

---

## Step 5: Connecting and Testing Everything

Now we will link your new plugin to your local WorldWideView application to see it in action.

### 5.1 Develop Your Plugin

Because your plugin is located in `local-plugins/wwv-plugin-iss`, it is automatically detected by the workspace. 
You do not need to link it manually.

Since you already started the whole stack (`pnpm dev:all`) in Step 3, the `dev:plugins` watcher is already running in the background. It will automatically build your frontend plugin code whenever you save changes.

### 5.2 View the ISS

1. Open your web browser and go to `http://localhost:3000`.
2. Click the **Layers** icon on the left sidebar.
3. Find **ISS Live Tracker** in the list and toggle it ON.
4. The globe will instantly fly to the current location of the ISS, and you will see it moving in real-time!

> [!TIP]
> **Troubleshooting missing points:**
> - Ensure your `pnpm dev:all` terminal is still running without errors.
> - Press `F12` in your browser to open Developer Tools. Check the `Console` tab for any red errors.
> - Ensure the `id` in your plugin (`"iss"`) exactly matches the `id` defined in `seeder.mjs`.

---

## Step 6: Publishing Your Plugin

You've built it, now share it with the world! 

### 6.1 Update package.json

Open `c:\dev\worldwideview\local-plugins\wwv-plugin-iss\package.json`. You must add a `"worldwideview"` metadata block so the marketplace knows how to read your plugin. Ensure your file looks like this:

```json
{
  "name": "wwv-plugin-iss",
  "version": "1.0.0",
  "main": "dist/index.js",
  "worldwideview": {
    "id": "iss",
    "name": "ISS Live Tracker",
    "version": "1.0.0",
    "icon": "Satellite",
    "category": "space"
  },
  "scripts": { ... }
}
```

### 6.2 Publish to NPM

In your plugin terminal, log in to NPM and publish your package:
```bash
npm login
npm publish --access public
```

### 6.3 Submit to the Marketplace

1. Go to the official marketplace at `https://marketplace.worldwideview.dev/submit`.
2. Type in your package name (`wwv-plugin-iss`) and click submit.
3. The system will automatically verify your code. Once approved, any WorldWideView user on the planet can click "Install" to add your ISS tracker to their globe.

**Congratulations!** You have successfully navigated the entire stack, from API polling and WebSockets to 3D rendering and global publishing.
