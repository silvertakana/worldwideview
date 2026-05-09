# Persistent Custom OSM Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to persistently save custom OSM tags to local storage so they remain available across sessions, and track their usage via Umami analytics.

**Architecture:** We will use `useState` and `useEffect` in the `OSMSidebar` component to sync `customTags` to the browser's `localStorage`. When the user enters a custom tag, we'll store it, render it with a small delete button (so the list doesn't get cluttered over time), and fire an event to `window.umami.track`.

**Tech Stack:** React Hooks, `localStorage`, Umami Analytics

---

### Task 1: Add Custom Tag State and Persistence

**Files:**
- Modify: `c:\dev\worldwideview-plugins\packages\wwv-plugin-osm-search\src\components\OSMSidebar.tsx`

- [ ] **Step 1: Add customTags state and persistence effects**

In `OSMSidebar.tsx`, below the existing `const [activeTags, setActiveTags] = useState<string[]>([]);` line, add:

```tsx
    const [customTags, setCustomTags] = useState<string[]>([]);

    React.useEffect(() => {
        try {
            const saved = localStorage.getItem("wwv_osm_custom_tags");
            if (saved) setCustomTags(JSON.parse(saved));
        } catch {}
    }, []);

    React.useEffect(() => {
        localStorage.setItem("wwv_osm_custom_tags", JSON.stringify(customTags));
    }, [customTags]);
```

- [ ] **Step 2: Include customTags in the rendered list**

Replace `const customTagMatch = searchText.includes("=") ? [searchText.trim()] : [];` and `const renderedTags = ...` with:

```tsx
    const renderedTags = Array.from(new Set([...filteredCommon, ...dynamicTags, ...customTags]));
```

- [ ] **Step 3: Update Enter key handler to save tags and track**

Inside the `input`'s `onKeyDown` handler:

```tsx
                             onKeyDown={e => {
                                 if (e.key === "Enter" && searchText.includes("=")) {
                                     const tag = searchText.trim();
                                     if (!activeTags.includes(tag)) {
                                         setActiveTags(prev => [...prev, tag]);
                                     }
                                     if (!customTags.includes(tag)) {
                                         setCustomTags(prev => [...prev, tag]);
                                         try {
                                             (window as any).umami?.track("osm-search-custom-tag", { tag });
                                         } catch {}
                                     }
                                     setSearchText("");
                                 }
                             }}
```

- [ ] **Step 4: Add a delete button to custom tags**

Inside the `.map(tag => {` block, update the `button` contents to include a delete span if it's a custom tag:

```tsx
                                <button 
                                    key={tag} 
                                    style={{ 
                                        background: isActive ? "var(--accent-blue)" : "rgba(255,255,255,0.05)", 
                                        color: isActive ? "#fff" : "var(--text-secondary)", 
                                        padding: "4px 10px", 
                                        borderRadius: "14px", 
                                        border: `1px solid ${isActive ? "transparent" : "rgba(255,255,255,0.1)"}`,
                                        fontSize: "11px",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px"
                                    }}
                                    onClick={() => setActiveTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag])}
                                >
                                    {tag.replace("=", ": ")}
                                    {customTags.includes(tag) && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCustomTags(prev => prev.filter(t => t !== tag));
                                                setActiveTags(prev => prev.filter(t => t !== tag));
                                            }}
                                            style={{
                                                marginLeft: "2px",
                                                padding: "0 4px",
                                                borderRadius: "50%",
                                                background: "rgba(255,255,255,0.15)",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center"
                                            }}
                                        >
                                            ×
                                        </span>
                                    )}
                                </button>
```

- [ ] **Step 5: Commit changes**

```bash
git add packages/wwv-plugin-osm-search/src/components/OSMSidebar.tsx
git commit -m "feat(osm-search): persist custom tags and track via umami"
```
