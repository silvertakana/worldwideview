# @worldwideview/wwv-cli

The official Command Line Interface for scaffolding and publishing WorldWideView plugins.

## Usage

This CLI is designed to be run from within the `worldwideview` monorepo.

### 1. Scaffold a new plugin
```bash
node packages/wwv-cli/dist/index.js create
```
This command generates a new plugin directory with a boilerplate `index.ts` and `package.json` configured for the WorldWideView plugin architecture inside the `local-plugins/` directory.

*(Note: To create a built-in plugin inside `packages/` instead, use the `--core` flag).*

### 2. Publish a plugin
Once your plugin is ready for release, you can publish it to NPM. You can do this from within the plugin directory or directly from the project root.

**From the plugin directory:**
```bash
cd local-plugins/<plugin-name>
npm login
node ../../packages/wwv-cli/dist/index.js publish
```

**From the project root:**
You can also run the CLI from the root by providing the plugin name:
```bash
node packages/wwv-cli/dist/index.js publish <plugin-name>
```

**Custom NPM Organizations:**
By default, plugins are scaffolded under the `@worldwideview` NPM scope. To publish to your own organization, use the `--org` flag:
```bash
node packages/wwv-cli/dist/index.js publish <plugin-name> --org my-username
```
This will permanently update your `package.json` to use `@my-username` and publish the package.

The publish command verifies that your `package.json` contains the required `"worldwideview"` manifest block and invokes `npm publish --access public`.

## Development

To re-compile the CLI during development:
```bash
pnpm --filter @worldwideview/wwv-cli run build
```
