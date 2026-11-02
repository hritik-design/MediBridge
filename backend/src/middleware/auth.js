const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT id, name, email, role, is_active, token_version FROM users WHERE id = ?', [payload.id]);
    const u = rows[0];
    if (!u || !u.is_active) return res.status(401).json({ message: 'Account unavailable' });
    if ((payload.tv ?? 0) !== u.token_version) return res.status(401).json({ message: 'Session ended. Please log in again.' });
    req.user = u;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Forbidden for your role' });

async function profileId(user) {
  if (user.role === 'patient') {
    const [r] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [user.id]);
    return r[0]?.id;
  }
  if (user.role === 'doctor') {
    const [r] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
    return r[0]?.id;
  }
  return null;
}

async function doctorTreats(doctorId, patientId) {
  const [r] = await pool.query('SELECT 1 FROM appointments WHERE doctor_id=? AND patient_id=? LIMIT 1', [doctorId, patientId]);
  return r.length > 0;
}

module.exports = { authenticate, authorize, profileId, doctorTreats };
