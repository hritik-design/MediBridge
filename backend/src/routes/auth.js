const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { rules } = validate;
const { audit, notifyRoles } = require('../utils/audit');

const sign = u => jwt.sign({ id: u.id, role: u.role, tv: u.token_version || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

router.post('/register',
  validate({ name: rules.required('Name'), email: rules.email, password: rules.password }),
  async (req, res) => {
    const { name, email, password, role = 'patient', phone, specialty, qualification, experience_years, consultation_fee } = req.body;
    if (!['patient', 'doctor', 'pharmacist'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const hash = await bcrypt.hash(password, 10);
      const active = role === 'pharmacist' ? 0 : 1;
      const [u] = await conn.query('INSERT INTO users (name,email,password_hash,role,is_active) VALUES (?,?,?,?,?)', [name.trim(), email.toLowerCase(), hash, role, active]);
      if (role === 'patient') await conn.query('INSERT INTO patients (user_id, phone) VALUES (?,?)', [u.insertId, phone || null]);
      if (role === 'doctor') {
        await conn.query('INSERT INTO doctors (user_id,specialty,qualification,experience_years,consultation_fee,is_verified) VALUES (?,?,?,?,?,0)',
          [u.insertId, specialty || null, qualification || null, experience_years || 0, consultation_fee || 0]);
      }
      await conn.commit();
      await audit(u.insertId, 'REGISTER', 'user', u.insertId);
      if (role !== 'patient') await notifyRoles(['admin'], 'Approval needed', `A new ${role} account is waiting for review.`);
      const msg = role === 'patient' ? 'Registered successfully' : 'Registered. Your account needs admin approval before privileged access.';
      res.status(201).json({ message: msg });
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already registered' });
      console.error(e); res.status(500).json({ message: 'Registration failed' });
    } finally { conn.release(); }
  });

router.post('/login', validate({ email: rules.email, password: rules.required('Password') }), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.body.email.toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(req.body.password, u.password_hash))) return res.status(401).json({ message: 'Invalid credentials' });
  if (!u.is_active) return res.status(403).json({ message: 'Account is inactive or awaiting approval' });
  await audit(u.id, 'LOGIN', 'user', u.id);
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

router.post('/logout', authenticate, async (req, res) => {
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id=?', [req.user.id]);
  await audit(req.user.id, 'LOGOUT', 'user', req.user.id);
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  const out = { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role };
  if (req.user.role === 'doctor') {
    const [d] = await pool.query('SELECT id, specialty, qualification, experience_years, consultation_fee, is_verified FROM doctors WHERE user_id = ?', [req.user.id]);
    out.doctor = d[0];
  }
  res.json(out);
});

router.put('/profile', authenticate, validate({ name: rules.required('Name') }), async (req, res) => {
  await pool.query('UPDATE users SET name=? WHERE id=?', [req.body.name.trim(), req.user.id]);
  res.json({ message: 'Profile updated' });
});

router.put('/password', authenticate, validate({ new_password: rules.password }), async (req, res) => {
  const [r] = await pool.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current_password || '', r[0].password_hash))) return res.status(400).json({ message: 'Current password incorrect' });
  await pool.query('UPDATE users SET password_hash=?, token_version = token_version + 1 WHERE id=?', [await bcrypt.hash(req.body.new_password, 10), req.user.id]);
  await audit(req.user.id, 'PASSWORD_CHANGE', 'user', req.user.id);
  const [u] = await pool.query('SELECT id, role, token_version FROM users WHERE id=?', [req.user.id]);
  res.json({ message: 'Password updated', token: sign(u[0]) });
});

module.exports = router;
