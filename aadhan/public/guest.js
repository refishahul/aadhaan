const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let timesCache = null;
let tomorrowFajr = null;
let countdownTimer = null;

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hms(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const HIJRI_MONTHS = [
  'Muharram','Safar','Rabiʻ al-Awwal','Rabiʻ al-Thani',
  'Jumada al-Awwal','Jumada al-Thani','Rajab','Shaʻban',
  'Ramadan','Shawwal','Dhu al-Qiʻdah','Dhu al-Hijjah'
];

function hijriDate(d) {
  try {
    const dt = d || new Date();
    const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
    const t = Math.trunc((m - 14) / 12);
    const jd = Math.floor((1461 * (y + 4800 + t)) / 4)
             + Math.floor((367 * (m - 2 - 12 * t)) / 12)
             - Math.floor((3 * Math.floor((y + 4900 + t) / 100)) / 4)
             + day - 32075;
    const l  = jd - 1948440 + 10632;
    const n  = Math.floor((l - 1) / 10631);
    const l2 = l - 10631 * n + 354;
    const j  = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
             + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
    const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
             - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const hMonth = Math.floor((24 * l3) / 709);
    const hDay   = l3 - Math.floor((709 * hMonth) / 24);
    const hYear  = 30 * n + j - 30;
    return `${hDay} ${HIJRI_MONTHS[hMonth - 1]} ${hYear} AH`;
  } catch { return ''; }
}

async function load() {
  const [data, settings] = await Promise.all([
    fetch('/api/times').then(r => r.json()).catch(() => ({})),
    fetch('/api/settings').then(r => r.json()).catch(() => ({})),
  ]);
  timesCache = data;

  // Location
  const locEl = document.getElementById('g-location');
  if (data.city) locEl.innerHTML = `📍 ${data.city}`;
  else if (data.zip) locEl.textContent = data.zip;

  // Date
  const now = new Date();
  const greg = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hijri = hijriDate(now);
  document.getElementById('g-date').innerHTML =
    `${greg}${hijri ? ` <span class="hijri">(${hijri})</span>` : ''}`;

  // Method footer
  const method = settings.calc_method || '';
  const madhab = settings.asr_madhab || '';
  document.getElementById('g-method').textContent = [method, madhab].filter(Boolean).join(' · ');

  renderGrid(data);
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

function renderGrid(times, nextName) {
  const now = Date.now();
  const next = nextName !== undefined
    ? nextName
    : ORDER.find(p => times[p] && new Date(times[p]) > now);
  document.getElementById('g-times-grid').innerHTML = ORDER.map(p => {
    const isNext = p === next;
    const past = !isNext && times[p] && new Date(times[p]) <= now;
    const cls = isNext ? 'next' : past ? 'past' : '';
    return `<div class="time-cell ${cls}">
      <div class="prayer-label">${p}</div>
      <div class="prayer-time-val">${fmt(times[p])}</div>
    </div>`;
  }).join('');
}

async function tick() {
  if (!timesCache) return;
  const times = timesCache;
  const now = Date.now();
  const next = ORDER.find(p => times[p] && new Date(times[p]) > now);

  if (next) {
    document.getElementById('g-next-name').textContent = next;
    document.getElementById('g-next-time').textContent = fmt(times[next]);
    document.getElementById('g-countdown').textContent = hms(times[next]) || 'Now!';
    renderGrid(times, next);
  } else {
    // All done — show tomorrow's Fajr
    if (!tomorrowFajr) {
      const d = await fetch('/api/times?date=tomorrow').then(r => r.json()).catch(() => ({}));
      tomorrowFajr = d.Fajr || null;
    }
    document.getElementById('g-next-name').textContent = 'Fajr';
    document.getElementById('g-next-time').textContent = tomorrowFajr ? fmt(tomorrowFajr) + ' (tomorrow)' : '';
    document.getElementById('g-countdown').textContent = tomorrowFajr ? (hms(tomorrowFajr) || '—') : '—';
    renderGrid(times, 'Fajr');
  }
}

// Reload times data every 10 minutes
load();
setInterval(load, 10 * 60 * 1000);
