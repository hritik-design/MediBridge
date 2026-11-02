const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId, doctorTreats } = require('../middleware/auth');
const { audit } = require('../utils/audit');

router.use(authenticate);
const FIELDS = ['symptoms', 'observations', 'diagnosis', 'treatment_notes', 'follow_up_date', 'status'];

router.post('/', authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const { patient_id, appointment_id, symptoms, observations, diagnosis, treatment_notes, follow_up_date, status } = req.body;
  if (!patient_id || !(await doctorTreats(doctorId, patient_id))) return res.status(403).json({ message: 'No treatment relationship with this patient' });
  const [r] = await pool.query(
    `INSERT INTO medical_records (patient_id,doctor_id,appointment_id,symptoms,observations,diagnosis,treatment_notes,follow_up_date,status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [patient_id, doctorId, appointment_id || null, symptoms, observations, diagnosis, treatment_notes, follow_up_date || null, status === 'Finalized' ? 'Finalized' : 'Draft']);
  await audit(req.user.id, 'CREATE_RECORD', 'medical_record', r.insertId);
  res.status(201).json({ id: r.insertId });
});

router.get('/mine', authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const [rows] = await pool.query(
    `SELECT m.id, m.patient_id, u.name AS patient_name, m.diagnosis, m.status, m.follow_up_date, m.created_at
     FROM medical_records m JOIN patients p ON p.id=m.patient_id JOIN users u ON u.id=p.user_id
     WHERE m.doctor_id=? ORDER BY m.created_at DESC`, [doctorId]);
  res.json(rows);
});

router.get('/patient/:patientId', authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  if (!(await doctorTreats(doctorId, req.params.patientId))) return res.status(403).json({ message: 'Forbidden' });
  const [rows] = await pool.query(
    `SELECT m.*, u.name AS doctor_name FROM medical_records m JOIN doctors d ON d.id=m.doctor_id JOIN users u ON u.id=d.user_id
     WHERE m.patient_id=? ORDER BY m.created_at DESC`, [req.params.patientId]);
  await audit(req.user.id, 'VIEW_PATIENT_RECORDS', 'patient', Number(req.params.patientId));
  res.json(rows);
});

router.get('/:id', authorize('doctor', 'patient'), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM medical_records WHERE id=?', [req.params.id]);
  const m = rows[0];
  if (!m) return res.status(404).json({ message: 'Not found' });
  const pid = await profileId(req.user);
  const allowed = req.user.role === 'patient' ? (m.patient_id === pid && m.status === 'Finalized') : await doctorTreats(pid, m.patient_id);
  if (!allowed) return res.status(403).json({ message: 'Forbidden' });
  await audit(req.user.id, 'VIEW_RECORD', 'medical_record', m.id);
  res.json(m);
});

router.get('/:id/history', authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const [m] = await pool.query('SELECT doctor_id FROM medical_records WHERE id=?', [req.params.id]);
  if (!m.length) return res.status(404).json({ message: 'Not found' });
  if (m[0].doctor_id !== doctorId) return res.status(403).json({ message: 'Forbidden' });
  const [rows] = await pool.query('SELECT h.id, h.changes, h.created_at, u.name AS changed_by FROM record_history h JOIN users u ON u.id=h.changed_by WHERE record_id=? ORDER BY h.id DESC', [req.params.id]);
  res.json(rows);
});

router.put('/:id', authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const [rows] = await pool.query('SELECT * FROM medical_records WHERE id=?', [req.params.id]);
  const m = rows[0];
  if (!m) return res.status(404).json({ message: 'Not found' });
  if (m.doctor_id !== doctorId) return res.status(403).json({ message: 'Forbidden' });
  if (m.status === 'Finalized') return res.status(409).json({ message: 'Finalized records cannot be edited' });
  const next = { ...req.body, status: req.body.status === 'Finalized' ? 'Finalized' : 'Draft', follow_up_date: req.body.follow_up_date || null };
  const diff = {};
  for (const f of FIELDS) {
    const before = m[f] ?? null, after = next[f] ?? null;
    if (String(before) !== String(after)) diff[f] = { from: before, to: after };
  }
  await pool.query('UPDATE medical_records SET symptoms=?, observations=?, diagnosis=?, treatment_notes=?, follow_up_date=?, status=? WHERE id=?',
    [next.symptoms, next.observations, next.diagnosis, next.treatment_notes, next.follow_up_date, next.status, m.id]);
  if (Object.keys(diff).length) await pool.query('INSERT INTO record_history (record_id, changed_by, changes) VALUES (?,?,?)', [m.id, req.user.id, JSON.stringify(diff)]);
  await audit(req.user.id, 'UPDATE_RECORD', 'medical_record', m.id);
  res.json({ message: 'Record updated' });
});

module.exports = router;
