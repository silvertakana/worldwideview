import { NextResponse } from 'next/server';
import { getOrRefreshCveFeedItems } from '@/lib/cve/cveFeedCache';
import { computeCveHeatForSite } from '@/lib/cve/siteIntel';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const siteIds: unknown = body?.siteIds;
    if (!Array.isArray(siteIds)) {
      return NextResponse.json({ heats: {} });
    }
    const ids = siteIds.filter((x): x is string => typeof x === 'string').slice(0, 400);
    if (ids.length === 0) {
      return NextResponse.json({ heats: {} });
    }
    const items = await getOrRefreshCveFeedItems();
    const now = Date.now();
    const heats: Record<string, number> = {};
    for (const id of ids) {
      heats[id] = computeCveHeatForSite(items, id, now);
    }
    return NextResponse.json({ heats });
  } catch (e) {
    console.error('[site-heats]', e);
    return NextResponse.json({ heats: {}, error: String(e) }, { status: 500 });
  }
}
