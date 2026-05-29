const cron = require('node-cron');
const path = require('path');
const db = require('./db');
const { getTodayTimes } = require('./prayerTimes');
const { castAudio, playLocal, stopCurrent, isPlaying, getLocalIP } = require('./cast');

const AUDIO_DIR = path.join(__dirname, '..', 'audio');
const PRESETS_DIR = path.join(AUDIO_DIR, 'presets');

let scheduledJobs = [];

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function getPrayer(name) {
  return db.prepare('SELECT * FROM prayers WHERE name = ?').get(name);
}

function resolveAudioPath(audioFile) {
  if (audioFile === 'default' || !audioFile) return path.join(PRESETS_DIR, 'makkah.mp3');
  if (audioFile.startsWith('preset:')) return path.join(PRESETS_DIR, audioFile.replace('preset:', '') + '.mp3');
  return path.join(AUDIO_DIR, 'uploads', audioFile);
}

async function playAdhan(prayerName) {
  const prayer = getPrayer(prayerName);
  if (!prayer || !prayer.enabled) return;

  const audioPath = resolveAudioPath(prayer.audio_file);
  const castDevice = getSetting('cast_device');
  const localIP = getLocalIP();
  const port = getSetting('port') || '3000';

  console.log(`[scheduler] Playing Adhan for ${prayerName}`);

  if (castDevice) {
    const [host, devPort] = castDevice.split(':');
    const fileName = path.basename(audioPath);
    const audioUrl = audioPath.startsWith(PRESETS_DIR)
      ? `http://${localIP}:${port}/audio/presets/${fileName}`
      : `http://${localIP}:${port}/audio/uploads/${fileName}`;
    try {
      await castAudio(host, parseInt(devPort) || 8009, audioUrl, prayer.volume);
    } catch (e) {
      console.error(`[scheduler] Cast failed for ${prayerName}:`, e.message);
      playLocal(audioPath);
    }
  } else {
    playLocal(audioPath);
  }
}

function stopAdhan() {
  stopCurrent();
  console.log('[scheduler] Adhan stopped');
}

function clearJobs() {
  for (const job of scheduledJobs) job.stop();
  scheduledJobs = [];
}

function schedulePrayerAt(date, prayerName, preAlertMinutes) {
  const now = Date.now();
  const scheduleAt = (fireTime, label) => {
    const diff = fireTime - now;
    if (diff <= 0) return;
    const timeout = setTimeout(() => playAdhan(prayerName), diff);
    scheduledJobs.push({ stop: () => clearTimeout(timeout) });
    console.log(`[scheduler] ${label} scheduled at ${new Date(fireTime).toLocaleTimeString()}`);
  };
  scheduleAt(date.getTime(), prayerName);
  if (preAlertMinutes > 0) {
    scheduleAt(date.getTime() - preAlertMinutes * 60 * 1000, `${prayerName} pre-alert`);
  }
}

async function rescheduleAll() {
  clearJobs();
  try {
    const times = await getTodayTimes();
    for (const [name, date] of Object.entries(times)) {
      const prayer = getPrayer(name);
      if (prayer) schedulePrayerAt(date, name, prayer.pre_alert || 0);
    }
    console.log('[scheduler] All prayers scheduled for today');
  } catch (e) {
    console.error('[scheduler] Failed to schedule prayers:', e.message);
  }
}

function startMidnightReset() {
  cron.schedule('0 0 * * *', () => {
    console.log('[scheduler] Midnight reset — rescheduling prayers');
    rescheduleAll();
  });
}

module.exports = { rescheduleAll, startMidnightReset, playAdhan, stopAdhan, isPlaying };
