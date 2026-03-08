import { test, expect } from 'vitest';
// import * as assert from 'node:assert';

test('fetch camera data from camlist.net via codetabs', async () => {
    const fetchUrl = 'https://api.codetabs.com/v1/proxy?quest=http://camlist.net/';
    
    console.log(`Fetching from ${fetchUrl}...`);
    const res = await fetch(fetchUrl);
    
    expect(res.ok).toBe(true);
    
    const text = await res.text();
    console.log(`Received ${text.length} bytes of data.`);
    
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        if (text.startsWith('<!DOCTYPE html>')) {
             console.warn('Skipping test: CodeTabs proxy returned HTML (likely rate limited).');
             return;
        }
        throw new Error('Target URL did not return a valid JSON format. Response preview: ' + text.substring(0, 100));
    }
    
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
        expect(data[0].latitude).toBeDefined();
        expect(data[0].longitude).toBeDefined();
        console.log(`Successfully parsed ${data.length} cameras. First camera:`, data[0]);
    } else {
        console.log('Successfully parsed empty array.');
    }
});
