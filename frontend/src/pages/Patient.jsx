import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg, download } from '../api';
import { Alert, Avatar, Card, Empty, Field, Loading, Stat, StatusBadge, fmtTime, greeting, today, useFlash } from '../components/Common';
import { PasswordForm } from './Shared';

export function PatientDashboard() {
  const [d, setD] = useState(null); const nav = useNavigate(); const [spec, setSpec] = useState('');
  useEffect(() => { api.get('/patients/dashboard').then(r => setD(r.data)); }, []);
  if (!d) return <Loading />;
  const s = d.summary;
  return (<>
    <div className="welcome-banner mb-4">
      <div><div className="welcome-eyebrow">{greeting()}</div><h2>Welcome back, {d.name.split(' ')[0]}</h2><p>{d.next ? `Your next appointment is on ${d.next.appt_date} at ${fmtTime(d.next.appt_time)}.` : 'You have no upcoming appointments. Book one in a few clicks.'}</p></div>
      <Link to="/patient/book" className="btn btn-light">Book appointment</Link>
    </div>
    <div className="row g-3 mb-4">
      <Stat label="Total appointments" value={s.total} /><Stat label="Upcoming" value={s.upcoming} color="warning" />
      <Stat label="Completed" value={s.completed} color="success" /><Stat label="Cancelled" value={s.cancelled} color="secondary" />
    </div>
    <div className="row g-3 mb-3">
      <div className="col-lg-6"><Card title="Upcoming appointment">
        {d.next ? <div><div className="fs-5">{d.next.appt_date} at {fmtTime(d.next.appt_time)}</div><div>{d.next.doctor_name} <span className="text-muted">· {d.next.specialty}</span></div><StatusBadge status={d.next.status} /></div>
          : <Empty text="No upcoming appointment" />}</Card></div>
      <div className="col-lg-3"><Card title="Quick booking">
        <input aria-label="Specialty" className="form-control mb-2" placeholder="Specialty (e.g. Cardiology)" value={spec} onChange={e => setSpec(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={() => nav(`/patient/doctors${spec ? `?specialty=${encodeURIComponent(spec)}` : ''}`)}>Find a doctor</button></Card></div>
      <div className="col-lg-3"><Card title="Profile completion">
        <div className="progress mb-2" role="progressbar" aria-valuenow={d.profile_completion} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${d.profile_completion}%` }}>{d.profile_completion}%</div></div>
        {d.profile_completion < 100 && <Link to="/patient/profile" className="small">Complete your profile</Link>}</Card></div>
    </div>
    <div className="row g-3">
      <div className="col-lg-6"><Card title="Recent appointment history">
        {d.recent.length === 0 ? <Empty text="No appointments yet" /> : <table className="table table-sm mb-0"><tbody>{d.recent.map(a => (
          <tr key={a.id}><td>{a.appt_date}</td><td>{fmtTime(a.appt_time)}</td><td>{a.doctor_name}</td><td><StatusBadge status={a.status} /></td></tr>))}</tbody></table>}</Card></div>
      <div className="col-lg-6"><Card title="Recent prescriptions">
        {d.prescriptions.length === 0 ? <Empty text="No prescriptions" /> : d.prescriptions.map(p => (
          <div key={p.id} className="small mb-2"><strong>{p.created_at}</strong> · {p.doctor_name}: {p.items.map(i => i.medicine).join(', ')}</div>))}</Card></div>
      <div className="col-lg-6"><Card title="Recent medical records">
        {d.records.length === 0 ? <Empty text="No finalized records" /> : d.records.map(r => (<div key={r.id} className="small mb-2"><strong>{r.created_at}</strong> · {r.doctor_name}: {r.diagnosis}</div>))}</Card></div>
      <div className="col-lg-6"><Card title="Notifications">
        {d.notifications.length === 0 ? <Empty text="Nothing new" /> : d.notifications.map(n => (<div key={n.id} className={`small mb-2 ${n.is_read ? 'text-muted' : 'fw-semibold'}`}>{n.title}: {n.message}</div>))}
        <Link to="/notifications" className="small">All notifications</Link></Card></div>
    </div></>);
}

export function FindDoctors() {
  const nav = useNavigate(); const [qs] = useSearchParams();
  const [hospitals, setHospitals] = useState([]); const [doctors, setDoctors] = useState(null);
  const [f, setF] = useState({ q: '', specialty: qs.get('specialty') || '', hospital_id: '', department_id: '', max_fee: '', date: '', time_from: '', time_to: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const depts = hospitals.filter(h => !f.hospital_id || String(h.id) === f.hospital_id).flatMap(h => h.departments.map(d => ({ ...d, hospital: h.name })));
  const search = () => api.get('/doctors', { params: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).then(r => setDoctors(r.data));
  useEffect(() => { api.get('/directory/hospitals').then(r => setHospitals(r.data)); search(); }, []);
  return (<>
    <h3 className="mb-3">Find a doctor</h3>
    <div className="row g-2 filter-bar mx-0">
      <div className="col-md-3"><input className="form-control" placeholder="Doctor name" aria-label="Doctor name" value={f.q} onChange={set('q')} /></div>
      <div className="col-md-3"><input className="form-control" placeholder="Specialty" aria-label="Specialty" value={f.specialty} onChange={set('specialty')} /></div>
      <div className="col-md-3"><select aria-label="Hospital" className="form-select" value={f.hospital_id} onChange={e => setF({ ...f, hospital_id: e.target.value, department_id: '' })}><option value="">Any hospital</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
      <div className="col-md-3"><select aria-label="Department" className="form-select" value={f.department_id} onChange={set('department_id')}><option value="">Any department</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="col-md-3"><label className="form-label small mb-0" htmlFor="fd">Date</label><input id="fd" type="date" min={today()} className="form-control" value={f.date} onChange={set('date')} /></div>
      <div className="col-md-2"><label className="form-label small mb-0" htmlFor="ft1">From</label><input id="ft1" type="time" className="form-control" value={f.time_from} onChange={set('time_from')} /></div>
      <div className="col-md-2"><label className="form-label small mb-0" htmlFor="ft2">To</label><input id="ft2" type="time" className="form-control" value={f.time_to} onChange={set('time_to')} /></div>
      <div className="col-md-2"><label className="form-label small mb-0" htmlFor="ff">Max fee ₹</label><input id="ff" type="number" min="0" className="form-control" value={f.max_fee} onChange={set('max_fee')} /></div>
      <div className="col-md-3 d-flex align-items-end"><button className="btn btn-primary me-2" onClick={search}>Search</button>
        <button className="btn btn-outline-secondary" onClick={() => { setF({ q: '', specialty: '', hospital_id: '', department_id: '', max_fee: '', date: '', time_from: '', time_to: '' }); setTimeout(search, 0); }}>Reset</button></div>
    </div>
    {f.date && <div className="text-muted small mb-2">Showing verified doctors with open slots on {f.date}{f.time_from || f.time_to ? ` between ${f.time_from || '00:00'} and ${f.time_to || '24:00'}` : ''}.</div>}
    {!doctors ? <Loading /> : doctors.length === 0 ? <Empty text="No doctors match these filters" /> : (
      <div className="row g-3">{doctors.map(d => (
        <div className="col-md-6 col-xl-4" key={d.id}><div className="card h-100 stat-card doc-card"><div className="card-body">
          <div className="d-flex align-items-center gap-3 mb-2"><Avatar name={d.name} size="lg" /><div><h5 className="mb-0">{d.name}</h5><div className="text-muted">{d.specialty} · {d.experience_years} yrs</div></div></div>
          <div className="small">{d.qualification}</div>
          {d.hospitals && <div className="small text-muted">{d.hospitals} · {d.departments}</div>}
          <div className="my-2"><span className="fee-tag">₹{d.consultation_fee}</span> <span className="text-muted small">consultation fee</span></div>
          {d.matching_slots && <div className="d-flex flex-wrap gap-1 mb-2">{d.matching_slots.slice(0, 8).map(t => (
            <button key={t} className="btn btn-sm btn-outline-success" onClick={() => nav(`/patient/book?doctor=${d.id}&date=${f.date}&time=${t}`)}>{t}</button>))}</div>}
          <button className="btn btn-outline-primary btn-sm" onClick={() => nav(`/patient/book?doctor=${d.id}${f.date ? `&date=${f.date}` : ''}`)}>Book</button>
        </div></div></div>))}</div>)}
  </>);
}

export function BookAppointment() {
  const [qs] = useSearchParams(); const nav = useNavigate();
  const [doctors, setDoctors] = useState([]); const [doctorId, setDoctorId] = useState(qs.get('doctor') || '');
  const [date, setDate] = useState(qs.get('date') || ''); const [time, setTime] = useState(qs.get('time') || '');
  const [slots, setSlots] = useState([]); const [reason, setReason] = useState(''); const [flash, setFlash] = useFlash();
  useEffect(() => { api.get('/doctors').then(r => setDoctors(r.data)); }, []);
  const loadSlots = () => doctorId && date ? api.get('/doctors/availability', { params: { doctor_id: doctorId, date } }).then(r => setSlots(r.data.slots)).catch(() => setSlots([])) : setSlots([]);
  useEffect(() => { loadSlots(); }, [doctorId, date]);
  const doc = doctors.find(d => String(d.id) === String(doctorId));
  const confirmBooking = async () => {
    try { const { data } = await api.post('/appointments', { doctor_id: doctorId, date, time, reason }); setFlash(`${data.message}. Redirecting…`); setTimeout(() => nav('/patient/appointments'), 1200); }
    catch (e) { setFlash(errMsg(e), 'danger'); setTime(''); loadSlots(); }
  };
  return (<div style={{ maxWidth: 760 }}>
    <h3 className="mb-3">Book an appointment</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <div className="row g-3 mb-3">
      <div className="col-md-6"><label className="form-label" htmlFor="bd">1. Doctor</label>
        <select id="bd" className="form-select" value={doctorId} onChange={e => { setDoctorId(e.target.value); setTime(''); }}><option value="">Select a doctor…</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name} – {d.specialty} (₹{d.consultation_fee})</option>)}</select></div>
      <div className="col-md-6"><label className="form-label" htmlFor="bdt">2. Date</label><input id="bdt" type="date" min={today()} className="form-control" value={date} onChange={e => { setDate(e.target.value); setTime(''); }} /></div>
    </div>
    {doctorId && date && <><label className="form-label">3. Time slot</label>
      {slots.length === 0 ? <Empty text="No slots on this date" /> : <div className="d-flex flex-wrap gap-2 mb-3">{slots.map(s => (
        <button key={s.time} disabled={!s.available} className={`btn slot-btn ${time === s.time ? 'btn-success' : s.available ? 'btn-outline-success' : 'btn-outline-secondary'}`} onClick={() => setTime(s.time)}>{s.time}</button>))}</div>}</>}
    {time && <><div className="mb-3"><label className="form-label" htmlFor="br">Reason (optional)</label><input id="br" className="form-control" maxLength={255} value={reason} onChange={e => setReason(e.target.value)} /></div>
      <div className="alert alert-light border">Confirm <strong>{doc?.name}</strong> on <strong>{date}</strong> at <strong>{time}</strong>{doc ? ` · fee ₹${doc.consultation_fee}` : ''}</div>
      <button className="btn btn-primary" onClick={confirmBooking}>Confirm appointment</button></>}
  </div>);
}

const Rate = ({ label, id, value, onChange }) => (
  <div className="col-md-3"><label className="form-label small" htmlFor={id}>{label}</label>
    <select id={id} className="form-select" value={value} onChange={e => onChange(e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n}>{n}</option>)}</select></div>);

export function MyAppointments() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash(); const [fb, setFb] = useState(null); const [resch, setResch] = useState(null); const [slots, setSlots] = useState([]);
  const load = () => api.get('/appointments').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (resch?.date) api.get('/doctors/availability', { params: { doctor_id: resch.doctor_id, date: resch.date } }).then(r => setSlots(r.data.slots)).catch(() => setSlots([])); }, [resch?.date]);
  const cancel = async id => { if (!confirm('Cancel this appointment?')) return; try { await api.patch(`/appointments/${id}/cancel`); setFlash('Appointment cancelled'); load(); } catch (e) { setFlash(errMsg(e), 'danger'); } };
  const sendFb = async () => { try { await api.post('/feedback', fb); setFlash('Thank you for your feedback'); setFb(null); } catch (e) { setFlash(errMsg(e), 'danger'); } };
  const sendResch = async () => { try { await api.patch(`/appointments/${resch.id}/reschedule`, { date: resch.date, time: resch.time }); setFlash('Appointment rescheduled'); setResch(null); load(); } catch (e) { setFlash(errMsg(e), 'danger'); } };
  if (!rows) return <Loading />;
  return (<>
    <h3 className="mb-3">My appointments</h3><Alert type={flash.type}>{flash.msg}</Alert>
    {rows.length === 0 ? <Empty text="No appointments" /> : <div className="table-responsive"><table className="table table-sm align-middle bg-white">
      <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map(a => (<tr key={a.id}><td>{a.appt_date}</td><td>{fmtTime(a.appt_time)}</td><td>{a.doctor_name} <span className="text-muted small">{a.specialty}</span></td><td><StatusBadge status={a.status} /></td>
        <td className="text-nowrap">{['Pending', 'Confirmed'].includes(a.status) && <>
          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => { setSlots([]); setResch({ id: a.id, doctor_id: a.doctor_id, date: '', time: '' }); }}>Reschedule</button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(a.id)}>Cancel</button></>}
          {a.status === 'Completed' && <button className="btn btn-sm btn-outline-success" onClick={() => setFb({ appointment_id: a.id, rating: 5, booking_ease: 5, waiting_time: 5, overall: 5, comment: '' })}>Rate</button>}</td></tr>))}</tbody></table></div>}
    {resch && <Card title="Reschedule" className="mb-3">
      <input aria-label="New date" type="date" min={today()} className="form-control w-auto mb-2" value={resch.date} onChange={e => setResch({ ...resch, date: e.target.value, time: '' })} />
      <div className="d-flex flex-wrap gap-2 mb-2">{slots.map(s => <button key={s.time} disabled={!s.available} className={`btn btn-sm ${resch.time === s.time ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setResch({ ...resch, time: s.time })}>{s.time}</button>)}</div>
      <button className="btn btn-primary btn-sm me-2" disabled={!resch.time} onClick={sendResch}>Confirm</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setResch(null)}>Close</button></Card>}
    {fb && <Card title="Rate your experience (service experience, not clinical outcome)">
      <div className="row g-2 mb-2">
        <Rate label="Appointment experience" id="r1" value={fb.rating} onChange={v => setFb({ ...fb, rating: v })} /><Rate label="Ease of booking" id="r2" value={fb.booking_ease} onChange={v => setFb({ ...fb, booking_ease: v })} />
        <Rate label="Waiting time" id="r3" value={fb.waiting_time} onChange={v => setFb({ ...fb, waiting_time: v })} /><Rate label="Overall service" id="r4" value={fb.overall} onChange={v => setFb({ ...fb, overall: v })} /></div>
      <textarea aria-label="Comment" className="form-control mb-2" maxLength={500} placeholder="Comments" value={fb.comment} onChange={e => setFb({ ...fb, comment: e.target.value })} />
      <button className="btn btn-primary btn-sm me-2" onClick={sendFb}>Submit</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setFb(null)}>Close</button></Card>}
  </>);
}

export function MedicalHistory() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/patients/medical-records').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Medical history</h3>{rows.length === 0 ? <Empty text="No finalized records yet" /> :
    rows.map(r => (<div className="card mb-3" key={r.id}><div className="card-body">
      <div className="d-flex justify-content-between"><strong>{r.doctor_name}</strong><span className="text-muted small">{r.created_at}</span></div>
      <dl className="row mb-0 mt-2">
        <dt className="col-sm-3">Symptoms</dt><dd className="col-sm-9">{r.symptoms}</dd>
        <dt className="col-sm-3">Observations</dt><dd className="col-sm-9">{r.observations}</dd>
        <dt className="col-sm-3">Diagnosis</dt><dd className="col-sm-9">{r.diagnosis}</dd>
        <dt className="col-sm-3">Treatment</dt><dd className="col-sm-9">{r.treatment_notes}</dd>
        {r.follow_up_date && <><dt className="col-sm-3">Follow-up</dt><dd className="col-sm-9">{r.follow_up_date}</dd></>}
      </dl></div></div>))}</>);
}

export function Prescriptions() {
  const [rows, setRows] = useState(null); const [printId, setPrintId] = useState(null);
  useEffect(() => { api.get('/patients/prescriptions').then(r => setRows(r.data)); }, []);
  const print = id => { setPrintId(id); setTimeout(() => { window.print(); setPrintId(null); }, 50); };
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3 no-print">Prescriptions</h3>
    {rows.length === 0 ? <Empty text="No prescriptions" /> : rows.filter(p => !printId || p.id === printId).map(p => (
      <div className="card mb-3" key={p.id}><div className="card-body">
        <div className="d-none d-print-block mb-2"><h4>MediBridge – Prescription #{p.id}</h4><div className="small">Synthetic demo document – not a valid medical prescription.</div></div>
        <div className="d-flex justify-content-between"><strong>Prescribed by {p.doctor_name}</strong><span className="text-muted small">{p.created_at}</span></div>
        <table className="table table-sm mt-2 mb-2"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
          <tbody>{p.items.map(i => <tr key={i.id}><td>{i.medicine}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration}</td><td>{i.instructions}</td></tr>)}</tbody></table>
        <button className="btn btn-outline-secondary btn-sm no-print" onClick={() => print(p.id)}>Print this prescription</button>
      </div></div>))}</>);
}

export function PatientDocuments() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash();
  const load = () => api.get('/documents').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const upload = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { await api.post('/documents', fd); setFlash('Document uploaded'); load(); } catch (x) { setFlash(errMsg(x), 'danger'); }
    e.target.value = '';
  };
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">My documents</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <div className="mb-3"><label className="form-label" htmlFor="up">Upload a document (PDF, PNG or JPEG, max 5 MB)</label><input id="up" type="file" accept=".pdf,.png,.jpg,.jpeg" className="form-control" onChange={upload} /></div>
    {rows.length === 0 ? <Empty text="No documents" /> : <ul className="list-group">{rows.map(d => (
      <li key={d.id} className="list-group-item d-flex justify-content-between align-items-center"><span>{d.original_name} <span className="text-muted small">· {Math.round(d.size / 1024)} KB · {d.created_at}</span></span>
        <span><button className="btn btn-sm btn-outline-primary me-1" onClick={() => download(`/documents/${d.id}/download`, d.original_name)}>Download</button>
          <button className="btn btn-sm btn-outline-danger" onClick={async () => { if (confirm('Delete?')) { try { await api.delete(`/documents/${d.id}`); load(); } catch (x) { setFlash(errMsg(x), 'danger'); } } }}>Delete</button></span></li>))}</ul>}</>);
}

export function MyFeedback() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/feedback/mine').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">My feedback</h3>{rows.length === 0 ? <Empty text="You haven't submitted feedback yet. Rate a completed appointment from My Appointments." /> :
    <div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>Date</th><th>Doctor</th><th>Experience</th><th>Booking</th><th>Waiting</th><th>Overall</th><th>Comment</th></tr></thead>
      <tbody>{rows.map(f => <tr key={f.id}><td>{f.appt_date}</td><td>{f.doctor_name}</td><td>{f.rating}</td><td>{f.booking_ease ?? '–'}</td><td>{f.waiting_time ?? '–'}</td><td>{f.overall ?? '–'}</td><td>{f.comment}</td></tr>)}</tbody></table></div>}</>);
}

export function PatientProfile() {
  const [f, setF] = useState(null); const [flash, setFlash] = useFlash();
  useEffect(() => { api.get('/patients/profile').then(r => setF(r.data)); }, []);
  if (!f) return <Loading />;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); try { await api.put('/patients/profile', f); setFlash('Profile saved'); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  return (<div style={{ maxWidth: 560 }}><h3 className="mb-3">My profile</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <form onSubmit={save}>
      <Field label="Name" id="pn" value={f.name || ''} onChange={set('name')} />
      <Field label="Email" id="pe" value={f.email || ''} disabled />
      <Field label="Phone" id="pp" value={f.phone || ''} onChange={set('phone')} />
      <Field label="Date of birth" id="pd" type="date" value={f.dob || ''} onChange={set('dob')} />
      <Field label="Gender" id="pg" value={f.gender || ''} onChange={set('gender')} />
      <Field label="Address" id="pa" value={f.address || ''} onChange={set('address')} />
      <Field label="Emergency contact (name and phone)" id="pc" value={f.emergency_contact || ''} onChange={set('emergency_contact')} />
      <button className="btn btn-primary">Save</button></form>
    <PasswordForm /></div>);
}
