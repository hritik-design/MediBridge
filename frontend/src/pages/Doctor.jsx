import { useEffect, useState } from 'react';
import api, { errMsg, download } from '../api';
import { Alert, Card, Empty, Field, Loading, Stat, StatusBadge, fmtTime, greeting, today, useFlash } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { PasswordForm } from './Shared';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PIE = ['#0f766e', '#f59e0b', '#16a34a', '#94a3b8', '#dc2626'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function DoctorDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null); const [av, setAv] = useState(null);
  useEffect(() => { api.get('/doctors/appointments').then(r => setRows(r.data)); api.get('/doctors/my/availability').then(r => setAv(r.data)); }, []);
  if (!rows || !av) return <Loading />;
  const t = today();
  const count = s => rows.filter(r => r.status === s).length;
  const todays = rows.filter(r => r.appt_date === t && r.status !== 'Cancelled').sort((a, b) => a.appt_time.localeCompare(b.appt_time));
  const upcoming = rows.filter(r => r.appt_date >= t && ['Confirmed', 'Pending'].includes(r.status)).sort((a, b) => (a.appt_date + a.appt_time).localeCompare(b.appt_date + b.appt_time));
  const chart = ['Confirmed', 'Pending', 'Completed', 'Cancelled', 'No-show'].map(n => ({ name: n, value: count(n) })).filter(x => x.value);
  return (<>
    <div className="welcome-banner mb-4">
      <div><div className="welcome-eyebrow">{greeting()}</div><h2>{user.name}</h2><p>{todays.length ? `You have ${todays.length} appointment${todays.length > 1 ? 's' : ''} today.` : 'No appointments today.'}</p></div>
    </div>
    {user.doctor && !user.doctor.is_verified && <Alert type="warning">Your profile is awaiting admin verification. Patients cannot book you until you are verified.</Alert>}
    <div className="row g-3 mb-4"><Stat label="Today" value={todays.length} /><Stat label="Upcoming consultations" value={upcoming.length} color="warning" />
      <Stat label="Completed consultations" value={count('Completed')} color="success" /><Stat label="Pending requests" value={count('Pending')} color="danger" /></div>
    <div className="row g-3">
      <div className="col-lg-6"><Card title="Today's appointments">{todays.length === 0 ? <Empty text="Nothing scheduled today" /> :
        <table className="table table-sm mb-0"><tbody>{todays.map(a => <tr key={a.id}><td>{fmtTime(a.appt_time)}</td><td>{a.patient_name}</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table>}</Card></div>
      <div className="col-lg-6"><Card title="Patient appointment schedule (next 8)">{upcoming.length === 0 ? <Empty text="No upcoming appointments" /> :
        <table className="table table-sm mb-0"><tbody>{upcoming.slice(0, 8).map(a => <tr key={a.id}><td>{a.appt_date}</td><td>{fmtTime(a.appt_time)}</td><td>{a.patient_name}</td></tr>)}</tbody></table>}</Card></div>
      <div className="col-lg-6"><Card title="Appointment status"><div style={{ height: 240 }}>{chart.length === 0 ? <Empty text="No data yet" /> :
        <ResponsiveContainer><PieChart><Pie data={chart} dataKey="value" nameKey="name" outerRadius={80} label>{chart.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div></Card></div>
      <div className="col-lg-6"><Card title="Availability summary">{av.windows.length === 0 ? <Empty text="No working hours set" /> :
        <ul className="list-unstyled mb-2">{av.windows.map((w, i) => <li key={i}>{DAYS[w.weekday]}: {fmtTime(w.start_time)}–{fmtTime(w.end_time)} · {w.slot_minutes} min{w.break_start ? ` · break ${fmtTime(w.break_start)}–${fmtTime(w.break_end)}` : ''}</li>)}</ul>}
        {av.blocked_dates.length > 0 && <div className="small text-muted">Blocked: {av.blocked_dates.map(b => b.date).join(', ')}</div>}</Card></div>
    </div></>);
}

const emptyItem = { medicine_id: '', dosage: '', frequency: '', duration: '', instructions: '' };
function ConsultPanel({ patientId, patientName, appointmentId, meds, onClose, onSaved, setFlash }) {
  const [rec, setRec] = useState({ symptoms: '', observations: '', diagnosis: '', treatment_notes: '', follow_up_date: '', status: 'Finalized' });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const setItem = (i, k, v) => setItems(its => its.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const save = async () => {
    try {
      const { data } = await api.post('/medical-records', { ...rec, patient_id: patientId, appointment_id: appointmentId });
      const used = items.filter(i => i.medicine_id);
      if (used.length) await api.post('/prescriptions', { patient_id: patientId, record_id: data.id, items: used });
      setFlash('Consultation saved'); onSaved();
    } catch (e) { setFlash(errMsg(e), 'danger'); }
  };
  return (<Card title={`Consultation – ${patientName}`} className="mt-3">
    {[['symptoms', 'Symptoms reported by patient'], ['observations', 'Clinical observations'], ['diagnosis', 'Diagnosis (clinician entered)'], ['treatment_notes', 'Treatment notes']].map(([k, l]) => (
      <div className="mb-2" key={k}><label className="form-label" htmlFor={`c-${k}`}>{l}</label><textarea id={`c-${k}`} className="form-control" rows={2} value={rec[k]} onChange={e => setRec({ ...rec, [k]: e.target.value })} /></div>))}
    <div className="row g-2 mb-3"><div className="col-md-4"><label className="form-label" htmlFor="c-fu">Follow-up date</label><input id="c-fu" type="date" className="form-control" value={rec.follow_up_date} onChange={e => setRec({ ...rec, follow_up_date: e.target.value })} /></div>
      <div className="col-md-4"><label className="form-label" htmlFor="c-st">Record status</label><select id="c-st" className="form-select" value={rec.status} onChange={e => setRec({ ...rec, status: e.target.value })}><option>Finalized</option><option>Draft</option></select></div></div>
    <h6>Prescription (optional)</h6>
    {items.map((it, i) => (<div className="row g-2 mb-2" key={i}>
      <div className="col-md-3"><select aria-label="Medicine" className="form-select" value={it.medicine_id} onChange={e => setItem(i, 'medicine_id', e.target.value)}><option value="">Medicine…</option>{meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
      {['dosage', 'frequency', 'duration', 'instructions'].map(k => <div className="col-md" key={k}><input aria-label={k} className="form-control" placeholder={k} value={it[k]} onChange={e => setItem(i, k, e.target.value)} /></div>)}</div>))}
    <button className="btn btn-sm btn-outline-secondary" onClick={() => setItems(its => [...its, { ...emptyItem }])}>+ Add medicine</button>
    <div className="mt-3"><button className="btn btn-primary me-2" onClick={save}>Save</button><button className="btn btn-outline-secondary" onClick={onClose}>Close</button></div>
  </Card>);
}

export function DoctorAppointments() {
  const [rows, setRows] = useState(null); const [flash, setFlash] = useFlash(); const [meds, setMeds] = useState([]); const [panel, setPanel] = useState(null); const [date, setDate] = useState('');
  const load = () => api.get('/doctors/appointments', { params: date ? { date } : {} }).then(r => setRows(r.data));
  useEffect(() => { load(); }, [date]);
  useEffect(() => { api.get('/medicines').then(r => setMeds(r.data)); }, []);
  const setStatus = async (id, status) => { try { await api.patch(`/appointments/${id}/status`, { status }); load(); } catch (e) { setFlash(errMsg(e), 'danger'); } };
  if (!rows) return <Loading />;
  return (<>
    <div className="d-flex justify-content-between align-items-end mb-3"><h3>My appointments</h3>
      <div><label className="form-label small mb-0" htmlFor="dd">Daily schedule</label><div className="input-group"><input id="dd" type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} /><button className="btn btn-outline-secondary" onClick={() => setDate('')}>All</button></div></div></div>
    <Alert type={flash.type}>{flash.msg}</Alert>
    {rows.length === 0 ? <Empty text="No appointments" /> : <div className="table-responsive"><table className="table table-sm align-middle bg-white">
      <thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map(a => (<tr key={a.id}><td>{a.appt_date}</td><td>{fmtTime(a.appt_time)}</td><td>{a.patient_name}</td><td>{a.reason}</td><td><StatusBadge status={a.status} /></td>
        <td className="text-nowrap">
          {a.status === 'Pending' && <button className="btn btn-sm btn-primary me-1" onClick={() => setStatus(a.id, 'Confirmed')}>Confirm</button>}
          {['Confirmed', 'Pending'].includes(a.status) && <>
            <button className="btn btn-sm btn-success me-1" onClick={() => setStatus(a.id, 'Completed')}>Complete</button>
            <button className="btn btn-sm btn-outline-danger me-1" onClick={() => setStatus(a.id, 'No-show')}>No-show</button></>}
          {a.status !== 'Cancelled' && <button className="btn btn-sm btn-outline-primary" onClick={() => setPanel(a)}>Consult</button>}</td></tr>))}</tbody></table></div>}
    {panel && <ConsultPanel patientId={panel.patient_id} patientName={panel.patient_name} appointmentId={panel.id} meds={meds} setFlash={setFlash} onClose={() => setPanel(null)} onSaved={() => setPanel(null)} />}
  </>);
}

export function PatientRecords() {
  const [patients, setPatients] = useState(null); const [sel, setSel] = useState(null); const [data, setData] = useState(null);
  const [meds, setMeds] = useState([]); const [flash, setFlash] = useFlash(); const [consult, setConsult] = useState(false);
  const [edit, setEdit] = useState(null); const [hist, setHist] = useState(null);
  useEffect(() => { api.get('/doctors/patients').then(r => setPatients(r.data)); api.get('/medicines').then(r => setMeds(r.data)); }, []);
  const open = async p => {
    setSel(p); setConsult(false); setEdit(null); setHist(null);
    const [records, docs, rx] = await Promise.all([api.get(`/medical-records/patient/${p.id}`), api.get('/documents', { params: { patient_id: p.id } }), api.get(`/prescriptions/patient/${p.id}`)]);
    setData({ records: records.data, docs: docs.data, rx: rx.data });
  };
  const upload = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('patient_id', sel.id);
    try { await api.post('/documents', fd); setFlash('Document uploaded'); open(sel); } catch (x) { setFlash(errMsg(x), 'danger'); }
    e.target.value = '';
  };
  const saveEdit = async () => { try { await api.put(`/medical-records/${edit.id}`, edit); setFlash('Record updated'); setEdit(null); open(sel); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  if (!patients) return <Loading />;
  return (<>
    <h3 className="mb-3">Patient records</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <div className="row g-3">
      <div className="col-lg-3"><Card title="My patients">{patients.length === 0 ? <Empty text="No patients yet" /> :
        <div className="list-group">{patients.map(p => <button key={p.id} className={`list-group-item list-group-item-action ${sel?.id === p.id ? 'active' : ''}`} onClick={() => open(p)}>{p.name}<div className="small">{p.visits} visit(s) · last {p.last_visit}</div></button>)}</div>}</Card></div>
      <div className="col-lg-9">{!sel ? <Empty text="Select a patient to view records you are authorized to see" /> : !data ? <Loading /> : <>
        <div className="d-flex justify-content-between mb-2"><h5>{sel.name}</h5><button className="btn btn-primary btn-sm" onClick={() => setConsult(true)}>New consultation</button></div>
        {consult && <ConsultPanel patientId={sel.id} patientName={sel.name} appointmentId={null} meds={meds} setFlash={setFlash} onClose={() => setConsult(false)} onSaved={() => { setConsult(false); open(sel); }} />}
        <h6 className="mt-3">Records</h6>
        {data.records.length === 0 ? <Empty text="No records" /> : data.records.map(r => (<div className="card mb-2" key={r.id}><div className="card-body">
          <div className="d-flex justify-content-between"><span><strong>{r.doctor_name}</strong> · {r.created_at}</span><StatusBadge status={r.status} /></div>
          <div className="small mt-1"><b>Symptoms:</b> {r.symptoms} <b>Diagnosis:</b> {r.diagnosis} <b>Treatment:</b> {r.treatment_notes}</div>
          {r.status === 'Draft' && <button className="btn btn-sm btn-outline-primary mt-2 me-2" onClick={() => setEdit({ ...r, follow_up_date: r.follow_up_date || '' })}>Edit draft</button>}
          <button className="btn btn-sm btn-outline-secondary mt-2" onClick={async () => { try { setHist({ id: r.id, rows: (await api.get(`/medical-records/${r.id}/history`)).data }); } catch (x) { setFlash(errMsg(x), 'danger'); } }}>Change history</button>
          {hist?.id === r.id && <ul className="small mt-2 mb-0">{hist.rows.length === 0 ? <li>No edits recorded</li> : hist.rows.map(h => <li key={h.id}>{h.created_at} · {h.changed_by}: {Object.keys(JSON.parse(h.changes)).join(', ')} changed</li>)}</ul>}
        </div></div>))}
        {edit && <Card title="Edit draft" className="mb-3">{['symptoms', 'observations', 'diagnosis', 'treatment_notes'].map(k => (
          <div className="mb-2" key={k}><label className="form-label text-capitalize" htmlFor={`e-${k}`}>{k.replace('_', ' ')}</label><textarea id={`e-${k}`} className="form-control" rows={2} value={edit[k] || ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></div>))}
          <select aria-label="Status" className="form-select w-auto mb-2" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}><option>Draft</option><option>Finalized</option></select>
          <button className="btn btn-primary btn-sm me-2" onClick={saveEdit}>Save</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setEdit(null)}>Cancel</button></Card>}
        <h6 className="mt-3">Documents</h6>
        <input aria-label="Upload document" type="file" accept=".pdf,.png,.jpg,.jpeg" className="form-control mb-2 w-auto" onChange={upload} />
        {data.docs.length === 0 ? <Empty text="No documents" /> : <ul className="list-group mb-3">{data.docs.map(d => <li key={d.id} className="list-group-item d-flex justify-content-between">{d.original_name}<button className="btn btn-sm btn-outline-primary" onClick={() => download(`/documents/${d.id}/download`, d.original_name)}>Download</button></li>)}</ul>}
        <h6>Prescriptions</h6>
        {data.rx.length === 0 ? <Empty text="No prescriptions" /> : data.rx.map(p => <div key={p.id} className="small mb-1">{p.created_at} · {p.doctor_name}: {p.items.map(i => `${i.medicine} (${i.dosage}, ${i.frequency}, ${i.duration})`).join('; ')}</div>)}
      </>}</div>
    </div></>);
}

export function DoctorPrescriptions() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/prescriptions/mine').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Prescriptions I created</h3>{rows.length === 0 ? <Empty text="No prescriptions yet. Create one from a consultation." /> :
    <div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>Date</th><th>Patient</th><th>Medicines</th><th>Notes</th></tr></thead>
      <tbody>{rows.map(p => <tr key={p.id}><td>{p.created_at}</td><td>{p.patient_name}</td><td>{p.items}</td><td>{p.notes}</td></tr>)}</tbody></table></div>}</>);
}

export function ConsultationHistory() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/medical-records/mine').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Consultation history</h3>{rows.length === 0 ? <Empty text="No consultations recorded" /> :
    <div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>Date</th><th>Patient</th><th>Diagnosis</th><th>Follow-up</th><th>Status</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.created_at}</td><td>{r.patient_name}</td><td>{r.diagnosis}</td><td>{r.follow_up_date || '–'}</td><td><StatusBadge status={r.status} /></td></tr>)}</tbody></table></div>}</>);
}

export function Availability() {
  const [windows, setWindows] = useState(null); const [blocked, setBlocked] = useState([]); const [flash, setFlash] = useFlash(); const [nb, setNb] = useState('');
  useEffect(() => { api.get('/doctors/my/availability').then(r => {
    setWindows(r.data.windows.map(w => ({ ...w, start_time: fmtTime(w.start_time), end_time: fmtTime(w.end_time), break_start: fmtTime(w.break_start), break_end: fmtTime(w.break_end) })));
    setBlocked(r.data.blocked_dates); }); }, []);
  if (!windows) return <Loading />;
  const upd = (i, k, v) => setWindows(ws => ws.map((w, j) => j === i ? { ...w, [k]: v } : w));
  const save = async () => { try { await api.put('/doctors/availability', { windows: windows.map(w => ({ ...w, break_start: w.break_start || null, break_end: w.break_end || null })), blocked_dates: blocked }); setFlash('Availability saved'); } catch (e) { setFlash(errMsg(e), 'danger'); } };
  return (<>
    <h3 className="mb-3">Availability</h3><Alert type={flash.type}>{flash.msg}</Alert>
    {windows.map((w, i) => (<div className="row g-2 mb-2 align-items-end" key={i}>
      <div className="col-md-2"><label className="form-label small">Day</label><select className="form-select" value={w.weekday} onChange={e => upd(i, 'weekday', Number(e.target.value))}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</select></div>
      <div className="col"><label className="form-label small">From</label><input type="time" className="form-control" value={w.start_time} onChange={e => upd(i, 'start_time', e.target.value)} /></div>
      <div className="col"><label className="form-label small">To</label><input type="time" className="form-control" value={w.end_time} onChange={e => upd(i, 'end_time', e.target.value)} /></div>
      <div className="col"><label className="form-label small">Slot (min)</label><input type="number" min="10" max="120" step="5" className="form-control" value={w.slot_minutes} onChange={e => upd(i, 'slot_minutes', Number(e.target.value))} /></div>
      <div className="col"><label className="form-label small">Break from</label><input type="time" className="form-control" value={w.break_start} onChange={e => upd(i, 'break_start', e.target.value)} /></div>
      <div className="col"><label className="form-label small">Break to</label><input type="time" className="form-control" value={w.break_end} onChange={e => upd(i, 'break_end', e.target.value)} /></div>
      <div className="col-auto"><button className="btn btn-outline-danger" aria-label="Remove" onClick={() => setWindows(ws => ws.filter((_, j) => j !== i))}>x</button></div></div>))}
    <button className="btn btn-outline-secondary btn-sm mb-4" onClick={() => setWindows(ws => [...ws, { weekday: 1, start_time: '09:00', end_time: '13:00', slot_minutes: 30, break_start: '', break_end: '' }])}>+ Add working hours</button>
    <h6>Blocked dates / leave</h6>
    <div className="d-flex gap-2 mb-2"><input aria-label="Blocked date" type="date" min={today()} className="form-control w-auto" value={nb} onChange={e => setNb(e.target.value)} />
      <button className="btn btn-outline-secondary" onClick={() => { if (nb && !blocked.some(b => b.date === nb)) setBlocked(b => [...b, { date: nb, reason: 'Leave' }]); setNb(''); }}>Block date</button></div>
    <div className="mb-3">{blocked.map((b, i) => <span key={i} className="badge text-bg-light border me-2">{b.date} <a href="#!" onClick={e => { e.preventDefault(); setBlocked(x => x.filter((_, j) => j !== i)); }}>x</a></span>)}</div>
    <button className="btn btn-primary" onClick={save}>Save availability</button></>);
}

export function DoctorProfile() {
  const { refresh } = useAuth(); const [f, setF] = useState(null); const [flash, setFlash] = useFlash();
  const [hospitals, setHospitals] = useState([]); const [deps, setDeps] = useState([]);
  useEffect(() => { api.get('/doctors/my/profile').then(r => { setF(r.data); setDeps(r.data.department_ids ? r.data.department_ids.split(',').map(Number) : []); }); api.get('/directory/hospitals').then(r => setHospitals(r.data)); }, []);
  if (!f) return <Loading />;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); try { await api.put('/doctors/profile', f); await refresh(); setFlash('Profile saved'); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  const saveDeps = async () => { try { await api.put('/doctors/departments', { department_ids: deps }); setFlash('Departments updated'); api.get('/doctors/my/profile').then(r => setF(r.data)); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  return (<div style={{ maxWidth: 620 }}><h3 className="mb-3">Profile</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <div className="mb-3">Verification: {f.is_verified ? <span className="badge text-bg-success">Verified</span> : <span className="badge text-bg-warning">Pending admin review</span>}</div>
    <form onSubmit={save}>
      <Field label="Email" id="dpe" value={f.email} disabled /><Field label="Specialty" id="dps" value={f.specialty || ''} onChange={set('specialty')} required />
      <Field label="Qualification" id="dpq" value={f.qualification || ''} onChange={set('qualification')} />
      <div className="row"><div className="col"><Field label="Experience (years)" id="dpx" type="number" min="0" value={f.experience_years || 0} onChange={set('experience_years')} /></div>
        <div className="col"><Field label="Consultation fee (₹)" id="dpc" type="number" min="0" value={f.consultation_fee || 0} onChange={set('consultation_fee')} /></div></div>
      <button className="btn btn-primary">Save profile</button></form>
    <hr /><h5>Hospital & department association</h5>
    <p className="small text-muted">Current: {f.affiliations || 'none'}</p>
    {hospitals.map(h => <div key={h.id} className="mb-2"><strong>{h.name}</strong><div>{h.departments.map(d => (
      <div className="form-check form-check-inline" key={d.id}><input className="form-check-input" type="checkbox" id={`dep${d.id}`} checked={deps.includes(d.id)} onChange={e => setDeps(x => e.target.checked ? [...x, d.id] : x.filter(i => i !== d.id))} /><label className="form-check-label" htmlFor={`dep${d.id}`}>{d.name}</label></div>))}</div></div>)}
    <button className="btn btn-outline-primary btn-sm" onClick={saveDeps}>Save departments</button>
    <PasswordForm /></div>);
}
