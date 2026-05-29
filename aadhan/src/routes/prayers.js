const express = require('express');
const router = express.Router();
const db = require('../db');
const { getTodayTimes } = require('../prayerTimes');
const { rescheduleAll } = require('../scheduler');

router.get('/', async (req, res) => {
  const rows = db.prepare('SELECT * FROM prayers ORDER BY name').all();
  try {
    const times = await getTodayTimes();
    const result = rows.map((p) => ({
      ...p,
      enabled: !!p.enabled,
      time: times[p.name]?.toISOString() || null,
    }));
    res.json(result);
  } catch (e) {
    res.json(rows.map((p) => ({ ...p, enabled: !!p.enabled, time: null })));
  }
});

router.patch('/:name', async (req, res) => {
  const { name } = req.params;
  const allowed = ['enabled', 'audio_file', 'volume', 'pre_alert'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  const sets = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE prayers SET ${sets} WHERE name = @name`).run({ ...updates, name });
  await rescheduleAll();
  res.json({ ok: true });
});

module.exports = router;
