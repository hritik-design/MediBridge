require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

(async () => {
  const hash = await bcrypt.hash('Password@123', 10);
  const user = async (name, email, role) =>
    (await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [name, email, hash, role]))[0].insertId;

  await user('Admin User', 'admin@medibridge.test', 'admin');
  await user('Priya Pharmacist', 'pharmacist@medibridge.test', 'pharmacist');

  const pu = await user('Rahul Patient', 'patient@medibridge.test', 'patient');
  await pool.query('INSERT INTO patients (user_id,phone,gender,emergency_contact) VALUES (?,?,?,?)', [pu, '9000000001', 'Male', 'Family - 9000000002']);

  const [h] = await pool.query('INSERT INTO hospitals (name,city,address,phone) VALUES (?,?,?,?)', ['City General Hospital', 'Ludhiana', '12 Demo Road', '0161-000000']);
  const depts = {};
  for (const d of ['Cardiology', 'Dermatology', 'Pediatrics']) {
    depts[d] = (await pool.query('INSERT INTO departments (hospital_id,name) VALUES (?,?)', [h.insertId, d]))[0].insertId;
  }
  const doctorIds = [];
  const docs = [['Dr. Anita Sharma', 'anita@medibridge.test', 'Cardiology', 'MD Cardiology', 12, 800],
                ['Dr. Vikram Singh', 'vikram@medibridge.test', 'Dermatology', 'MD Dermatology', 8, 600],
                ['Dr. Meera Kapoor', 'meera@medibridge.test', 'Pediatrics', 'MD Pediatrics', 10, 500]];
  for (const [n, e, sp, q, x, fee] of docs) {
    const u = await user(n, e, 'doctor');
    const [d] = await pool.query('INSERT INTO doctors (user_id,specialty,qualification,experience_years,consultation_fee,is_verified) VALUES (?,?,?,?,?,1)', [u, sp, q, x, fee]);
    await pool.query('INSERT INTO doctor_departments VALUES (?,?)', [d.insertId, depts[sp]]);
    for (const wd of [1, 2, 3, 4, 5]) {
      await pool.query('INSERT INTO doctor_availability (doctor_id,weekday,start_time,end_time,slot_minutes,break_start,break_end) VALUES (?,?,?,?,30,?,?)', [d.insertId, wd, '09:00', '13:00', '11:00', '11:15']);
    }
    doctorIds.push(d.insertId);
  }
  const [s] = await pool.query('INSERT INTO suppliers (name,contact) VALUES (?,?)', ['HealthSupply Co', 'supply@demo.test']);
  const meds = [['Paracetamol 500mg', 'Analgesic', 50], ['Amoxicillin 250mg', 'Antibiotic', 30], ['Cetirizine 10mg', 'Antihistamine', 20]];
  for (const [n, c, min] of meds) {
    const [m] = await pool.query('INSERT INTO medicines (name,category,min_stock) VALUES (?,?,?)', [n, c, min]);
    await pool.query('INSERT INTO medicine_batches (medicine_id,supplier_id,batch_no,expiry_date,quantity) VALUES (?,?,?,?,?)',
      [m.insertId, s.insertId, 'B' + m.insertId + '01', '2027-12-31', n.startsWith('Cetirizine') ? 10 : 200]);
  }
  const [[pt]] = await pool.query('SELECT id FROM patients LIMIT 1');
  const past = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const [a1] = await pool.query("INSERT INTO appointments (patient_id,doctor_id,appt_date,appt_time,reason,status) VALUES (?,?,?,?,?,'Completed')", [pt.id, doctorIds[0], past(14), '09:00', 'Routine check-up']);
  await pool.query("INSERT INTO appointments (patient_id,doctor_id,appt_date,appt_time,reason,status) VALUES (?,?,?,?,?,'Cancelled')", [pt.id, doctorIds[1], past(7), '10:00', 'Skin review']);
  const [rec] = await pool.query("INSERT INTO medical_records (patient_id,doctor_id,appointment_id,symptoms,observations,diagnosis,treatment_notes,status) VALUES (?,?,?,?,?,?,?,'Finalized')",
    [pt.id, doctorIds[0], a1.insertId, 'Mild fatigue (demo)', 'Vitals within normal range (demo)', 'Demo diagnosis entered by clinician', 'Rest and follow-up (demo)']);
  const [rx] = await pool.query('INSERT INTO prescriptions (patient_id,doctor_id,record_id,notes) VALUES (?,?,?,?)', [pt.id, doctorIds[0], rec.insertId, 'Demo prescription']);
  const [[med]] = await pool.query('SELECT id FROM medicines LIMIT 1');
  await pool.query('INSERT INTO prescription_items (prescription_id,medicine_id,dosage,frequency,duration,instructions) VALUES (?,?,?,?,?,?)', [rx.insertId, med.id, '1 tablet', 'Twice daily', '5 days', 'After food']);
  console.log('Seeded. Login password for all demo users: Password@123');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
