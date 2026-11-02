import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Landing, Login, Register } from './pages/Public';
import { PatientDashboard, FindDoctors, BookAppointment, MyAppointments, MedicalHistory, Prescriptions, PatientDocuments, MyFeedback, PatientProfile } from './pages/Patient';
import { DoctorDashboard, DoctorAppointments, PatientRecords, DoctorPrescriptions, ConsultationHistory, Availability, DoctorProfile } from './pages/Doctor';
import { Pharmacist, Suppliers, PrescriptionReview, InventoryReports } from './pages/Pharmacist';
import { AdminDashboard, AdminPatients, AdminDoctors, AdminUsers, AdminHospitals, AdminDepartments, AdminAppointments, AdminFeedback, AdminAudit, AdminReports, AdminSettings } from './pages/Admin';
import { Notifications, AccountProfile } from './pages/Shared';

const P = ({ roles, children }) => <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
const R = (path, roles, el) => <Route key={path} path={path} element={<P roles={roles}>{el}</P>} />;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<P><Layout /></P>}>
        <Route path="/notifications" element={<Notifications />} />
        {R('/profile', ['pharmacist', 'admin'], <AccountProfile />)}
        {R('/patient', ['patient'], <PatientDashboard />)}
        {R('/patient/doctors', ['patient'], <FindDoctors />)}
        {R('/patient/book', ['patient'], <BookAppointment />)}
        {R('/patient/appointments', ['patient'], <MyAppointments />)}
        {R('/patient/history', ['patient'], <MedicalHistory />)}
        {R('/patient/prescriptions', ['patient'], <Prescriptions />)}
        {R('/patient/documents', ['patient'], <PatientDocuments />)}
        {R('/patient/feedback', ['patient'], <MyFeedback />)}
        {R('/patient/profile', ['patient'], <PatientProfile />)}
        {R('/doctor', ['doctor'], <DoctorDashboard />)}
        {R('/doctor/appointments', ['doctor'], <DoctorAppointments />)}
        {R('/doctor/patients', ['doctor'], <PatientRecords />)}
        {R('/doctor/prescriptions', ['doctor'], <DoctorPrescriptions />)}
        {R('/doctor/availability', ['doctor'], <Availability />)}
        {R('/doctor/history', ['doctor'], <ConsultationHistory />)}
        {R('/doctor/profile', ['doctor'], <DoctorProfile />)}
        {R('/pharmacist', ['pharmacist'], <Pharmacist />)}
        {R('/pharmacist/suppliers', ['pharmacist'], <Suppliers />)}
        {R('/pharmacist/prescriptions', ['pharmacist'], <PrescriptionReview />)}
        {R('/pharmacist/reports', ['pharmacist'], <InventoryReports />)}
        {R('/admin', ['admin'], <AdminDashboard />)}
        {R('/admin/patients', ['admin'], <AdminPatients />)}
        {R('/admin/doctors', ['admin'], <AdminDoctors />)}
        {R('/admin/users', ['admin'], <AdminUsers />)}
        {R('/admin/hospitals', ['admin'], <AdminHospitals />)}
        {R('/admin/departments', ['admin'], <AdminDepartments />)}
        {R('/admin/appointments', ['admin'], <AdminAppointments />)}
        {R('/admin/inventory', ['admin'], <InventoryReports admin />)}
        {R('/admin/feedback', ['admin'], <AdminFeedback />)}
        {R('/admin/reports', ['admin'], <AdminReports />)}
        {R('/admin/audit', ['admin'], <AdminAudit />)}
        {R('/admin/settings', ['admin'], <AdminSettings />)}
      </Route>
      <Route path="*" element={<div className="p-5 text-center"><h3>404 – Page not found</h3></div>} />
    </Routes>
  );
}
