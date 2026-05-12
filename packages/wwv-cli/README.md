# @worldwideview/wwv-cli

The official Command Line Interface for scaffolding and publishing WorldWideView plugins.

## Usage

This CLI is designed to be run from within the `worldwideview` monorepo.

### 1. Scaffold a new plugin
```bash
node packages/wwv-cli/dist/index.js create <plugin-name> --local
```
This command generates a new plugin directory with a boilerplate `index.ts` and `package.json` configured for the WorldWideView plugin architecture inside the `local-plugins/` directory.

### 2. Publish a plugin
Once your plugin is ready for release, navigate into your plugin directory and publish it to NPM:

```bash
cd local-plugins/<plugin-name>
npm login
node ../../packages/wwv-cli/dist/index.js publish
```
The publish command verifies that your `package.json` contains the required `"worldwideview"` manifest block and invokes `npm publish --access public`.

## Development

To re-compile the CLI during development:
```bash
pnpm --filter @worldwideview/wwv-cli run build
```
