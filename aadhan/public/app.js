// Tab navigation
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'prayers')   loadPrayers();
    if (btn.dataset.tab === 'audio')     loadAudio();
    if (btn.dataset.tab === 'settings')  loadSettings();
    if (btn.dataset.tab === 'cast')      loadCast();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeUntilHMS(isoStr) {
  const diff = new Date(isoStr) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getHijriDate(date) {
  try {
    const hijri = new Intl.DateTimeFormat('en-u-ca-islamic', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(date || new Date());
    return hijri;
  } catch {
    return '';
  }
}

function getGregorianDate(date) {
  return (date || new Date()).toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  return res.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let countdownTimer = null;
let prayerTimesCache = null;
let tomorrowFajrCache = null;

let stopPollTimer = null;

async function pollPlayingStatus() {
  const { playing } = await api('GET', '/cast/status').catch(() => ({ playing: false }));
  const wrap = document.getElementById('stop-btn-wrap');
  if (wrap) wrap.style.display = playing ? 'block' : 'none';
}

async function loadDashboard() {
  clearInterval(countdownTimer);
  clearInterval(stopPollTimer);
  const data = await api('GET', '/times').catch(() => ({}));
  prayerTimesCache = data;
  renderLocation(data);
  renderDate();
  renderTimesGrid(data);
  tickCountdown(data);
  countdownTimer = setInterval(() => tickCountdown(prayerTimesCache), 1000);
  pollPlayingStatus();
  stopPollTimer = setInterval(pollPlayingStatus, 3000);
}

document.getElementById('stop-adhan-btn').addEventListener('click', async () => {
  await api('POST', '/cast/stop');
  document.getElementById('stop-btn-wrap').style.display = 'none';
});

function renderDate() {
  const el = document.getElementById('date-display');
  if (!el) return;
  const now = new Date();
  const greg = getGregorianDate(now);
  const hijri = getHijriDate(now);
  el.innerHTML = `<span>${greg}</span>${hijri ? `<span class="hijri-date">(${hijri})</span>` : ''}`;
}

function renderLocation(data) {
  const el = document.getElementById('location-display');
  if (!el) return;
  if (data.city) {
    el.innerHTML = `<span class="loc-icon">📍</span><span>${data.city}</span>${data.zip ? `<span class="loc-zip">${data.zip}</span>` : ''}`;
  } else if (data.zip) {
    el.innerHTML = `<span class="loc-icon">📍</span><span class="loc-zip">${data.zip}</span>`;
  } else {
    el.innerHTML = `<span style="color:rgba(255,255,255,0.3);font-size:.75rem">Set your ZIP in Settings</span>`;
  }
}

function renderTimesGrid(times, nextOverride) {
  const now = Date.now();
  const next = nextOverride !== undefined
    ? nextOverride
    : ORDER.find((p) => times[p] && new Date(times[p]) > now);
  const grid = document.getElementById('times-grid');
  grid.innerHTML = ORDER.map((p) => {
    const isNext = p === next;
    const past = !isNext && times[p] && new Date(times[p]) <= now;
    const cls = isNext ? 'next-prayer' : past ? 'past' : '';
    return `
      <div class="time-cell ${cls}">
        <div class="prayer-label">${p}</div>
        <div class="prayer-time">${fmt(times[p])}</div>
      </div>`;
  }).join('');
}

async function fetchTomorrowFajr() {
  if (tomorrowFajrCache) return tomorrowFajrCache;
  const data = await api('GET', '/times?date=tomorrow').catch(() => ({}));
  tomorrowFajrCache = data.Fajr || null;
  return tomorrowFajrCache;
}

function tickCountdown(times) {
  if (!times) return;
  const now = Date.now();
  const next = ORDER.find((p) => times[p] && new Date(times[p]) > now);
  if (next) {
    document.getElementById('next-prayer-name').textContent = next;
    document.getElementById('next-prayer-time').textContent = fmt(times[next]);
    const hms = timeUntilHMS(times[next]);
    document.getElementById('countdown').textContent = hms || 'Now!';
    renderTimesGrid(times, next);
  } else {
    // All prayers done — show tomorrow's Fajr
    fetchTomorrowFajr().then((fajrISO) => {
      document.getElementById('next-prayer-name').textContent = 'Fajr';
      document.getElementById('next-prayer-time').textContent = fajrISO ? fmt(fajrISO) + ' (tomorrow)' : '';
      const hms = fajrISO ? timeUntilHMS(fajrISO) : null;
      document.getElementById('countdown').textContent = hms || '—';
    });
    renderTimesGrid(times, 'Fajr');
  }
}

// ── Prayers ───────────────────────────────────────────────────────────────────
let audioOptions = [];

async function loadPrayers() {
  const [prayers, audioData] = await Promise.all([
    api('GET', '/prayers'),
    api('GET', '/audio'),
  ]);
  audioOptions = [
    ...audioData.presets.map((p) => ({ id: p.id, label: p.label })),
    ...audioData.uploads.map((u) => ({ id: u.id, label: u.label })),
  ];
  const container = document.getElementById('prayer-list');
  container.innerHTML = prayers.map(buildPrayerRow).join('');
  container.querySelectorAll('.prayer-row').forEach(attachPrayerRowEvents);
}

function buildPrayerRow(p) {
  const audioSelect = audioOptions.map((a) =>
    `<option value="${a.id}" ${p.audio_file === a.id ? 'selected' : ''}>${a.label}</option>`
  ).join('');
  const vol = p.volume ?? 80;
  return `
  <div class="prayer-row ${p.enabled ? '' : 'disabled'}" data-name="${p.name}">
    <div class="prayer-row-left">
      <div class="prayer-dot"></div>
      <div>
        <div class="prayer-name">${p.name}</div>
        <div class="prayer-time-small">${fmt(p.time)}</div>
      </div>
    </div>
    <div class="prayer-row-controls">
      <label class="toggle" title="Enable/Disable">
        <input type="checkbox" class="pr-enabled" ${p.enabled ? 'checked' : ''} />
        <span class="slider"></span>
      </label>
      <div>
        <div class="control-label">Audio</div>
        <select class="pr-audio">${audioSelect}</select>
      </div>
      <div class="volume-wrap">
        <div class="control-label">Vol</div>
        <input type="range" class="pr-volume" min="0" max="100" value="${vol}" />
        <span class="vol-value">${vol}%</span>
      </div>
      <div>
        <div class="control-label">Pre-alert (min)</div>
        <input type="number" class="pr-prealert" value="${p.pre_alert}" min="0" max="60" />
      </div>
      <button class="play-btn" title="Play now">▶ Play</button>
    </div>
  </div>`;
}

function attachPrayerRowEvents(row) {
  const name = row.dataset.name;
  const save = async () => {
    const enabled = row.querySelector('.pr-enabled').checked;
    row.classList.toggle('disabled', !enabled);
    await api('PATCH', `/prayers/${name}`, {
      enabled: enabled ? 1 : 0,
      audio_file: row.querySelector('.pr-audio').value,
      volume: parseInt(row.querySelector('.pr-volume').value) || 80,
      pre_alert: parseInt(row.querySelector('.pr-prealert').value) || 0,
    });
  };
  const volSlider = row.querySelector('.pr-volume');
  const volLabel  = row.querySelector('.vol-value');
  volSlider.addEventListener('input', () => { volLabel.textContent = volSlider.value + '%'; });
  row.querySelector('.pr-enabled').addEventListener('change', save);
  row.querySelector('.pr-audio').addEventListener('change', save);
  row.querySelector('.pr-volume').addEventListener('change', save);
  row.querySelector('.pr-prealert').addEventListener('change', save);
  row.querySelector('.play-btn').addEventListener('click', () =>
    api('POST', `/cast/play/${name}`)
  );
}

// ── Audio ─────────────────────────────────────────────────────────────────────
async function loadAudio() {
  const data = await api('GET', '/audio');
  document.getElementById('preset-list').innerHTML = data.presets.map((p) =>
    `<div class="audio-item">
       <div class="audio-item-name"><span class="audio-icon">♪</span>${p.label}</div>
     </div>`
  ).join('') || '<em style="color:var(--text-muted);font-size:.85rem">None</em>';

  document.getElementById('upload-list').innerHTML = data.uploads.length
    ? data.uploads.map((u) =>
        `<div class="audio-item">
           <div class="audio-item-name"><span class="audio-icon">♪</span>${u.label}</div>
           <button class="del-btn" data-id="${u.id}">Delete</button>
         </div>`
      ).join('')
    : '<em style="color:var(--text-muted);font-size:.85rem">No uploads yet</em>';

  document.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/audio/uploads/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
      loadAudio();
    });
  });
}

document.getElementById('upload-btn').addEventListener('click', async () => {
  const file = document.getElementById('audio-upload').files[0];
  const status = document.getElementById('upload-status');
  if (!file) { status.textContent = 'Choose a file first.'; status.className = 'status-msg error'; return; }
  const form = new FormData();
  form.append('audio', file);
  status.textContent = 'Uploading…'; status.className = 'status-msg';
  const res = await fetch('/api/audio/upload', { method: 'POST', body: form });
  const data = await res.json();
  status.textContent = data.ok ? 'Uploaded successfully!' : (data.error || 'Upload failed');
  status.className = data.ok ? 'status-msg' : 'status-msg error';
  if (data.ok) loadAudio();
});

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  const data = await api('GET', '/settings');
  const form = document.getElementById('settings-form');
  form.zip_code.value   = data.zip_code || '';
  form.asr_madhab.value = data.asr_madhab || 'Shafi';
  form.timezone.value   = data.timezone || '';
  form.calc_method.innerHTML = (data.available_methods || []).map((m) =>
    `<option value="${m}" ${data.calc_method === m ? 'selected' : ''}>${m}</option>`
  ).join('');
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('settings-status');
  status.textContent = 'Saving…'; status.className = 'status-msg';
  const res = await api('POST', '/settings', {
    zip_code:    form.zip_code.value.trim(),
    calc_method: form.calc_method.value,
    asr_madhab:  form.asr_madhab.value,
    timezone:    form.timezone.value.trim(),
  });
  status.textContent = res.ok ? 'Settings saved! Prayer times updated.' : (res.error || 'Error saving.');
  status.className = res.ok ? 'status-msg' : 'status-msg error';
  if (res.ok) prayerTimesCache = null;
});

// ── Cast ──────────────────────────────────────────────────────────────────────
let selectedDevice = null;

async function loadCast() {
  await refreshDevices();
  const saved = await api('GET', '/settings').then((d) => d.cast_device).catch(() => '');
  if (saved) {
    const [host, port] = saved.split(':');
    selectedDevice = { host, port: parseInt(port) || 8009, name: saved };
    updateSelectedDevice();
  }
}

async function refreshDevices() {
  const list = document.getElementById('device-list');
  list.innerHTML = '<em style="color:var(--text-muted);font-size:.85rem">Scanning…</em>';
  const devices = await api('GET', '/cast/devices');
  if (!devices.length) {
    list.innerHTML = '<em style="color:var(--text-muted);font-size:.85rem">No devices found. Make sure you\'re on the same Wi-Fi network.</em>';
    return;
  }
  list.innerHTML = devices.map((d) =>
    `<div class="device-item" data-host="${d.host}" data-port="${d.port}">
       <div class="device-info">
         <div class="device-name">${d.name}</div>
         <div class="device-host">${d.host}:${d.port}</div>
       </div>
       <button class="select-device-btn">Select</button>
     </div>`
  ).join('');
  list.querySelectorAll('.select-device-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.device-item');
      selectedDevice = {
        host: item.dataset.host,
        port: parseInt(item.dataset.port),
        name: item.querySelector('.device-name').textContent,
      };
      list.querySelectorAll('.device-item').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      updateSelectedDevice();
      await api('POST', '/settings', { cast_device: `${selectedDevice.host}:${selectedDevice.port}` });
    });
  });
}

function updateSelectedDevice() {
  const el = document.getElementById('selected-device-info');
  if (selectedDevice) {
    el.className = 'selected-device-banner';
    el.innerHTML = `📡 <strong>${selectedDevice.name}</strong> &nbsp;·&nbsp; ${selectedDevice.host}:${selectedDevice.port}`;
  } else {
    el.className = 'selected-device-banner empty';
    el.textContent = 'No device selected';
  }
  document.getElementById('test-cast-btn').disabled = !selectedDevice;
}

document.getElementById('refresh-devices').addEventListener('click', refreshDevices);

document.getElementById('test-cast-btn').addEventListener('click', async () => {
  if (!selectedDevice) return;
  const status = document.getElementById('cast-status');
  status.textContent = 'Casting test audio…'; status.className = 'status-msg';
  const res = await api('POST', '/cast/test', { host: selectedDevice.host, port: selectedDevice.port });
  status.textContent = res.ok ? 'Cast successful! ✓' : ('Error: ' + (res.error || 'unknown'));
  status.className = res.ok ? 'status-msg' : 'status-msg error';
});

// ── PWA Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadDashboard();
