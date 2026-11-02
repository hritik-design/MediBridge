require('dotenv').config();
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }
const app = require('./app');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log(`MediBridge API running on port ${PORT}`); require('./jobs').start(); });
