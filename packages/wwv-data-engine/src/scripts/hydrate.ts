import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const seedPath = path.join(__dirname, '..', '..', 'data', 'fallback', 'iranwar_seed.json');

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractMedia(url: string): Promise<{img: string | null, vid: string | null, realUrl: string | null}> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            },
            signal: AbortSignal.timeout(10000)
        });
        
        const text = await res.text();
        const $ = cheerio.load(text);
        
        let realUrl = res.url;
        
        // Sometimes Bing wraps in a redirect page
        if ($('noscript').text().includes('refresh')) {
            const redirectMatch = $('noscript').html()?.match(/URL=([^"']+)/i);
            if (redirectMatch && redirectMatch[1]) {
                const redir = redirectMatch[1].replace(/&amp;/g, '&');
                try {
                    const redirRes = await fetch(redir, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
                    const redirHtml = await redirRes.text();
                    const $2 = cheerio.load(redirHtml);
                    realUrl = redirRes.url;
                    return { ...parseMetas($2, realUrl), realUrl };
                } catch(e) {}
            }
        }
        
        return { ...parseMetas($, realUrl), realUrl };
    } catch {
        return { img: null, vid: null, realUrl: null };
    }
}

function parseMetas($: cheerio.CheerioAPI, source: string) {
    const img = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || null;
    const vid = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content') || null;
    return { img, vid };
}

async function run() {
    console.log("Loading existing seed...");
    if (!fs.existsSync(seedPath)) {
        console.error("Seed not found!");
        return;
    }
    
    const events: any[] = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    let count = 0;
    
    for (const event of events) {
        const isSearchable = !["POSTURING", "INTERCEPTION", "AIRSPACE CLOSED"].includes(event.type?.toUpperCase() || "");
        
        if (isSearchable && event.location && event.type) {
            console.log(`[Hydrate] Searching Bing News for: ${event.type} ${event.location}`);
            const query = encodeURIComponent(`${event.type} ${event.location} Iran Israel conflict`);
            try {
                const searchRes = await fetch(`https://www.bing.com/news/search?q=${query}&format=rss`, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    signal: AbortSignal.timeout(5000)
                });
                
                if (searchRes.ok) {
                    const xml = await searchRes.text();
                    const $ = cheerio.load(xml, { xmlMode: true });
                    const items = $('item');
                    if (items.length > 0) {
                         const articleUrl = $(items[0]).find('link').text();
                         console.log(` -> Found article string: ${articleUrl.substring(0, 50)}...`);
                         const media = await extractMedia(articleUrl);
                         
                         event.source_url = media.realUrl || articleUrl;
                         if (media.vid) event.preview_video = media.vid;
                         if (media.img) event.preview_image = media.img;
                         count++;
                    }
                }
            } catch (err: any) {
                console.warn(` -> Search failed: ${err.message}`);
            }
            fs.writeFileSync(seedPath, JSON.stringify(events, null, 2));
            await delay(500); 
        }
    }
    
    console.log(`Extraction complete. Modified ${count} events.`);
}

run().catch(console.error);
