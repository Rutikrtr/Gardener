import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, Printer, Pencil, Trash2, ArrowLeft, CheckCircle2, ArrowRight, Sparkles, Info, Loader2, Lock, Eye } from 'lucide-react';
import { useApi, FormModal, Badge, Bar, toast } from './ui';
import { api, inr, dt } from '../api';
import { projectFields } from './Projects';
import Overview from './Overview';

function StatusPicker({ q, busy, onChange }) {
  if (busy) return <span className="badge b-sent"><Loader2 size={12} className="spin" /> Updating…</span>;
  return (
    <select className={'status-select s-' + q.status} value={q.status} onChange={e => onChange(e.target.value)}>
      {['draft', 'sent', 'approved', 'rejected'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
    </select>
  );
}

const TABS = ['Overview', 'Quotations', 'Stage Bills', 'Payments', 'Daily Usage', 'Plant Stock', 'Expenses & Profit'];
export const EXPENSE_TYPES = ['Labour', 'Transport', 'Plant purchase', 'Material purchase', 'Machinery / JCB', 'Water / tanker', 'Food & stay', 'Other'];

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState(useLocation().state?.tab || 'Overview');
  const [busy, setBusy] = useState(null);
  const [p, reloadP] = useApi('/projects/' + id);
  const [sum, reloadSum] = useApi(`/projects/${id}/summary`);
  const [quotes, reloadQ] = useApi('/quotations?project=' + id, []);
  const [bills, reloadB] = useApi('/bills?project=' + id, []);
  const [pays, reloadPay] = useApi('/payments?project=' + id, []);
  const [usage, reloadU] = useApi('/usage?project=' + id, []);
  const [ledger, reloadL] = useApi(`/projects/${id}/ledger`, []);
  const [daywise, reloadD] = useApi(`/projects/${id}/daywise`, []);
  const [expenses, reloadE] = useApi('/expenses?project=' + id, []);
  const [clients] = useApi('/clients', []);
  const [modal, setModal] = useState(null);
  const reloadAll = () => [reloadP, reloadSum, reloadQ, reloadB, reloadPay, reloadU, reloadL, reloadD, reloadE].forEach(f => f());

  if (!p) return <div className="empty">Loading…</div>;
  const del = async (path, msg) => {
    if (!confirm(msg)) return false;
    await api(path, { method: 'DELETE' });
    reloadAll();
    return true;
  };
  const approvedQ = quotes.filter(q => q.status === 'approved');
  const setQStatus = async (q, status) => {
    setBusy(q._id);
    try {
      await api('/quotations/' + q._id, { method: 'PUT', body: { status } }); // project status updates automatically
      await new Promise(r => setTimeout(r, 700)); // short pause so the change feels deliberate
      reloadAll();
      toast(status === 'approved' ? `${q.number} approved — ready for stage billing` : `${q.number} marked ${status}`);
    } catch (e) { toast(e.message, 'err'); }
    setBusy(null);
  };
  const billed = sum?.billed || 0;
  const paidByBill = b => pays.filter(x => x.bill?._id === b._id).reduce((s, x) => s + x.amount, 0);
  // Only billed items that still have stock in hand can be used on site
  const inHand = ledger.filter(l => l.inHand > 0);
  const ledgerItems = inHand.map(l => ({ value: l.item._id, label: `${l.item.name} — ${l.inHand} ${l.item.unit} in hand` }));
  const stockOf = v => ledger.find(l => l.item._id === v.item);

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

      {tab === 'Overview' && <Overview p={p} sum={sum} quotes={quotes} bills={bills} pays={pays} usage={usage} ledger={ledger}
        go={t => (t === 'edit' ? setModal('project') : setTab(t))} />}

      {tab === 'Expenses & Profit' && (
        <div className="grid fade">
          <div className="notice"><Lock size={16} /> Internal only — expenses and profit are never shown on quotations or bills.</div>
          <div className="grid g4">
            <div className="card kpi"><div className="label">Revenue <small style={{ display: 'inline' }}>(billed, excl. GST)</small></div><div className="val">{inr(sum?.revenue)}</div></div>
            <div className="card kpi"><div className="label">Plant & material cost</div><div className="val">{inr(sum?.materialCost)}</div><small>Billed qty × purchase cost in Price List</small></div>
            <div className="card kpi"><div className="label">Labour & other expenses</div><div className="val">{inr(sum?.expenses)}</div></div>
            <div className={'card kpi dark'}><div className="label">Profit</div><div className="val" style={{ color: sum?.profit < 0 ? '#ff8a8a' : undefined }}>{inr(sum?.profit)}</div>
              <small style={{ color: '#a9bba9' }}>{sum?.margin || 0}% margin</small></div>
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="head"><h2 style={{ margin: 0 }}>Expenses</h2><button className="primary" onClick={() => setModal('expense')}><Plus size={15} /> Add expense</button></div>
              <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Paid to</th><th>Note</th><th className="num">Amount</th><th /></tr></thead>
                <tbody>{expenses.map(x => <tr key={x._id}><td>{dt(x.date)}</td><td><span className="badge">{x.category}</span></td><td>{x.paidTo}</td><td>{x.note}</td>
                  <td className="num neg">{inr(x.amount)}</td>
                  <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setModal({ expense: x })}><Pencil size={15} /></button>
                    <button className="icon danger" onClick={() => del('/expenses/' + x._id, 'Delete expense?')}><Trash2 size={15} /></button></div></td></tr>)}
                  {!expenses.length && <tr><td colSpan={6} className="empty">No expenses yet. Add labour wages, transport, JCB, etc.</td></tr>}</tbody></table></div>
            </div>
            <div className="card">
              <h2>Where the money goes</h2>
              {[['Plant & material', sum?.materialCost || 0], ...(sum?.byCategory || []).map(c => [c._id, c.t])].map(([l, v]) => (
                <div key={l} className="meter">
                  <div className="row" style={{ justifyContent: 'space-between' }}><span>{l}</span><b>{inr(v)}</b></div>
                  <Bar pct={sum?.revenue ? v / sum.revenue * 100 : 0} warn />
                </div>
              ))}
              <div className="meter" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><b>Profit</b><b className={sum?.profit < 0 ? 'neg' : 'pos'}>{inr(sum?.profit)}</b></div>
                <Bar pct={sum?.revenue ? Math.max(0, sum.profit) / sum.revenue * 100 : 0} />
              </div>
              <small style={{ marginTop: 12 }}>Tip: set the purchase cost of each plant in the Price List so plant cost is calculated automatically.</small>
            </div>
          </div>
        </div>
      )}

      {tab === 'Quotations' && (
        <div className="card fade">
          <div className="head"><h2 style={{ margin: 0 }}>Quotations</h2><Link className="btn primary" to={`/projects/${id}/quotation/new`}><Plus size={15} /> New quotation</Link></div>
          {approvedQ.length > 0 && (
            <div className="notice ok">
              <CheckCircle2 size={16} /><span className="grow">Quotation <b>{approvedQ[0].number}</b> is approved. {sum?.toBill > 0 ? `${inr(sum.toBill)} is ready to bill.` : 'Fully billed.'}</span>
              {sum?.toBill > 0 && <button className="primary" onClick={() => setTab('Stage Bills')}>Go to bills <ArrowRight size={15} /></button>}
            </div>
          )}
          <DocTable rows={quotes} kind="quotation" pid={id} onDelete={d => del('/quotations/' + d._id, 'Delete quotation?')}
            extra={q => <StatusPicker q={q} busy={busy === q._id} onChange={s => setQStatus(q, s)} />} />
        </div>
      )}

      {tab === 'Stage Bills' && (
        <div className="card fade">
          <div className="head"><h2 style={{ margin: 0 }}>Stage-wise bills</h2><Link className="btn primary" to={`/projects/${id}/bill/new`}><Plus size={15} /> New stage bill</Link></div>
          {approvedQ.length > 0 && sum?.toBill > 0 && (
            <div className="notice ok glow">
              <Sparkles size={16} />
              <span className="grow">Approved quotation <b>{approvedQ.map(q => q.number).join(', ')}</b> — <b>{inr(sum.toBill)}</b> left to bill. Make {bills.length ? `Stage ${bills.length + 1}` : 'the first stage'} bill from it.</span>
              <Link className="btn primary" to={`/projects/${id}/bill/new`}>Create Stage {bills.length + 1} bill <ArrowRight size={15} /></Link>
            </div>
          )}
          {!approvedQ.length && <div className="notice warn"><Info size={16} /> No approved quotation yet. Approve one in Quotations so bills follow its quantities.</div>}
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
              <button className="primary" onClick={() => setModal('usage')} disabled={!inHand.length}><Plus size={15} /> Log usage</button></div>
            {!inHand.length && <div className="notice warn"><Info size={16} /> {ledger.some(l => l.billed > 0)
              ? 'All billed plants and material are already used. Make the next stage bill to add more stock.'
              : 'Nothing billed yet. Usage is tracked against billed stock, so make a stage bill first.'}</div>}
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
      {(modal === 'expense' || modal?.expense) && <FormModal title={modal.expense ? 'Edit expense' : 'Add expense (internal)'} onClose={() => setModal(null)}
        value={modal.expense || { date: new Date().toISOString(), category: 'Labour' }}
        fields={[
          { k: 'category', label: 'Type', options: EXPENSE_TYPES, required: true },
          { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'paidTo', label: 'Paid to (e.g. labour contractor)' },
          { k: 'note', label: 'Note (e.g. 6 labourers × 2 days)', full: true },
        ]}
        onSave={async v => {
          if (!(v.amount > 0)) throw new Error('Enter an amount more than 0');
          await api(modal.expense ? '/expenses/' + modal.expense._id : '/expenses', { method: modal.expense ? 'PUT' : 'POST', body: { ...v, project: id } });
          reloadAll();
        }} />}
      {modal === 'usage' &&<FormModal title="Log daily usage" onClose={() => setModal(null)} value={{ date: new Date().toISOString() }}
        fields={[
          { k: 'item', label: 'Plant / material', options: ledgerItems, required: true, full: true },
          { k: 'qty', label: 'Quantity used', type: 'number', required: true, max: v => stockOf(v)?.inHand ?? 0,
            hint: v => stockOf(v) ? `Max ${stockOf(v).inHand} ${stockOf(v).item.unit} (billed ${stockOf(v).billed}, used ${stockOf(v).used})` : 'Pick an item first' },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'note', label: 'Note (area, stage…)', full: true },
        ]}
        onSave={async v => {
          if (!(v.qty > 0)) throw new Error('Enter a quantity more than 0');
          await api('/usage', { method: 'POST', body: { ...v, project: id } }); reloadAll();
        }} />}
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
              <a className="btn view-btn" href={`/print/${kind}/${d._id}`} target="_blank" title="View"><Eye size={15} /> View</a>
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
