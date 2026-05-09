---
name: bing-news-hydration
description: Hydrate event attributes with news URLs and images via Bing RSS
---

# Bing News Event Hydration Workflow

When enriching a simulation database or CSV dataset via automation, standard search engines like Google will aggressively block headless scrapers or `fetch` requests with CAPTCHA walls. This workflow uses **Bing News RSS** as an open, structured payload to discover news articles and then bypasses its tracking wrapper to scrape `og:image` tags.

### 1. Structure the Request
Bing offers a developer-friendly RSS feed option that bypasses captchas. Construct the query string properly depending on whether you want an exact match or a broad categorical match (e.g. for fictional simulation events).

```javascript
const query = encodeURIComponent("AIR STRIKE Tehran Iran Israel conflict");
const url = `https://www.bing.com/news/search?q=${query}&format=rss`;
```

### 2. Bypass Bing Click-Tracking
When Bing RSS returns an article, the URL will be wrapped in a tracking link (`apiclick.aspx`). Fetching this URL directly will *fail* to return the article HTML, as Bing uses a client-side JavaScript redirect. To extract the real article link, you must unescape the XML, map the `url=` parameter, and decode it.

```javascript
async function bingNewsSearch(query) {
    const res = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WorldWideView-Hydrator" }
    });
    
    const xml = await res.text();
    const itemMatch = xml.match(/<item>[\s\S]*?<link>(.*?)<\/link>/i);
    
    if (itemMatch && itemMatch[1]) {
        // 1. Unescape XML entities
        let encodedUrl = itemMatch[1].trim().replace(/&amp;/g, '&');
        
        // 2. Extract the `url=` target and decode it
        const urlMatch = encodedUrl.match(/[?&]url=([^&]+)/i);
        if (urlMatch && urlMatch[1]) {
            return decodeURIComponent(urlMatch[1]);
        }
        return encodedUrl;
    }
    return null;
}
```

### 3. Fetch Article `og:image`
Once you have the direct real article URL (e.g., Al Jazeera, MSN, etc.), make a standard HTTP fetch to the webpage. You can regex parse the HTML (without needing a full DOM parser or headless browser) to extract the Open Graph preview image.

```javascript
async function scrapeOgImage(articleUrl) {
    // Note: Always sleep/wait a few hundred ms between requests to respect rate limits
    const res = await fetch(articleUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WorldWideView-Hydrator" }
    });
    const html = await res.text();
    
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) 
                 || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                 
    return ogMatch ? ogMatch[1] : null;
}
```

### 4. Apply to Dataset
Wrap these utility functions in an async loop covering your DB output:
1. Filter out broad non-searchable events (e.g. `POSTURING`).
2. Run `bingNewsSearch(title)`.
3. If successful, run `scrapeOgImage(target)`.
4. Update the SQL DB via `UPDATE table SET ...` payload injection.

**Important**: Implement delays (`await sleep(500);`) between fetches to avoid being IP blocklisted by target news outlets.
