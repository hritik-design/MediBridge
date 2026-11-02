import { useEffect, useState } from 'react';
import api, { download } from '../api';
import { Alert, Card, Empty, Field, Loading, makeRun, Stat, useFlash } from '../components/Common';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export function Pharmacist() {
  const [meds, setMeds] = useState(null); const [batches, setBatches] = useState([]); const [low, setLow] = useState([]);
  const [exp, setExp] = useState([]); const [tx, setTx] = useState([]); const [suppliers, setSuppliers] = useState([]);
  const [flash, setFlash] = useFlash();
  const [nm, setNm] = useState({ name: '', category: '', min_stock: 20 }); const [editM, setEditM] = useState(null);
  const [rc, setRc] = useState({ medicine_id: '', supplier_id: '', batch_no: '', expiry_date: '', quantity: '' });
  const [ds, setDs] = useState({ batch_id: '', quantity: '' }); const [adj, setAdj] = useState({ batch_id: '', quantity: '', note: '' });

  const load = () => Promise.all([api.get('/medicines'), api.get('/inventory/batches'), api.get('/inventory/low-stock'), api.get('/inventory/expiring'), api.get('/inventory/transactions'), api.get('/suppliers')])
    .then(([m, b, l, e, t, s]) => { setMeds(m.data); setBatches(b.data); setLow(l.data); setExp(e.data); setTx(t.data); setSuppliers(s.data); });
  useEffect(() => { load(); }, []);
  const run = makeRun(load, setFlash);

  if (!meds) return <Loading />;
  return (<>
    <h3 className="mb-3">Pharmacy inventory</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <div className="row g-3 mb-4"><Stat label="Medicine products" value={meds.length} /><Stat label="Low stock" value={low.length} color="danger" /><Stat label="Expiring ≤ 90 days" value={exp.length} color="warning" /><Stat label="Out of stock" value={meds.filter(m => Number(m.stock) === 0).length} color="secondary" /></div>

    <h5>Medicine catalogue</h5>
    <div className="table-responsive mb-4"><table className="table table-sm bg-white align-middle"><thead><tr><th>Name</th><th>Category</th><th>Stock</th><th>Min</th><th /></tr></thead>
      <tbody>{meds.map(m => (<tr key={m.id} className={Number(m.stock) <= m.min_stock ? 'table-warning' : ''}>
        {editM?.id === m.id ? <>
          <td><input aria-label="Name" className="form-control form-control-sm" value={editM.name} onChange={e => setEditM({ ...editM, name: e.target.value })} /></td>
          <td><input aria-label="Category" className="form-control form-control-sm" value={editM.category || ''} onChange={e => setEditM({ ...editM, category: e.target.value })} /></td>
          <td>{m.stock}</td><td><input aria-label="Minimum stock" type="number" min="0" className="form-control form-control-sm" value={editM.min_stock} onChange={e => setEditM({ ...editM, min_stock: e.target.value })} /></td>
          <td className="text-nowrap"><button className="btn btn-sm btn-primary me-1" onClick={() => run(async () => { await api.put(`/medicines/${m.id}`, editM); setEditM(null); }, 'Medicine updated')}>Save</button><button className="btn btn-sm btn-outline-secondary" onClick={() => setEditM(null)}>Cancel</button></td></> : <>
          <td>{m.name}</td><td>{m.category}</td><td>{m.stock}</td><td>{m.min_stock}</td>
          <td className="text-nowrap"><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEditM({ ...m })}>Edit</button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Deactivate this medicine?') && run(() => api.delete(`/medicines/${m.id}`), 'Deactivated')}>Deactivate</button></td></>}
      </tr>))}</tbody></table></div>

    <div className="row g-3 mb-4">
      <div className="col-lg-3"><Card title="Add medicine">
        <Field label="Name" id="mn" value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} />
        <Field label="Category" id="mc" value={nm.category} onChange={e => setNm({ ...nm, category: e.target.value })} />
        <Field label="Minimum stock" id="mm" type="number" min="0" value={nm.min_stock} onChange={e => setNm({ ...nm, min_stock: e.target.value })} />
        <button className="btn btn-primary btn-sm" onClick={() => run(() => api.post('/medicines', nm), 'Medicine added')}>Add</button></Card></div>
      <div className="col-lg-3"><Card title="Record stock receipt">
        <select aria-label="Medicine" className="form-select mb-2" value={rc.medicine_id} onChange={e => setRc({ ...rc, medicine_id: e.target.value })}><option value="">Medicine…</option>{meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select aria-label="Supplier" className="form-select mb-2" value={rc.supplier_id} onChange={e => setRc({ ...rc, supplier_id: e.target.value })}><option value="">Supplier…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input aria-label="Batch number" className="form-control mb-2" placeholder="Batch no." value={rc.batch_no} onChange={e => setRc({ ...rc, batch_no: e.target.value })} />
        <input aria-label="Expiry date" type="date" className="form-control mb-2" value={rc.expiry_date} onChange={e => setRc({ ...rc, expiry_date: e.target.value })} />
        <input aria-label="Quantity" type="number" min="1" className="form-control mb-2" placeholder="Quantity" value={rc.quantity} onChange={e => setRc({ ...rc, quantity: e.target.value })} />
        <button className="btn btn-primary btn-sm" onClick={() => run(() => api.post('/inventory/receipts', rc), 'Stock received')}>Receive</button></Card></div>
      <div className="col-lg-3"><Card title="Dispense (authorized)">
        <select aria-label="Batch" className="form-select mb-2" value={ds.batch_id} onChange={e => setDs({ ...ds, batch_id: e.target.value })}><option value="">Batch…</option>{batches.map(b => <option key={b.id} value={b.id}>{b.medicine} · {b.batch_no} (qty {b.quantity})</option>)}</select>
        <input aria-label="Quantity to dispense" type="number" min="1" className="form-control mb-2" placeholder="Quantity" value={ds.quantity} onChange={e => setDs({ ...ds, quantity: e.target.value })} />
        <button className="btn btn-primary btn-sm" onClick={() => run(() => api.post('/inventory/transactions', { ...ds, type: 'DISPENSE', note: 'Dispensed' }), 'Dispensed')}>Dispense</button></Card></div>
      <div className="col-lg-3"><Card title="Stock adjustment (needs reason)">
        <select aria-label="Adjust batch" className="form-select mb-2" value={adj.batch_id} onChange={e => setAdj({ ...adj, batch_id: e.target.value })}><option value="">Batch…</option>{batches.map(b => <option key={b.id} value={b.id}>{b.medicine} · {b.batch_no} (qty {b.quantity})</option>)}</select>
        <input aria-label="Adjustment quantity" type="number" className="form-control mb-2" placeholder="+/- quantity" value={adj.quantity} onChange={e => setAdj({ ...adj, quantity: e.target.value })} />
        <input aria-label="Reason" className="form-control mb-2" placeholder="Reason (e.g. damaged)" value={adj.note} onChange={e => setAdj({ ...adj, note: e.target.value })} />
        <button className="btn btn-outline-primary btn-sm" onClick={() => run(() => api.post('/inventory/transactions', { ...adj, type: 'ADJUSTMENT' }), 'Adjustment recorded')}>Record</button></Card></div>
    </div>

    <div className="row g-3 mb-4">
      <div className="col-lg-6"><Card title="Low-stock medicines">{low.length === 0 ? <Empty text="All medicines above minimum" /> : <ul className="list-group list-group-flush">{low.map(m => <li key={m.id} className="list-group-item d-flex justify-content-between">{m.name}<span className="text-danger">{m.stock} / min {m.min_stock}</span></li>)}</ul>}</Card></div>
      <div className="col-lg-6"><Card title="Expiring medicine batches (90 days)">{exp.length === 0 ? <Empty text="Nothing expiring soon" /> : <ul className="list-group list-group-flush">{exp.map(b => <li key={b.id} className="list-group-item">{b.medicine} · batch {b.batch_no} · qty {b.quantity} · expires {b.expiry_date}</li>)}</ul>}</Card></div>
    </div>
    <h5>Recent stock movements (audit trail)</h5>
    <div className="table-responsive"><table className="table table-sm bg-white"><thead><tr><th>When</th><th>Type</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Note</th></tr></thead>
      <tbody>{tx.map(t => <tr key={t.id}><td>{t.created_at}</td><td>{t.type}</td><td>{t.medicine}</td><td>{t.batch_no}</td><td>{t.quantity}</td><td>{t.note}</td></tr>)}</tbody></table></div></>);
}

export function Suppliers() {
  const [rows, setRows] = useState(null); const [f, setF] = useState({ name: '', contact: '' }); const [edit, setEdit] = useState(null); const [flash, setFlash] = useFlash();
  const load = () => api.get('/suppliers').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const run = makeRun(load, setFlash);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Suppliers</h3><Alert type={flash.type}>{flash.msg}</Alert>
    <Card title="Add supplier" className="mb-3"><div className="row g-2">
      <div className="col-md"><input aria-label="Supplier name" className="form-control" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="col-md"><input aria-label="Contact" className="form-control" placeholder="Contact" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
      <div className="col-md-auto"><button className="btn btn-primary" onClick={() => run(async () => { await api.post('/suppliers', f); setF({ name: '', contact: '' }); }, 'Supplier added')}>Add</button></div></div></Card>
    {rows.length === 0 ? <Empty text="No suppliers" /> : <table className="table table-sm bg-white align-middle"><thead><tr><th>Name</th><th>Contact</th><th /></tr></thead><tbody>{rows.map(s => (
      <tr key={s.id}>{edit?.id === s.id ? <>
        <td><input aria-label="Name" className="form-control form-control-sm" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></td>
        <td><input aria-label="Contact" className="form-control form-control-sm" value={edit.contact || ''} onChange={e => setEdit({ ...edit, contact: e.target.value })} /></td>
        <td><button className="btn btn-sm btn-primary me-1" onClick={() => run(async () => { await api.put(`/suppliers/${s.id}`, edit); setEdit(null); }, 'Supplier updated')}>Save</button><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button></td></> : <>
        <td>{s.name}</td><td>{s.contact}</td>
        <td><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEdit({ ...s })}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Delete supplier?') && run(() => api.delete(`/suppliers/${s.id}`), 'Supplier deleted')}>Delete</button></td></>}</tr>))}</tbody></table>}</>);
}

export function PrescriptionReview() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/prescriptions/review/recent').then(r => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (<><h3 className="mb-3">Prescription review</h3><p className="text-muted small">Shows patient name, prescriber and medicines only. Clinical notes are not visible to pharmacists. Each view is audit-logged.</p>
    {rows.length === 0 ? <Empty text="No prescriptions" /> : rows.map(p => (<div className="card mb-2" key={p.id}><div className="card-body">
      <div className="d-flex justify-content-between"><strong>#{p.id} · {p.patient_name}</strong><span className="text-muted small">{p.created_at} · {p.doctor_name}</span></div>
      <table className="table table-sm mb-0 mt-2"><tbody>{p.items.map((i, k) => <tr key={k}><td>{i.medicine}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration}</td><td>{i.instructions}</td></tr>)}</tbody></table></div></div>))}</>);
}

export function InventoryReports({ admin = false }) {
  const [monthly, setMonthly] = useState(null); const [cat, setCat] = useState([]); const [exp, setExp] = useState([]); const [low, setLow] = useState([]);
  useEffect(() => { Promise.all([api.get('/inventory/monthly'), api.get('/inventory/low-stock-by-category'), api.get('/inventory/expiring', { params: { days: 90 } }), api.get('/inventory/low-stock')])
    .then(([m, c, e, l]) => { setMonthly(m.data); setCat(c.data); setExp(e.data); setLow(l.data); }); }, []);
  if (!monthly) return <Loading />;
  return (<>
    <div className="d-flex justify-content-between mb-3 no-print"><h3>{admin ? 'Pharmacy inventory (monitor)' : 'Inventory reports'}</h3>
      <div><button className="btn btn-outline-primary btn-sm me-2" onClick={() => download('/inventory/export.csv', 'inventory-report.csv')}>Export CSV</button><button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>Print / Save PDF</button></div></div>
    <div className="row g-3 mb-3">
      <div className="col-lg-7"><Card title="Monthly stock movement"><div style={{ height: 260 }}>{monthly.length === 0 ? <Empty text="No transactions yet" /> :
        <ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="received" fill="#16a34a" /><Bar dataKey="dispensed" fill="#dc2626" /><Bar dataKey="adjusted" fill="#6366f1" /></BarChart></ResponsiveContainer>}</div></Card></div>
      <div className="col-lg-5"><Card title="Low-stock medicines by category"><div style={{ height: 260 }}>{cat.length === 0 ? <Empty text="No low-stock items" /> :
        <ResponsiveContainer><BarChart data={cat}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f59e0b" /></BarChart></ResponsiveContainer>}</div></Card></div>
    </div>
    <div className="row g-3">
      <div className="col-lg-6"><Card title="Low stock">{low.length === 0 ? <Empty text="None" /> : low.map(m => <div key={m.id} className="small">{m.name}: {m.stock} (min {m.min_stock})</div>)}</Card></div>
      <div className="col-lg-6"><Card title="Expiry report (90 days)">{exp.length === 0 ? <Empty text="None" /> : exp.map(b => <div key={b.id} className="small">{b.medicine} · {b.batch_no} · qty {b.quantity} · {b.expiry_date}</div>)}</Card></div>
    </div></>);
}
