import type { FeedItem } from '@/app/api/feeds/texas/route';
import { extractTagIds, mergeSitesForCveBlob, tagLabels } from '@/lib/cve/matcher';

interface NvdCpeMatch {
  criteria: string;
  vulnerable: boolean;
}

interface NvdNode {
  cpeMatch?: NvdCpeMatch[];
  children?: NvdNode[];
}

interface NvdCve {
  id: string;
  descriptions: { lang: string; value: string }[];
  published: string;
  metrics?: {
    cvssMetricV31?: { type: string; cvssData: { baseScore: number; baseSeverity: string } }[];
    cvssMetricV30?: { type: string; cvssData: { baseScore: number; baseSeverity: string } }[];
  };
  configurations?: { nodes: NvdNode[] }[];
}

function nvdDateParam(d: Date): string {
  return d.toISOString().slice(0, 23);
}

function extractCpeText(cve: NvdCve): string {
  const parts: string[] = [];
  const walkNodes = (nodes: NvdNode[]) => {
    for (const node of nodes) {
      for (const match of node.cpeMatch ?? []) parts.push(match.criteria);
      if (node.children) walkNodes(node.children);
    }
  };
  for (const config of cve.configurations ?? []) walkNodes(config.nodes);
  return parts.join(' ');
}

function cveScore(cve: NvdCve): number {
  const v31 = cve.metrics?.cvssMetricV31;
  const v30 = cve.metrics?.cvssMetricV30;
  if (v31?.length) return (v31.find((m) => m.type === 'Primary') ?? v31[0]).cvssData.baseScore;
  if (v30?.length) return (v30.find((m) => m.type === 'Primary') ?? v30[0]).cvssData.baseScore;
  return 0;
}

async function fetchNvdAll(start: Date, end: Date): Promise<NvdCve[]> {
  const apiKey = process.env.NVD_API_KEY;
  const qs = new URLSearchParams({
    pubStartDate: nvdDateParam(start),
    pubEndDate: nvdDateParam(end),
    resultsPerPage: '2000',
    startIndex: '0',
  });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'WorldWideView/1.0 (contact@worldwideview.co)',
  };
  if (apiKey) headers.apiKey = apiKey;

  const res = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?${qs}`, { headers });
  if (!res.ok) throw new Error(`NVD ${res.status}`);
  const data = await res.json();
  return ((data.vulnerabilities ?? []) as { cve: NvdCve }[]).map((v) => v.cve);
}

interface GhAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  description: string;
  severity: string;
  published_at: string;
  html_url: string;
  cvss?: { score: number };
  vulnerabilities?: { package?: { ecosystem?: string; name?: string } }[];
}

async function fetchGitHubAdvisories(): Promise<GhAdvisory[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'WorldWideView/1.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/advisories?type=reviewed&per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub Advisory ${res.status}`);
  return res.json();
}

function severityFromScore(score: number): FeedItem['severity'] {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'warning';
  return 'info';
}

function nvdCveToFeedItem(cve: NvdCve): FeedItem | null {
  const desc = cve.descriptions.find((d) => d.lang === 'en')?.value ?? '';
  const cpeText = extractCpeText(cve);
  const blob = `${desc} ${cpeText}`;

  const tagIds = extractTagIds(blob);
  const sites = mergeSitesForCveBlob(blob);
  if (sites.length === 0) return null;

  const score = cveScore(cve);
  const siteNames = sites.map((s) => s.name);
  const impactedSiteIds = sites.map((s) => s.siteId);

  return {
    id: `cve-${cve.id}`,
    title: cve.id,
    url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
    publishedAt: cve.published,
    source: 'NVD',
    category: 'cve',
    summary: desc,
    severity: severityFromScore(score),
    cveId: cve.id,
    cvssScore: score > 0 ? score : undefined,
    affectedTech: tagLabels(tagIds),
    impactedSites: siteNames,
    impactedSiteIds,
  };
}

function githubAdvisoryCvss(adv: GhAdvisory): number {
  if (adv.cvss?.score != null && adv.cvss.score > 0) return adv.cvss.score;
  const s = String(adv.severity ?? '').toLowerCase();
  if (s === 'critical') return 9.5;
  if (s === 'high') return 8;
  if (s === 'medium' || s === 'moderate') return 5;
  if (s === 'low') return 3;
  return 0;
}

function ghAdvisoryToFeedItem(adv: GhAdvisory): FeedItem | null {
  const pkgText = (adv.vulnerabilities ?? [])
    .map((v) => `${v.package?.ecosystem ?? ''} ${v.package?.name ?? ''}`)
    .join(' ');
  const blob = `${adv.summary} ${adv.description} ${pkgText}`;

  const tagIds = extractTagIds(blob);
  const sites = mergeSitesForCveBlob(blob);
  if (sites.length === 0) return null;

  const score = githubAdvisoryCvss(adv);
  const id = adv.cve_id ?? adv.ghsa_id;

  return {
    id: `cve-gh-${adv.ghsa_id}`,
    title: id,
    url: adv.html_url,
    publishedAt: adv.published_at,
    source: 'GitHub Advisory',
    category: 'cve',
    summary: adv.description || adv.summary,
    severity: severityFromScore(score),
    cveId: id,
    cvssScore: score > 0 ? score : undefined,
    affectedTech: tagLabels(tagIds),
    impactedSites: sites.map((s) => s.name),
    impactedSiteIds: sites.map((s) => s.siteId),
  };
}

function sevRank(s: FeedItem['severity'] | undefined): number {
  if (s === 'critical') return 3;
  if (s === 'warning') return 2;
  return 1;
}

function mergeDuplicateCve(a: FeedItem, b: FeedItem): FeedItem {
  const ids = new Set([...(a.impactedSiteIds ?? []), ...(b.impactedSiteIds ?? [])]);
  const names = new Set([...(a.impactedSites ?? []), ...(b.impactedSites ?? [])]);
  const cvss = Math.max(a.cvssScore ?? 0, b.cvssScore ?? 0);
  const merged: FeedItem = { ...a };
  merged.impactedSiteIds = [...ids];
  merged.impactedSites = [...names];
  merged.cvssScore = cvss > 0 ? cvss : undefined;
  if (cvss > 0) merged.severity = severityFromScore(cvss);
  else if (sevRank(b.severity) > sevRank(a.severity)) merged.severity = b.severity;

  const tech = new Set([...(a.affectedTech ?? []), ...(b.affectedTech ?? [])]);
  merged.affectedTech = tech.size > 0 ? [...tech] : undefined;

  return merged;
}

export async function buildCveItems(): Promise<FeedItem[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [nvdResult, ghResult] = await Promise.allSettled([
    fetchNvdAll(thirtyDaysAgo, now),
    fetchGitHubAdvisories(),
  ]);

  const nvdItems = (nvdResult.status === 'fulfilled' ? nvdResult.value : [])
    .map(nvdCveToFeedItem)
    .filter((x): x is FeedItem => x !== null);

  const ghItems = (ghResult.status === 'fulfilled' ? ghResult.value : [])
    .map(ghAdvisoryToFeedItem)
    .filter((x): x is FeedItem => x !== null);

  const byKey = new Map<string, FeedItem>();
  for (const item of [...nvdItems, ...ghItems]) {
    const key = item.cveId ?? item.id;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, { ...item });
    else byKey.set(key, mergeDuplicateCve(existing, item));
  }

  const merged = [...byKey.values()];

  return merged
    .sort((a, b) => {
      const dayA = a.publishedAt.slice(0, 10);
      const dayB = b.publishedAt.slice(0, 10);
      if (dayA !== dayB) return dayB.localeCompare(dayA);
      return (b.cvssScore ?? 0) - (a.cvssScore ?? 0);
    })
    .slice(0, 200);
}
