const pool = require('./config/db');
const { notify, notifyRoles } = require('./utils/audit');
const { getSettings } = require('./utils/settings');
const { sendMail } = require('./utils/mailer');

async function sendReminders() {
  const { reminder_hours_before } = await getSettings();
  const [rows] = await pool.query(
    `SELECT a.id, a.appt_date, a.appt_time, u.id AS user_id, u.email FROM appointments a
     JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id
     WHERE a.status IN ('Pending','Confirmed') AND a.reminder_sent=0
       AND TIMESTAMP(a.appt_date, a.appt_time) > NOW()
       AND TIMESTAMP(a.appt_date, a.appt_time) <= DATE_ADD(NOW(), INTERVAL ? HOUR)`, [Number(reminder_hours_before) || 24]);
  for (const a of rows) {
    await notify(a.user_id, 'Appointment reminder', `You have an appointment on ${a.appt_date} at ${String(a.appt_time).slice(0, 5)}.`);
    await sendMail(a.email, 'MediBridge appointment reminder', `Reminder: you have an appointment on ${a.appt_date} at ${String(a.appt_time).slice(0, 5)}. Log in to MediBridge for details.`);
    await pool.query('UPDATE appointments SET reminder_sent=1 WHERE id=?', [a.id]);
  }
  return rows.length;
}

async function inventoryAlerts() {
  const { expiry_alert_days } = await getSettings();
  const [exp] = await pool.query('SELECT COUNT(*) AS c FROM medicine_batches WHERE quantity>0 AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)', [Number(expiry_alert_days) || 60]);
  const [[low]] = await pool.query(
    `SELECT COUNT(*) AS c FROM (SELECT m.id FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.expiry_date >= CURDATE()
      WHERE m.is_active=1 GROUP BY m.id HAVING COALESCE(SUM(b.quantity),0) <= MAX(m.min_stock)) t`);
  if (exp[0].c) await notifyRoles(['pharmacist', 'admin'], 'Expiring stock', `${exp[0].c} batch(es) expire within ${expiry_alert_days} days.`);
  if (low.c) await notifyRoles(['pharmacist', 'admin'], 'Low stock', `${low.c} medicine(s) are at or below minimum stock.`);
}

function start() {
  if (process.env.ENABLE_JOBS === 'false') return;
  const cron = require('node-cron');
  cron.schedule('*/15 * * * *', () => sendReminders().catch(e => console.error('reminder job', e.message)));
  cron.schedule('0 8 * * *', () => inventoryAlerts().catch(e => console.error('inventory job', e.message)));
  console.log('Scheduled jobs started');
}
module.exports = { start, sendReminders, inventoryAlerts };
