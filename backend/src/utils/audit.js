const pool = require('../config/db');

async function audit(userId, action, entity, entityId, conn) {
  try {
    await (conn || pool).query('INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [userId || null, action, entity || null, entityId || null]);
  } catch (e) { console.error('audit failed', e.message); }
}

async function notify(userId, title, message, conn) {
  try { await (conn || pool).query('INSERT INTO notifications (user_id, title, message) VALUES (?,?,?)', [userId, title, message]); }
  catch (e) { console.error('notify failed', e.message); }
}

async function notifyRoles(roles, title, message) {
  const [users] = await pool.query(`SELECT id FROM users WHERE is_active=1 AND role IN (${roles.map(() => '?').join(',')})`, roles);
  for (const u of users) await notify(u.id, title, message);
}

module.exports = { audit, notify, notifyRoles };
