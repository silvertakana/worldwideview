import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';

export const createCommand = new Command('create')
  .description('Interactively scaffold a new WorldWideView plugin')
  .option('-c, --core', 'Create inside packages instead of local-plugins (for core contributors)')
  .action(async (options) => {
    const response = await prompts([
      {
        type: 'text',
        name: 'pluginId',
        message: 'What is the unique ID for your plugin? (e.g. my-tracker)',
        validate: value => value.length > 0 ? true : 'Plugin ID is required'
      },
      {
        type: 'text',
        name: 'displayName',
        message: 'What is the display name? (e.g. My Live Tracker)',
        initial: (prev: string) => prev.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      },
      {
        type: 'text',
        name: 'description',
        message: 'Enter a short description:'
      },
      {
        type: 'select',
        name: 'category',
        message: 'Which category does this plugin belong to?',
        choices: [
          { title: 'Aviation (Plane icon)', value: 'aviation' },
          { title: 'Maritime (Ship icon)', value: 'maritime' },
          { title: 'Space (Satellite icon)', value: 'space' },
          { title: 'Weather (Cloud icon)', value: 'weather' },
          { title: 'Custom (Box icon)', value: 'custom' }
        ]
      },
      {
        type: 'select',
        name: 'architecture',
        message: 'How will your plugin receive data?',
        choices: [
          { title: 'REST Polling / Static Data (Frontend only)', value: 'polling' },
          { title: 'Real-Time WebSockets (Generates backend seeder)', value: 'websocket' }
        ]
      },
      {
        type: (prev: string) => prev === 'websocket' ? 'select' : null,
        name: 'seederTier',
        message: 'Which tier should your backend seeder belong to?',
        choices: [
          { title: 'Community (Open data, shared)', value: 'community' },
          { title: 'Private (Requires API keys, restricted)', value: 'private' }
        ]
      },
      {
        type: 'select',
        name: 'renderStyle',
        message: 'How should entities be rendered on the 3D globe?',
        choices: [
          { title: '2D Billboard (Great for static icons)', value: 'billboard' },
          { title: '3D Model with LOD (Transitions 2D to 3D)', value: 'model' },
          { title: 'Simple Point (High performance dots)', value: 'point' }
        ]
      }
    ]);

    if (!response.pluginId) {
      console.log('Plugin creation cancelled.');
      return;
    }

    const { pluginId, displayName, description, category, architecture, seederTier, renderStyle } = response;

    const targetBaseDir = options.core ? 'packages' : 'local-plugins';
    const pluginDir = path.join(process.cwd(), targetBaseDir, `wwv-plugin-${pluginId}`);

    if (fs.existsSync(pluginDir)) {
      console.error(`Error: Directory ${pluginDir} already exists.`);
      process.exit(1);
    }

    fs.mkdirSync(pluginDir, { recursive: true });

    // Determine category icon
    const iconMap: Record<string, string> = {
      aviation: 'Plane',
      maritime: 'Ship',
      space: 'Satellite',
      weather: 'Cloud',
      custom: 'Box'
    };
    const defaultIcon = iconMap[category] || 'Box';

    // Package.json boilerplate
    const streamUrlField = architecture === 'websocket' 
      ? `\n    "streamUrl": "wss://dataenginev2.worldwideview.dev/stream",` 
      : '';
      
    const packageJsonContent = `{
  "name": "@worldwideview/wwv-plugin-${pluginId}",
  "version": "1.0.0",
  "description": "${description}",
  "main": "dist/frontend.mjs",
  "module": "dist/frontend.mjs",
  "exports": {
    ".": {
      "import": "./dist/frontend.mjs",
      "require": "./dist/frontend.mjs"
    }
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@worldwideview/wwv-plugin-sdk": "latest"
  },
  "worldwideview": {
    "pluginId": "${pluginId}",
    "name": "${displayName}",
    "description": "${description}",
    "icon": "${defaultIcon}",
    "category": "${category}",${streamUrlField}
    "author": "Your Name",
    "dev_entry": "src/index.ts",
    "format": "bundle"
  }
}
`;

    // index.ts boilerplate
    const renderBoilerplate = {
      billboard: `return {
      type: 'billboard',
      iconUrl: '/icons/default.png',
      iconScale: 1.0,
      color: '#ffffff'
    };`,
      model: `return {
      type: 'billboard', // Placeholder for LOD logic, update to 3D model path when zoomed
      iconUrl: '/icons/default.png',
      iconScale: 1.0,
      modelUrl: '/models/default.glb', // Advanced LOD
      color: '#ffffff'
    };`,
      point: `return {
      type: 'point',
      color: '#ff0000',
      size: 8,
      outlineColor: '#ffffff',
      outlineWidth: 2
    };`
    }[renderStyle as string] || `return {};`;

    const fetchBoilerplate = architecture === 'polling' 
      ? `\n  async fetch(): Promise<GeoEntity[]> {
    // Implement REST polling logic here
    return [];
  }\n` 
      : '';

    const indexTsContent = `import { WorldPlugin, GeoEntity, CesiumEntityOptions } from '@worldwideview/wwv-plugin-sdk';

export default class ${pluginId.replace(/-/g, '')}Plugin implements WorldPlugin {
  id = '${pluginId}';
  name = '${displayName}';

  async initialize(context: any): Promise<void> {
    console.log('${displayName} initialized.');
  }

  getPollingInterval(): number {
    return ${architecture === 'polling' ? '10000' : '0'}; // ${architecture === 'polling' ? '10 seconds' : '0 for WebSockets'}
  }
${fetchBoilerplate}
  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    ${renderBoilerplate}
  }

  renderHUD(entity: GeoEntity): string {
    return \`<div>
      <h3>\${entity.id}</h3>
      <p>Data provided by ${displayName}</p>
    </div>\`;
  }
}
`;

    fs.writeFileSync(path.join(pluginDir, 'package.json'), packageJsonContent);
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'src', 'index.ts'), indexTsContent);

    console.log(`\n✅ Successfully created plugin frontend at ${pluginDir}`);

    // Generate seeder backend if requested
    if (architecture === 'websocket' && seederTier) {
      const seederDir = path.join(process.cwd(), 'local-seeders', seederTier, pluginId);
      
      if (!fs.existsSync(seederDir)) {
        fs.mkdirSync(seederDir, { recursive: true });
        
        const seederContent = `// WWV Data Engine Seeder for ${pluginId}
export default async function run(context) {
  console.log('Starting ${displayName} seeder...');
  
  // Example: Emit a mock entity to the engine
  setInterval(() => {
    context.emit({
      id: '${pluginId}-mock-1',
      lat: 0,
      lng: 0,
      alt: 10000,
      heading: 0,
      velocity: 250,
      properties: {
        status: 'active'
      }
    });
  }, 1000);
}
`;
        fs.writeFileSync(path.join(seederDir, 'seeder.mjs'), seederContent);
        console.log(`✅ Successfully created plugin seeder at ${seederDir}`);
      }
    }

    console.log(`\nNext steps:
1. Run \`pnpm install\` from the project root.
2. Edit \`index.ts\` in your plugin directory.
${architecture === 'websocket' ? '3. Edit `seeder.mjs` in your local-seeders directory.' : ''}
`);
  });
