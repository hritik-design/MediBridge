import { useEffect, useState } from 'react';
import api, { errMsg, download } from '../api';
import { Alert, Card, Empty, Field, Loading, Stat, StatusBadge, fmtTime, greeting, makeRun, useFlash } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const PIE = ['#0f766e', '#f59e0b', '#16a34a', '#94a3b8', '#dc2626', '#6366f1'];
const Box = ({ title, children }) => <div className="col-lg-6"><Card title={title}><div style={{ height: 260 }}>{children}</div></Card></div>;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AdminDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/admin/analytics').then(r => setD(r.data)); }, []);
  if (!d) return <Loading />;
  const t = d.totals;
  return (<>
    <div className="welcome-banner mb-4">
      <div><div className="welcome-eyebrow">{greeting()}</div><h2>{user.name}</h2><p>{t.pending_doctors ? `${t.pending_doctors} doctor${t.pending_doctors > 1 ? 's are' : ' is'} waiting for verification.` : 'Operations overview'}</p></div>
    </div>
    <div className="row g-3 mb-3"><Stat label="Registered patients" value={t.patients} /><Stat label="Verified doctors" value={t.verified_doctors} color="success" /><Stat label="Doctors awaiting verification" value={t.pending_doctors} color="warning" /><Stat label="Appointments today" value={t.appointments_today} />
      <Stat label="Pending appointment requests" value={t.pending_appointments} color="warning" /><Stat label="Low-stock alerts" value={t.low_stock} color="danger" /><Stat label="Expiring batches (60 d)" value={t.expiring_batches} color="warning" /><Stat label="Medicine products" value={t.medicines} /></div>
    <div className="row g-3 mb-3"><Stat label="Completion rate" value={`${d.rates.completion}%`} color="success" cols="col-4" /><Stat label="Cancellation rate" value={`${d.rates.cancellation}%`} color="secondary" cols="col-4" /><Stat label="No-show rate" value={`${d.rates.no_show}%`} color="danger" cols="col-4" /></div>
    <div className="row g-3">
      <Box title="Appointment trends">{d.overTime.length ? <ResponsiveContainer><LineChart data={d.overTime}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="appointments" stroke="#0f766e" /></LineChart></ResponsiveContainer> : <Empty text="No data" />}</Box>
      <Box title="Status distribution">{d.byStatus.length ? <ResponsiveContainer><PieChart><Pie data={d.byStatus} dataKey="value" nameKey="name" outerRadius={85} label>{d.byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <Empty text="No data" />}</Box>
      <Box title="Department-wise appointments">{d.byDept.length ? <ResponsiveContainer><BarChart data={d.byDept}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0f766e" /></BarChart></ResponsiveContainer> : <Empty text="No data" />}</Box>
      <Box title="Doctor workload">{d.workload.length ? <ResponsiveContainer><BarChart data={d.workload}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#6366f1" /></BarChart></ResponsiveContainer> : <Empty text="No data" />}</Box>
      <Box title="Patient registration trend">{d.registrations.length ? <ResponsiveContainer><LineChart data={d.registrations}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="patients" stroke="#6366f1" /></LineChart></ResponsiveContainer> : <Empty text="No data" />}</Box>
      <Box title="Low-stock medicines by category">{d.lowStockByCategory.length ? <ResponsiveContainer><BarChart data={d.lowStockByCategory}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f59e0b" /></BarChart></ResponsiveContainer> : <Empty text="No low-stock items" />}</Box>
    </div></>);
}

export function AdminPatients() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash();
  const load = () => api.get('/admin/patients').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-2">Patients</h3><p className="text-muted small">Account details only. Clinical records are not visible to administrators.</p><Alert type={flash.type}>{flash.msg}</Alert>
    {rows.length === 0 ? <Empty text="No patients" /> : <div className="table-responsive"><table className="table table-sm bg-white align-middle"><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Appointments</th><th>Active</th><th /></tr></thead>
      <tbody>{rows.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td>{p.created_at}</td><td>{p.appointments}</td><td>{p.is_active ? 'Yes' : 'No'}</td>
        <td><button className="btn btn-sm btn-outline-secondary" onClick={async () => { try { const u = (await api.get('/admin/users')).data.find(x => x.email === p.email); await api.patch(`/admin/users/${u.id}/active`, { is_active: !p.is_active }); load(); } catch (e) { setFlash(errMsg(e), 'danger'); } }}>{p.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}</>);
}

export function AdminAppointments() {
  const [rows, setRows] = useState(null); const [status, setStatus] = useState(''); const [date, setDate] = useState('');
  useEffect(() => { api.get('/admin/appointments', { params: { ...(status && { status }), ...(date && { date }) } }).then(r => setRows(r.data)); }, [status, date]);
  return (<><h3 className="mb-3">Appointments</h3>
    <div className="row g-2 mb-3"><div className="col-md-3"><select aria-label="Status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-show'].map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="col-md-3"><input aria-label="Date" type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} /></div></div>
    {!rows ? <Loading /> : rows.length === 0 ? <Empty text="No appointments" /> : <div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Specialty</th><th>Status</th></tr></thead>
      <tbody>{rows.map(a => <tr key={a.id}><td>{a.appt_date}</td><td>{fmtTime(a.appt_time)}</td><td>{a.patient_name}</td><td>{a.doctor_name}</td><td>{a.specialty}</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table></div>}</>);
}

export function AdminDoctors() {
  const [rows, setRows] = useState(null); const [hospitals, setHospitals] = useState([]); const [flash, setFlash] = useFlash(); const [sel, setSel] = useState(null);
  const load = () => api.get('/admin/doctors').then(r => setRows(r.data));
  useEffect(() => { load(); api.get('/admin/hospitals').then(r => setHospitals(r.data)); }, []);
  const run = makeRun(load, setFlash);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Doctors</h3><Alert type={flash.type}>{flash.msg}</Alert>
    {rows.length === 0 ? <Empty text="No doctors" /> : <div className="table-responsive"><table className="table table-sm bg-white align-middle"><thead><tr><th>Name</th><th>Specialty</th><th>Fee</th><th>Hospital / department</th><th>Verified</th><th /></tr></thead>
      <tbody>{rows.map(d => <tr key={d.id}><td>{d.name}<div className="small text-muted">{d.email}</div></td><td>{d.specialty}</td><td>₹{d.consultation_fee}</td><td className="small">{d.affiliations || '–'}</td><td>{d.is_verified ? 'Yes' : 'No'}</td>
        <td className="text-nowrap"><button className="btn btn-sm btn-outline-success me-1" onClick={() => run(() => api.patch(`/admin/doctors/${d.id}/verify`, { verified: !d.is_verified }), d.is_verified ? 'Verification revoked' : 'Doctor verified')}>{d.is_verified ? 'Revoke' : 'Verify'}</button>
          <button className="btn btn-sm btn-outline-primary" onClick={() => setSel({ id: d.id, name: d.name, ids: d.department_ids ? d.department_ids.split(',').map(Number) : [] })}>Assign departments</button></td></tr>)}</tbody></table></div>}
    {sel && <Card title={`Departments for ${sel.name}`}>{hospitals.map(h => <div key={h.id} className="mb-2"><strong>{h.name}</strong><div>{h.departments.map(dp => (
      <div className="form-check form-check-inline" key={dp.id}><input className="form-check-input" type="checkbox" id={`ad${dp.id}`} checked={sel.ids.includes(dp.id)} onChange={e => setSel({ ...sel, ids: e.target.checked ? [...sel.ids, dp.id] : sel.ids.filter(i => i !== dp.id) })} /><label className="form-check-label" htmlFor={`ad${dp.id}`}>{dp.name}</label></div>))}</div></div>)}
      <button className="btn btn-primary btn-sm me-2" onClick={() => run(async () => { await api.put(`/admin/doctors/${sel.id}/departments`, { department_ids: sel.ids }); setSel(null); }, 'Departments updated')}>Save</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setSel(null)}>Cancel</button></Card>}</>);
}

export function AdminUsers() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash(); const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'pharmacist' });
  const load = () => api.get('/admin/users').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const run = makeRun(load, setFlash);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Users & roles</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <Card title="Create staff account" className="mb-3"><div className="row g-2">
      <div className="col-md"><input aria-label="Name" className="form-control" placeholder="Name" value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} /></div>
      <div className="col-md"><input aria-label="Email" className="form-control" placeholder="Email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} /></div>
      <div className="col-md"><input aria-label="Temporary password" type="password" className="form-control" placeholder="Temporary password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} /></div>
      <div className="col-md-auto"><select aria-label="Role" className="form-select" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}><option value="pharmacist">Pharmacist</option><option value="admin">Admin</option></select></div>
      <div className="col-md-auto"><button className="btn btn-primary" onClick={() => run(async () => { await api.post('/admin/users', nu); setNu({ name: '', email: '', password: '', role: 'pharmacist' }); }, 'Account created')}>Create</button></div></div></Card>
    <div className="table-responsive"><table className="table table-sm bg-white align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
      <tbody>{rows.map(u => (<tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.is_active ? 'Yes' : 'No'}</td>
        <td className="text-nowrap">
          {['admin', 'pharmacist'].includes(u.role) && <button className="btn btn-sm btn-outline-primary me-1" onClick={() => run(() => api.patch(`/admin/users/${u.id}/role`, { role: u.role === 'admin' ? 'pharmacist' : 'admin' }), 'Role updated')}>Make {u.role === 'admin' ? 'pharmacist' : 'admin'}</button>}
          <button className="btn btn-sm btn-outline-secondary" onClick={() => run(() => api.patch(`/admin/users/${u.id}/active`, { is_active: !u.is_active }), 'Account updated')}>{u.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>))}</tbody></table></div></>);
}

export function AdminHospitals() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash(); const empty = { name: '', city: '', address: '', phone: '' };
  const [h, setH] = useState(empty); const [edit, setEdit] = useState(null);
  const load = () => api.get('/admin/hospitals').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const run = makeRun(load, setFlash);
  if (!rows) return <Loading />;
  const Form = ({ v, set }) => <div className="row g-2">{['name', 'city', 'address', 'phone'].map(k => <div className="col-md" key={k}><input aria-label={k} className="form-control" placeholder={k} value={v[k] || ''} onChange={e => set({ ...v, [k]: e.target.value })} /></div>)}</div>;
  return (<><h3 className="mb-3">Hospitals & branches</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <Card title="Add hospital / branch" className="mb-3"><Form v={h} set={setH} /><button className="btn btn-primary mt-2" onClick={() => run(async () => { await api.post('/admin/hospitals', h); setH(empty); }, 'Hospital added')}>Add</button></Card>
    {rows.map(x => (<div className="card mb-3" key={x.id}><div className="card-body">
      {edit?.id === x.id ? <><Form v={edit} set={setEdit} /><button className="btn btn-primary btn-sm mt-2 me-2" onClick={() => run(async () => { await api.put(`/admin/hospitals/${x.id}`, edit); setEdit(null); }, 'Hospital updated')}>Save</button><button className="btn btn-outline-secondary btn-sm mt-2" onClick={() => setEdit(null)}>Cancel</button></> : <>
        <div className="d-flex justify-content-between"><h5>{x.name} <small className="text-muted">{x.city} · {x.address} · {x.phone}</small></h5>
          <div><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEdit({ ...x })}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Delete hospital and its departments?') && run(() => api.delete(`/admin/hospitals/${x.id}`), 'Hospital deleted')}>Delete</button></div></div>
        <div>{x.departments.map(d => <span key={d.id} className="badge text-bg-light border me-1">{d.name}</span>)}</div></>}
    </div></div>))}</>);
}

export function AdminDepartments() {
  const [rows, setRows] = useState(null); const [hospitals, setHospitals] = useState([]); const [flash, setFlash] = useFlash(); const [nd, setNd] = useState({ hospital_id: '', name: '' }); const [edit, setEdit] = useState(null);
  const load = () => { api.get('/admin/departments').then(r => setRows(r.data)); api.get('/admin/hospitals').then(r => setHospitals(r.data)); };
  useEffect(() => { load(); }, []);
  const run = makeRun(load, setFlash);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Departments</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <Card title="Add department" className="mb-3"><div className="row g-2">
      <div className="col-md"><select aria-label="Hospital" className="form-select" value={nd.hospital_id} onChange={e => setNd({ ...nd, hospital_id: e.target.value })}><option value="">Hospital…</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
      <div className="col-md"><input aria-label="Department name" className="form-control" placeholder="Department name" value={nd.name} onChange={e => setNd({ ...nd, name: e.target.value })} /></div>
      <div className="col-md-auto"><button className="btn btn-primary" onClick={() => run(async () => { await api.post(`/admin/hospitals/${nd.hospital_id}/departments`, { name: nd.name }); setNd({ hospital_id: '', name: '' }); }, 'Department added')}>Add</button></div></div></Card>
    <table className="table table-sm bg-white align-middle"><thead><tr><th>Hospital</th><th>Department</th><th>Doctors</th><th /></tr></thead><tbody>{rows.map(d => (
      <tr key={d.id}><td>{d.hospital}</td><td>{edit?.id === d.id ? <input aria-label="Name" className="form-control form-control-sm" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /> : d.name}</td><td>{d.doctors}</td>
        <td className="text-nowrap">{edit?.id === d.id ? <><button className="btn btn-sm btn-primary me-1" onClick={() => run(async () => { await api.put(`/admin/departments/${d.id}`, { name: edit.name }); setEdit(null); }, 'Department renamed')}>Save</button><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button></> : <>
          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEdit({ id: d.id, name: d.name })}>Rename</button><button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Delete department?') && run(() => api.delete(`/admin/departments/${d.id}`), 'Department deleted')}>Delete</button></>}</td></tr>))}</tbody></table></>);
}

export function AdminFeedback() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/admin/feedback').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  if (!rows) return <Loading />;
  const avg = k => { const v = rows.filter(r => !r.flagged && r[k] != null); return v.length ? (v.reduce((s, r) => s + r[k], 0) / v.length).toFixed(1) : '–'; };
  return (<><h3>Feedback moderation</h3><p className="text-muted small">Ratings measure service experience (booking ease, waiting time). They are not evidence of clinical quality. Flagged items are excluded from averages.</p>
    <div className="row g-3 mb-3"><Stat label="Appointment experience" value={avg('rating')} /><Stat label="Ease of booking" value={avg('booking_ease')} /><Stat label="Waiting time" value={avg('waiting_time')} /><Stat label="Overall service" value={avg('overall')} /></div>
    {rows.length === 0 ? <Empty text="No feedback yet" /> : <ul className="list-group">{rows.map(f => (
      <li key={f.id} className={`list-group-item d-flex justify-content-between ${f.flagged ? 'list-group-item-danger' : ''}`}>
        <span>{f.rating}/5 · booking {f.booking_ease ?? '–'} · waiting {f.waiting_time ?? '–'} · overall {f.overall ?? '–'} – {f.doctor_name}: {f.comment}</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={async () => { await api.patch(`/admin/feedback/${f.id}/flag`, { flagged: !f.flagged }); load(); }}>{f.flagged ? 'Unflag' : 'Flag'}</button></li>))}</ul>}</>);
}

export function AdminAudit() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/admin/audit-logs').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Audit logs</h3><div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
    <tbody>{rows.map(l => <tr key={l.id}><td>{l.created_at}</td><td>{l.user_name || '–'}</td><td>{l.action}</td><td>{l.entity} {l.entity_id}</td></tr>)}</tbody></table></div></>);
}

export function AdminReports() {
  const [year, setYear] = useState(new Date().getFullYear()); const [d, setD] = useState(null);
  useEffect(() => { setD(null); api.get('/admin/reports', { params: { year } }).then(r => setD(r.data)); }, [year]);
  const chart = d ? MONTHS.map((m, i) => { const r = d.monthly.find(x => x.month === i + 1); return { month: m, total: r ? Number(r.total) : 0, completed: r ? Number(r.completed) : 0, cancelled: r ? Number(r.cancelled) : 0 }; }) : [];
  return (<>
    <div className="d-flex justify-content-between align-items-end mb-3 no-print"><h3>Operational reports</h3>
      <div className="d-flex gap-2"><input aria-label="Year" type="number" min="2020" max="2100" className="form-control" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))} />
        {['appointments', 'service-quality', 'registrations'].map(t => <button key={t} className="btn btn-outline-primary btn-sm" onClick={() => download('/admin/reports/export.csv', `${t}-${year}.csv`, { type: t, year })}>CSV: {t}</button>)}
        <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>Print / Save PDF</button></div></div>
    {!d ? <Loading /> : <>
      <h5 className="d-none d-print-block">MediBridge operational report – {d.year}</h5>
      <div className="row g-3 mb-3"><Stat label={`Appointments ${d.year}`} value={d.yearly.total} /><Stat label="Completed" value={d.yearly.completed} color="success" /><Stat label="Cancelled" value={d.yearly.cancelled} color="secondary" /><Stat label="New patients" value={d.yearly.new_patients} color="warning" /></div>
      <Card title="Monthly appointments" className="mb-3"><div style={{ height: 280 }}><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="total" fill="#0f766e" /><Bar dataKey="completed" fill="#16a34a" /><Bar dataKey="cancelled" fill="#94a3b8" /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Service-quality report (patient satisfaction, not clinical quality)">
        {d.serviceQuality.length === 0 ? <Empty text="No feedback this year" /> : <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Doctor</th><th>Responses</th><th>Experience</th><th>Booking ease</th><th>Waiting time</th><th>Overall</th></tr></thead>
          <tbody>{d.serviceQuality.map(q => <tr key={q.doctor}><td>{q.doctor}</td><td>{q.responses}</td><td>{q.appointment_experience}</td><td>{q.booking_ease ?? '–'}</td><td>{q.waiting_time ?? '–'}</td><td>{q.overall ?? '–'}</td></tr>)}</tbody></table></div>}</Card>
      <p className="small text-muted mt-2">{d.note} Report contains aggregated data only.</p></>}</>);
}

export function AdminSettings() {
  const [s, setS] = useState(null); const [flash, setFlash] = useFlash();
  useEffect(() => { api.get('/admin/settings').then(r => setS(r.data)); }, []);
  if (!s) return <Loading />;
  const save = async e => { e.preventDefault(); try { setS((await api.put('/admin/settings', s)).data); setFlash('Settings saved'); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  return (<div style={{ maxWidth: 520 }}><h3 className="mb-3">System settings</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <form onSubmit={save}>
      <Field label="Application name" id="s1" value={s.app_name} onChange={e => setS({ ...s, app_name: e.target.value })} />
      <div className="form-check form-switch mb-3"><input className="form-check-input" type="checkbox" id="s2" checked={s.auto_confirm_appointments === 'true'} onChange={e => setS({ ...s, auto_confirm_appointments: e.target.checked ? 'true' : 'false' })} />
        <label className="form-check-label" htmlFor="s2">Auto-confirm bookings (off = doctor must confirm; bookings start as Pending)</label></div>
      <Field label="Send appointment reminders this many hours before" id="s3" type="number" min="1" max="168" value={s.reminder_hours_before} onChange={e => setS({ ...s, reminder_hours_before: e.target.value })} />
      <Field label="Alert about batches expiring within (days)" id="s4" type="number" min="7" max="365" value={s.expiry_alert_days} onChange={e => setS({ ...s, expiry_alert_days: e.target.value })} />
      <button className="btn btn-primary">Save settings</button></form></div>);
}
