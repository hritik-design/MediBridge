const pool = require('../config/db');
const DEFAULTS = { auto_confirm_appointments: 'true', reminder_hours_before: '24', expiry_alert_days: '60', app_name: 'MediBridge' };

async function getSettings() {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
  const out = { ...DEFAULTS };
  rows.forEach(r => { out[r.setting_key] = r.setting_value; });
  return out;
}
module.exports = { getSettings, DEFAULTS };
