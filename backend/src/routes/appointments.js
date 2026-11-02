const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId } = require('../middleware/auth');
const { generateSlots, isValidDate, weekdayOf } = require('../utils/slots');
const { audit, notify } = require('../utils/audit');
const { getSettings } = require('../utils/settings');
const { sendMail } = require('../utils/mailer');

router.post('/', authenticate, authorize('patient'), async (req, res) => {
  const { doctor_id, date, time, reason } = req.body;
  if (!doctor_id || !isValidDate(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ message: 'doctor_id, date and time required' });
  if (new Date(`${date}T${time}:00`) < new Date()) return res.status(400).json({ message: 'Cannot book a past slot' });
  const patientId = await profileId(req.user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [doc] = await conn.query('SELECT d.id, d.user_id FROM doctors d WHERE d.id=? AND d.is_verified=1 FOR UPDATE', [doctor_id]);
    if (!doc.length) { await conn.rollback(); return res.status(404).json({ message: 'Doctor not available' }); }
    const [blocked] = await conn.query('SELECT 1 FROM doctor_blocked_dates WHERE doctor_id=? AND blocked_date=?', [doctor_id, date]);
    const [windows] = await conn.query('SELECT start_time,end_time,slot_minutes,break_start,break_end FROM doctor_availability WHERE doctor_id=? AND weekday=?', [doctor_id, weekdayOf(date)]);
    const valid = !blocked.length && generateSlots(windows).some(s => s.time === time);
    if (!valid) { await conn.rollback(); return res.status(400).json({ message: 'Doctor does not work at this time' }); }
    const settings = await getSettings();
    const status = settings.auto_confirm_appointments === 'true' ? 'Confirmed' : 'Pending';
    const [ins] = await conn.query(
      'INSERT INTO appointments (patient_id,doctor_id,appt_date,appt_time,reason,status) VALUES (?,?,?,?,?,?)',
      [patientId, doctor_id, date, time, reason || null, status]);
    await conn.commit();
    const verb = status === 'Confirmed' ? 'is confirmed' : 'is awaiting doctor confirmation';
    await notify(req.user.id, `Appointment ${status.toLowerCase()}`, `Your appointment on ${date} at ${time} ${verb}.`);
    await notify(doc[0].user_id, status === 'Pending' ? 'Appointment request' : 'New appointment', `A patient booked ${date} at ${time}.`);
    await sendMail(req.user.email, 'MediBridge appointment', `Your appointment on ${date} at ${time} ${verb}. Log in to MediBridge for details.`);
    await audit(req.user.id, 'BOOK_APPOINTMENT', 'appointment', ins.insertId);
    res.status(201).json({ id: ins.insertId, status, message: `Appointment ${status.toLowerCase()}` });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That slot was just booked. Please pick another.' });
    console.error(e); res.status(500).json({ message: 'Booking failed' });
  } finally { conn.release(); }
});

async function loadAuthorized(req, id) {
  const [rows] = await pool.query(
    `SELECT a.*, p.user_id AS patient_user, d.user_id AS doctor_user FROM appointments a
     JOIN patients p ON p.id=a.patient_id JOIN doctors d ON d.id=a.doctor_id WHERE a.id=?`, [id]);
  const a = rows[0];
  if (!a) return null;
  const ok = req.user.role === 'admin' || a.patient_user === req.user.id || a.doctor_user === req.user.id;
  return ok ? a : 'forbidden';
}

router.get('/', authenticate, async (req, res) => {
  let where = '1=1'; const p = [];
  if (req.user.role === 'patient') { where = 'a.patient_id=?'; p.push(await profileId(req.user)); }
  else if (req.user.role === 'doctor') { where = 'a.doctor_id=?'; p.push(await profileId(req.user)); }
  else if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden for your role' });
  if (req.query.status) { where += ' AND a.status=?'; p.push(req.query.status); }
  const [rows] = await pool.query(
    `SELECT a.id, a.appt_date, a.appt_time, a.status, a.reason, a.doctor_id, a.patient_id,
            du.name AS doctor_name, dc.specialty, pu.name AS patient_name
     FROM appointments a JOIN doctors dc ON dc.id=a.doctor_id JOIN users du ON du.id=dc.user_id
     JOIN patients pt ON pt.id=a.patient_id JOIN users pu ON pu.id=pt.user_id
     WHERE ${where} ORDER BY a.appt_date DESC, a.appt_time DESC`, p);
  res.json(rows);
});

router.get('/:id', authenticate, async (req, res) => {
  const a = await loadAuthorized(req, req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (a === 'forbidden') return res.status(403).json({ message: 'Forbidden' });
  res.json(a);
});

router.patch('/:id/cancel', authenticate, async (req, res) => {
  const a = await loadAuthorized(req, req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (a === 'forbidden') return res.status(403).json({ message: 'Forbidden' });
  if (['Completed', 'Cancelled', 'No-show'].includes(a.status)) return res.status(400).json({ message: `Cannot cancel a ${a.status} appointment` });
  await pool.query("UPDATE appointments SET status='Cancelled' WHERE id=?", [a.id]);
  const other = req.user.id === a.patient_user ? a.doctor_user : a.patient_user;
  await notify(other, 'Appointment cancelled', `Appointment on ${a.appt_date} at ${a.appt_time} was cancelled.`);
  await audit(req.user.id, 'CANCEL_APPOINTMENT', 'appointment', a.id);
  res.json({ message: 'Appointment cancelled' });
});

router.patch('/:id/reschedule', authenticate, authorize('patient'), async (req, res) => {
  const { date, time } = req.body;
  if (!isValidDate(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ message: 'date and time required' });
  const a = await loadAuthorized(req, req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (a === 'forbidden') return res.status(403).json({ message: 'Forbidden' });
  if (!['Pending', 'Confirmed'].includes(a.status)) return res.status(400).json({ message: 'Only active appointments can be rescheduled' });
  const [windows] = await pool.query('SELECT start_time,end_time,slot_minutes,break_start,break_end FROM doctor_availability WHERE doctor_id=? AND weekday=?', [a.doctor_id, weekdayOf(date)]);
  const [blocked] = await pool.query('SELECT 1 FROM doctor_blocked_dates WHERE doctor_id=? AND blocked_date=?', [a.doctor_id, date]);
  if (blocked.length || !generateSlots(windows).some(s => s.time === time)) return res.status(400).json({ message: 'Doctor does not work at this time' });
  try {
    await pool.query('UPDATE appointments SET appt_date=?, appt_time=? WHERE id=?', [date, time, a.id]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Slot already booked' });
    throw e;
  }
  await notify(a.doctor_user, 'Appointment rescheduled', `Moved to ${date} at ${time}.`);
  await audit(req.user.id, 'RESCHEDULE_APPOINTMENT', 'appointment', a.id);
  res.json({ message: 'Appointment rescheduled' });
});

router.patch('/:id/status', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  const { status } = req.body;
  if (!['Confirmed', 'Completed', 'No-show', 'Cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const a = await loadAuthorized(req, req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (a === 'forbidden') return res.status(403).json({ message: 'Forbidden' });
  if (req.user.role === 'doctor' && a.doctor_user !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
  await pool.query('UPDATE appointments SET status=? WHERE id=?', [status, a.id]);
  await notify(a.patient_user, 'Appointment updated', `Status is now ${status}.`);
  await audit(req.user.id, 'UPDATE_APPOINTMENT_STATUS', 'appointment', a.id);
  res.json({ message: 'Status updated' });
});

module.exports = router;
