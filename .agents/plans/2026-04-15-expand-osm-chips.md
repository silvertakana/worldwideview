# Expand OSM Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the available OSM search chips to include a curated list of ~30 pre-loaded OSINT-relevant tags, and add a live Taginfo API autocomplete search to dynamically find and select any of the millions of other OSM tags.

**Architecture:** We will replace the current small `COMMON_TAGS` array with a richer, categorized list inside the `OSMSidebar` file. To allow access to "all" tags without crashing the UI, we will add a debounced fetch hook that hits `https://taginfo.openstreetmap.org/api/4/tags/popular` (or the equivalent search endpoint) when the user types in the filter box. These dynamically fetched tags will temporarily populate the chip list.

**Tech Stack:** React, TypeScript, Taginfo API

---

### Task 1: Update Pre-Loaded COMMON_TAGS

**Files:**
- Modify: `c:\dev\worldwideview\packages\wwv-plugin-osm-search\src\components\OSMSidebar.tsx:6-11`

- [ ] **Step 1: Replace existing COMMON_TAGS array**

```tsx
const COMMON_TAGS = [
    // Military & Security
    "military=base", "military=bunker", "amenity=police", "amenity=prison",
    // Aviation & Maritime
    "aeroway=aerodrome", "aeroway=helipad", "aeroway=hangar", "man_made=pier", "harbour=yes",
    // Infrastructure & Utilities
    "power=plant", "power=substation", "telecom=antenna", "man_made=communications_tower", "man_made=water_tower",
    // Transport
    "highway=bus_stop", "railway=station", "amenity=fuel", "amenity=parking",
    // Medical & Emergency
    "amenity=hospital", "amenity=fire_station", "amenity=clinic",
    // General Commercial & Industrial
    "shop=supermarket", "tourism=hotel", "industrial=factory", "landuse=industrial",
    // Education & Amenities
    "amenity=school", "amenity=university", "amenity=cafe", "building=house"
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/wwv-plugin-osm-search/src/components/OSMSidebar.tsx
git commit -m "feat(osm-search): expand quick preset tags with OSINT categories"
```

### Task 2: Implement Taginfo Dynamic Autocomplete

**Files:**
- Modify: `c:\dev\worldwideview\packages\wwv-plugin-osm-search\src\components\OSMSidebar.tsx`

- [ ] **Step 1: Add state and debounced fetch logic inside OSMSidebar component**

```tsx
    const [searchText, setSearchText] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [dynamicTags, setDynamicTags] = useState<string[]>([]);
    const [isSearchingApi, setIsSearchingApi] = useState(false);

    // Add this useEffect below the useState hooks
    React.useEffect(() => {
        if (searchText.length < 3) {
            setDynamicTags([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingApi(true);
            try {
                // Fetch tags matching the search term from OSM Taginfo
                const res = await fetch(`https://taginfo.openstreetmap.org/api/4/search/by_keyword?query=${encodeURIComponent(searchText)}`);
                const data = await res.json();
                if (data && data.data) {
                    // Extract exact key=value pairs or just keys, format as "key=value"
                    const tags = data.data
                        .filter((item: any) => item.key && item.value)
                        .map((item: any) => `${item.key}=${item.value}`)
                        .slice(0, 15); // Limit to top 15 results
                    setDynamicTags(tags);
                }
            } catch (err) {
                console.error("Taginfo fetch failed", err);
            } finally {
                setIsSearchingApi(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchText]);
```

- [ ] **Step 2: Update rendering logic to merge static and dynamic tags**

Look for the `renderedTags` definition and replace it:

```tsx
    // Combine filtered common tags with newly fetched dynamic tags, removing duplicates
    const filteredCommon = searchText 
        ? COMMON_TAGS.filter(t => t.toLowerCase().includes(searchText.toLowerCase())) 
        : COMMON_TAGS;
        
    const renderedTags = Array.from(new Set([...filteredCommon, ...dynamicTags]));
```

- [ ] **Step 3: Add loading indicator to the search input area**

Look for the `<input>` element for `searchText` and wrap it/add a loading indicator:

```tsx
                    <div style={{ position: "relative" }}>
                        <input 
                            style={{ 
                                width: "100%", 
                                padding: "8px", 
                                paddingRight: "24px",
                                backgroundColor: "rgba(0,0,0,0.3)", 
                                color: "#fff", 
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "4px",
                                fontSize: "13px"
                            }}
                            placeholder="Filter or search OSM for tags..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)} 
                        />
                        {isSearchingApi && (
                            <span style={{ 
                                position: "absolute", 
                                right: "8px", 
                                top: "50%", 
                                transform: "translateY(-50%)", 
                                fontSize: "10px", 
                                color: "var(--text-muted)" 
                            }}>
                                ⏳
                            </span>
                        )}
                    </div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/wwv-plugin-osm-search/src/components/OSMSidebar.tsx
git commit -m "feat(osm-search): add live Taginfo autocomplete for unlisted tags"
```
