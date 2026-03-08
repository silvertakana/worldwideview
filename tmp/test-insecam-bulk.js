const cheerio = require('cheerio');
const insecam = require('insecam-api');

async function testFetchAll() {
    try {
        const pages = 10;
        let allIds = [];
        for(let i=1; i<=pages; i++) {
            const response = await fetch(`http://www.insecam.org/en/byrating/?page=${i}`);
            const text = await response.text();
            const $ = cheerio.load(text);
            $('.thumbnail-item__wrap').each(function() {
                const href = $(this).attr('href');
                if(href) {
                    allIds.push(href.slice(9, -1)); // /en/view/12345/ -> 12345
                }
            });
        }
        console.log(`Fetched ${allIds.length} IDs.`);
        
        // now fetch details for all
        const promises = allIds.map(id => insecam.camera(id).catch(() => null));
        console.time("fetchDetails");
        const details = await Promise.all(promises);
        console.timeEnd("fetchDetails");
        const valid = details.filter(d => d !== null);
        console.log(`Successfully fetched details for ${valid.length} cameras.`);
    } catch (e) {
        console.error(e);
    }
}
testFetchAll();
