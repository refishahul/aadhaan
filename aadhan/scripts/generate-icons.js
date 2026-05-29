#!/usr/bin/env node
// Generates PWA icons at public/icons/icon-192.png and icon-512.png
// Uses sharp which has pre-built ARM64 binaries (no native compilation needed)

const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

function svgIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.42;
  // Crescent: outer circle minus offset inner circle (clip path trick)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="crescent">
      <circle cx="${cx}" cy="${cy}" r="${r}" />
    </clipPath>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0a3d3a"/>
  <!-- Outer moon circle -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#c9a84c" clip-path="url(#crescent)"/>
  <!-- Inner cutout to form crescent -->
  <circle cx="${cx + r * 0.32}" cy="${cy - r * 0.08}" r="${r * 0.78}" fill="#0a3d3a" clip-path="url(#crescent)"/>
  <!-- Small star -->
  <circle cx="${cx + r * 0.52}" cy="${cy - r * 0.55}" r="${r * 0.09}" fill="#c9a84c"/>
</svg>`;
}

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[icons] sharp not installed — skipping icon generation.');
    console.warn('[icons] Run: npm install sharp');
    return;
  }

  for (const size of [192, 512]) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    if (fs.existsSync(outPath)) {
      console.log(`[icons] icon-${size}.png already exists, skipping`);
      continue;
    }
    await sharp(Buffer.from(svgIcon(size)))
      .png()
      .toFile(outPath);
    console.log(`[icons] Generated icon-${size}.png`);
  }
}

generate().catch((e) => console.error('[icons] Error:', e.message));
