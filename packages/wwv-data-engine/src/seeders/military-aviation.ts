import { db } from '../db';
import { setLiveSnapshot } from '../redis';
import { registerSeeder } from '../scheduler';

const ADSB_LOL_URL = "https://api.adsb.lol/v2/mil";
const POLLING_INTERVAL_MS = 60000;

const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO military_aviation_history (hex, ts, lat, lon, alt, hdg, spd, fetched_at)
    VALUES (@hex, @ts, @lat, @lon, @alt, @hdg, @spd, @fetched_at)
`);

async function pollMilitaryAviation() {
    try {
        const response = await fetch(ADSB_LOL_URL, {
            headers: {
                "User-Agent": "WorldWideView-DataEngine"
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('[MilitaryAviation] 429 Rate Limit hit.');
            }
            throw new Error(`Status ${response.status}`);
        }

        const data = await response.json();
        if (!data.ac || !Array.isArray(data.ac)) return;

        const fetchedAt = Math.floor(Date.now() / 1000);
        const fleetObj: Record<string, any> = Object.create(null);
        let insertedCount = 0;

        const insertMany = db.transaction((aircraft) => {
            for (const ac of aircraft) {
                if (ac.lat == null || ac.lon == null) continue;

                const hex = ac.hex;
                // Some fields might be missing depending on coverage
                const ts = Math.floor((ac.seen_pos != null ? (Date.now() - ac.seen_pos * 1000) : Date.now()) / 1000); // Approximate timestamp based on seen_pos
                const lon = ac.lon;
                const lat = ac.lat;
                const alt = typeof ac.alt_baro === "number" ? ac.alt_baro : 0; 
                const on_ground = ac.alt_baro === "ground";
                const spd = ac.gs || 0;
                const hdg = ac.track || 0;

                // 1. Write History to SQLite
                if (!on_ground) {
                    const result = insertHistory.run({
                        hex, ts, lat, lon, alt, hdg, spd, fetched_at: fetchedAt
                    });
                    if (result.changes > 0) insertedCount++;
                }

                // 2. Prepare Live Cache structure
                fleetObj[hex] = {
                    hex,
                    flight: ac.flight || null,
                    r: ac.r || null,
                    t: ac.t || null,
                    lat,
                    lon,
                    alt_baro: ac.alt_baro,
                    alt_geom: ac.alt_geom,
                    gs: ac.gs,
                    track: ac.track,
                    squawk: ac.squawk,
                    dbFlags: ac.dbFlags,
                    category: ac.category,
                    emergency: ac.emergency,
                    seen: ac.seen,
                    seen_pos: ac.seen_pos,
                    last_updated: fetchedAt
                };
            }
        });

        insertMany(data.ac);

        // Execute Redis batch via compressed snapshot (60 mins to match slow moving or intermittent adsb.lol coverage)
        await setLiveSnapshot('military-aviation', fleetObj, 60 * 60);

    } catch (err: any) {
        console.error(`[MilitaryAviation] Polling Error: ${err.message}`);
    }
}

export function startMilitaryAviationPoller() {
    console.log('[MilitaryAviation] Starting background polling...');
    setInterval(pollMilitaryAviation, POLLING_INTERVAL_MS);
    
    // Initial fetch
    pollMilitaryAviation();
}

registerSeeder({
    name: "military-aviation",
    init: startMilitaryAviationPoller
});
