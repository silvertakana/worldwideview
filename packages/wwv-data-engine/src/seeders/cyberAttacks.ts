import { db } from '../db';
import { setLiveSnapshot } from '../redis';
import { fetchWithTimeout, withRetry } from '../seed-utils';
import { registerSeeder } from '../scheduler';
import { geolocateIp } from '../geoip';

const OTX_BASE = 'https://otx.alienvault.com/api/v1';

const insertCyberAttack = db.prepare(
  'INSERT OR REPLACE INTO cyber_attacks (id, payload, source_ts, fetched_at) VALUES (@id, @payload, @source_ts, @fetched_at)'
);

interface OtxIndicator {
  id: number;
  indicator: string;
  type: string;
  title: string;
  description: string;
}

interface OtxPulse {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  adversary: string;
  targeted_countries: string[];
  attack_ids: { id: string; name: string }[];
  malware_families: string[];
  indicators: OtxIndicator[];
  tags: string[];
}

export async function seedCyberAttacks() {
  const apiKey = process.env.OTX_API_KEY;
  if (!apiKey) {
    console.warn('[CyberAttacks] OTX_API_KEY not set — skipping.');
    return;
  }

  console.log('[CyberAttacks] Polling AlienVault OTX...');

  // Fetch pulses modified in the last 48 hours
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const url = `${OTX_BASE}/pulses/subscribed?modified_since=${since}&limit=50`;

  const res = await withRetry(async () => {
    try {
      return await fetchWithTimeout(url, {
        headers: { 'X-OTX-API-KEY': apiKey, 'User-Agent': 'WWV-Data-Engine' },
      });
    } catch(err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CyberAttacks] Fetch error details:', msg);
      throw err;
    }
  });
  const data = await res.json();

  if (!data?.results || !Array.isArray(data.results)) {
    console.warn('[CyberAttacks] Invalid OTX response');
    return;
  }

  const pulses: OtxPulse[] = data.results;
  const fetchedAt = Date.now();
  const items: any[] = [];
  const seenIps = new Set<string>();

  for (const pulse of pulses) {
    // Extract only IPv4 indicators
    const ipIndicators = (pulse.indicators || []).filter(
      (ind) => ind.type === 'IPv4'
    );

    for (const ind of ipIndicators) {
      if (seenIps.has(ind.indicator)) continue;
      seenIps.add(ind.indicator);

      const geo = geolocateIp(ind.indicator);
      if (!geo) continue; // Skip un-geolocatable IPs

      const threatType = classifyThreat(pulse);
      const item = {
        id: `otx-${pulse.id}-${ind.id}`,
        ip: ind.indicator,
        lat: geo.lat,
        lon: geo.lon,
        country: geo.country,
        city: geo.city,
        threatType,
        adversary: pulse.adversary || 'Unknown',
        pulseName: pulse.name,
        pulseDescription: pulse.description?.slice(0, 300) || '',
        malwareFamilies: pulse.malware_families || [],
        tags: pulse.tags?.slice(0, 5) || [],
        targetedCountries: pulse.targeted_countries || [],
        pulseId: pulse.id,
        pulseCreated: pulse.created,
        pulseModified: pulse.modified,
      };

      items.push(item);

      // Persist to SQLite
      insertCyberAttack.run({
        id: item.id,
        payload: JSON.stringify(item),
        source_ts: new Date(pulse.modified).getTime(),
        fetched_at: fetchedAt,
      });
    }
  }

  console.log(
    `[CyberAttacks] Processed ${pulses.length} pulses → ${items.length} geolocated indicators.`
  );

  // Save to Redis
  await setLiveSnapshot(
    'cyber_attacks',
    {
      source: 'cyber_attacks',
      fetchedAt: new Date().toISOString(),
      items,
      totalCount: items.length,
    },
    7200 // 2 hour TTL
  );
}

function classifyThreat(pulse: OtxPulse): string {
  const tags = (pulse.tags || []).map((t) => t.toLowerCase());
  const name = pulse.name.toLowerCase();
  const desc = (pulse.description || '').toLowerCase();
  const combined = [...tags, name, desc].join(' ');

  if (combined.includes('apt') || combined.includes('advanced persistent'))
    return 'APT';
  if (combined.includes('ransomware')) return 'Ransomware';
  if (combined.includes('botnet')) return 'Botnet';
  if (combined.includes('phishing')) return 'Phishing';
  if (combined.includes('ddos')) return 'DDoS';
  if (combined.includes('malware') || combined.includes('trojan'))
    return 'Malware';
  if (combined.includes('c2') || combined.includes('command and control'))
    return 'C2 Server';
  return 'Other';
}

registerSeeder({
  name: 'cyber_attacks',
  cron: '0 */2 * * *', // Every 2 hours
  fn: seedCyberAttacks,
});
