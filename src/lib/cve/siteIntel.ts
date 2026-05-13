import type { FeedItem } from '@/app/api/feeds/texas/route';

export const CVE_HEAT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export function inferCvssNorm(item: FeedItem): number {
  if (item.cvssScore != null && item.cvssScore > 0) return Math.min(item.cvssScore / 10, 1);
  if (item.severity === 'critical') return 0.9;
  if (item.severity === 'warning') return 0.72;
  return 0.38;
}

export function computeCveHeatForSite(items: FeedItem[], siteId: string, now = Date.now()): number {
  let maxN = 0;
  let sumN = 0;
  let count = 0;
  for (const item of items) {
    if (item.category !== 'cve') continue;
    if (!item.impactedSiteIds?.includes(siteId)) continue;
    const t = new Date(item.publishedAt).getTime();
    if (Number.isNaN(t) || now - t > CVE_HEAT_WINDOW_MS || t > now + 60_000) continue;
    const n = inferCvssNorm(item);
    maxN = Math.max(maxN, n);
    sumN += n;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.min(1, maxN * 0.55 + Math.min(1, sumN / 6) * 0.35 + Math.min(1, count / 6) * 0.1);
}

export function heatToBillboardTint(heat: number): string {
  const t = Math.max(0, Math.min(1, heat));
  const cold = [59, 130, 246];
  const hot = [127, 29, 29];
  const r = Math.round(cold[0] + (hot[0] - cold[0]) * t);
  const g = Math.round(cold[1] + (hot[1] - cold[1]) * t);
  const b = Math.round(cold[2] + (hot[2] - cold[2]) * t);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function cvesTouchingSites(items: FeedItem[], siteIds: Set<string>, limit = 50): FeedItem[] {
  return items
    .filter((i) => i.category === 'cve' && i.impactedSiteIds?.some((id) => siteIds.has(id)))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
