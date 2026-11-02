const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId } = require('../middleware/auth');

router.use(authenticate, authorize('patient'));

router.get('/profile', async (req, res) => {
  const [r] = await pool.query(
    `SELECT u.name, u.email, p.phone, p.dob, p.gender, p.address, p.emergency_contact
     FROM patients p JOIN users u ON u.id=p.user_id WHERE p.user_id=?`, [req.user.id]);
  res.json(r[0]);
});

router.put('/profile', async (req, res) => {
  const { name, phone, dob, gender, address, emergency_contact } = req.body;
  if (name) await pool.query('UPDATE users SET name=? WHERE id=?', [name, req.user.id]);
  await pool.query('UPDATE patients SET phone=?, dob=?, gender=?, address=?, emergency_contact=? WHERE user_id=?',
    [phone || null, dob || null, gender || null, address || null, emergency_contact || null, req.user.id]);
  res.json({ message: 'Profile updated' });
});

router.get('/medical-records', async (req, res) => {
  const id = await profileId(req.user);
  const [rows] = await pool.query(
    `SELECT m.id, m.symptoms, m.observations, m.diagnosis, m.treatment_notes, m.follow_up_date, m.created_at, u.name AS doctor_name
     FROM medical_records m JOIN doctors d ON d.id=m.doctor_id JOIN users u ON u.id=d.user_id
     WHERE m.patient_id=? AND m.status='Finalized' ORDER BY m.created_at DESC`, [id]);
  res.json(rows);
});

router.get('/prescriptions', async (req, res) => {
  const id = await profileId(req.user);
  res.json(await require('./prescriptions').fetchForPatient(id));
});

router.get('/dashboard', async (req, res) => {
  const id = await profileId(req.user);
  const [[s]] = await pool.query(
    `SELECT COUNT(*) total,
       COALESCE(SUM(status IN ('Pending','Confirmed') AND appt_date >= CURDATE()),0) upcoming,
       COALESCE(SUM(status='Completed'),0) completed, COALESCE(SUM(status='Cancelled'),0) cancelled
     FROM appointments WHERE patient_id=?`, [id]);
  const [next] = await pool.query(
    `SELECT a.id, a.appt_date, a.appt_time, a.status, du.name AS doctor_name, d.specialty
     FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
     WHERE a.patient_id=? AND a.status IN ('Pending','Confirmed') AND (a.appt_date > CURDATE() OR (a.appt_date = CURDATE() AND a.appt_time >= CURTIME()))
     ORDER BY a.appt_date, a.appt_time LIMIT 1`, [id]);
  const [recent] = await pool.query(
    `SELECT a.id, a.appt_date, a.appt_time, a.status, du.name AS doctor_name, d.specialty
     FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
     WHERE a.patient_id=? ORDER BY a.appt_date DESC, a.appt_time DESC LIMIT 5`, [id]);
  const rx = (await require('./prescriptions').fetchForPatient(id)).slice(0, 3);
  const [records] = await pool.query(
    `SELECT m.id, m.diagnosis, m.created_at, u.name AS doctor_name FROM medical_records m JOIN doctors d ON d.id=m.doctor_id JOIN users u ON u.id=d.user_id
     WHERE m.patient_id=? AND m.status='Finalized' ORDER BY m.created_at DESC LIMIT 3`, [id]);
  const [notes] = await pool.query('SELECT id, title, message, created_at, is_read FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 4', [req.user.id]);
  const [[prof]] = await pool.query('SELECT p.phone, p.dob, p.gender, p.address, p.emergency_contact FROM patients p WHERE p.id=?', [id]);
  const fields = Object.values(prof);
  const completion = Math.round(100 * fields.filter(v => v !== null && v !== '').length / fields.length);
  res.json({ name: req.user.name, summary: s, next: next[0] || null, recent, prescriptions: rx, records, notifications: notes, profile_completion: completion });
});

module.exports = router;
