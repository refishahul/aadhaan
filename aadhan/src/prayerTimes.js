const adhan = require('adhan');
const fetch = require('node-fetch');
const db = require('./db');

const METHOD_MAP = {
  ISNA:      adhan.CalculationMethod.NorthAmerica,
  MWL:       adhan.CalculationMethod.MuslimWorldLeague,
  Egyptian:  adhan.CalculationMethod.Egyptian,
  Karachi:   adhan.CalculationMethod.Karachi,
  UmmAlQura: adhan.CalculationMethod.UmmAlQura,
  Dubai:     adhan.CalculationMethod.Dubai,
};

async function zipToCoords(zip) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'aadhan-pi/1.0' } });
  const data = await res.json();
  if (!data.length) throw new Error(`ZIP code ${zip} not found`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function buildParams() {
  const method = getSetting('calc_method') || 'ISNA';
  const madhab = getSetting('asr_madhab') || 'Shafi';
  const calcFn = METHOD_MAP[method] || adhan.CalculationMethod.NorthAmerica;
  const params = calcFn();
  params.madhab = madhab === 'Hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  return params;
}

async function getTodayTimes(date) {
  const zip = getSetting('zip_code') || '10001';
  const { lat, lng } = await zipToCoords(zip);
  const coords = new adhan.Coordinates(lat, lng);
  const d = date || new Date();
  const params = buildParams();
  const times = new adhan.PrayerTimes(coords, d, params);
  return {
    Fajr:    times.fajr,
    Dhuhr:   times.dhuhr,
    Asr:     times.asr,
    Maghrib: times.maghrib,
    Isha:    times.isha,
  };
}

module.exports = { getTodayTimes, zipToCoords, METHOD_MAP };
