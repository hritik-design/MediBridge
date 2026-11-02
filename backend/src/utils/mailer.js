let transporter = null;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t) return false;
  try { await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text }); return true; }
  catch (e) { console.error('mail failed:', e.message); return false; }
}
module.exports = { sendMail };
