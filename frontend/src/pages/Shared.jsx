import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alert, Empty, Field, Loading, useFlash } from '../components/Common';

export function Notifications() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/notifications').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  if (!rows) return <Loading />;
  return (<>
    <div className="d-flex justify-content-between mb-3"><h3>Notifications</h3>
      <button className="btn btn-outline-secondary btn-sm" onClick={async () => { await api.patch('/notifications/read-all'); load(); }}>Mark all read</button></div>
    {rows.length === 0 ? <Empty text="No notifications" /> :
      <ul className="list-group">{rows.map(n => (
        <li key={n.id} className={`list-group-item d-flex justify-content-between ${n.is_read ? '' : 'list-group-item-info'}`}>
          <div><strong>{n.title}</strong> <span className="text-muted small">· {n.created_at} · {n.is_read ? 'Read' : 'Unread'}</span><div>{n.message}</div></div>
          {!n.is_read && <button className="btn btn-sm btn-outline-secondary align-self-start" onClick={async () => { await api.patch(`/notifications/${n.id}/read`); load(); }}>Mark read</button>}
        </li>))}</ul>}</>);
}

export function PasswordForm() {
  const [pw, setPw] = useState({ current_password: '', new_password: '' }); const [flash, setFlash] = useFlash();
  const submit = async e => {
    e.preventDefault();
    try { const { data } = await api.put('/auth/password', pw); localStorage.setItem('mb_token', data.token); setFlash('Password changed. Other sessions were signed out.'); setPw({ current_password: '', new_password: '' }); }
    catch (x) { setFlash(errMsg(x), 'danger'); }
  };
  return (<form onSubmit={submit} className="mt-4"><h5>Change password</h5><Alert type={flash.type}>{flash.msg}</Alert>
    <Field label="Current password" id="cp" type="password" required value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} />
    <Field label="New password (8+ chars, letters & numbers)" id="np" type="password" required value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} />
    <button className="btn btn-outline-primary">Update password</button></form>);
}

export function AccountProfile() {
  const { user, refresh } = useAuth(); const [name, setName] = useState(user.name); const [flash, setFlash] = useFlash();
  const save = async e => { e.preventDefault(); try { await api.put('/auth/profile', { name }); await refresh(); setFlash('Profile saved'); } catch (x) { setFlash(errMsg(x), 'danger'); } };
  return (<div style={{ maxWidth: 520 }}><h3 className="mb-3">Profile</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <form onSubmit={save}><Field label="Name" id="an" value={name} onChange={e => setName(e.target.value)} /><Field label="Email" id="ae" value={user.email} disabled />
      <Field label="Role" id="ar" value={user.role} disabled /><button className="btn btn-primary">Save</button></form><PasswordForm /></div>);
}
