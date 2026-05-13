import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import { getConfig, saveConfig } from '../utils/config.js';

export const publishCommand = new Command('publish')
  .description('Publish the plugin to NPM and notify the WWV Marketplace')
  .argument('[pluginName]', 'Name of the plugin to publish (if running from root)')
  .option('--org <orgName>', 'NPM organization to publish to (e.g., your-username)')
  .action(async (pluginName, options) => {
    console.log('[wwv-cli] Preparing to publish plugin...');
    let cwd = process.cwd();

    // If pluginName is provided, try to find the plugin directory
    if (pluginName) {
      const rootLocalPath = path.join(cwd, 'local-plugins', pluginName);
      const rootWwvLocalPath = path.join(cwd, 'local-plugins', `wwv-plugin-${pluginName}`);
      const packagesPath = path.join(cwd, 'packages', pluginName);
      const packagesWwvPath = path.join(cwd, 'packages', `wwv-plugin-${pluginName}`);
      
      if (fs.existsSync(rootWwvLocalPath)) {
        cwd = rootWwvLocalPath;
      } else if (fs.existsSync(rootLocalPath)) {
        cwd = rootLocalPath;
      } else if (fs.existsSync(packagesWwvPath)) {
        cwd = packagesWwvPath;
      } else if (fs.existsSync(packagesPath)) {
        cwd = packagesPath;
      } else {
        console.error(`[wwv-cli] Error: Could not find plugin '${pluginName}' in local-plugins or packages.`);
        process.exit(1);
      }
      console.log(`[wwv-cli] Found plugin at: ${cwd}`);
    }

    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
      console.error('[wwv-cli] Error: No package.json found in directory: ' + cwd);
      process.exit(1);
    }

    try {
      const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      if (!pkgContent.worldwideview) {
        console.error('[wwv-cli] Error: package.json is missing the "worldwideview" manifest block. Is this a WWV plugin?');
        process.exit(1);
      }

      let originalName = pkgContent.name;
      let publishedName = originalName;

      // Determine organization
      let targetOrg = options.org;
      const config = getConfig();

      if (!targetOrg) {
        if (config.org) {
          targetOrg = config.org;
          console.log(`[wwv-cli] Using default organization from config: @${targetOrg}`);
        } else {
          // Fallback to NPM whoami if possible
          try {
            const whoami = execSync('npm whoami', { stdio: 'pipe' }).toString().trim();
            targetOrg = whoami;
          } catch (e) {
            // Not logged in or errored, ignore
          }

          const response = await prompts({
            type: 'text',
            name: 'org',
            message: 'What NPM organization/username do you want to publish under?',
            initial: targetOrg || '',
            validate: value => value.length > 0 ? true : 'Organization is required'
          });

          if (!response.org) {
            console.log('Publish cancelled.');
            return;
          }

          targetOrg = response.org;
          saveConfig({ org: targetOrg });
          console.log(`[wwv-cli] Saved @${targetOrg} as your default organization.`);
        }
      } else {
        // Save the explicitly passed org as the new default
        saveConfig({ org: targetOrg });
      }

      if (targetOrg) {
        const orgPrefix = targetOrg.startsWith('@') ? targetOrg : `@${targetOrg}`;
        const baseName = originalName.startsWith('@') ? originalName.split('/')[1] : originalName;
        publishedName = `${orgPrefix}/${baseName}`;
        
        if (originalName !== publishedName) {
          pkgContent.name = publishedName;
          fs.writeFileSync(pkgPath, JSON.stringify(pkgContent, null, 2) + '\n');
          console.log(`[wwv-cli] Updated package name to ${publishedName}`);
        }
      }

      console.log(`[wwv-cli] Publishing ${publishedName}@${pkgContent.version} to NPM...`);
      
      // Execute npm publish
      execSync('npm publish --access public', { stdio: 'inherit', cwd });
      
      console.log('[wwv-cli] Successfully published to NPM!');
      console.log('[wwv-cli] To submit this plugin to the WorldWideView Marketplace, please visit: https://marketplace.worldwideview.dev/submit');
      console.log(`[wwv-cli] Package Name: ${publishedName}`);

    } catch (err: any) {
      console.error('[wwv-cli] Error during publish:', err.message);
      process.exit(1);
    }
  });
