import { useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { useApi, FormModal } from './ui';
import { api, inr, dt, isoDate } from '../api';

const PLANS = ['Trial', 'Annual', 'Half-yearly', 'Monthly', 'Lifetime'];
const daysLeft = d => (d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null);

function status(a) {
  if (!a.active) return ['Stopped', 'b-rejected'];
  const left = daysLeft(a.plan?.endDate);
  if (left !== null && left < 0) return ['Expired', 'b-rejected'];
  if (left !== null && left <= 30) return [`${left} days left`, 'b-sent'];
  return ['Active', 'b-active'];
}

// Flatten plan fields for the form and back
const toForm = a => ({ ...a, password: '', planName: a.plan?.name, planAmount: a.plan?.amount, startDate: a.plan?.startDate, endDate: a.plan?.endDate });
const fromForm = v => ({ name: v.name, username: v.username, phone: v.phone, password: v.password || undefined,
  plan: { name: v.planName, amount: v.planAmount, startDate: v.startDate || undefined, endDate: v.endDate || undefined } });

export default function Accounts() {
  const [rows, reload, error] = useApi('/auth/accounts', []);
  const [edit, setEdit] = useState(null);
  const fields = [
    { k: 'name', label: 'Business name', required: true, full: true },
    { k: 'username', label: 'Login username', required: true },
    { k: 'password', label: edit?._id ? 'New password (blank = keep)' : 'Password', type: 'password', required: !edit?._id },
    { k: 'phone', label: 'Phone' },
    { k: 'planName', label: 'Plan', options: PLANS },
    { k: 'planAmount', label: 'Plan amount (₹)', type: 'number' },
    { k: 'startDate', label: 'Start date', type: 'date' },
    { k: 'endDate', label: 'Expiry date (blank = never)', type: 'date' },
  ].filter(f => !(edit?._id && f.k === 'username'));

  const newAccount = () => {
    const end = new Date(); end.setFullYear(end.getFullYear() + 1);
    setEdit({ planName: 'Annual', planAmount: 0, startDate: isoDate(), endDate: isoDate(end) });
  };
  const renew = async a => {
    const from = a.plan?.endDate && new Date(a.plan.endDate) > new Date() ? new Date(a.plan.endDate) : new Date();
    from.setFullYear(from.getFullYear() + 1);
    if (!confirm(`Extend ${a.name} plan to ${dt(from)}?`)) return;
    await api('/auth/accounts/' + a._id, { method: 'PUT', body: { plan: { ...a.plan, endDate: from } } });
    reload();
  };
  const toggle = async a => {
    if (!confirm(`${a.active ? 'Stop' : 'Start'} service for ${a.name}?`)) return;
    await api('/auth/accounts/' + a._id, { method: 'PUT', body: { active: !a.active } });
    reload();
  };

  const active = rows.filter(a => status(a)[0] !== 'Stopped' && status(a)[0] !== 'Expired').length;
  return (
    <>
      <div className="head"><div><h1>Client Accounts</h1><small>Start / stop service and manage annual plans</small></div>
        <button className="primary" onClick={newAccount}><Plus size={16} /> New client account</button></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Total accounts</div><div className="val">{rows.length}</div></div>
        <div className="card kpi"><div className="label">Active</div><div className="val">{active}</div></div>
        <div className="card kpi dark"><div className="label">Plan revenue</div><div className="val">{inr(rows.reduce((s, a) => s + (a.plan?.amount || 0), 0))}</div></div>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="card table-wrap"><table>
        <thead><tr><th>Business</th><th>Username</th><th>Plan</th><th>Valid till</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map(a => {
          const [label, cls] = status(a);
          return (
            <tr key={a._id}>
              <td><b>{a.name}</b><small>{a.phone}</small></td>
              <td>{a.username}</td>
              <td>{a.plan?.name}<small>{inr(a.plan?.amount)}</small></td>
              <td>{a.plan?.endDate ? dt(a.plan.endDate) : 'No expiry'}</td>
              <td><span className={'badge ' + cls}>{label}</span></td>
              <td><div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                <button onClick={() => renew(a)}>Renew 1 yr</button>
                <button className={a.active ? 'danger' : 'primary'} onClick={() => toggle(a)}><Power size={14} /> {a.active ? 'Stop' : 'Start'}</button>
                <button className="icon" onClick={() => setEdit(toForm(a))}><Pencil size={15} /></button>
              </div></td>
            </tr>
          );
        })}
          {!rows.length && <tr><td colSpan={6} className="empty">No client accounts yet</td></tr>}</tbody>
      </table></div>
      {edit && <FormModal title={edit._id ? 'Edit client account' : 'New client account'} fields={fields} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/auth/accounts/' + edit._id : '/auth/accounts', { method: edit._id ? 'PUT' : 'POST', body: fromForm(v) }); reload(); }} />}
    </>
  );
}
