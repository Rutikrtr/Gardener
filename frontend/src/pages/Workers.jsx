import { useState } from 'react';
import { Plus, Pencil, Trash2, HardHat } from 'lucide-react';
import { useApi, FormModal } from './ui';
import { api, inr } from '../api';
import { WORKER_FIELDS, workerBody } from './ProjectCosts';

// Labour team, with work and unpaid amounts across all projects
export default function Workers() {
  const [workers, reload] = useApi('/workers', []);
  const [labour] = useApi('/labour', []);
  const [edit, setEdit] = useState(null);
  const stat = {};
  labour.forEach(l => {
    const s = (stat[l.worker?._id] ??= { days: 0, cost: 0, unpaid: 0 });
    s.days += l.days; s.cost += l.totalCost; if (!l.paid) s.unpaid += l.totalCost;
  });
  const unpaid = Object.values(stat).reduce((s, x) => s + x.unpaid, 0);
  return (
    <>
      <div className="head"><div><h1>Workers</h1><small>Your labour team — record their days inside each project</small></div>
        <button className="primary" onClick={() => setEdit({ role: 'Mali / Gardener', pfApplicable: 'no', esiApplicable: 'no' })}><Plus size={16} /> Add worker</button></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Workers</div><div className="val">{workers.filter(w => w.active !== false).length}</div></div>
        <div className="card kpi"><div className="label">Total labour cost</div><div className="val">{inr(Object.values(stat).reduce((s, x) => s + x.cost, 0))}</div></div>
        <div className="card kpi dark"><div className="label">Unpaid wages</div><div className="val">{inr(unpaid)}</div></div>
      </div>
      <div className="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Work</th><th className="num">Daily wage</th><th>PF / ESI</th><th className="num">Days worked</th><th className="num">Unpaid</th><th /></tr></thead>
        <tbody>{workers.map(w => {
          const s = stat[w._id] || { days: 0, unpaid: 0 };
          return (
            <tr key={w._id} style={{ opacity: w.active === false ? .5 : 1 }}>
              <td><div className="row"><span className="ico"><HardHat size={15} /></span><div><b>{w.name}</b><small>{w.phone}</small></div></div></td>
              <td>{w.role}</td><td className="num">{inr(w.dailyWage)}</td>
              <td>{[w.pfApplicable && 'PF', w.esiApplicable && 'ESI'].filter(Boolean).join(' + ') || '—'}</td>
              <td className="num">{s.days}</td><td className={'num ' + (s.unpaid ? 'neg' : '')}>{inr(s.unpaid)}</td>
              <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                <button className="icon" onClick={() => setEdit({ ...w, pfApplicable: w.pfApplicable ? 'yes' : 'no', esiApplicable: w.esiApplicable ? 'yes' : 'no' })}><Pencil size={15} /></button>
                <button className="icon danger" onClick={async () => { if (confirm('Delete worker?')) { await api('/workers/' + w._id, { method: 'DELETE' }); reload(); } }}><Trash2 size={15} /></button>
              </div></td>
            </tr>
          );
        })}
          {!workers.length && <tr><td colSpan={7} className="empty">No workers yet</td></tr>}</tbody>
      </table></div>
      {edit && <FormModal title={edit._id ? 'Edit worker' : 'Add worker'} fields={WORKER_FIELDS} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/workers/' + edit._id : '/workers', { method: edit._id ? 'PUT' : 'POST', body: workerBody(v) }); reload(); }} />}
    </>
  );
}
