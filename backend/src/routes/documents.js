const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize, profileId, doctorTreats } = require('../middleware/auth');
const { upload, DIR } = require('../utils/upload');
const { audit, notify } = require('../utils/audit');

router.use(authenticate, authorize('patient', 'doctor'));

const handleUpload = (req, res, next) => upload.single('file')(req, res, err => (err ? res.status(400).json({ message: err.message }) : next()));

router.post('/', handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const me = await profileId(req.user);
  let patientId = me;
  if (req.user.role === 'doctor') {
    patientId = Number(req.body.patient_id);
    if (!patientId || !(await doctorTreats(me, patientId))) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ message: 'No treatment relationship with this patient' }); }
  }
  const [r] = await pool.query('INSERT INTO documents (patient_id, record_id, uploaded_by, original_name, stored_name, mime, size) VALUES (?,?,?,?,?,?,?)',
    [patientId, req.body.record_id || null, req.user.id, req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype, req.file.size]);
  await audit(req.user.id, 'UPLOAD_DOCUMENT', 'document', r.insertId);
  if (req.user.role === 'doctor') {
    const [pu] = await pool.query('SELECT user_id FROM patients WHERE id=?', [patientId]);
    await notify(pu[0].user_id, 'New document', 'A document was added to your file.');
  }
  res.status(201).json({ id: r.insertId });
});

router.get('/', async (req, res) => {
  const me = await profileId(req.user);
  let pid = me;
  if (req.user.role === 'doctor') {
    pid = Number(req.query.patient_id);
    if (!pid || !(await doctorTreats(me, pid))) return res.status(403).json({ message: 'Forbidden' });
  }
  const [rows] = await pool.query('SELECT id, original_name, mime, size, created_at, uploaded_by FROM documents WHERE patient_id=? ORDER BY created_at DESC', [pid]);
  res.json(rows);
});

async function authorizedDoc(req) {
  const [rows] = await pool.query('SELECT * FROM documents WHERE id=?', [req.params.id]);
  const d = rows[0];
  if (!d) return null;
  const me = await profileId(req.user);
  const ok = req.user.role === 'patient' ? d.patient_id === me : await doctorTreats(me, d.patient_id);
  return ok ? d : 'forbidden';
}

router.get('/:id/download', async (req, res) => {
  const d = await authorizedDoc(req);
  if (!d) return res.status(404).json({ message: 'Not found' });
  if (d === 'forbidden') return res.status(403).json({ message: 'Forbidden' });
  const file = path.join(DIR, path.basename(d.stored_name));
  if (!fs.existsSync(file)) return res.status(404).json({ message: 'File missing' });
  await audit(req.user.id, 'DOWNLOAD_DOCUMENT', 'document', d.id);
  res.setHeader('Content-Type', d.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(d.original_name)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).pipe(res);
});

router.delete('/:id', async (req, res) => {
  const d = await authorizedDoc(req);
  if (!d) return res.status(404).json({ message: 'Not found' });
  if (d === 'forbidden' || d.uploaded_by !== req.user.id) return res.status(403).json({ message: 'You can delete only documents you uploaded' });
  await pool.query('DELETE FROM documents WHERE id=?', [d.id]);
  fs.unlink(path.join(DIR, path.basename(d.stored_name)), () => {});
  await audit(req.user.id, 'DELETE_DOCUMENT', 'document', d.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
