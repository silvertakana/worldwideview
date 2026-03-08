const cheerio = require('cheerio');

async function testFetch() {
    try {
        const response = await fetch('http://www.insecam.org/en/byrating/?page=2');
        const text = await response.text();
        const $ = cheerio.load(text);
        const r = [];
        $('.thumbnail-item__wrap').each(function() {
            r.push($(this).attr('href'));
        });
        console.log("Results from page 2:");
        console.log(r);

        // testing page 1: 
        const response1 = await fetch('http://www.insecam.org/en/byrating/?page=1');
        const text1 = await response1.text();
        const $1 = cheerio.load(text1);
        const r1 = [];
        $1('.thumbnail-item__wrap').each(function() {
            r1.push($1(this).attr('href'));
        });
        console.log("Results from page 1:");
        console.log(r1);

    } catch (e) {
        console.error(e);
    }
}
testFetch();
