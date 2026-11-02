const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize, profileId } = require('../middleware/auth');

router.use(authenticate);

router.get('/notifications', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json(rows);
});
router.get('/notifications/unread-count', async (req, res) => {
  const [[r]] = await pool.query('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]);
  res.json({ count: r.c });
});
router.patch('/notifications/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ message: 'All marked read' });
});
router.patch('/notifications/:id/read', async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked read' });
});

router.get('/directory/hospitals', async (req, res) => {
  const [h] = await pool.query('SELECT id,name,city,address,phone FROM hospitals ORDER BY name');
  for (const x of h) [x.departments] = await pool.query('SELECT id,name FROM departments WHERE hospital_id=?', [x.id]);
  res.json(h);
});

const score = v => (v === undefined || v === null || v === '' ? null : (Number(v) >= 1 && Number(v) <= 5 ? Number(v) : NaN));

router.post('/feedback', authorize('patient'), async (req, res) => {
  const { appointment_id, comment } = req.body;
  const rating = score(req.body.rating), ease = score(req.body.booking_ease), wait = score(req.body.waiting_time), overall = score(req.body.overall);
  if (rating === null || [rating, ease, wait, overall].some(Number.isNaN)) return res.status(400).json({ message: 'Ratings must be between 1 and 5' });
  const pid = await profileId(req.user);
  const [a] = await pool.query("SELECT id FROM appointments WHERE id=? AND patient_id=? AND status='Completed'", [appointment_id, pid]);
  if (!a.length) return res.status(403).json({ message: 'Feedback allowed only for your completed appointments' });
  try {
    await pool.query('INSERT INTO feedback (appointment_id,patient_id,rating,booking_ease,waiting_time,overall,comment) VALUES (?,?,?,?,?,?,?)',
      [appointment_id, pid, rating, ease, wait, overall, (comment || '').slice(0, 500)]);
    res.status(201).json({ message: 'Thank you for your feedback' });
  } catch (e) { res.status(409).json({ message: 'Feedback already submitted' }); }
});

router.get('/feedback/mine', authorize('patient'), async (req, res) => {
  const pid = await profileId(req.user);
  const [rows] = await pool.query(
    `SELECT f.id, f.rating, f.booking_ease, f.waiting_time, f.overall, f.comment, f.created_at, a.appt_date, du.name AS doctor_name
     FROM feedback f JOIN appointments a ON a.id=f.appointment_id JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
     WHERE f.patient_id=? ORDER BY f.created_at DESC`, [pid]);
  res.json(rows);
});

module.exports = router;
