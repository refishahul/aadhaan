const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'audio', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(mp3|wav|ogg|m4a)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only audio files allowed'), ok);
  },
});

const PRESETS = [
  { id: 'preset:makkah',  label: 'Makkah' },
  { id: 'preset:madinah', label: 'Madinah' },
  { id: 'preset:aqsa',    label: 'Al-Aqsa' },
];

router.get('/', (req, res) => {
  const uploads = fs.existsSync(UPLOAD_DIR)
    ? fs.readdirSync(UPLOAD_DIR)
        .filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f))
        .map((f) => ({ id: f, label: f }))
    : [];
  res.json({ presets: PRESETS, uploads });
});

router.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ ok: true, id: req.file.filename, label: req.file.originalname });
});

router.delete('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

module.exports = router;
