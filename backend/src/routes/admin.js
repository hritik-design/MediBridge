const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { audit, notify } = require('../utils/audit');
const { getSettings, DEFAULTS } = require('../utils/settings');
const validate = require('../middleware/validate');
const toCsv = require('../utils/csv');

router.use(authenticate, authorize('admin'));

router.get('/users', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, d.is_verified, d.id AS doctor_id, d.specialty
     FROM users u LEFT JOIN doctors d ON d.user_id=u.id ORDER BY u.created_at DESC`);
  res.json(rows);
});

router.post('/users', validate({ name: validate.rules.required('Name'), email: validate.rules.email, password: validate.rules.password }), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['admin', 'pharmacist'].includes(role)) return res.status(400).json({ message: 'Staff accounts can be created for admin or pharmacist roles' });
  try {
    const [r] = await pool.query('INSERT INTO users (name,email,password_hash,role,is_active) VALUES (?,?,?,?,1)', [name.trim(), email.toLowerCase(), await bcrypt.hash(password, 10), role]);
    await audit(req.user.id, `CREATE_${role.toUpperCase()}`, 'user', r.insertId);
    res.status(201).json({ id: r.insertId });
  } catch (e) { res.status(e.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: e.code === 'ER_DUP_ENTRY' ? 'Email already registered' : 'Failed' }); }
});

router.patch('/users/:id/role', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'You cannot change your own role' });
  if (!['admin', 'pharmacist'].includes(req.body.role)) return res.status(400).json({ message: 'Invalid role' });
  const [u] = await pool.query('SELECT role FROM users WHERE id=?', [req.params.id]);
  if (!u.length || !['admin', 'pharmacist'].includes(u[0].role)) return res.status(400).json({ message: 'Only admin/pharmacist staff roles can be reassigned' });
  await pool.query('UPDATE users SET role=?, token_version = token_version + 1 WHERE id=?', [req.body.role, req.params.id]);
  await audit(req.user.id, 'CHANGE_ROLE', 'user', Number(req.params.id));
  res.json({ message: 'Role updated' });
});

router.patch('/users/:id/active', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'Cannot change your own status' });
  await pool.query('UPDATE users SET is_active=?, token_version = token_version + 1 WHERE id=?', [req.body.is_active ? 1 : 0, req.params.id]);
  await audit(req.user.id, 'SET_USER_ACTIVE', 'user', Number(req.params.id));
  res.json({ message: 'Updated' });
});

router.patch('/doctors/:id/verify', async (req, res) => {
  const [d] = await pool.query('SELECT user_id FROM doctors WHERE id=?', [req.params.id]);
  if (!d.length) return res.status(404).json({ message: 'Doctor not found' });
  await pool.query('UPDATE doctors SET is_verified=? WHERE id=?', [req.body.verified ? 1 : 0, req.params.id]);
  await notify(d[0].user_id, 'Verification update', req.body.verified ? 'Your profile has been verified.' : 'Your verification was revoked.');
  await audit(req.user.id, 'VERIFY_DOCTOR', 'doctor', Number(req.params.id));
  res.json({ message: 'Updated' });
});

router.get('/doctors', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT d.id, u.name, u.email, u.is_active, d.specialty, d.is_verified, d.consultation_fee,
            GROUP_CONCAT(CONCAT(h.name,' – ',dp.name) SEPARATOR '; ') AS affiliations,
            GROUP_CONCAT(dp.id) AS department_ids
     FROM doctors d JOIN users u ON u.id=d.user_id LEFT JOIN doctor_departments dd ON dd.doctor_id=d.id
     LEFT JOIN departments dp ON dp.id=dd.department_id LEFT JOIN hospitals h ON h.id=dp.hospital_id GROUP BY d.id ORDER BY u.name`);
  res.json(rows);
});

router.put('/doctors/:id/departments', async (req, res) => {
  const ids = (req.body.department_ids || []).map(Number).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM doctor_departments WHERE doctor_id=?', [req.params.id]);
    for (const dep of ids) await conn.query('INSERT INTO doctor_departments (doctor_id,department_id) VALUES (?,?)', [req.params.id, dep]);
    await conn.commit();
    await audit(req.user.id, 'ASSIGN_DEPARTMENTS', 'doctor', Number(req.params.id));
    res.json({ message: 'Departments updated' });
  } catch (e) { await conn.rollback(); res.status(400).json({ message: 'Invalid doctor or department' }); }
  finally { conn.release(); }
});

router.get('/patients', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, u.name, u.email, u.is_active, u.created_at, COUNT(a.id) AS appointments
     FROM patients p JOIN users u ON u.id=p.user_id LEFT JOIN appointments a ON a.patient_id=p.id GROUP BY p.id ORDER BY u.created_at DESC`);
  res.json(rows);
});

router.get('/appointments', async (req, res) => {
  let sql = `SELECT a.id, a.appt_date, a.appt_time, a.status, pu.name AS patient_name, du.name AS doctor_name, d.specialty
     FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users pu ON pu.id=p.user_id
     JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id WHERE 1=1`;
  const p = [];
  if (req.query.status) { sql += ' AND a.status=?'; p.push(req.query.status); }
  if (req.query.date) { sql += ' AND a.appt_date=?'; p.push(req.query.date); }
  const [rows] = await pool.query(sql + ' ORDER BY a.appt_date DESC, a.appt_time DESC LIMIT 300', p);
  res.json(rows);
});

router.get('/hospitals', async (req, res) => {
  const [h] = await pool.query('SELECT * FROM hospitals ORDER BY name');
  for (const x of h) [x.departments] = await pool.query('SELECT id, name FROM departments WHERE hospital_id=?', [x.id]);
  res.json(h);
});
router.post('/hospitals', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  const [r] = await pool.query('INSERT INTO hospitals (name,city,address,phone) VALUES (?,?,?,?)', [req.body.name, req.body.city, req.body.address, req.body.phone]);
  await audit(req.user.id, 'ADD_HOSPITAL', 'hospital', r.insertId);
  res.status(201).json({ id: r.insertId });
});
router.put('/hospitals/:id', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  await pool.query('UPDATE hospitals SET name=?, city=?, address=?, phone=? WHERE id=?', [req.body.name, req.body.city, req.body.address, req.body.phone, req.params.id]);
  res.json({ message: 'Updated' });
});
router.delete('/hospitals/:id', async (req, res) => {
  await pool.query('DELETE FROM hospitals WHERE id=?', [req.params.id]);
  await audit(req.user.id, 'DELETE_HOSPITAL', 'hospital', Number(req.params.id));
  res.json({ message: 'Deleted' });
});

router.get('/departments', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT dp.id, dp.name, h.id AS hospital_id, h.name AS hospital, COUNT(dd.doctor_id) AS doctors
     FROM departments dp JOIN hospitals h ON h.id=dp.hospital_id LEFT JOIN doctor_departments dd ON dd.department_id=dp.id
     GROUP BY dp.id ORDER BY h.name, dp.name`);
  res.json(rows);
});
router.post('/hospitals/:id/departments', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  try {
    const [r] = await pool.query('INSERT INTO departments (hospital_id,name) VALUES (?,?)', [req.params.id, req.body.name]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { res.status(409).json({ message: 'Department exists or hospital invalid' }); }
});
router.put('/departments/:id', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  try { await pool.query('UPDATE departments SET name=? WHERE id=?', [req.body.name, req.params.id]); res.json({ message: 'Updated' }); }
  catch (e) { res.status(409).json({ message: 'Department name already exists in this hospital' }); }
});
router.delete('/departments/:id', async (req, res) => {
  await pool.query('DELETE FROM departments WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

router.get('/feedback', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT f.id, f.rating, f.booking_ease, f.waiting_time, f.overall, f.comment, f.flagged, f.created_at, du.name AS doctor_name
     FROM feedback f JOIN appointments a ON a.id=f.appointment_id JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
     ORDER BY f.created_at DESC`);
  res.json(rows);
});
router.patch('/feedback/:id/flag', async (req, res) => {
  await pool.query('UPDATE feedback SET flagged=? WHERE id=?', [req.body.flagged ? 1 : 0, req.params.id]);
  await audit(req.user.id, 'MODERATE_FEEDBACK', 'feedback', Number(req.params.id));
  res.json({ message: 'Updated' });
});

router.get('/audit-logs', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.created_at, u.name AS user_name
     FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 300`);
  res.json(rows);
});

router.get('/settings', async (req, res) => res.json(await getSettings()));
router.put('/settings', async (req, res) => {
  const b = req.body;
  const clean = {};
  if (b.auto_confirm_appointments !== undefined) clean.auto_confirm_appointments = b.auto_confirm_appointments === true || b.auto_confirm_appointments === 'true' ? 'true' : 'false';
  if (b.reminder_hours_before !== undefined) { const n = Number(b.reminder_hours_before); if (!(n >= 1 && n <= 168)) return res.status(400).json({ message: 'Reminder hours must be 1-168' }); clean.reminder_hours_before = String(n); }
  if (b.expiry_alert_days !== undefined) { const n = Number(b.expiry_alert_days); if (!(n >= 7 && n <= 365)) return res.status(400).json({ message: 'Expiry alert days must be 7-365' }); clean.expiry_alert_days = String(n); }
  if (b.app_name !== undefined) { if (!String(b.app_name).trim()) return res.status(400).json({ message: 'App name required' }); clean.app_name = String(b.app_name).trim().slice(0, 60); }
  for (const [k, v] of Object.entries(clean)) {
    if (!(k in DEFAULTS)) continue;
    await pool.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [k, v]);
  }
  await audit(req.user.id, 'UPDATE_SETTINGS', 'settings', null);
  res.json(await getSettings());
});

router.get('/analytics', async (req, res) => {
  const [[totals]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM patients) patients,
            (SELECT COUNT(*) FROM doctors WHERE is_verified=1) verified_doctors,
            (SELECT COUNT(*) FROM doctors WHERE is_verified=0) pending_doctors,
            (SELECT COUNT(*) FROM appointments WHERE appt_date=CURDATE()) appointments_today,
            (SELECT COUNT(*) FROM appointments WHERE status='Pending') pending_appointments`);
  const [byStatus] = await pool.query('SELECT status AS name, COUNT(*) AS value FROM appointments GROUP BY status');
  const [overTime] = await pool.query(`SELECT DATE_FORMAT(appt_date,'%Y-%m') AS month, COUNT(*) AS appointments FROM appointments GROUP BY month ORDER BY month DESC LIMIT 12`);
  const [byDept] = await pool.query('SELECT d.specialty AS name, COUNT(*) AS value FROM appointments a JOIN doctors d ON d.id=a.doctor_id GROUP BY d.specialty');
  const [workload] = await pool.query('SELECT u.name, COUNT(*) AS value FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=d.user_id GROUP BY u.name ORDER BY value DESC LIMIT 10');
  const [registrations] = await pool.query(`SELECT DATE_FORMAT(u.created_at,'%Y-%m') AS month, COUNT(*) AS patients FROM patients p JOIN users u ON u.id=p.user_id GROUP BY month ORDER BY month DESC LIMIT 12`);
  const [lowCat] = await pool.query(
    `SELECT COALESCE(category,'Uncategorised') AS name, COUNT(*) AS value FROM (
       SELECT m.id, m.category FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.expiry_date >= CURDATE()
       WHERE m.is_active=1 GROUP BY m.id HAVING COALESCE(SUM(b.quantity),0) <= MAX(m.min_stock)) t GROUP BY name`);
  const [[inv]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM medicines WHERE is_active=1) medicines,
            (SELECT COUNT(*) FROM medicine_batches WHERE quantity>0 AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)) expiring`);
  const total = byStatus.reduce((s, r) => s + r.value, 0);
  const rate = n => (total ? Math.round((1000 * (byStatus.find(r => r.name === n)?.value || 0)) / total) / 10 : 0);
  res.json({
    totals: { ...totals, low_stock: lowCat.reduce((s, r) => s + r.value, 0), medicines: inv.medicines, expiring_batches: inv.expiring },
    rates: { cancellation: rate('Cancelled'), completion: rate('Completed'), no_show: rate('No-show') },
    byStatus, overTime: overTime.reverse(), byDept, workload, registrations: registrations.reverse(), lowStockByCategory: lowCat,
  });
});

router.get('/reports', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const [monthly] = await pool.query(
    `SELECT MONTH(appt_date) AS month, COUNT(*) AS total, SUM(status='Completed') AS completed, SUM(status='Cancelled') AS cancelled, SUM(status='No-show') AS no_show
     FROM appointments WHERE YEAR(appt_date)=? GROUP BY month ORDER BY month`, [year]);
  const [[yearly]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(status='Completed'),0) AS completed, COALESCE(SUM(status='Cancelled'),0) AS cancelled, COALESCE(SUM(status='No-show'),0) AS no_show
     FROM appointments WHERE YEAR(appt_date)=?`, [year]);
  const [[reg]] = await pool.query('SELECT COUNT(*) AS c FROM patients p JOIN users u ON u.id=p.user_id WHERE YEAR(u.created_at)=?', [year]);
  const [quality] = await pool.query(
    `SELECT du.name AS doctor, COUNT(*) AS responses, ROUND(AVG(f.rating),2) AS appointment_experience, ROUND(AVG(f.booking_ease),2) AS booking_ease,
            ROUND(AVG(f.waiting_time),2) AS waiting_time, ROUND(AVG(f.overall),2) AS overall
     FROM feedback f JOIN appointments a ON a.id=f.appointment_id JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
     WHERE f.flagged=0 AND YEAR(f.created_at)=? GROUP BY d.id ORDER BY overall DESC`, [year]);
  res.json({ year, monthly, yearly: { ...yearly, new_patients: reg.c }, serviceQuality: quality,
    note: 'Ratings reflect patient satisfaction with the service experience, not clinical quality.' });
});

router.get('/reports/export.csv', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const type = req.query.type;
  let rows, cols;
  if (type === 'appointments') {
    [rows] = await pool.query(`SELECT MONTH(appt_date) AS month, COUNT(*) AS total, SUM(status='Completed') AS completed, SUM(status='Cancelled') AS cancelled, SUM(status='No-show') AS no_show FROM appointments WHERE YEAR(appt_date)=? GROUP BY month ORDER BY month`, [year]);
    cols = ['month', 'total', 'completed', 'cancelled', 'no_show'];
  } else if (type === 'service-quality') {
    [rows] = await pool.query(`SELECT du.name AS doctor, COUNT(*) AS responses, ROUND(AVG(f.rating),2) AS appointment_experience, ROUND(AVG(f.booking_ease),2) AS booking_ease, ROUND(AVG(f.waiting_time),2) AS waiting_time, ROUND(AVG(f.overall),2) AS overall FROM feedback f JOIN appointments a ON a.id=f.appointment_id JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id WHERE f.flagged=0 AND YEAR(f.created_at)=? GROUP BY d.id`, [year]);
    cols = ['doctor', 'responses', 'appointment_experience', 'booking_ease', 'waiting_time', 'overall'];
  } else if (type === 'registrations') {
    [rows] = await pool.query(`SELECT DATE_FORMAT(u.created_at,'%Y-%m') AS month, COUNT(*) AS new_patients FROM patients p JOIN users u ON u.id=p.user_id WHERE YEAR(u.created_at)=? GROUP BY month ORDER BY month`, [year]);
    cols = ['month', 'new_patients'];
  } else return res.status(400).json({ message: 'type must be appointments, service-quality or registrations' });
  await audit(req.user.id, 'EXPORT_REPORT', type, null);
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename="${type}-${year}.csv"`);
  res.send(toCsv(rows, cols));
});

module.exports = router;
