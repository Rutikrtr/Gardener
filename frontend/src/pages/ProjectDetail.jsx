import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Printer, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useApi, FormModal, Badge, Bar } from './ui';
import { api, inr, dt } from '../api';
import { projectFields } from './Projects';

const TABS = ['Overview', 'Quotations', 'Stage Bills', 'Payments', 'Daily Usage', 'Plant Stock'];

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [p, reloadP] = useApi('/projects/' + id);
  const [sum, reloadSum] = useApi(`/projects/${id}/summary`);
  const [quotes, reloadQ] = useApi('/quotations?project=' + id, []);
  const [bills, reloadB] = useApi('/bills?project=' + id, []);
  const [pays, reloadPay] = useApi('/payments?project=' + id, []);
  const [usage, reloadU] = useApi('/usage?project=' + id, []);
  const [ledger, reloadL] = useApi(`/projects/${id}/ledger`, []);
  const [daywise, reloadD] = useApi(`/projects/${id}/daywise`, []);
  const [clients] = useApi('/clients', []);
  const [modal, setModal] = useState(null);
  const reloadAll = () => [reloadP, reloadSum, reloadQ, reloadB, reloadPay, reloadU, reloadL, reloadD].forEach(f => f());

  if (!p) return <div className="empty">Loading…</div>;
  const del = async (path, msg) => {
    if (!confirm(msg)) return false;
    await api(path, { method: 'DELETE' });
    reloadAll();
    return true;
  };
  const billed = sum?.billed || 0;
  const paidByBill = b => pays.filter(x => x.bill?._id === b._id).reduce((s, x) => s + x.amount, 0);
  const ledgerItems = ledger.map(l => ({ value: l.item._id, label: `${l.item.name} (in hand: ${l.inHand} ${l.item.unit})` }));

  return (
    <>
      <div className="head">
        <div className="row"><button className="icon" onClick={() => nav('/projects')}><ArrowLeft size={18} /></button>
          <div><div className="row"><h1>{p.name}</h1><Badge s={p.status} /></div><small>{p.client?.name}{p.site ? ' · ' + p.site : ''}</small></div></div>
        <div className="row">
          <button onClick={() => setModal('project')}><Pencil size={15} /> Edit</button>
          <button className="danger" onClick={() => del('/projects/' + id, 'Delete project?').then(ok => ok && nav('/projects'))}><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        {[['Approved quote', sum?.quoted], ['Billed', billed], ['Received', sum?.received], ['Outstanding', sum?.outstanding]].map(([l, v], i) => (
          <div key={l} className={'card kpi' + (i === 3 ? ' dark' : '')}><div className="label">{l}</div><div className="val">{inr(v)}</div></div>
        ))}
      </div>

      <div className="tabs">{TABS.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Overview' && (
        <div className="grid g2">
          <div className="card">
            <h2>Workflow</h2>
            <ol style={{ lineHeight: 2, margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
              <li>Create a <b>Quotation</b> from the price list and mark it <b>Approved</b> when the client accepts.</li>
              <li>As work progresses, raise <b>Stage Bills</b> (Stage 1, 2, …) for supplied plants & material.</li>
              <li>Record <b>Payments</b> against each stage bill.</li>
              <li>Log <b>Daily Usage</b> — e.g. 11th: 50 plants planted. Unused billed plants carry to the next stage.</li>
              <li>Check <b>Plant Stock</b> for quoted vs billed vs used vs remaining.</li>
            </ol>
          </div>
          <div className="card">
            <h2>Progress</h2>
            <small>Billed against approved quotation</small>
            <div className="row" style={{ margin: '8px 0 16px' }}><Bar pct={sum?.quoted ? billed / sum.quoted * 100 : 0} /><b>{sum?.quoted ? Math.round(billed / sum.quoted * 100) : 0}%</b></div>
            <small>Payment collected</small>
            <div className="row" style={{ marginTop: 8 }}><Bar pct={billed ? sum.received / billed * 100 : 0} /><b>{billed ? Math.round(sum.received / billed * 100) : 0}%</b></div>
            <p><small>Remaining to bill: <b>{inr(sum?.toBill)}</b></small></p>
          </div>
        </div>
      )}

      {tab === 'Quotations' && (
        <div className="card">
          <div className="head"><h2 style={{ margin: 0 }}>Quotations</h2><Link className="btn primary" to={`/projects/${id}/quotation/new`}><Plus size={15} /> New quotation</Link></div>
          <DocTable rows={quotes} kind="quotation" pid={id} onDelete={d => del('/quotations/' + d._id, 'Delete quotation?')}
            extra={q => <select value={q.status} style={{ width: 120 }} onChange={async e => { await api('/quotations/' + q._id, { method: 'PUT', body: { status: e.target.value } }); reloadAll(); }}>
              {['draft', 'sent', 'approved', 'rejected'].map(s => <option key={s}>{s}</option>)}</select>} />
        </div>
      )}

      {tab === 'Stage Bills' && (
        <div className="card">
          <div className="head"><h2 style={{ margin: 0 }}>Stage-wise bills</h2><Link className="btn primary" to={`/projects/${id}/bill/new`}><Plus size={15} /> New stage bill</Link></div>
          <DocTable rows={bills} kind="bill" pid={id} onDelete={d => del('/bills/' + d._id, 'Delete bill?')}
            extra={b => { const paid = paidByBill(b); return <span className={paid >= b.grandTotal ? 'pos' : 'neg'}>{paid >= b.grandTotal ? 'Paid' : 'Due ' + inr(b.grandTotal - paid)}</span>; }} />
        </div>
      )}

      {tab === 'Payments' && (
        <div className="card">
          <div className="head"><h2 style={{ margin: 0 }}>Payments received</h2><button className="primary" onClick={() => setModal('payment')}><Plus size={15} /> Add payment</button></div>
          <table><thead><tr><th>Date</th><th>Against bill</th><th>Mode</th><th>Reference</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>{pays.map(x => <tr key={x._id}><td>{dt(x.date)}</td><td>{x.bill ? `Stage ${x.bill.stage} · ${x.bill.number}` : 'Advance'}</td><td>{x.mode}</td><td>{x.reference}</td>
              <td className="num pos">{inr(x.amount)}</td><td><button className="icon danger" onClick={() => del('/payments/' + x._id, 'Delete payment?')}><Trash2 size={15} /></button></td></tr>)}
              {!pays.length && <tr><td colSpan={6} className="empty">No payments yet</td></tr>}</tbody></table>
        </div>
      )}

      {tab === 'Daily Usage' && (
        <div className="grid">
          <div className="card">
            <div className="head"><div><h2 style={{ margin: 0 }}>Daily site usage</h2><small>Log how many plants / material were used each day</small></div>
              <button className="primary" onClick={() => setModal('usage')} disabled={!ledger.length}><Plus size={15} /> Log usage</button></div>
            {!ledger.length && <small>Add items to a stage bill first — usage is tracked against billed stock.</small>}
            <table><thead><tr><th>Date</th><th>Item</th><th className="num">Qty used</th><th>Note</th><th /></tr></thead>
              <tbody>{usage.map(u => <tr key={u._id}><td>{dt(u.date)}</td><td>{u.item?.name}</td><td className="num">{u.qty} {u.item?.unit}</td><td>{u.note}</td>
                <td><button className="icon danger" onClick={() => del('/usage/' + u._id, 'Delete entry?')}><Trash2 size={15} /></button></td></tr>)}
                {!usage.length && <tr><td colSpan={5} className="empty">No usage logged</td></tr>}</tbody></table>
          </div>
          <div className="card">
            <h2>Date-wise stock movement</h2>
            <table><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th className="num">Qty</th><th className="num">Remaining</th></tr></thead>
              <tbody>{daywise.map((e, i) => <tr key={i}><td>{dt(e.date)}</td><td>{e.name}</td><td>{e.type === 'billed' ? <span className="badge b-active">+ {e.ref}</span> : <span className="badge">Used {e.ref && '· ' + e.ref}</span>}</td>
                <td className={'num ' + (e.type === 'billed' ? 'pos' : 'neg')}>{e.type === 'billed' ? '+' : '−'}{e.qty}</td><td className="num"><b>{e.remaining}</b> {e.unit}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}

      {tab === 'Plant Stock' && (
        <div className="card">
          <h2>Plant & material stock</h2>
          <small style={{ marginBottom: 12 }}>Quoted = approved quotation · Billed = supplied in stage bills · In hand = billed − used (carries to next stage)</small>
          <div className="table-wrap"><table>
            <thead><tr><th>Item</th><th className="num">Quoted</th><th className="num">Billed</th><th className="num">Used</th><th className="num">In hand</th><th className="num">Left to bill</th><th>Used %</th></tr></thead>
            <tbody>{ledger.map(l => <tr key={l.item._id}><td><b>{l.item.name}</b><small>{l.item.category} · {l.item.unit}</small></td>
              <td className="num">{l.quoted}</td><td className="num">{l.billed}</td><td className="num">{l.used}</td>
              <td className={'num ' + (l.inHand < 0 ? 'neg' : 'pos')}>{l.inHand}</td><td className="num">{l.pendingToBill}</td>
              <td><Bar pct={l.billed ? l.used / l.billed * 100 : 0} warn={l.inHand < 0} /></td></tr>)}
              {!ledger.length && <tr><td colSpan={7} className="empty">No items yet</td></tr>}</tbody>
          </table></div>
        </div>
      )}

      {modal === 'project' && <FormModal title="Edit project" fields={projectFields(clients)} value={{ ...p, client: p.client?._id }} onClose={() => setModal(null)}
        onSave={async v => { await api('/projects/' + id, { method: 'PUT', body: { ...v, client: v.client || undefined } }); reloadAll(); }} />}
      {modal === 'payment' && <FormModal title="Add payment" onClose={() => setModal(null)} value={{ date: new Date().toISOString(), mode: 'Bank' }}
        fields={[
          { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'bill', label: 'Against stage bill', options: bills.map(b => ({ value: b._id, label: `Stage ${b.stage} · ${b.number} · ${inr(b.grandTotal)}` })) },
          { k: 'mode', label: 'Mode', options: ['Cash', 'Bank', 'UPI', 'Cheque'] },
          { k: 'reference', label: 'Reference / Cheque no.', full: true },
        ]}
        onSave={async v => { await api('/payments', { method: 'POST', body: { ...v, project: id, bill: v.bill || undefined } }); reloadAll(); }} />}
      {modal === 'usage' && <FormModal title="Log daily usage" onClose={() => setModal(null)} value={{ date: new Date().toISOString() }}
        fields={[
          { k: 'item', label: 'Plant / material', options: ledgerItems, required: true, full: true },
          { k: 'qty', label: 'Quantity used', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'note', label: 'Note (area, stage…)', full: true },
        ]}
        onSave={async v => { await api('/usage', { method: 'POST', body: { ...v, project: id } }); reloadAll(); }} />}
    </>
  );
}

function DocTable({ rows, kind, pid, onDelete, extra }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>No.</th>{kind === 'bill' && <th>Stage</th>}<th>Date</th><th>Title</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
      <tbody>
        {rows.map(d => (
          <tr key={d._id}>
            <td><b>{d.number}</b></td>{kind === 'bill' && <td>Stage {d.stage}</td>}<td>{dt(d.date)}</td><td>{d.title}</td>
            <td className="num"><b>{inr(d.grandTotal)}</b></td><td>{extra(d)}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
              <Link className="icon" to={`/projects/${pid}/${kind}/${d._id}`} title="Edit"><Pencil size={15} /></Link>
              <a className="icon" href={`/print/${kind}/${d._id}`} target="_blank" title="Print / PDF"><Printer size={15} /></a>
              <button className="icon danger" onClick={() => onDelete(d)}><Trash2 size={15} /></button>
            </div></td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={7} className="empty">Nothing here yet</td></tr>}
      </tbody>
    </table></div>
  );
}
