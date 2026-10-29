import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { useApi, FormModal } from './ui';
import { api, inr } from '../api';
import { SUPPLIER_FIELDS } from './ProjectCosts';

// All suppliers with what we owe them (or they owe us), overall and per project
export default function Suppliers() {
  const [suppliers, reload] = useApi('/suppliers', []);
  const [buys] = useApi('/purchase-usage', []);
  const [paid] = useApi('/supplier-payments', []);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);

  const stat = {};
  const add = (sid, pid, pname, k, v) => {
    const s = (stat[sid] ??= { bought: 0, paid: 0, projects: {} });
    s[k] += v;
    const pr = (s.projects[pid] ??= { name: pname, bought: 0, paid: 0, items: {} });
    pr[k] += v;
    return pr;
  };
  buys.forEach(b => {
    if (!b.supplier) return;
    const pr = add(b.supplier._id, b.project?._id, b.project?.name, 'bought', b.amount || 0);
    const name = b.item?.name || b.description || 'Other';
    const it = (pr.items[name] ??= { unit: b.unit || b.item?.unit || '', qty: 0, used: 0, linked: !!b.item });
    it.qty += b.qty || 0; it.used += b.usedQty || 0;
  });
  paid.forEach(p => p.supplier && add(p.supplier._id, p.project?._id, p.project?.name, 'paid', p.amount || 0));
  const totalDue = Object.values(stat).reduce((s, x) => s + x.bought - x.paid, 0);

  return (
    <>
      <div className="head"><div><h1>Suppliers</h1><small>Nurseries & vendors — what was delivered to which project, how much is used, and what is still to pay. Click a supplier to see its projects.</small></div>
        <button className="primary" onClick={() => setEdit({})}><Plus size={16} /> Add supplier</button></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Suppliers</div><div className="val">{suppliers.length}</div></div>
        <div className="card kpi"><div className="label">Total bought</div><div className="val">{inr(Object.values(stat).reduce((s, x) => s + x.bought, 0))}</div></div>
        <div className="card kpi dark"><div className="label">{totalDue >= 0 ? 'Total to pay' : 'Suppliers owe us'}</div><div className="val">{inr(Math.abs(totalDue))}</div></div>
      </div>
      <div className="card table-wrap"><table>
        <thead><tr><th>Supplier</th><th>Phone</th><th className="num">Bought</th><th className="num">Paid</th><th className="num">Balance</th><th /></tr></thead>
        <tbody>{suppliers.map(s => {
          const st = stat[s._id] || { bought: 0, paid: 0, projects: {} }, due = st.bought - st.paid;
          return [
            <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === s._id ? null : s._id)}>
              <td><div className="row"><span className="ico"><Truck size={15} /></span><div><b>{s.name}</b><small>{s.gstin || s.address}</small></div></div></td>
              <td>{s.phone}</td><td className="num">{inr(st.bought)}</td><td className="num">{inr(st.paid)}</td>
              <td className={'num ' + (due > 0 ? 'neg' : due < 0 ? 'pos' : '')}><b>{due > 0 ? `To pay ${inr(due)}` : due < 0 ? `Owes us ${inr(-due)}` : 'Settled'}</b></td>
              <td onClick={e => e.stopPropagation()}><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                <button className="icon" onClick={() => setEdit(s)}><Pencil size={15} /></button>
                <button className="icon danger" onClick={async () => { if (confirm('Delete supplier?')) { await api('/suppliers/' + s._id, { method: 'DELETE' }); reload(); } }}><Trash2 size={15} /></button>
              </div></td>
            </tr>,
            open === s._id && Object.entries(st.projects).map(([pid, pr]) => (
              <tr key={s._id + pid} className="sub-row"><td colSpan={2}>↳ <Link to={'/projects/' + pid} state={{ tab: 'purchases' }}><b>{pr.name}</b></Link>
                  {Object.entries(pr.items).map(([n, it]) => <small key={n}>{n}: {it.qty} {it.unit} received{it.linked ? ` · ${it.used} used · ${it.qty - it.used} at site` : ''}</small>)}</td>
                <td className="num">{inr(pr.bought)}</td><td className="num">{inr(pr.paid)}</td><td className="num">{inr(pr.bought - pr.paid)}</td><td /></tr>
            )),
          ];
        })}
          {!suppliers.length && <tr><td colSpan={6} className="empty">No suppliers yet</td></tr>}</tbody>
      </table></div>
      {edit && <FormModal title={edit._id ? 'Edit supplier' : 'Add supplier'} fields={SUPPLIER_FIELDS} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/suppliers/' + edit._id : '/suppliers', { method: edit._id ? 'PUT' : 'POST', body: v }); reload(); }} />}
    </>
  );
}
