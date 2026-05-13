import { TAG_MAP } from './taxonomy';
import { SITE_TAGS, type SiteTagEntry } from './siteTags';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match tracked sites when the operator name appears in advisory text (fills gaps vs tag-only overlap). */
export function matchSitesByOperatorName(text: string): SiteTagEntry[] {
  const lower = text.toLowerCase();
  const out: SiteTagEntry[] = [];
  const seen = new Set<string>();
  for (const s of SITE_TAGS) {
    const primary = s.name.split('(')[0].trim();
    if (!primary) continue;
    const pl = primary.toLowerCase();
    const words = pl.split(/\s+/).filter(Boolean);
    let matched = false;
    if (words.length >= 2) {
      if (lower.includes(pl)) matched = true;
    } else {
      const w = words[0];
      if (w.length < 5) continue;
      const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'i');
      if (re.test(text)) matched = true;
    }
    if (matched && !seen.has(s.siteId)) {
      seen.add(s.siteId);
      out.push(s);
    }
  }
  return out;
}

export function mergeSitesForCveBlob(blob: string): SiteTagEntry[] {
  const tagIds = extractTagIds(blob);
  const fromTags = matchSitesForTagIds(tagIds);
  const fromNames = matchSitesByOperatorName(blob);
  const m = new Map<string, SiteTagEntry>();
  for (const s of [...fromTags, ...fromNames]) m.set(s.siteId, s);
  return [...m.values()];
}

/** Extract tag IDs from a blob of text (CVE description + CPE criteria). */
export function extractTagIds(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const tag of TAG_MAP.values()) {
    if (tag.matchPatterns.some((p) => lower.includes(p))) {
      matched.push(tag.id);
    }
  }
  return matched;
}

/** Return sites whose tech stack overlaps with the given tag IDs. */
export function matchSitesForTagIds(tagIds: string[]): SiteTagEntry[] {
  if (tagIds.length === 0) return [];
  const tagSet = new Set(tagIds);
  return SITE_TAGS.filter((s) => s.tags.some((t) => tagSet.has(t)));
}

/** Human-readable labels for a list of tag IDs. Skips unknown IDs. */
export function tagLabels(tagIds: string[]): string[] {
  return tagIds
    .map((id) => TAG_MAP.get(id)?.label)
    .filter((l): l is string => l !== undefined);
}
