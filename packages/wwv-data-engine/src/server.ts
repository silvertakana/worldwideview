import Fastify from 'fastify';
import { initDB } from './db';
import { startScheduler } from './scheduler';
import { seederStatus } from './scheduler';

// Boot Fastify
export const fastify = Fastify({
  logger: false // Keep it clean for the console
});

import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import { handleConnection } from './websocket';

fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

fastify.register(fastifyWebsocket);

fastify.register(async function (fastify) {
  fastify.get('/stream', { websocket: true }, (connection: any, req) => {
    handleConnection(connection, req);
  });
});

const PORT = parseInt(process.env.PORT || '5001', 10);

fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    engine: 'wwv-data-engine',
    timestamp: Date.now(),
    seeders: seederStatus
  };
});

async function start() {
  try {
    // 1. Initialize SQLite Database
    initDB();

    // 2. Register Routes
    await import('./routes/index.js');

    // 3. Start the Fastify API Server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] WWV Data Engine listening on port ${PORT}`);

    // 3. Import seeder registry (this registers them)
    await import('./seeders/index.js');

    // 4. Start the Cron Scheduler
    startScheduler();

  } catch (err) {
    console.error('[Server] Fatal error starting server:', err);
    process.exit(1);
  }
}

start();
