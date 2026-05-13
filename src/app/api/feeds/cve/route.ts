import { NextResponse } from 'next/server';
import { getOrRefreshCveFeedItems } from '@/lib/cve/cveFeedCache';

export const revalidate = 3600;

export async function GET() {
  try {
    const items = await getOrRefreshCveFeedItems();
    return NextResponse.json({ count: items.length, items });
  } catch (err) {
    console.error('[CVE feed]', err);
    return NextResponse.json({ count: 0, items: [], error: String(err) }, { status: 503 });
  }
}
