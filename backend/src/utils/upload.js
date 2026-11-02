const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DIR = path.resolve(process.env.UPLOAD_DIR || './private_uploads');
fs.mkdirSync(DIR, { recursive: true });

const ALLOWED = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };

const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('Only PDF, PNG or JPEG files up to 5 MB are allowed'))),
});

module.exports = { upload, DIR };
