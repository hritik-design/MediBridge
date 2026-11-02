import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alert, Brand, Field } from '../components/Common';
import Icon from '../components/Icon';
import { ThemeToggle } from '../components/Layout';

const HOME = { patient: '/patient', doctor: '/doctor', pharmacist: '/pharmacist', admin: '/admin' };

const FEATURES = [
  ['calendar', 'primary', 'Smart appointments', 'Search verified doctors by specialty, hospital, date and time, then book conflict-free slots in seconds.'],
  ['file-text', 'info', 'Secure health records', 'Doctor-authored records with change history, visible only to people who are authorized to see them.'],
  ['pill', 'success', 'Digital prescriptions', 'Create, review and print prescriptions linked to each consultation and patient.'],
  ['package', 'warning', 'Pharmacy inventory', 'Batch, expiry and low-stock tracking with a full audit trail of every stock movement.'],
  ['bar-chart', 'danger', 'Analytics & reports', 'Aggregated dashboards, monthly and yearly reports, and CSV exports for administrators.'],
  ['bell', 'secondary', 'Reminders', 'In-app notifications and scheduled reminders keep patients and doctors on schedule.'],
];
const ROLES = [
  ['users', 'Patients', 'Find doctors, book and manage visits, access records and prescriptions.'],
  ['user-check', 'Doctors', 'Manage availability, consult, write records and prescriptions.'],
  ['package', 'Pharmacists', 'Run the medicine catalogue, stock and dispensing records.'],
  ['shield', 'Administrators', 'Verify doctors, manage hospitals, review reports and audit logs.'],
];

export function Landing() {
  return (
    <>
      <nav className="pub-nav">
        <Brand />
        <div className="d-flex align-items-center gap-2">
          <ThemeToggle />
          <Link className="btn btn-outline-primary btn-sm" to="/login">Login</Link>
          <Link className="btn btn-primary btn-sm" to="/register">Get started</Link>
        </div>
      </nav>

      <header className="hero">
        <div className="container"><div className="row align-items-center g-5">
          <div className="col-lg-6">
            <span className="pill"><Icon name="heart" size={14} /> Aligned with UN SDG 3 &amp; SDG 10</span>
            <h1>Healthcare management that connects everyone.</h1>
            <p className="lead mt-3">One secure platform for patients, doctors, pharmacists and hospitals: appointments, records, prescriptions and pharmacy stock in one place.</p>
            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link to="/register" className="btn btn-light btn-lg d-inline-flex align-items-center gap-2">Create free account <Icon name="arrow-right" size={18} /></Link>
              <Link to="/login" className="btn btn-outline-light btn-lg">Sign in</Link>
            </div>
          </div>
          <div className="col-lg-6"><div className="hero-visual">
            <div className="hero-card c1"><div className="row-i"><span className="stat-icon tint-primary"><Icon name="calendar" /></span><div><div className="fw-bold">Appointment confirmed</div><small>Tomorrow · 10:30 AM</small></div></div></div>
            <div className="hero-card c2"><div className="row-i"><span className="stat-icon tint-success"><Icon name="pill" /></span><div><div className="fw-bold">New prescription</div><small>Available in your account</small></div></div></div>
            <div className="hero-card c3"><div className="row-i"><span className="stat-icon tint-warning"><Icon name="package" /></span><div><div className="fw-bold">Low-stock alert</div><small>Sent to pharmacy staff</small></div></div></div>
          </div></div>
        </div></div>
      </header>

      <section className="section">
        <div className="container">
          <div className="section-title"><h2>Everything a hospital workflow needs</h2><p className="text-muted">Built as a modular platform: start with bookings, grow into records, pharmacy and analytics.</p></div>
          <div className="row g-4">{FEATURES.map(([icon, tint, title, text]) => (
            <div className="col-md-6 col-lg-4" key={title}><div className="feature"><div className={`stat-icon tint-${tint}`}><Icon name={icon} size={24} /></div><h5>{title}</h5><p className="text-muted mb-0">{text}</p></div></div>))}</div>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <div className="section-title"><h2>How it works</h2></div>
          <div className="row g-4 text-center">{[['Find', 'Search verified doctors and see live availability.'], ['Book', 'Pick a slot. The system prevents double bookings.'], ['Consult', 'The doctor records the visit and prescribes.'], ['Follow up', 'Access history, prescriptions and reminders anytime.']].map(([t, d], i) => (
            <div className="col-6 col-lg-3" key={t}><div className="step-num">{i + 1}</div><h5>{t}</h5><p className="text-muted small mb-0">{d}</p></div>))}</div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-title"><h2>One platform, four roles</h2></div>
          <div className="row g-4">{ROLES.map(([icon, t, d]) => (
            <div className="col-sm-6 col-lg-3" key={t}><div className="feature text-center"><div className="stat-icon tint-primary mx-auto"><Icon name={icon} size={24} /></div><h5>{t}</h5><p className="text-muted small mb-0">{d}</p></div></div>))}</div>
        </div>
      </section>

      <section className="section pt-0"><div className="container">
        <div className="cta">
          <h2 className="fw-bold">Ready to try MediBridge?</h2>
          <p className="opacity-75 mb-4">Create an account in under a minute. Demo data only. No real patient information.</p>
          <Link to="/register" className="btn btn-light btn-lg">Get started</Link>
        </div>
      </div></section>

      <footer className="footer">© {new Date().getFullYear()} MediBridge · Student project demonstration. Uses synthetic data only; not a certified clinical system.</footer>
    </>
  );
}

function AuthShell({ title, subtitle, children, wide }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-brand">
        <Brand />
        <div>
          <h2 className="fw-bold display-6">Care that stays connected.</h2>
          <ul>
            {['Book verified doctors with live availability', 'Records and prescriptions in one secure place', 'Role-based access, audit logs and privacy by design'].map(t => <li key={t}><Icon name="check-circle" size={20} />{t}</li>)}
          </ul>
        </div>
        <small className="opacity-75">Student project · synthetic data only</small>
      </aside>
      <section className="auth-form">
        <div className="auth-card" style={wide ? { maxWidth: 560 } : undefined}>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div><h3 className="fw-bold mb-1">{title}</h3><div className="text-muted">{subtitle}</div></div>
            <ThemeToggle />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

const DEMOS = [['Patient', 'patient@medibridge.test'], ['Doctor', 'anita@medibridge.test'], ['Pharmacist', 'pharmacist@medibridge.test'], ['Admin', 'admin@medibridge.test']];

export function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const u = await login(f.email, f.password); nav(HOME[u.role]); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to MediBridge">
      <Alert>{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Email" id="email" type="email" required autoComplete="username" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <div className="mb-3">
          <label htmlFor="pw" className="form-label">Password</label>
          <div className="input-group">
            <input id="pw" className="form-control" type={show ? 'text' : 'password'} required autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <button className="btn btn-primary w-100 py-2" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-3 mb-4 small text-center">New to MediBridge? <Link to="/register">Create an account</Link></p>
      <div className="border-top pt-3">
        <div className="small text-muted mb-2">Demo accounts (after seeding): click to fill</div>
        <div className="d-flex flex-wrap gap-2">{DEMOS.map(([r, em]) => <button type="button" key={r} className="demo-chip" onClick={() => setF({ email: em, password: 'Password@123' })}>{r}</button>)}</div>
      </div>
    </AuthShell>
  );
}

const ROLE_OPTS = [['patient', 'users', 'Patient'], ['doctor', 'user-check', 'Doctor'], ['pharmacist', 'package', 'Pharmacist']];

export function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'patient', specialty: '', qualification: '', experience_years: 0, consultation_fee: 0 });
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const { data } = await api.post('/auth/register', f); setOk(data.message); setTimeout(() => nav('/login'), 1800); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Create your account" subtitle="Join MediBridge in a minute" wide>
      <Alert>{err}</Alert><Alert type="success">{ok}</Alert>
      <form onSubmit={submit}>
        <div className="mb-3"><div className="form-label">I am a</div>
          <div className="role-pick" role="radiogroup" aria-label="Account type">{ROLE_OPTS.map(([v, icon, label]) => (
            <button type="button" key={v} role="radio" aria-checked={f.role === v} className={`role-opt ${f.role === v ? 'on' : ''}`} onClick={() => setF({ ...f, role: v })}><Icon name={icon} size={22} />{label}</button>))}</div>
          {f.role !== 'patient' && <div className="small text-muted mt-2"><Icon name="lock" size={13} /> {f.role === 'doctor' ? 'Doctor accounts need admin verification before patients can book you.' : 'Pharmacist accounts need admin approval before first login.'}</div>}
        </div>
        <Field label="Full name" id="n" required value={f.name} onChange={set('name')} />
        <Field label="Email" id="e" type="email" required value={f.email} onChange={set('email')} />
        <Field label="Password (8+ characters, letters and numbers)" id="p" type="password" required value={f.password} onChange={set('password')} />
        {f.role === 'doctor' && <>
          <Field label="Specialty" id="s" required value={f.specialty} onChange={set('specialty')} />
          <Field label="Qualification" id="q" value={f.qualification} onChange={set('qualification')} />
          <div className="row"><div className="col"><Field label="Experience (years)" id="x" type="number" min="0" value={f.experience_years} onChange={set('experience_years')} /></div>
            <div className="col"><Field label="Consultation fee (₹)" id="c" type="number" min="0" value={f.consultation_fee} onChange={set('consultation_fee')} /></div></div>
        </>}
        <button className="btn btn-primary w-100 py-2" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-3 mb-0 small text-center">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
