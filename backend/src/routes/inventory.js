const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { audit, notifyRoles } = require('../utils/audit');
const toCsv = require('../utils/csv');

router.use(authenticate);

router.get('/medicines', authorize('doctor', 'pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.name, m.category, m.unit, m.min_stock, m.is_active,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity END),0) AS stock
     FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id
     WHERE m.is_active=1 GROUP BY m.id ORDER BY m.name`);
  res.json(rows);
});

router.post('/medicines', authorize('pharmacist', 'admin'), async (req, res) => {
  const { name, category, unit, min_stock } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  const [r] = await pool.query('INSERT INTO medicines (name,category,unit,min_stock) VALUES (?,?,?,?)', [name, category || null, unit || 'tablet', min_stock ?? 20]);
  await audit(req.user.id, 'ADD_MEDICINE', 'medicine', r.insertId);
  res.status(201).json({ id: r.insertId });
});

router.put('/medicines/:id', authorize('pharmacist', 'admin'), async (req, res) => {
  const { name, category, unit, min_stock } = req.body;
  await pool.query('UPDATE medicines SET name=?, category=?, unit=?, min_stock=? WHERE id=?', [name, category, unit, min_stock, req.params.id]);
  res.json({ message: 'Updated' });
});

router.delete('/medicines/:id', authorize('pharmacist', 'admin'), async (req, res) => {
  await pool.query('UPDATE medicines SET is_active=0 WHERE id=?', [req.params.id]);
  await audit(req.user.id, 'DEACTIVATE_MEDICINE', 'medicine', Number(req.params.id));
  res.json({ message: 'Medicine deactivated' });
});

router.get('/inventory/batches', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.id, m.name AS medicine, b.batch_no, b.expiry_date, b.quantity FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id WHERE m.is_active=1 ORDER BY b.expiry_date`);
  res.json(rows);
});

router.get('/inventory/low-stock', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.name, m.category, m.min_stock,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity END),0) AS stock
     FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id
     WHERE m.is_active=1 GROUP BY m.id HAVING stock <= m.min_stock ORDER BY stock`);
  res.json(rows);
});

router.get('/inventory/expiring', authorize('pharmacist', 'admin'), async (req, res) => {
  const days = Math.min(Number(req.query.days) || 90, 730);
  const [rows] = await pool.query(
    `SELECT b.id, m.name AS medicine, b.batch_no, b.expiry_date, b.quantity FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id
     WHERE b.quantity > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY b.expiry_date`, [days]);
  res.json(rows);
});

router.get('/inventory/transactions', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.type, t.quantity, t.note, t.created_at, m.name AS medicine, b.batch_no
     FROM inventory_transactions t JOIN medicine_batches b ON b.id=t.batch_id JOIN medicines m ON m.id=b.medicine_id
     ORDER BY t.created_at DESC LIMIT 100`);
  res.json(rows);
});

router.post('/inventory/receipts', authorize('pharmacist'), async (req, res) => {
  const { medicine_id, supplier_id, batch_no, expiry_date, quantity } = req.body;
  if (!medicine_id || !batch_no || !expiry_date || !(Number(quantity) > 0)) return res.status(400).json({ message: 'medicine_id, batch_no, expiry_date, positive quantity required' });
  if (new Date(expiry_date) <= new Date()) return res.status(400).json({ message: 'Cannot receive an expired batch' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [b] = await conn.query('INSERT INTO medicine_batches (medicine_id,supplier_id,batch_no,expiry_date,quantity) VALUES (?,?,?,?,?)',
      [medicine_id, supplier_id || null, batch_no, expiry_date, quantity]);
    await conn.query("INSERT INTO inventory_transactions (batch_id,type,quantity,performed_by,note) VALUES (?, 'RECEIPT', ?, ?, 'Stock receipt')", [b.insertId, quantity, req.user.id]);
    await conn.commit();
    res.status(201).json({ id: b.insertId });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Batch number already exists for this medicine' });
    res.status(400).json({ message: 'Could not record receipt' });
  } finally { conn.release(); }
});

router.post('/inventory/transactions', authorize('pharmacist'), async (req, res) => {
  const { batch_id, type, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!batch_id || !['RECEIPT', 'DISPENSE', 'ADJUSTMENT'].includes(type) || !Number.isInteger(qty) || qty === 0) return res.status(400).json({ message: 'Invalid transaction' });
  if (type !== 'ADJUSTMENT' && qty < 0) return res.status(400).json({ message: 'Quantity must be positive' });
  if (type === 'ADJUSTMENT' && !note) return res.status(400).json({ message: 'Adjustments require a note' });
  const delta = type === 'DISPENSE' ? -qty : qty;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [b] = await conn.query('SELECT b.quantity, b.expiry_date, m.name, m.min_stock FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.id=? FOR UPDATE', [batch_id]);
    if (!b.length) { await conn.rollback(); return res.status(404).json({ message: 'Batch not found' }); }
    if (type === 'DISPENSE' && new Date(b[0].expiry_date) < new Date()) { await conn.rollback(); return res.status(400).json({ message: 'Batch is expired' }); }
    if (b[0].quantity + delta < 0) { await conn.rollback(); return res.status(400).json({ message: 'Insufficient stock' }); }
    await conn.query('UPDATE medicine_batches SET quantity = quantity + ? WHERE id=?', [delta, batch_id]);
    await conn.query('INSERT INTO inventory_transactions (batch_id,type,quantity,performed_by,note) VALUES (?,?,?,?,?)', [batch_id, type, qty, req.user.id, note || null]);
    await conn.commit();
    if (b[0].quantity + delta <= b[0].min_stock) await notifyRoles(['pharmacist', 'admin'], 'Low stock', `${b[0].name} is at or below minimum stock.`);
    await audit(req.user.id, `STOCK_${type}`, 'batch', Number(batch_id));
    res.status(201).json({ message: 'Transaction recorded', new_quantity: b[0].quantity + delta });
  } catch (e) { await conn.rollback(); console.error(e); res.status(500).json({ message: 'Transaction failed' }); }
  finally { conn.release(); }
});

router.get('/suppliers', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name');
  res.json(rows);
});
router.post('/suppliers', authorize('pharmacist', 'admin'), async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  const [r] = await pool.query('INSERT INTO suppliers (name,contact) VALUES (?,?)', [req.body.name, req.body.contact || null]);
  res.status(201).json({ id: r.insertId });
});

router.put('/suppliers/:id', authorize('pharmacist', 'admin'), async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name required' });
  await pool.query('UPDATE suppliers SET name=?, contact=? WHERE id=?', [req.body.name, req.body.contact || null, req.params.id]);
  res.json({ message: 'Updated' });
});
router.delete('/suppliers/:id', authorize('pharmacist', 'admin'), async (req, res) => {
  try { await pool.query('DELETE FROM suppliers WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(409).json({ message: 'Supplier is used by stock batches and cannot be deleted' }); }
});

router.get('/inventory/monthly', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
            SUM(CASE WHEN type='RECEIPT' THEN quantity ELSE 0 END) AS received,
            SUM(CASE WHEN type='DISPENSE' THEN quantity ELSE 0 END) AS dispensed,
            SUM(CASE WHEN type='ADJUSTMENT' THEN quantity ELSE 0 END) AS adjusted
     FROM inventory_transactions GROUP BY month ORDER BY month DESC LIMIT 12`);
  res.json(rows.reverse());
});
router.get('/inventory/low-stock-by-category', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT COALESCE(category,'Uncategorised') AS name, COUNT(*) AS value FROM (
       SELECT m.id, m.category FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.expiry_date >= CURDATE()
       WHERE m.is_active=1 GROUP BY m.id HAVING COALESCE(SUM(b.quantity),0) <= MAX(m.min_stock)) t GROUP BY name`);
  res.json(rows);
});

router.get('/inventory/export.csv', authorize('pharmacist', 'admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.name AS medicine, m.category, b.batch_no, b.expiry_date, b.quantity, m.min_stock
     FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE m.is_active=1 ORDER BY m.name, b.expiry_date`);
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
  res.send(toCsv(rows, ['medicine', 'category', 'batch_no', 'expiry_date', 'quantity', 'min_stock']));
});

module.exports = router;
