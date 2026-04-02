const fs = require('fs');
const path = require('path');

const csvPath = 'C:/dev/worldwideview/artifacts/Events.csv';
const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');

const events = [];
const parseCSVLine = (text) => {
    let ret = [], q = false, cv = '';
    for (let c of text) {
        if (c === '\"') { q = !q; }
        else if (c === ',' && !q) { ret.push(cv); cv = ''; }
        else { cv += c; }
    }
    ret.push(cv);
    return ret;
};

for(const line of lines) {
  const parts = parseCSVLine(line);
  if(parts.length < 10) continue;
  
  const [time, date, type, location, casualties, sourceUrl, sourceTitle, summary, eventId, day, articleUrl] = parts;
  
  // time is like '02:00Z', date is like '28-Mar-26'
  const isoDate = new Date(`${date} ${time.replace('Z', '')} UTC`).toISOString();
  
  events.push({
    event_id: eventId,
    type: type,
    location: location,
    timestamp: isoDate,
    confidence: 'Confirmed',
    event_summary: summary,
    source_url: articleUrl,
    preview_image: null,
    _osint_meta: {
      casualties: parseInt(casualties) || 0,
    }
  });
}

const outDir = 'C:/dev/worldwideview/packages/wwv-data-engine/data/fallback';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(path.join(outDir, 'iranwar_seed.json'), JSON.stringify(events, null, 2));
console.log('Saved ' + events.length + ' events to seed.json');
