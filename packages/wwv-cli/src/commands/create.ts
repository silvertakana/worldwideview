/* eslint-disable no-console */
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';

const VALID_CATEGORIES = ['aviation', 'maritime', 'space', 'weather', 'custom'];
const VALID_ARCHITECTURES = ['polling', 'websocket'];
const VALID_SEEDER_TIERS = ['community', 'private'];
const VALID_RENDER_STYLES = ['billboard', 'model', 'point'];

interface CreateOptions {
  core?: boolean;
  displayName?: string;
  description?: string;
  category?: string;
  architecture?: string;
  seederTier?: string;
  renderStyle?: string;
  yes?: boolean;
}

function assertChoice(label: string, value: string | undefined, valid: string[]): void {
  if (value !== undefined && !valid.includes(value)) {
    console.error(`Error: invalid --${label} "${value}". Valid values: ${valid.join(', ')}`);
    process.exit(1);
  }
}

export const createCommand = new Command('create')
  .description('Scaffold a new WorldWideView plugin (flags skip the matching prompt; omit them for interactive mode)')
  .argument('[pluginId]', 'Unique kebab-case plugin ID (e.g. my-tracker)')
  .option('-c, --core', 'Create inside packages instead of local-plugins (for core contributors)')
  .option('-n, --display-name <name>', 'Display name (e.g. "My Live Tracker")')
  .option('-d, --description <text>', 'Short description')
  .option('--category <category>', `One of: ${VALID_CATEGORIES.join(', ')}`)
  .option('--architecture <architecture>', `One of: ${VALID_ARCHITECTURES.join(', ')}`)
  .option('--seeder-tier <tier>', `One of: ${VALID_SEEDER_TIERS.join(', ')} (websocket only)`)
  .option('--render-style <style>', `One of: ${VALID_RENDER_STYLES.join(', ')}`)
  .option('-y, --yes', 'Non-interactive: fail instead of prompting for missing values')
  .action(async (pluginIdArg: string | undefined, options: CreateOptions) => {
    // Validate any flags supplied up front so we fail fast and consistently.
    assertChoice('category', options.category, VALID_CATEGORIES);
    assertChoice('architecture', options.architecture, VALID_ARCHITECTURES);
    assertChoice('seeder-tier', options.seederTier, VALID_SEEDER_TIERS);
    assertChoice('render-style', options.renderStyle, VALID_RENDER_STYLES);

    // Build the prompt list, skipping any value already supplied via flag/arg.
    // In --yes mode we never prompt; missing required values are an error.
    const promptList: prompts.PromptObject[] = [];

    if (!pluginIdArg) {
      promptList.push({
        type: 'text',
        name: 'pluginId',
        message: 'What is the unique ID for your plugin? (e.g. my-tracker)',
        validate: value => value.length > 0 ? true : 'Plugin ID is required',
      });
    }
    if (options.displayName === undefined) {
      promptList.push({
        type: 'text',
        name: 'displayName',
        message: 'What is the display name? (e.g. My Live Tracker)',
        initial: pluginIdArg
          ? pluginIdArg.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : undefined,
      });
    }
    if (options.description === undefined) {
      promptList.push({ type: 'text', name: 'description', message: 'Enter a short description:' });
    }
    if (options.category === undefined) {
      promptList.push({
        type: 'select',
        name: 'category',
        message: 'Which category does this plugin belong to?',
        choices: [
          { title: 'Aviation (Plane icon)', value: 'aviation' },
          { title: 'Maritime (Ship icon)', value: 'maritime' },
          { title: 'Space (Satellite icon)', value: 'space' },
          { title: 'Weather (Cloud icon)', value: 'weather' },
          { title: 'Custom (Box icon)', value: 'custom' },
        ],
      });
    }
    if (options.architecture === undefined) {
      promptList.push({
        type: 'select',
        name: 'architecture',
        message: 'How will your plugin receive data?',
        choices: [
          { title: 'REST Polling / Static Data (Frontend only)', value: 'polling' },
          { title: 'Real-Time WebSockets (Generates backend seeder)', value: 'websocket' },
        ],
      });
    }
    if (options.seederTier === undefined) {
      promptList.push({
        // Only ask about seeder tier when architecture resolves to websocket.
        type: (_prev, values) => {
          const arch = options.architecture ?? values.architecture;
          return arch === 'websocket' ? 'select' : null;
        },
        name: 'seederTier',
        message: 'Which tier should your backend seeder belong to?',
        choices: [
          { title: 'Community (Open data, shared)', value: 'community' },
          { title: 'Private (Requires API keys, restricted)', value: 'private' },
        ],
      });
    }
    if (options.renderStyle === undefined) {
      promptList.push({
        type: 'select',
        name: 'renderStyle',
        message: 'How should entities be rendered on the 3D globe?',
        choices: [
          { title: '2D Billboard (Great for static icons)', value: 'billboard' },
          { title: '3D Model with LOD (Transitions 2D to 3D)', value: 'model' },
          { title: 'Simple Point (High performance dots)', value: 'point' },
        ],
      });
    }

    if (options.yes && promptList.length > 0) {
      // Only count prompts that would actually fire. seederTier is irrelevant
      // unless the resolved architecture is websocket, so a polling plugin with
      // --yes must not be forced to supply it.
      const missing = promptList
        .map(p => p.name as string)
        .filter(name => (name === 'seederTier' ? options.architecture === 'websocket' : true));
      if (missing.length > 0) {
        console.error(`Error: --yes given but these required values are missing: ${missing.join(', ')}`);
        process.exit(1);
      }
    }

    const answers = promptList.length > 0 ? await prompts(promptList) : {};

    // Merge flags/args (authoritative) over interactive answers.
    const pluginId: string | undefined = pluginIdArg ?? answers.pluginId;
    const displayName: string = options.displayName ?? answers.displayName ?? '';
    const description: string = options.description ?? answers.description ?? '';
    const category: string = options.category ?? answers.category;
    const architecture: string = options.architecture ?? answers.architecture;
    const seederTier: string | undefined = options.seederTier ?? answers.seederTier;
    const renderStyle: string = options.renderStyle ?? answers.renderStyle;

    if (!pluginId) {
      console.log('Plugin creation cancelled.');
      return;
    }

    const targetBaseDir = options.core ? 'packages' : 'local-plugins';
    const pluginDir = path.join(process.cwd(), targetBaseDir, `wwv-plugin-${pluginId}`);

    if (fs.existsSync(pluginDir)) {
      console.error(`Error: Directory ${pluginDir} already exists.`);
      process.exit(1);
    }

    fs.mkdirSync(pluginDir, { recursive: true });

    const iconMap: Record<string, string> = {
      aviation: 'Plane',
      maritime: 'Ship',
      space: 'Satellite',
      weather: 'Cloud',
      custom: 'Box',
    };
    const defaultIcon = iconMap[category] || 'Box';

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
    };`,
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

    // Generate seeder backend if requested. Matches the real community/private
    // seeder layout: local-seeders/<tier>/packages/<pluginId>/ with a tsup build
    // and a src/index.ts that exports the canonical { name, cron, fn } shape.
    if (architecture === 'websocket' && seederTier) {
      const seederDir = path.join(process.cwd(), 'local-seeders', seederTier, 'packages', pluginId);

      if (fs.existsSync(seederDir)) {
        console.error(`Warning: Seeder directory ${seederDir} already exists. Skipping seeder scaffold.`);
      } else {
        fs.mkdirSync(path.join(seederDir, 'src'), { recursive: true });

        const seederPackageJson = `{
  "name": "@wwv-seeders/${pluginId}",
  "version": "1.0.0",
  "main": "dist/index.mjs",
  "scripts": {
    "build": "tsup"
  },
  "dependencies": {
    "@worldwideview/seeder-sdk": "^1.0.0"
  }
}
`;

        const tsupConfig = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  shims: true,
  noExternal: [/@wwv-seeders\\/.*/],
  external: [/^(?!@wwv-seeders)[a-z@].*/],
});
`;

        // The seeder's exported `name` MUST equal the frontend plugin id
        // (kebab-case). See ADR-0002 / data-engine-architecture.md section 6.
        const seederIndexTs = `import { setLiveSnapshot, fetchWithTimeout, withRetry } from '@worldwideview/seeder-sdk';

async function seed${pluginId.replace(/-/g, '')}() {
  // TODO: fetch from the real data source and map into GeoEntity-shaped items.
  const items: Array<{ id: string; lat: number; lon: number; name: string }> = [];

  await setLiveSnapshot('${pluginId}', {
    source: '${pluginId}',
    fetchedAt: new Date().toISOString(),
    items,
    totalCount: items.length,
  }, 3600);
}

export default {
  name: '${pluginId}', // MUST match the frontend plugin id exactly (kebab-case)
  cron: '*/15 * * * *',
  fn: seed${pluginId.replace(/-/g, '')},
};
`;

        fs.writeFileSync(path.join(seederDir, 'package.json'), seederPackageJson);
        fs.writeFileSync(path.join(seederDir, 'tsup.config.ts'), tsupConfig);
        fs.writeFileSync(path.join(seederDir, 'src', 'index.ts'), seederIndexTs);
        console.log(`✅ Successfully created plugin seeder at ${seederDir}`);
      }
    }

    console.log(`\nNext steps:
1. Run \`pnpm install\` from the project root.
2. Edit \`src/index.ts\` in your plugin directory.
${architecture === 'websocket' && seederTier ? `3. Edit \`src/index.ts\` in local-seeders/${seederTier}/packages/${pluginId}/, then \`pnpm build\` it.` : ''}
`);
  });
