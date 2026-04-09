import { db } from '../db';
import { setLiveSnapshot } from '../redis';
import { fetchWithTimeout, withRetry } from '../seed-utils';
import { registerSeeder } from '../scheduler';

/**
 * ACLED API response record for protest/riot events.
 * Fields documented at https://acleddata.com/resources/general-guides/
 */
interface ACLEDEvent {
  event_id_cnty: string;
  event_date: string;
  year: number;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2: string;
  country: string;
  location: string;
  latitude: string;
  longitude: string;
  fatalities: string;
  source: string;
  notes: string;
}

interface ACLEDResponse {
  status: number;
  success: boolean;
  count: number;
  data: ACLEDEvent[];
}

const ACLED_BASE = 'https://api.acleddata.com/acled/read';

/**
 * Fetches a single page from ACLED API.
 * Returns parsed ACLEDResponse or null on failure.
 */
async function fetchACLEDPage(page: number): Promise<ACLEDResponse | null> {
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!apiKey || !email) {
    console.warn('[CivilUnrest] ACLED_API_KEY or ACLED_EMAIL not set — skipping fetch.');
    return null;
  }

  // Fetch protests and riots from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateAfter = thirtyDaysAgo.toISOString().split('T')[0];

  const params = new URLSearchParams({
    key: apiKey,
    email: email,
    event_type: 'Protests',
    event_date: dateAfter,
    event_date_where: '>=',
    limit: '5000',
    page: String(page),
  });

  // ACLED separates Protests and Riots as distinct event_types.
  // We fetch Protests here; Riots are fetched in a second call.
  const url = `${ACLED_BASE}?${params.toString()}`;
  const res = await withRetry(() => fetchWithTimeout(url, {}, 30000));
  return await res.json() as ACLEDResponse;
}

/**
 * Fetches both Protests and Riots from ACLED, paginating as needed.
 */
async function fetchAllACLEDEvents(): Promise<ACLEDEvent[]> {
  const allEvents: ACLEDEvent[] = [];

  for (const eventType of ['Protests', 'Riots']) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const apiKey = process.env.ACLED_API_KEY;
      const email = process.env.ACLED_EMAIL;
      if (!apiKey || !email) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateAfter = thirtyDaysAgo.toISOString().split('T')[0];

      const params = new URLSearchParams({
        key: apiKey,
        email: email,
        event_type: eventType,
        event_date: dateAfter,
        event_date_where: '>=',
        limit: '5000',
        page: String(page),
      });

      const url = `${ACLED_BASE}?${params.toString()}`;

      try {
        const res = await withRetry(() => fetchWithTimeout(url, {}, 30000));
        const json = await res.json() as ACLEDResponse;

        if (!json.success || !json.data || json.data.length === 0) {
          hasMore = false;
          break;
        }

        allEvents.push(...json.data);
        console.log(`[CivilUnrest] Fetched page ${page} of ${eventType}: ${json.data.length} events`);

        // ACLED returns max 5000 per page. If we got less, we're done.
        hasMore = json.data.length >= 5000;
        page++;
      } catch (err: any) {
        console.error(`[CivilUnrest] Failed to fetch ${eventType} page ${page}:`, err.message);
        hasMore = false;
      }
    }
  }

  return allEvents;
}

const insertStmt = db.prepare(
  'INSERT OR REPLACE INTO civil_unrest (id, payload, source_ts, fetched_at) VALUES (@id, @payload, @source_ts, @fetched_at)'
);

export async function fetchCivilUnrest() {
  console.log('[CivilUnrest] Fetching from ACLED API...');

  const events = await fetchAllACLEDEvents();
  if (events.length === 0) {
    console.warn('[CivilUnrest] No events returned from ACLED.');
    return;
  }

  const fetchedAt = Date.now();
  let inserted = 0;

  // Transform ACLED records into our standard format
  const items = events
    .filter(e => {
      const lat = parseFloat(e.latitude);
      const lon = parseFloat(e.longitude);
      return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
    })
    .map(e => ({
      id: e.event_id_cnty,
      lat: parseFloat(e.latitude),
      lon: parseFloat(e.longitude),
      type: e.event_type,
      subType: e.sub_event_type,
      actor1: e.actor1 || 'Unknown',
      actor2: e.actor2 || '',
      fatalities: parseInt(e.fatalities, 10) || 0,
      country: e.country,
      location: e.location,
      date: e.event_date,
      source: e.source || 'ACLED',
      notes: e.notes || '',
    }));

  // Persist to SQLite
  const insertMany = db.transaction((rows: typeof items) => {
    for (const item of rows) {
      const sourceTs = new Date(item.date).getTime() || fetchedAt;
      const result = insertStmt.run({
        id: item.id,
        payload: JSON.stringify(item),
        source_ts: sourceTs,
        fetched_at: fetchedAt,
      });
      if (result.changes > 0) inserted++;
    }
  });

  insertMany(items);
  console.log(`[CivilUnrest] Saved ${inserted} events to SQLite.`);

  // Cache to Redis for live endpoint
  await setLiveSnapshot('civil_unrest', {
    source: 'civil_unrest',
    fetchedAt: new Date().toISOString(),
    items,
    totalCount: items.length,
  }, 3600 * 24); // 24h TTL — ACLED updates weekly

  console.log(`[CivilUnrest] Published ${items.length} events to Redis.`);
}

registerSeeder({
  name: 'civilUnrest',
  cron: '0 */12 * * *', // Every 12 hours
  fn: fetchCivilUnrest,
});
