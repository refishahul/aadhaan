const express = require('express');
const router = express.Router();
const { getDevices, castAudio, getLocalIP } = require('../cast');
const { playAdhan, stopAdhan, isPlaying } = require('../scheduler');
const db = require('../db');

router.get('/devices', (req, res) => {
  res.json(getDevices());
});

router.get('/status', (req, res) => {
  res.json({ playing: isPlaying() });
});

router.post('/stop', (req, res) => {
  stopAdhan();
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const { host, port } = req.body;
  if (!host) return res.status(400).json({ error: 'host required' });
  const localIP = getLocalIP();
  const serverPort = db.prepare('SELECT value FROM settings WHERE key = ?').get('port')?.value || '3000';
  const audioUrl = `http://${localIP}:${serverPort}/audio/presets/makkah.mp3`;
  try {
    await castAudio(host, parseInt(port) || 8009, audioUrl, 80);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/play/:prayer', async (req, res) => {
  const { prayer } = req.params;
  const valid = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  if (!valid.includes(prayer)) return res.status(400).json({ error: 'Invalid prayer' });
  try {
    playAdhan(prayer);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
