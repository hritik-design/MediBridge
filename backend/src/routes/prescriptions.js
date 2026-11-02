const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId, doctorTreats } = require('../middleware/auth');
const { audit, notify } = require('../utils/audit');

async function fetchForPatient(patientId) {
  const [rx] = await pool.query(
    `SELECT p.id, p.notes, p.created_at, u.name AS doctor_name FROM prescriptions p
     JOIN doctors d ON d.id=p.doctor_id JOIN users u ON u.id=d.user_id
     WHERE p.patient_id=? ORDER BY p.created_at DESC`, [patientId]);
  for (const r of rx) {
    const [items] = await pool.query(
      `SELECT i.id, m.name AS medicine, i.dosage, i.frequency, i.duration, i.instructions
       FROM prescription_items i JOIN medicines m ON m.id=i.medicine_id WHERE i.prescription_id=?`, [r.id]);
    r.items = items;
  }
  return rx;
}

router.post('/', authenticate, authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const { patient_id, record_id, notes, items } = req.body;
  if (!patient_id || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'patient_id and at least one item required' });
  if (!(await doctorTreats(doctorId, patient_id))) return res.status(403).json({ message: 'No treatment relationship with this patient' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [p] = await conn.query('INSERT INTO prescriptions (patient_id,doctor_id,record_id,notes) VALUES (?,?,?,?)', [patient_id, doctorId, record_id || null, notes || null]);
    for (const it of items) {
      if (!it.medicine_id || !it.dosage || !it.frequency || !it.duration) throw new Error('invalid item');
      await conn.query('INSERT INTO prescription_items (prescription_id,medicine_id,dosage,frequency,duration,instructions) VALUES (?,?,?,?,?,?)',
        [p.insertId, it.medicine_id, it.dosage, it.frequency, it.duration, it.instructions || null]);
    }
    await conn.commit();
    const [pu] = await pool.query('SELECT user_id FROM patients WHERE id=?', [patient_id]);
    await notify(pu[0].user_id, 'New prescription', 'A new prescription is available in your account.');
    await audit(req.user.id, 'CREATE_PRESCRIPTION', 'prescription', p.insertId);
    res.status(201).json({ id: p.insertId });
  } catch (e) { await conn.rollback(); res.status(400).json({ message: 'Invalid prescription data' }); }
  finally { conn.release(); }
});

router.get('/mine', authenticate, authorize('doctor'), async (req, res) => {
  const doctorId = await profileId(req.user);
  const [rows] = await pool.query(
    `SELECT p.id, p.created_at, p.notes, u.name AS patient_name, COUNT(i.id) AS items
     FROM prescriptions p JOIN patients pt ON pt.id=p.patient_id JOIN users u ON u.id=pt.user_id
     LEFT JOIN prescription_items i ON i.prescription_id=p.id WHERE p.doctor_id=? GROUP BY p.id ORDER BY p.created_at DESC`, [doctorId]);
  res.json(rows);
});

router.get('/review/recent', authenticate, authorize('pharmacist'), async (req, res) => {
  const [rx] = await pool.query(
    `SELECT p.id, p.created_at, u.name AS patient_name, du.name AS doctor_name
     FROM prescriptions p JOIN patients pt ON pt.id=p.patient_id JOIN users u ON u.id=pt.user_id
     JOIN doctors d ON d.id=p.doctor_id JOIN users du ON du.id=d.user_id ORDER BY p.created_at DESC LIMIT 50`);
  for (const r of rx) {
    const [items] = await pool.query('SELECT m.name AS medicine, i.dosage, i.frequency, i.duration, i.instructions FROM prescription_items i JOIN medicines m ON m.id=i.medicine_id WHERE i.prescription_id=?', [r.id]);
    r.items = items;
  }
  await audit(req.user.id, 'PHARMACIST_REVIEW_PRESCRIPTIONS', 'prescription', null);
  res.json(rx);
});

router.get('/patient/:id', authenticate, authorize('doctor', 'pharmacist'), async (req, res) => {
  const all = await fetchForPatient(req.params.id);
  if (req.user.role === 'doctor') {
    const doctorId = await profileId(req.user);
    if (!(await doctorTreats(doctorId, req.params.id))) return res.status(403).json({ message: 'Forbidden' });
  }
  await audit(req.user.id, 'VIEW_PRESCRIPTIONS', 'patient', Number(req.params.id));
  res.json(all);
});

router.get('/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM prescriptions WHERE id=?', [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).json({ message: 'Not found' });
  const pid = await profileId(req.user);
  const ok = (req.user.role === 'patient' && p.patient_id === pid) || (req.user.role === 'doctor' && p.doctor_id === pid) || req.user.role === 'pharmacist';
  if (!ok) return res.status(403).json({ message: 'Forbidden' });
  const [items] = await pool.query('SELECT i.*, m.name AS medicine FROM prescription_items i JOIN medicines m ON m.id=i.medicine_id WHERE prescription_id=?', [p.id]);
  res.json({ ...p, items });
});

module.exports = router;
module.exports.fetchForPatient = fetchForPatient;
