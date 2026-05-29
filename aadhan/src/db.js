const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'aadhan.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prayers (
    name       TEXT PRIMARY KEY,
    enabled    INTEGER NOT NULL DEFAULT 1,
    audio_file TEXT NOT NULL DEFAULT 'default',
    volume     INTEGER NOT NULL DEFAULT 80,
    pre_alert  INTEGER NOT NULL DEFAULT 0
  );
`);

// Default settings
const defaults = {
  zip_code: '10001',
  calc_method: 'ISNA',
  asr_madhab: 'Shafi',
  cast_device: '',
  timezone: 'America/New_York',
};

const insertDefault = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [k, v] of Object.entries(defaults)) {
  insertDefault.run(k, v);
}

// Default prayer rows
const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const insertPrayer = db.prepare(
  'INSERT OR IGNORE INTO prayers (name) VALUES (?)'
);
for (const p of prayers) insertPrayer.run(p);

module.exports = db;
