import { Command } from 'commander';
import { saveConfig } from '../utils/config.js';

export const configCommand = new Command('config')
  .description('Manage WWV CLI configuration')
  .argument('<action>', 'Action to perform (e.g., set)')
  .argument('<key>', 'Config key (e.g., org)')
  .argument('<value>', 'Config value (e.g., your-username)')
  .action((action, key, value) => {
    if (action !== 'set') {
      console.error(`[wwv-cli] Unknown config action: ${action}`);
      process.exit(1);
    }

    if (key === 'org') {
      saveConfig({ org: value });
      console.log(`[wwv-cli] Successfully set default organization to @${value}`);
    } else {
      console.error(`[wwv-cli] Unknown config key: ${key}. Valid keys: org`);
      process.exit(1);
    }
  });
