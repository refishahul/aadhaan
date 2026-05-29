const express = require('express');
const router = express.Router();
const db = require('../db');
const { rescheduleAll } = require('../scheduler');
const { zipToCoords, METHOD_MAP } = require('../prayerTimes');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

router.get('/', (req, res) => {
  const keys = ['zip_code', 'calc_method', 'asr_madhab', 'cast_device', 'timezone', 'city_display'];
  const result = {};
  for (const k of keys) result[k] = getSetting(k) || '';
  result.available_methods = Object.keys(METHOD_MAP);
  res.json(result);
});

router.post('/', async (req, res) => {
  const { zip_code, calc_method, asr_madhab, cast_device, timezone } = req.body;

  if (zip_code) {
    try {
      const coords = await zipToCoords(zip_code);
      setSetting('zip_code', zip_code);
      setSetting('city_display', coords.display || '');
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (calc_method && METHOD_MAP[calc_method]) setSetting('calc_method', calc_method);
  if (asr_madhab && ['Hanafi', 'Shafi'].includes(asr_madhab)) setSetting('asr_madhab', asr_madhab);
  if (cast_device !== undefined) setSetting('cast_device', cast_device);
  if (timezone) setSetting('timezone', timezone);

  await rescheduleAll();
  res.json({ ok: true });
});

module.exports = router;
