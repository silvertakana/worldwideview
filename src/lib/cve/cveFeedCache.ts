import type { FeedItem } from '@/app/api/feeds/texas/route';
import { buildCveItems } from '@/lib/cve/cveAggregator';

let memCache: { items: FeedItem[]; ts: number } | null = null;
const MEM_CACHE_TTL = 55 * 60 * 1000;

export async function getOrRefreshCveFeedItems(): Promise<FeedItem[]> {
  const now = Date.now();
  if (memCache && now - memCache.ts < MEM_CACHE_TTL) return memCache.items;
  try {
    const items = await buildCveItems();
    memCache = { items, ts: now };
    return items;
  } catch {
    if (memCache && memCache.items.length > 0) return memCache.items;
    throw new Error('CVE feed unavailable');
  }
}
