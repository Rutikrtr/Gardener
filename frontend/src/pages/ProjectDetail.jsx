import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Printer, Pencil, Trash2, ArrowLeft, ArrowRight, Info, Loader2, Eye, LayoutGrid, FileText, Receipt, Wallet, Sprout,
  Truck, HardHat, Coins, TrendingUp, FileSpreadsheet, Copy, BadgeCheck, Send, XCircle, CheckCircle2, Circle, Lock,
} from 'lucide-react';
import { useApi, FormModal, Badge, Bar, toast, Tick } from './ui';
import { api, inr, dt, Q_STATUS } from '../api';
import { projectFields } from './Projects';
import Overview from './Overview';
import { exportProject } from '../excel';
import { Purchases, LabourSection, Expenses, ProfitLoss } from './ProjectCosts';

// Left menu of the project page, grouped so it's clear what is for the customer and what is internal
const NAV = [
  { group: null, items: [['overview', 'Overview', LayoutGrid]] },
  { group: 'Customer', items: [['quotes', 'Quotations & Work Order', FileText], ['bills', 'Bills', Receipt], ['payments', 'Payments received', Wallet]] },
  { group: 'Site', items: [['stock', 'Plants & stock', Sprout]] },
  { group: 'Costs · internal', items: [['purchases', 'Suppliers & purchases', Truck], ['labour', 'Labour', HardHat], ['expenses', 'Other expenses', Coins], ['pnl', 'Profit & loss', TrendingUp]] },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState(useLocation().state?.tab || 'overview');
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
  const [costsVersion, setCostsVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const downloadExcel = async () => {
    setExporting(true);
    try { await exportProject(id); toast('Excel report downloaded'); } catch (e) { toast(e.message, 'err'); }
    setExporting(false);
  };
  const reloadAll = () => { [reloadP, reloadSum, reloadQ, reloadB, reloadPay, reloadU, reloadL, reloadD].forEach(f => f()); setCostsVersion(v => v + 1); };

  if (!p || !sum) return <ProjectSkeleton />;
  const del = async (path, msg) => {
    if (!confirm(msg)) return false;
    await api(path, { method: 'DELETE' });
    reloadAll();
    toast('Deleted');
    return true;
  };
  const wo = quotes.find(q => q.status === 'approved');
  const ctx = { id, p, sum, quotes, bills, pays, usage, ledger, daywise, wo, reloadAll, del, setModal, go: setTab, costsVersion };
  const counts = { quotes: quotes.length, bills: bills.length, payments: pays.length };

  return (
    <>
      <div className="head">
        <div className="row"><button className="icon" onClick={() => nav('/projects')}><ArrowLeft size={18} /></button>
          <div><div className="row"><h1>{p.name}</h1><Badge s={p.status} /></div><small>{p.client?.name}{p.client?.company ? ` · ${p.client.company}` : ''}{p.site ? ' · ' + p.site : ''}</small></div></div>
        <div className="row">
          <button onClick={downloadExcel} disabled={exporting}><FileSpreadsheet size={15} /> {exporting ? 'Preparing…' : 'Excel report'}</button>
          <button onClick={() => setModal('project')}><Pencil size={15} /> Edit project</button>
          <button className="danger" onClick={() => del('/projects/' + id, 'Delete this project and keep its documents?').then(ok => ok && nav('/projects'))}><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="proj">
        <aside className="pnav">
          {NAV.map(g => (
            <div key={g.group || 'top'}>
              {g.group && <div className="pnav-label">{g.group}</div>}
              {g.items.map(([k, label, Icon]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                  <Icon size={17} /><span className="grow">{label}</span>{counts[k] ? <span className="count">{counts[k]}</span> : null}
                </button>
              ))}
            </div>
          ))}
          <div className="pnav-foot">
            <div className="pnav-label">Quick actions</div>
            <Link className="qa" to={`/projects/${id}/quotation/new`}><FileText size={15} /> New quotation</Link>
            <Link className="qa" to={`/projects/${id}/bill/new`}><Receipt size={15} /> New stage bill</Link>
            <button className="qa" onClick={() => setTab('stock')}><Sprout size={15} /> Log usage</button>
            <button className="qa" onClick={downloadExcel} disabled={exporting}><FileSpreadsheet size={15} /> {exporting ? 'Preparing…' : 'Excel'}</button>
          </div>
        </aside>

        <div className="pmain">
        <div className="strip">
          <div><small>Work order value</small><b>{wo ? inr(sum?.quoted) : '—'}</b></div>
          <div><small>Billed</small><b>{inr(sum?.billed)}</b></div>
          <div><small>Received</small><b className="pos">{inr(sum?.received)}</b></div>
          <div><small>Due from customer</small><b className={sum?.outstanding > 0 ? 'neg' : ''}>{inr(sum?.outstanding)}</b></div>
          <div className="dark"><small>Profit <Lock size={11} /></small><b>{inr(sum?.profit)} <span>{sum?.margin || 0}%</span></b></div>
        </div>

        <div className="pbody" key={tab}>
          {tab === 'overview' && <Overview {...ctx} go={t => (t === 'edit' ? setModal('project') : setTab(t))} />}
          {tab === 'quotes' && <Quotations {...ctx} />}
          {tab === 'bills' && <Bills {...ctx} />}
          {tab === 'payments' && <Payments {...ctx} />}
          {tab === 'stock' && <Stock {...ctx} />}
          {tab === 'purchases' && <Purchases {...ctx} />}
          {tab === 'labour' && <LabourSection {...ctx} />}
          {tab === 'expenses' && <Expenses {...ctx} />}
          {tab === 'pnl' && <ProfitLoss {...ctx} />}
        </div>
        </div>
      </div>

      {modal === 'project' && <FormModal title="Edit project" fields={projectFields(clients)} value={{ ...p, client: p.client?._id }} onClose={() => setModal(null)}
        onSave={async v => { await api('/projects/' + id, { method: 'PUT', body: { ...v, client: v.client || undefined } }); reloadAll(); }} />}
    </>
  );
}

/* ---------------- Quotations & Work Order ---------------- */
function Quotations({ id, quotes, wo, sum, reloadAll, del, go }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(null);
  const [woFor, setWoFor] = useState(null);
  // Group revisions of the same quotation together (QT-…, QT-…-R1, QT-…-R2)
  const groups = {};
  quotes.forEach(q => { (groups[q.baseNumber || q.number] ??= []).push(q); });
  const list = Object.entries(groups).map(([base, rs]) => ({ base, rs: rs.sort((a, b) => (b.revision || 0) - (a.revision || 0)) }))
    .sort((a, b) => new Date(b.rs[0].date) - new Date(a.rs[0].date));

  const act = async (q, fn, msg) => {
    setBusy(q._id);
    try { const r = await fn(); await new Promise(res => setTimeout(res, 500)); reloadAll(); toast(msg); return r; } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const revise = q => act(q, () => api(`/projects/${id}/quotations/${q._id}/revise`, { method: 'POST' }), `Revision created from ${q.number}`)
    .then(r => r && nav(`/projects/${id}/quotation/${r._id}`));
  const setStatus = (q, status) => act(q, () => api('/quotations/' + q._id, { method: 'PUT', body: { status } }), `${q.number}: ${Q_STATUS[status]}`);

  return (
    <div className="grid fade">
      {wo ? (
        <div className="card wo-card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row"><span className="wo-icon"><BadgeCheck size={22} /></span>
              <div><small>Work Order (final quotation)</small><h2 style={{ margin: 0 }}>{wo.number}</h2>
                <small>{wo.poNumber ? `Customer PO ${wo.poNumber}` : 'No PO number added'}{wo.poDate ? ` · ${dt(wo.poDate)}` : ''}</small></div></div>
            <div style={{ textAlign: 'right' }}><small>Value</small><div className="wo-val">{inr(wo.grandTotal)}</div></div>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn view-btn" href={`/print/quotation/${wo._id}`} target="_blank"><Eye size={15} /> View work order</a>
            <button onClick={() => setWoFor(wo)}><Pencil size={15} /> PO details</button>
            {sum?.toBill > 0 && <button className="primary" onClick={() => go('bills')}>{inr(sum.toBill)} left to bill <ArrowRight size={15} /></button>}
          </div>
        </div>
      ) : (
        <div className="notice warn"><Info size={16} /><span className="grow">No work order yet. Send quotations, revise them as the customer asks, and when they agree click <b>Make Work Order</b>.</span></div>
      )}

      <div className="card">
        <div className="head" style={{ marginBottom: 6 }}><div><h2 style={{ margin: 0 }}>Quotations</h2><small>Every version is kept. Revise to make a new version — the old one stays for reference.</small></div>
          <Link className="btn primary" to={`/projects/${id}/quotation/new`}><Plus size={15} /> New quotation</Link></div>

        {list.map(({ base, rs }) => (
          <div key={base} className="qgroup">
            <div className="qgroup-head"><b>{base}</b><small>{rs[rs.length - 1].title || 'Quotation'} · {rs.length} version{rs.length > 1 ? 's' : ''}</small></div>
            {rs.map((q, i) => (
              <div key={q._id} className={'qrow' + (q.status === 'approved' ? ' is-wo' : '') + (q.status === 'revised' ? ' is-old' : '')}>
                <span className="rev">{q.revision ? `R${q.revision}` : 'R0'}</span>
                <div className="grow"><b>{q.number}</b><small>{dt(q.date)}{i === 0 && rs.length > 1 ? ' · latest' : ''}</small></div>
                <b className="num" style={{ minWidth: 110 }}>{inr(q.grandTotal)}</b>
                {busy === q._id ? <span className="badge b-sent"><Loader2 size={12} className="spin" /> Updating…</span> : <span className={'badge q-' + q.status}>{Q_STATUS[q.status]}</span>}
                <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                  <a className="btn view-btn" href={`/print/quotation/${q._id}`} target="_blank"><Eye size={14} /> View</a>
                  {!['revised', 'approved'].includes(q.status) && <Link className="icon" title="Edit" to={`/projects/${id}/quotation/${q._id}`}><Pencil size={15} /></Link>}
                  {i === 0 && q.status !== 'approved' && <button className="icon" title="Revise (new version)" onClick={() => revise(q)}><Copy size={15} /></button>}
                  {q.status === 'draft' && <button className="icon" title="Mark as sent" onClick={() => setStatus(q, 'sent')}><Send size={15} /></button>}
                  {q.status !== 'approved' && i === 0 && <button className="primary small" onClick={() => setWoFor(q)}><BadgeCheck size={14} /> Make Work Order</button>}
                  {['draft', 'sent'].includes(q.status) && <button className="icon danger" title="Rejected by customer" onClick={() => setStatus(q, 'rejected')}><XCircle size={15} /></button>}
                  {q.status !== 'approved' && <button className="icon danger" title="Delete" onClick={() => del('/quotations/' + q._id, `Delete ${q.number}?`)}><Trash2 size={15} /></button>}
                </div>
              </div>
            ))}
          </div>
        ))}
        {!list.length && <div className="empty">No quotations yet. Click “New quotation” to make the first one.</div>}
      </div>

      {woFor && <FormModal title={woFor.status === 'approved' ? 'Work order details' : `Make ${woFor.number} the Work Order`} onClose={() => setWoFor(null)}
        value={{ poNumber: woFor.poNumber || '', poDate: (woFor.poDate || new Date().toISOString()) }}
        fields={[
          { k: 'poNumber', label: "Customer's PO / work order no. (optional)" },
          { k: 'poDate', label: 'Date', type: 'date' },
        ]}
        onSave={async v => {
          await api(`/projects/${id}/quotations/${woFor._id}/work-order`, { method: 'POST', body: v });
          reloadAll();
          toast(`${woFor.number} is now the Work Order — bills will follow its quantities`);
        }} />}
    </div>
  );
}

/* ---------------- Bills with TDS / GST tracking ---------------- */
function Bills({ id, bills, pays, wo, sum, reloadAll, del }) {
  const paidFor = b => pays.filter(x => (x.bill?._id || x.bill) === b._id).reduce((s, x) => s + x.amount, 0);
  const toggle = async (b, field) => {
    const on = !b[field];
    await api('/bills/' + b._id, { method: 'PUT', body: { [field]: on, [field === 'tdsCertReceived' ? 'tdsCertDate' : 'gstReportDate']: on ? new Date() : null } });
    reloadAll();
    toast(on ? 'Marked as received' : 'Marked as pending');
  };
  const pendingTds = bills.filter(b => b.tdsAmount > 0 && !b.tdsCertReceived).length;
  const pendingGst = bills.filter(b => !b.gstReportReceived).length;
  return (
    <div className="grid fade">
      {wo && sum?.toBill > 0 && (
        <div className="notice ok glow">
          <CheckCircle2 size={16} />
          <span className="grow">Work order <b>{wo.number}</b> — <b>{inr(sum.toBill)}</b> left to bill.</span>
          <Link className="btn primary" to={`/projects/${id}/bill/new`}>Create Stage {bills.length + 1} bill <ArrowRight size={15} /></Link>
        </div>
      )}
      {!wo && <div className="notice warn"><Info size={16} /> No work order yet. Make one in Quotations so bills follow its quantities.</div>}
      {(pendingTds > 0 || pendingGst > 0) && bills.length > 0 && (
        <div className="notice warn"><Info size={16} /> Still to collect from the customer: {[pendingTds && `${pendingTds} TDS certificate${pendingTds > 1 ? 's' : ''}`, pendingGst && `${pendingGst} GST report${pendingGst > 1 ? 's' : ''}`].filter(Boolean).join(' and ')}. Tick them below when received.</div>
      )}
      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Stage bills</h2><Link className="btn primary" to={`/projects/${id}/bill/new`}><Plus size={15} /> New stage bill</Link></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Stage</th><th>Bill</th><th className="num">Bill amount</th><th className="num">To receive</th><th>TDS certificate</th><th>GST report</th><th /></tr></thead>
          <tbody>{bills.map(b => {
            const net = b.netReceivable ?? b.grandTotal, paid = paidFor(b);
            return (
              <tr key={b._id}>
                <td><span className="stage">{b.stage}</span></td>
                <td><b className="nowrap">{b.number}</b><small>{dt(b.date)}{b.title ? ' · ' + b.title : ''}</small></td>
                <td className="num"><b>{inr(b.grandTotal)}</b></td>
                <td className="num"><b>{inr(net)}</b>{b.tdsAmount ? <small>after {b.tdsPercent}% TDS {inr(b.tdsAmount)}</small> : null}
                  <div style={{ marginTop: 4 }}>{paid >= net ? <span className="badge b-approved">Paid</span> : paid > 0 ? <span className="badge b-sent">Due {inr(net - paid)}</span> : <span className="badge b-rejected">Unpaid</span>}</div></td>
                <td>{b.tdsAmount > 0 ? <Tick on={b.tdsCertReceived} date={b.tdsCertDate} onClick={() => toggle(b, 'tdsCertReceived')} /> : <small>No TDS</small>}</td>
                <td><Tick on={b.gstReportReceived} date={b.gstReportDate} onClick={() => toggle(b, 'gstReportReceived')} /></td>
                <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                  <a className="btn view-btn" href={`/print/bill/${b._id}`} target="_blank"><Eye size={14} /> View</a>
                  <Link className="icon" to={`/projects/${id}/bill/${b._id}`} title="Edit"><Pencil size={15} /></Link>
                  <button className="icon danger" onClick={() => del('/bills/' + b._id, `Delete ${b.number}?`)}><Trash2 size={15} /></button>
                </div></td>
              </tr>
            );
          })}
            {!bills.length && <tr><td colSpan={7} className="empty">No bills yet</td></tr>}</tbody>
        </table></div>
        {sum?.extraBilled > 0 && <small style={{ marginTop: 10 }}>Includes <b>{inr(sum.extraBilled)}</b> of extra work beyond the work order.</small>}
      </div>
    </div>
  );
}


/* ---------------- Payments received ---------------- */
function Payments({ id, bills, pays, sum, reloadAll, del }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid fade">
      <div className="grid g3">
        <div className="card kpi"><div className="label">To receive (after TDS)</div><div className="val">{inr(sum?.billedNet)}</div></div>
        <div className="card kpi"><div className="label">Received</div><div className="val pos">{inr(sum?.received)}</div></div>
        <div className="card kpi dark"><div className="label">Still due</div><div className="val">{inr(sum?.outstanding)}</div></div>
      </div>
      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Payments received</h2><button className="primary" onClick={() => setOpen(true)}><Plus size={15} /> Add payment</button></div>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Against bill</th><th>Mode</th><th>Reference</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{pays.map(x => <tr key={x._id}><td>{dt(x.date)}</td><td>{x.bill ? `Stage ${x.bill.stage} · ${x.bill.number}` : 'Advance'}</td><td>{x.mode}</td><td>{x.reference}</td>
            <td className="num pos">{inr(x.amount)}</td><td><button className="icon danger" onClick={() => del('/payments/' + x._id, 'Delete payment?')}><Trash2 size={15} /></button></td></tr>)}
            {!pays.length && <tr><td colSpan={6} className="empty">No payments yet</td></tr>}</tbody></table></div>
      </div>
      {open && <FormModal title="Add payment received" onClose={() => setOpen(false)} value={{ date: new Date().toISOString(), mode: 'Bank' }}
        fields={[
          { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'bill', label: 'Against stage bill', options: bills.map(b => ({ value: b._id, label: `Stage ${b.stage} · ${b.number} · to receive ${inr(b.netReceivable ?? b.grandTotal)}` })) },
          { k: 'mode', label: 'Mode', options: ['Cash', 'Bank', 'UPI', 'Cheque'] },
          { k: 'reference', label: 'Reference / Cheque no.', full: true },
        ]}
        onSave={async v => { await api('/payments', { method: 'POST', body: { ...v, project: id, bill: v.bill || undefined } }); reloadAll(); }} />}
    </div>
  );
}

/* ---------------- Plants & stock ---------------- */
function Stock({ id, ledger, usage, daywise, reloadAll, del, go }) {
  const [open, setOpen] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const inHand = ledger.filter(l => l.inHand > 0);
  const stockOf = v => ledger.find(l => l.item._id === v.item);
  return (
    <div className="grid fade">
      <div className="card">
        <div className="head" style={{ marginBottom: 6 }}><div><h2 style={{ margin: 0 }}>Plants & material at this site</h2>
          <small>Received from supplier → used on site → <b>at site</b>. Billing to the customer is shown alongside.</small></div>
          <div className="row">
            <button onClick={() => go('purchases')}><Truck size={15} /> Record supplier delivery</button>
            <button className="primary" onClick={() => setOpen(true)} disabled={!inHand.length}><Plus size={15} /> Log today's usage</button>
          </div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Item</th><th className="num">Work order</th><th className="num">Received from supplier</th><th className="num">Used</th><th className="num">At site</th><th className="num">Billed to customer</th><th style={{ width: 120 }}>Used</th></tr></thead>
          <tbody>{ledger.map(l => {
            const base = l.source === 'supplier' ? l.received : l.billed;
            return (
              <tr key={l.item._id}>
                <td style={{ minWidth: 200 }}><b>{l.item.name}</b><small>{l.item.unit}</small></td>
                <td className="num">{l.quoted || '—'}</td>
                <td className="num">{l.source === 'supplier' ? <><b>{l.received}</b><small>{l.suppliers.map(s => s.name + ' ' + s.qty).join(' · ')}</small></> : <small style={{ whiteSpace: 'normal' }}>not from a supplier — counted from bills</small>}</td>
                <td className="num">{l.used}</td>
                <td className={'num ' + (l.inHand < 0 ? 'neg' : 'pos')}><b>{l.inHand}</b></td>
                <td className="num">{l.billed}{l.extra ? <small className="tag-extra">+{l.extra} extra</small> : null}
                  {l.source === 'supplier' && l.billed > l.received ? <small className="neg">{l.billed - l.received} billed but not yet received</small> : null}</td>
                <td><Bar pct={base ? l.used / base * 100 : 0} warn={l.inHand < 0} /></td>
              </tr>
            );
          })}
            {!ledger.length && <tr><td colSpan={7} className="empty">No plants yet — they appear once you record a supplier delivery, a work order or a bill.</td></tr>}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Daily usage</h2>
          <button onClick={() => setShowLog(s => !s)}>{showLog ? 'Show usage entries' : 'Show date-wise stock movement'}</button></div>
        {!showLog ? (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Item</th><th className="num">Qty used</th><th>Note</th><th /></tr></thead>
            <tbody>{usage.map(u => <tr key={u._id}><td>{dt(u.date)}</td><td>{u.item?.name}</td><td className="num">{u.qty} {u.item?.unit}</td><td>{u.note}</td>
              <td><button className="icon danger" onClick={() => del('/usage/' + u._id, 'Delete entry?')}><Trash2 size={15} /></button></td></tr>)}
              {!usage.length && <tr><td colSpan={5} className="empty">No usage logged</td></tr>}</tbody></table></div>
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th className="num">Qty</th><th className="num">Remaining</th></tr></thead>
            <tbody>{daywise.map((e, i) => <tr key={i}><td>{dt(e.date)}</td><td>{e.name}</td><td>{e.type === 'used' ? <span className="badge">Used {e.ref && '· ' + e.ref}</span> : <span className="badge b-active">{e.type === 'received' ? 'Received · ' : 'Billed · '}{e.ref}</span>}</td>
              <td className={'num ' + (e.type === 'used' ? 'neg' : 'pos')}>{e.type === 'used' ? '−' : '+'}{e.qty}</td><td className="num"><b>{e.remaining}</b> {e.unit}</td></tr>)}</tbody></table></div>
        )}
      </div>
      {open && <FormModal title="Log daily usage" onClose={() => setOpen(false)} value={{ date: new Date().toISOString() }}
        fields={[
          { k: 'item', label: 'Plant / material', options: inHand.map(l => ({ value: l.item._id, label: `${l.item.name} — ${l.inHand} ${l.item.unit} at site` })), required: true, full: true },
          { k: 'qty', label: 'Quantity used', type: 'number', required: true, max: v => stockOf(v)?.inHand ?? 0,
            hint: v => stockOf(v) ? `Max ${stockOf(v).inHand} ${stockOf(v).item.unit} at site${stockOf(v).source === 'supplier' ? ' (received from suppliers − used)' : ''}` : 'Pick an item first' },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'note', label: 'Note (area, stage…)', full: true },
        ]}
        onSave={async v => {
          if (!(v.qty > 0)) throw new Error('Enter a quantity more than 0');
          await api('/usage', { method: 'POST', body: { ...v, project: id } }); reloadAll();
        }} />}
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <>
      <div className="head"><div><div className="skel" style={{ width: 260, height: 28 }} /><div className="skel" style={{ width: 180, height: 14, marginTop: 8 }} /></div></div>
      <div className="skel" style={{ height: 64, marginBottom: 18, borderRadius: 16 }} />
      <div className="proj">
        <div className="skel" style={{ height: 420, borderRadius: 16 }} />
        <div className="grid">{[160, 90, 220].map((h, i) => <div key={i} className="skel" style={{ height: h, borderRadius: 16 }} />)}</div>
      </div>
    </>
  );
}
