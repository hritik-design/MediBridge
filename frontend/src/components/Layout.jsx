import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Icon from './Icon';
import { Avatar, Brand } from './Common';
import { useTheme } from './theme';

const NOTIF = ['/notifications', 'Notifications', 'bell'];
const PROFILE = ['/profile', 'Profile', 'user'];
const MENUS = {
  patient: [['/patient', 'Dashboard', 'home'], ['/patient/doctors', 'Find Doctors', 'search'], ['/patient/book', 'Book Appointment', 'calendar-plus'], ['/patient/appointments', 'My Appointments', 'calendar'],
    ['/patient/history', 'Medical History', 'file-text'], ['/patient/prescriptions', 'Prescriptions', 'pill'], ['/patient/documents', 'My Documents', 'folder'], ['/patient/feedback', 'My Feedback', 'star'], NOTIF, ['/patient/profile', 'My Profile', 'user']],
  doctor: [['/doctor', 'Dashboard', 'home'], ['/doctor/appointments', 'My Appointments', 'calendar'], ['/doctor/patients', 'Patient Records', 'users'], ['/doctor/prescriptions', 'Prescriptions', 'pill'],
    ['/doctor/availability', 'Availability', 'clock'], ['/doctor/history', 'Consultation History', 'clipboard'], NOTIF, ['/doctor/profile', 'Profile', 'user']],
  pharmacist: [['/pharmacist', 'Inventory', 'package'], ['/pharmacist/suppliers', 'Suppliers', 'truck'], ['/pharmacist/prescriptions', 'Prescription Review', 'check-circle'], ['/pharmacist/reports', 'Inventory Reports', 'bar-chart'], NOTIF, PROFILE],
  admin: [['/admin', 'Dashboard', 'home'], ['/admin/patients', 'Patients', 'users'], ['/admin/doctors', 'Doctors', 'user-check'], ['/admin/users', 'Users & Roles', 'shield'], ['/admin/hospitals', 'Hospitals', 'building'],
    ['/admin/departments', 'Departments', 'layers'], ['/admin/appointments', 'Appointments', 'calendar'], ['/admin/inventory', 'Pharmacy Inventory', 'package'], ['/admin/feedback', 'Feedback', 'star'],
    ['/admin/reports', 'Reports', 'bar-chart'], ['/admin/audit', 'Audit Logs', 'list'], ['/admin/settings', 'Settings', 'sliders'], NOTIF, PROFILE],
};

export function ThemeToggle({ className = '' }) {
  const [theme, toggle] = useTheme();
  return (
    <button type="button" className={`icon-btn ${className}`} onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false);
  const menu = MENUS[user.role];
  const title = (menu.find(([to]) => to === loc.pathname) || [])[1] || 'MediBridge';

  useEffect(() => { api.get('/notifications/unread-count').then(r => setUnread(r.data.count)).catch(() => {}); setOpen(false); }, [loc.pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar no-print ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Brand />
        <div className="user-card">
          <Avatar name={user.name} size="md" />
          <div className="min-w-0"><div className="u-name text-truncate">{user.name}</div><div className="u-role">{user.role}</div></div>
        </div>
        <ul className="side-nav">
          {menu.map(([to, label, icon]) => (
            <li key={to}>
              <NavLink end to={to} className="nav-link"><Icon name={icon} size={18} />{label}{to === '/notifications' && unread > 0 && <span className="badge text-bg-danger">{unread}</span>}</NavLink>
            </li>
          ))}
        </ul>
        <div className="side-foot">
          <button className="btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2" onClick={async () => { await logout(); nav('/'); }}><Icon name="logout" size={16} />Logout</button>
        </div>
      </aside>
      {open && <div className="sidebar-overlay no-print" onClick={() => setOpen(false)} />}

      <div className="app-main">
        <header className="topbar no-print">
          <button type="button" className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={20} /></button>
          <h1 className="text-truncate">{title}</h1>
          <div className="ms-auto d-flex align-items-center gap-2">
            <ThemeToggle />
            <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Icon name="bell" size={18} />{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Avatar name={user.name} size="sm" />
          </div>
        </header>
        <main className="page" key={loc.pathname}><Outlet /></main>
      </div>
    </div>
  );
}
