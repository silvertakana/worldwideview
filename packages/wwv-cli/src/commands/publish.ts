import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export const publishCommand = new Command('publish')
  .description('Publish the plugin to NPM and notify the WWV Marketplace')
  .action(() => {
    console.log('[wwv-cli] Preparing to publish plugin...');
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
      console.error('[wwv-cli] Error: No package.json found in current directory.');
      process.exit(1);
    }

    try {
      const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      if (!pkgContent.worldwideview) {
        console.error('[wwv-cli] Error: package.json is missing the "worldwideview" manifest block. Is this a WWV plugin?');
        process.exit(1);
      }

      console.log(`[wwv-cli] Publishing ${pkgContent.name}@${pkgContent.version} to NPM...`);
      
      // Execute npm publish
      execSync('npm publish --access public', { stdio: 'inherit', cwd });
      
      console.log('[wwv-cli] Successfully published to NPM!');
      console.log('[wwv-cli] To submit this plugin to the WorldWideView Marketplace, please visit: https://marketplace.worldwideview.dev/submit');
      console.log(`[wwv-cli] Package Name: ${pkgContent.name}`);

    } catch (err: any) {
      console.error('[wwv-cli] Error during publish:', err.message);
      process.exit(1);
    }
  });
