import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Printer, Search } from 'lucide-react';
import { useApi, Badge } from './ui';
import { inr, dt } from '../api';

// All quotations and stage bills across every project, in one place
export default function Bills() {
  const [bills] = useApi('/bills', []);
  const [quotes] = useApi('/quotations', []);
  const [pays] = useApi('/payments', []);
  const [kind, setKind] = useState('bill');
  const [q, setQ] = useState('');

  const paidFor = b => pays.filter(x => (x.bill?._id || x.bill) === b._id).reduce((s, x) => s + x.amount, 0);
  const rows = (kind === 'bill' ? bills : quotes)
    .filter(d => !q || [d.number, d.title, d.project?.name, d.project?.client?.name].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalBilled = bills.reduce((s, b) => s + (b.netReceivable ?? b.grandTotal), 0);
  const totalPaid = pays.reduce((s, x) => s + x.amount, 0);

  return (
    <>
      <div className="head"><div><h1>Bills & Quotations</h1><small>Every document across all projects</small></div></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Stage bills</div><div className="val">{bills.length}</div><small>{inr(totalBilled)} billed</small></div>
        <div className="card kpi"><div className="label">Quotations</div><div className="val">{quotes.length}</div><small>{quotes.filter(x => x.status === 'approved').length} approved</small></div>
        <div className="card kpi dark"><div className="label">Payment due</div><div className="val">{inr(totalBilled - totalPaid)}</div></div>
      </div>
      <div className="card fade">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={kind === 'bill' ? 'on' : ''} onClick={() => setKind('bill')}>Stage bills</button>
            <button className={kind === 'quotation' ? 'on' : ''} onClick={() => setKind('quotation')}>Quotations</button>
          </div>
          <div className="row grow" style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--muted)' }} />
            <input placeholder="Search number, project or client…" style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>No.</th><th>Project</th><th>Date</th>{kind === 'bill' && <th>Stage</th>}<th className="num">Amount</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(d => {
            const paid = kind === 'bill' ? paidFor(d) : 0;
            return (
              <tr key={d._id}>
                <td><b>{d.number}</b><small>{d.title}</small></td>
                <td><Link to={'/projects/' + d.project?._id}><b>{d.project?.name}</b></Link><small>{d.project?.client?.name}</small></td>
                <td>{dt(d.date)}</td>
                {kind === 'bill' && <td>Stage {d.stage}</td>}
                <td className="num"><b>{inr(d.grandTotal)}</b></td>
                <td>{kind === 'bill'
                  ? <span className={'badge ' + (paid >= (d.netReceivable ?? d.grandTotal) ? 'b-approved' : paid > 0 ? 'b-sent' : 'b-rejected')}>{paid >= (d.netReceivable ?? d.grandTotal) ? 'Paid' : paid > 0 ? 'Part paid' : 'Unpaid'}</span>
                  : <Badge s={d.status} />}</td>
                <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                  <a className="btn view-btn" href={`/print/${kind}/${d._id}`} target="_blank"><Eye size={15} /> View</a>
                  <Link className="icon" to={`/projects/${d.project?._id}/${kind}/${d._id}`} title="Edit"><Pencil size={15} /></Link>
                  <a className="icon" href={`/print/${kind}/${d._id}`} target="_blank" title="Print / PDF"><Printer size={15} /></a>
                </div></td>
              </tr>
            );
          })}
            {!rows.length && <tr><td colSpan={7} className="empty">Nothing here yet</td></tr>}</tbody>
        </table></div>
      </div>
    </>
  );
}
