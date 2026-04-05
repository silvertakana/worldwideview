import Database from 'better-sqlite3';
import path from 'path';

// Define the path for the SQLite database. Note Docker volume mounts to /app/packages/wwv-data-engine/data
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'engine.db');

export const db = new Database(dbPath, {
  // Use verbose logging if needed for debugging
  // verbose: console.log
});

// Enable Write-Ahead Logging for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds if DB is locked

/**
 * Initialize all required tables for the different seeders.
 * This runs synchronously on boot.
 */
export function initDB() {
  console.log(`[DB] Initializing SQLite database at ${dbPath}`);

  // IranWarLive table
  db.exec(`
    CREATE TABLE IF NOT EXISTS iranwar_events (
      event_id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      timestamp TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Earthquakes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS earthquakes (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Wildfires table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wildfires (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Maritime AIS history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS maritime_history (
      mmsi TEXT NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      hdg REAL,
      spd REAL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (mmsi, ts)
    )
  `);
  
  // Index for fast maritime history lookups by MMSI + time range
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maritime_history_mmsi_ts ON maritime_history(mmsi, ts);
  `);

  // Index for time-range-only queries (playback mode)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maritime_history_ts ON maritime_history(ts);
  `);

  // Aviation history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS aviation_history (
      icao24 TEXT NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      alt REAL,
      hdg REAL,
      spd REAL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (icao24, ts)
    )
  `);
  
  // Index for fast aviation history lookups by ICAO24 + time range
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_aviation_history_icao24_ts ON aviation_history(icao24, ts);
  `);

  // Index for time-range-only queries (playback mode)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_aviation_history_ts ON aviation_history(ts);
  `);

  // Military Aviation history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS military_aviation_history (
      hex TEXT NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      alt REAL,
      hdg REAL,
      spd REAL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (hex, ts)
    )
  `);
  
  // Index for fast military aviation history lookups by hex + time range
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_military_aviation_history_hex_ts ON military_aviation_history(hex, ts);
  `);

  // Index for time-range-only queries (playback mode)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_military_aviation_history_ts ON military_aviation_history(ts);
  `);

  // GPS Jamming daily interference map
  db.exec(`
    CREATE TABLE IF NOT EXISTS gps_jamming (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Conflict Events (ACLED) DB table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conflict_events (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Civil Unrest DB table
  db.exec(`
    CREATE TABLE IF NOT EXISTS civil_unrest (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Cyber Attacks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cyber_attacks (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Sanctions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sanctions (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  console.log('[DB] All tables initialized successfully.');
}

/**
 * Prune history rows older than the retention period.
 * Runs periodically to prevent unbounded table growth.
 */
const RETENTION_HOURS = 24;

export function pruneHistoryTables() {
  const cutoff = Math.floor(Date.now() / 1000) - RETENTION_HOURS * 3600;

  const tables = [
    'aviation_history',
    'military_aviation_history',
    'maritime_history',
  ];

  for (const table of tables) {
    const result = db.prepare(`DELETE FROM ${table} WHERE ts < ?`).run(cutoff);
    if (result.changes > 0) {
      console.log(`[DB] Pruned ${result.changes} rows from ${table}`);
    }
  }
}
