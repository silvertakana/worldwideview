import Database from 'better-sqlite3';

const db = new Database('./data/engine.db');

try {
  const rows = db.prepare('SELECT payload FROM iranwar_events').all();
  for (const row of rows) {
    try {
      JSON.parse(row.payload);
    } catch(err) {
      console.log('JSON Parse Failed for:', row.payload);
    }
  }
  console.log('Tested rows correctly');
} catch(e) {
  console.error(e);
}
