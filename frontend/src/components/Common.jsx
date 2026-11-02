import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { errMsg } from '../api';

export const Alert = ({ type = 'danger', children }) => children
  ? <div className={`alert-modern alert alert-${type} mb-3`} role="alert"><Icon name={type === 'success' ? 'check-circle' : 'alert-circle'} size={20} /><div>{children}</div></div>
  : null;

const ICON_RULES = [
  [/rate/i, 'trending-up'], [/patient/i, 'users'], [/doctor/i, 'user-check'], [/stock|out of/i, 'package'], [/medicine|prescri/i, 'pill'],
  [/expir/i, 'clock'], [/complet/i, 'check-circle'], [/cancel|no-show/i, 'x'], [/upcoming|pending|today/i, 'clock'],
  [/experience|ease|waiting|overall|rating/i, 'star'], [/appointment|total|consult/i, 'calendar'],
];
const iconFor = label => (ICON_RULES.find(([re]) => re.test(label)) || [null, 'activity'])[1];

export const Stat = ({ label, value, color = 'primary', cols = 'col-6 col-lg-3' }) => (
  <div className={cols}>
    <div className="card stat-card stat">
      <div className={`stat-icon tint-${color}`}><Icon name={iconFor(String(label))} size={22} /></div>
      <div className="min-w-0">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '–'}</div>
      </div>
    </div>
  </div>
);

const COLORS = { Pending: 'warning', Confirmed: 'primary', Completed: 'success', Cancelled: 'secondary', 'No-show': 'danger', Draft: 'warning', Finalized: 'success' };
export const StatusBadge = ({ status }) => <span className={`badge text-bg-${COLORS[status] || 'light'}`}>{status}</span>;

export const Empty = ({ text }) => (
  <div className="empty"><div className="empty-icon"><Icon name="inbox" size={26} /></div><div>{text}</div></div>
);
export const Loading = () => (
  <div className="page-skeleton" aria-busy="true" aria-label="Loading">
    <div className="skeleton mb-3" style={{ height: 34, width: 240 }} />
    <div className="row g-3 mb-3">{[0, 1, 2, 3].map(i => <div className="col-6 col-lg-3" key={i}><div className="skeleton" style={{ height: 82 }} /></div>)}</div>
    <div className="skeleton" style={{ height: 220 }} />
  </div>
);

export function useFlash() {
  const [flash, set] = useState({ type: 'success', msg: '' });
  return [flash, (msg, type = 'success') => set({ msg, type })];
}

export const makeRun = (load, setFlash) => async (fn, ok) => {
  try { await fn(); if (ok) setFlash(ok); load(); } catch (e) { setFlash(errMsg(e), 'danger'); }
};

export const Brand = () => (
  <Link to="/" className="brand"><span className="brand-mark"><Icon name="plus" size={22} stroke="#fff" /></span>MediBridge</Link>
);

export const Field = ({ label, id, ...props }) => (
  <div className="mb-3">
    <label htmlFor={id} className="form-label">{label}</label>
    <input id={id} className="form-control" {...props} />
  </div>
);

export const Card = ({ title, children, className = '' }) => (
  <div className={`card stat-card ${className}`}><div className="card-body">{title && <div className="card-h">{title}</div>}{children}</div></div>
);

export const Avatar = ({ name = '?', size = 'md' }) => (
  <span className={`avatar avatar-${size}`} aria-hidden="true">{name.replace(/^(Dr\.?\s+)/i, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>
);
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export const fmtTime = t => (t ? String(t).slice(0, 5) : '');
export const today = () => new Date().toISOString().slice(0, 10);
