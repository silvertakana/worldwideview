import { fastify } from '../server';
import { db } from '../db';
import { getLiveSnapshot } from '../redis';

fastify.get('/data/maritime', async (request: any, reply) => {
  try {
    const { lookback, time } = request.query;

    // Historical playback mode snapshot
    if (time && typeof time === 'string') {
      const targetTs = Math.floor(parseInt(time, 10) / 1000);
      const historyQuery = db.prepare(`
        SELECT mmsi, ts, lat, lon, hdg, spd
        FROM maritime_history
        WHERE ts BETWEEN @start AND @end
      `);
      const historyRows = historyQuery.all({
        start: targetTs - 60,
        end: targetTs + 60,
      }) as any[];

      const closest = new Map();
      for (const r of historyRows) {
        const prev = closest.get(r.mmsi);
        if (!prev || Math.abs(r.ts - targetTs) < Math.abs(prev.ts - targetTs)) {
          closest.set(r.mmsi, r);
        }
      }

      return {
        source: 'maritime',
        fetchedAt: new Date().toISOString(),
        lookbackSeconds: 0,
        items: Array.from(closest.values()),
        totalCount: closest.size,
      };
    }

    // Parse lookback (e.g., "6h" -> seconds)
    let lookbackSeconds = 0;
    if (lookback && typeof lookback === 'string') {
      const match = lookback.match(/^(\d+)([hm])$/);
      if (match) {
        const val = parseInt(match[1], 10);
        lookbackSeconds = match[2] === 'h' ? val * 3600 : val * 60;
      }
    }

    // Get live fleet from Redis and filter by freshness
    const fleetObj = (await getLiveSnapshot('maritime')) || {};
    const activeFleet = Object.values(fleetObj) as any[];
    const nowTs = Math.floor(Date.now() / 1000);
    const maxAge = lookbackSeconds > 0 ? lookbackSeconds : 3600;
    const items = activeFleet.filter(
      (ship) => nowTs - ship.last_updated <= maxAge
    );

    // If lookback was requested, grab history points from SQLite
    if (lookbackSeconds > 0 && items.length > 0) {
      const historyQuery = db.prepare(`
        SELECT mmsi, ts, lat, lon
        FROM maritime_history
        WHERE ts >= @startTs
      `);
      const allHistory = historyQuery.all({ startTs: nowTs - lookbackSeconds }) as any[];

      const historyMap = new Map<string, any[]>();
      for (const row of allHistory) {
        if (!historyMap.has(row.mmsi)) historyMap.set(row.mmsi, []);
        historyMap.get(row.mmsi)!.push({ lat: row.lat, lon: row.lon, ts: row.ts });
      }

      for (const ship of items) {
        const pts = historyMap.get(ship.mmsi);
        if (pts && pts.length > 0) {
          // Sort chronologically ascending
          pts.sort((a, b) => a.ts - b.ts);
          ship.history = pts;
        } else {
          ship.history = [];
        }
      }
    }

    return {
      source: 'maritime',
      fetchedAt: new Date().toISOString(),
      lookbackSeconds: lookbackSeconds || null,
      items,
      totalCount: items.length,
    };
  } catch (err: any) {
    console.error('[Maritime Route] ERROR:', err?.message || err);
    reply.status(500).send({ error: 'Internal error', message: err?.message });
  }
});
