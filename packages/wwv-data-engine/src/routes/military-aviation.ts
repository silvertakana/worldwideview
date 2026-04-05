import { fastify } from '../server';
import { db } from '../db';
import { getLiveSnapshot } from '../redis';

fastify.get('/data/military-aviation', async (request: any, reply) => {
  try {
    const { lookback, time } = request.query;

    // Historical playback mode snapshot
    if (time && typeof time === 'string') {
      const targetTs = Math.floor(parseInt(time, 10) / 1000);
      const historyQuery = db.prepare(`
        SELECT hex, ts, lat, lon, hdg, spd, alt
        FROM military_aviation_history
        WHERE ts BETWEEN @start AND @end
      `);
      const historyRows = historyQuery.all({
        start: targetTs - 60,
        end: targetTs + 60,
      }) as any[];

      const closest = new Map();
      for (const r of historyRows) {
        const prev = closest.get(r.hex);
        if (!prev || Math.abs(r.ts - targetTs) < Math.abs(prev.ts - targetTs)) {
          closest.set(r.hex, { ...r, on_ground: r.alt <= 0 });
        }
      }

      return {
        source: 'military-aviation',
        fetchedAt: new Date().toISOString(),
        lookbackSeconds: 0,
        ac: Array.from(closest.values()),
        totalCount: closest.size,
      };
    }

    // Parse lookback (e.g., "15m" -> 900s, "1h" -> 3600s)
    let lookbackSeconds = 0;
    if (lookback && typeof lookback === 'string') {
      const match = lookback.match(/^(\d+)([hm])$/);
      if (match) {
        const val = parseInt(match[1], 10);
        lookbackSeconds = match[2] === 'h' ? val * 3600 : val * 60;
      }
    }

    // Get live fleet from Redis and filter by freshness
    const fleetObj = (await getLiveSnapshot('military-aviation')) || {};
    const activeFleet = Object.values(fleetObj) as any[];
    const nowTs = Math.floor(Date.now() / 1000);
    const maxAge = lookbackSeconds > 0 ? lookbackSeconds : 3600;
    const items = activeFleet.filter(
      (plane) => nowTs - plane.last_updated <= maxAge
    );

    return {
      source: 'military-aviation',
      fetchedAt: new Date().toISOString(),
      lookbackSeconds: lookbackSeconds || null,
      ac: items,
      totalCount: items.length,
    };
  } catch (err: any) {
    console.error('[MilitaryAviation Route] ERROR:', err?.message || err);
    reply.status(500).send({ error: 'Internal error', message: err?.message });
  }
});
