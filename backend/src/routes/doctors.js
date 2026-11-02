const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId } = require('../middleware/auth');
const { generateSlots, windowsOverlap, isValidDate, weekdayOf, toMinutes } = require('../utils/slots');
const { audit } = require('../utils/audit');

const WIN_COLS = 'start_time,end_time,slot_minutes,break_start,break_end';

async function slotsFor(doctorId, date) {
  const [blocked] = await pool.query('SELECT 1 FROM doctor_blocked_dates WHERE doctor_id=? AND blocked_date=?', [doctorId, date]);
  if (blocked.length) return [];
  const [windows] = await pool.query(`SELECT ${WIN_COLS} FROM doctor_availability WHERE doctor_id=? AND weekday=? ORDER BY start_time`, [doctorId, weekdayOf(date)]);
  const [booked] = await pool.query("SELECT appt_time FROM appointments WHERE doctor_id=? AND appt_date=? AND status<>'Cancelled'", [doctorId, date]);
  let slots = generateSlots(windows, booked.map(b => b.appt_time));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (date < today) return [];
  if (date === today) { const nowMin = now.getHours() * 60 + now.getMinutes(); slots = slots.filter(s => toMinutes(s.time) > nowMin); }
  return slots;
}

router.get('/', authenticate, async (req, res) => {
  const { specialty, hospital_id, department_id, max_fee, q, date, time_from, time_to } = req.query;
  let sql = `SELECT d.id, u.name, d.specialty, d.qualification, d.experience_years, d.consultation_fee,
                    GROUP_CONCAT(DISTINCT h.name SEPARATOR ', ') AS hospitals,
                    GROUP_CONCAT(DISTINCT dp.name SEPARATOR ', ') AS departments
             FROM doctors d JOIN users u ON u.id = d.user_id
             LEFT JOIN doctor_departments dd ON dd.doctor_id = d.id
             LEFT JOIN departments dp ON dp.id = dd.department_id
             LEFT JOIN hospitals h ON h.id = dp.hospital_id
             WHERE d.is_verified = 1 AND u.is_active = 1`;
  const p = [];
  if (specialty) { sql += ' AND d.specialty = ?'; p.push(specialty); }
  if (department_id) { sql += ' AND dd.department_id = ?'; p.push(department_id); }
  if (hospital_id) { sql += ' AND dp.hospital_id = ?'; p.push(hospital_id); }
  if (max_fee) { sql += ' AND d.consultation_fee <= ?'; p.push(max_fee); }
  if (q) { sql += ' AND u.name LIKE ?'; p.push(`%${q}%`); }
  const [rows] = await pool.query(sql + ' GROUP BY d.id ORDER BY u.name', p);
  if (date) {
    if (!isValidDate(date)) return res.status(400).json({ message: 'Invalid date' });
    const from = time_from ? toMinutes(time_from) : 0, to = time_to ? toMinutes(time_to) : 24 * 60;
    const out = [];
    for (const d of rows) {
      const free = (await slotsFor(d.id, date)).filter(s => s.available && toMinutes(s.time) >= from && toMinutes(s.time) < to);
      if (free.length) out.push({ ...d, matching_slots: free.map(s => s.time) });
    }
    return res.json(out);
  }
  res.json(rows);
});

router.get('/availability', authenticate, async (req, res) => {
  const { doctor_id, date } = req.query;
  if (!doctor_id || !isValidDate(date || '')) return res.status(400).json({ message: 'doctor_id and date (YYYY-MM-DD) required' });
  res.json({ date, slots: await slotsFor(doctor_id, date) });
});

router.put('/availability', authenticate, authorize('doctor'), async (req, res) => {
  const id = await profileId(req.user);
  const { windows = [], blocked_dates = [] } = req.body;
  const t = x => (typeof x === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(x));
  for (const w of windows) {
    if (!(w.weekday >= 0 && w.weekday <= 6) || !t(w.start_time) || !t(w.end_time) || w.start_time >= w.end_time) return res.status(400).json({ message: 'Invalid working hours' });
    if (!(w.slot_minutes >= 10 && w.slot_minutes <= 120)) return res.status(400).json({ message: 'Slot length must be 10-120 minutes' });
    if (w.break_start || w.break_end) {
      if (!t(w.break_start) || !t(w.break_end) || w.break_start >= w.break_end || w.break_start < w.start_time || w.break_end > w.end_time)
        return res.status(400).json({ message: 'Break must fall inside the working hours' });
    }
  }
  if (windowsOverlap(windows)) return res.status(400).json({ message: 'Working hours overlap on the same day' });
  for (const b of blocked_dates) if (!isValidDate(b.date)) return res.status(400).json({ message: 'Invalid blocked date' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM doctor_availability WHERE doctor_id=?', [id]);
    for (const w of windows) {
      await conn.query('INSERT INTO doctor_availability (doctor_id,weekday,start_time,end_time,slot_minutes,break_start,break_end) VALUES (?,?,?,?,?,?,?)',
        [id, w.weekday, w.start_time, w.end_time, w.slot_minutes, w.break_start || null, w.break_end || null]);
    }
    await conn.query('DELETE FROM doctor_blocked_dates WHERE doctor_id=?', [id]);
    for (const b of blocked_dates) await conn.query('INSERT INTO doctor_blocked_dates (doctor_id,blocked_date,reason) VALUES (?,?,?)', [id, b.date, b.reason || null]);
    await conn.commit();
    res.json({ message: 'Availability updated' });
  } catch (e) { await conn.rollback(); console.error(e); res.status(400).json({ message: 'Could not save availability (duplicate blocked dates?)' }); }
  finally { conn.release(); }
});

router.get('/my/availability', authenticate, authorize('doctor'), async (req, res) => {
  const id = await profileId(req.user);
  const [windows] = await pool.query(`SELECT weekday,${WIN_COLS} FROM doctor_availability WHERE doctor_id=? ORDER BY weekday, start_time`, [id]);
  const [blocked] = await pool.query('SELECT blocked_date AS date, reason FROM doctor_blocked_dates WHERE doctor_id=? ORDER BY blocked_date', [id]);
  res.json({ windows, blocked_dates: blocked });
});

router.get('/my/profile', authenticate, authorize('doctor'), async (req, res) => {
  const [d] = await pool.query(
    `SELECT u.name, u.email, d.specialty, d.qualification, d.experience_years, d.consultation_fee, d.is_verified,
            GROUP_CONCAT(DISTINCT CONCAT(h.name,' – ',dp.name) SEPARATOR '; ') AS affiliations,
            GROUP_CONCAT(DISTINCT dp.id) AS department_ids
     FROM doctors d JOIN users u ON u.id=d.user_id
     LEFT JOIN doctor_departments dd ON dd.doctor_id=d.id LEFT JOIN departments dp ON dp.id=dd.department_id LEFT JOIN hospitals h ON h.id=dp.hospital_id
     WHERE d.user_id=? GROUP BY d.id`, [req.user.id]);
  res.json(d[0]);
});

router.put('/profile', authenticate, authorize('doctor'), async (req, res) => {
  const { specialty, qualification, experience_years, consultation_fee } = req.body;
  if (!specialty || Number(consultation_fee) < 0 || Number(experience_years) < 0) return res.status(400).json({ message: 'Specialty is required; fee and experience cannot be negative' });
  await pool.query('UPDATE doctors SET specialty=?, qualification=?, experience_years=?, consultation_fee=? WHERE user_id=?',
    [specialty, qualification || null, experience_years || 0, consultation_fee || 0, req.user.id]);
  await audit(req.user.id, 'UPDATE_DOCTOR_PROFILE', 'doctor', await profileId(req.user));
  res.json({ message: 'Profile updated' });
});

router.put('/departments', authenticate, authorize('doctor'), async (req, res) => {
  const id = await profileId(req.user);
  const ids = (req.body.department_ids || []).map(Number).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM doctor_departments WHERE doctor_id=?', [id]);
    for (const dep of ids) await conn.query('INSERT INTO doctor_departments (doctor_id,department_id) VALUES (?,?)', [id, dep]);
    await conn.commit(); res.json({ message: 'Departments updated' });
  } catch (e) { await conn.rollback(); res.status(400).json({ message: 'Invalid department' }); }
  finally { conn.release(); }
});

router.get('/appointments', authenticate, authorize('doctor'), async (req, res) => {
  const id = await profileId(req.user);
  let sql = `SELECT a.id, a.appt_date, a.appt_time, a.status, a.reason, a.patient_id, u.name AS patient_name
     FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id WHERE a.doctor_id=?`;
  const p = [id];
  if (req.query.date) { sql += ' AND a.appt_date=?'; p.push(req.query.date); }
  const [rows] = await pool.query(sql + ' ORDER BY a.appt_date DESC, a.appt_time', p);
  res.json(rows);
});

router.get('/patients', authenticate, authorize('doctor'), async (req, res) => {
  const id = await profileId(req.user);
  const [rows] = await pool.query(
    `SELECT p.id, u.name, p.gender, p.dob, COUNT(a.id) AS visits, MAX(a.appt_date) AS last_visit
     FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id
     WHERE a.doctor_id=? GROUP BY p.id ORDER BY last_visit DESC`, [id]);
  res.json(rows);
});

router.get('/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT d.id, u.name, d.specialty, d.qualification, d.experience_years, d.consultation_fee
     FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.id=? AND d.is_verified=1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Doctor not found' });
  res.json(rows[0]);
});

module.exports = router;
