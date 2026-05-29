const express = require('express');
const path = require('path');
const db = require('./db');
const { rescheduleAll, startMidnightReset } = require('./scheduler');
const { startDiscovery } = require('./cast');

const app = express();
const PORT = process.env.PORT || 3000;

// Persist port for cast URL generation
db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('port', String(PORT));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve audio files
app.use('/audio/presets', express.static(path.join(__dirname, '..', 'audio', 'presets')));
app.use('/audio/uploads', express.static(path.join(__dirname, '..', 'audio', 'uploads')));

// API routes
app.use('/api/settings', require('./routes/settings'));
app.use('/api/prayers', require('./routes/prayers'));
app.use('/api/audio', require('./routes/audio'));
app.use('/api/cast', require('./routes/cast'));

// Prayer times endpoint
app.get('/api/times', async (req, res) => {
  const { getTodayTimes } = require('./prayerTimes');
  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value || '';
  try {
    const times = await getTodayTimes();
    const result = {
      city: getSetting('city_display'),
      zip:  getSetting('zip_code'),
    };
    for (const [k, v] of Object.entries(times)) result[k] = v.toISOString();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[server] Adhan Pi running at http://0.0.0.0:${PORT}`);
  startDiscovery();
  startMidnightReset();
  await rescheduleAll();
});
