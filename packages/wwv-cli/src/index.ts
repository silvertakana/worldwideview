#!/usr/bin/env node
import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

program
  .name('wwv')
  .description('WorldWideView Plugin CLI')
  .version('1.0.0');

program.addCommand(createCommand);
program.addCommand(publishCommand);

program.parse(process.argv);
