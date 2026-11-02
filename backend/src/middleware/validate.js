module.exports = rules => (req, res, next) => {
  const errors = [];
  for (const [field, check] of Object.entries(rules)) {
    const msg = check(req.body[field], req.body);
    if (msg) errors.push({ field, message: msg });
  }
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });
  next();
};

module.exports.rules = {
  required: label => v => (v === undefined || v === null || String(v).trim() === '' ? `${label} is required` : null),
  email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '') ? null : 'Valid email is required'),
  password: v => (typeof v === 'string' && v.length >= 8 && /\d/.test(v) && /[A-Za-z]/.test(v)
    ? null : 'Password must be 8+ characters with letters and numbers'),
  int: label => v => (Number.isInteger(Number(v)) && Number(v) > 0 ? null : `${label} must be a positive integer`),
};
