import cron from 'node-cron';
import { pruneHistoryTables } from './db';

// Define the interface for a seeder definition
export interface SeederDefinition {
  name: string;
  cron?: string;        // Optional: Cron expression if it runs on a schedule
  fn?: () => Promise<void>; // Optional: Function to run on the cron schedule
  init?: () => void;    // Optional: Initialization function (e.g., for websockets)
}

// Registry to hold all registered seeders
let registeredSeeders: SeederDefinition[] = [];

// Registry to track the last run time of each cron seeder
export const seederStatus: Record<string, number | null> = {};

/**
 * Register a seeder to be scheduled when the engine boots.
 */
export function registerSeeder(seeder: SeederDefinition) {
  registeredSeeders.push(seeder);
  if (seeder.cron) {
    seederStatus[seeder.name] = null;
  }
}

/**
 * Start the scheduler. Initializes websocket listeners and registers cron jobs.
 */
export function startScheduler() {
  console.log('[Scheduler] Starting data engine scheduler...');
  
  for (const seeder of registeredSeeders) {
    // 1. Run init handlers (like websocket listeners)
    if (seeder.init) {
      console.log(`[Scheduler] Initializing persistent seeder: ${seeder.name}`);
      seeder.init();
    }
    
    // 2. Schedule cron jobs
    if (seeder.cron && seeder.fn) {
      console.log(`[Scheduler] Scheduling cron seeder: ${seeder.name} (${seeder.cron})`);
      
      cron.schedule(seeder.cron, async () => {
        try {
          console.log(`[Scheduler] Running seeder: ${seeder.name} ...`);
          await seeder.fn!();
          seederStatus[seeder.name] = Date.now();
        } catch (error: any) {
          console.error(`[Scheduler] Seeder ${seeder.name} failed:`, error.message);
        }
      });
      
      // Kick off the first run immediately for cron jobs
      console.log(`[Scheduler] Kickstarting initial run for ${seeder.name}...`);
      seeder.fn().then(() => {
        seederStatus[seeder.name] = Date.now();
      }).catch((err) => {
        console.error(`[Scheduler] Initial run for ${seeder.name} failed:`, err.message);
      });
    }
  }

  // Data retention: prune old history rows every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Running data retention pruning...');
    pruneHistoryTables();
  });
}
