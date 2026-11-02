CREATE DATABASE IF NOT EXISTS medibridge CHARACTER SET utf8mb4;
USE medibridge;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('patient','doctor','pharmacist','admin') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(20), dob DATE, gender VARCHAR(20), address VARCHAR(255),
  emergency_contact VARCHAR(150),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospitals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL, city VARCHAR(100), address VARCHAR(255), phone VARCHAR(20)
);

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL, name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_dept (hospital_id, name),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialty VARCHAR(100), qualification VARCHAR(150), experience_years INT DEFAULT 0,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE doctor_departments (
  doctor_id INT NOT NULL, department_id INT NOT NULL,
  PRIMARY KEY (doctor_id, department_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL, weekday TINYINT NOT NULL,
  start_time TIME NOT NULL, end_time TIME NOT NULL, slot_minutes INT NOT NULL DEFAULT 30,
  break_start TIME NULL, break_end TIME NULL,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE doctor_blocked_dates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL, blocked_date DATE NOT NULL, reason VARCHAR(150),
  UNIQUE KEY uq_block (doctor_id, blocked_date),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL, doctor_id INT NOT NULL,
  appt_date DATE NOT NULL, appt_time TIME NOT NULL,
  reason VARCHAR(255),
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('Pending','Confirmed','Completed','Cancelled','No-show') NOT NULL DEFAULT 'Confirmed',
  active_slot VARCHAR(40) GENERATED ALWAYS AS (
    IF(status = 'Cancelled', NULL, CONCAT(doctor_id,'|',appt_date,'|',appt_time))
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_active_slot (active_slot),
  INDEX idx_appt_doctor_date (doctor_id, appt_date),
  INDEX idx_appt_patient (patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE medical_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL, doctor_id INT NOT NULL, appointment_id INT NULL,
  symptoms TEXT, observations TEXT, diagnosis TEXT, treatment_notes TEXT,
  follow_up_date DATE NULL,
  status ENUM('Draft','Finalized') NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

CREATE TABLE medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL, category VARCHAR(80), unit VARCHAR(30) DEFAULT 'tablet',
  min_stock INT NOT NULL DEFAULT 20, is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL, contact VARCHAR(100)
);

CREATE TABLE medicine_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT NOT NULL, supplier_id INT NULL,
  batch_no VARCHAR(50) NOT NULL, expiry_date DATE NOT NULL, quantity INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_batch (medicine_id, batch_no),
  CHECK (quantity >= 0),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL, type ENUM('RECEIPT','DISPENSE','ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL, performed_by INT NOT NULL, note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES medicine_batches(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
);

CREATE TABLE prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL, doctor_id INT NOT NULL, record_id INT NULL, notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (record_id) REFERENCES medical_records(id)
);

CREATE TABLE prescription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL, medicine_id INT NOT NULL,
  dosage VARCHAR(80), frequency VARCHAR(80), duration VARCHAR(80), instructions VARCHAR(255),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE, patient_id INT NOT NULL,
  rating TINYINT NOT NULL,
  booking_ease TINYINT NULL, waiting_time TINYINT NULL, overall TINYINT NULL,
  comment VARCHAR(500), flagged TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, title VARCHAR(150) NOT NULL, message VARCHAR(255),
  is_read TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL, action VARCHAR(80) NOT NULL, entity VARCHAR(50), entity_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE record_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_id INT NOT NULL, changed_by INT NOT NULL, changes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL, record_id INT NULL, uploaded_by INT NOT NULL,
  original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(100) NOT NULL,
  mime VARCHAR(80) NOT NULL, size INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE system_settings (
  setting_key VARCHAR(60) PRIMARY KEY, setting_value VARCHAR(255) NOT NULL
);
INSERT INTO system_settings VALUES
  ('auto_confirm_appointments','true'), ('reminder_hours_before','24'),
  ('expiry_alert_days','60'), ('app_name','MediBridge');
