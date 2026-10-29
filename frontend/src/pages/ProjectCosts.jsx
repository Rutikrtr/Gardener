import { useState } from 'react';
import { Plus, Pencil, Trash2, Lock, Info, Truck, HardHat, CheckCircle2 } from 'lucide-react';
import { useApi, FormModal, Bar, toast, Tick } from './ui';
import { api, inr, dt } from '../api';

export const EXPENSE_TYPES = ['Transport', 'Machinery / JCB', 'Water / tanker', 'Tools & equipment', 'Food & stay', 'Site rent', 'Other'];
const MODES = ['Cash', 'Bank', 'UPI', 'Cheque'];
const internal = <div className="notice"><Lock size={16} /> Internal only — never shown on quotations or bills.</div>;

/* ---------------- Suppliers & purchases ---------------- */
export function Purchases({ id, reloadAll, del, costsVersion }) {
  const v = `&v=${costsVersion}`;
  const [suppliers, reloadS] = useApi('/suppliers?' + v, []);
  const [items] = useApi('/items', []);
  const [buys] = useApi(`/projects/${id}/purchases?` + v, []);
  const [paid] = useApi('/supplier-payments?project=' + id + v, []);
  const [modal, setModal] = useState(null);

  // Balance per supplier for this project: bought − paid (positive = we have to pay, negative = they owe us)
  const bal = {};
  const row = s => (bal[s._id] ??= { s, bought: 0, paid: 0 });
  buys.forEach(b => b.supplier && (row(b.supplier).bought += b.amount || 0));
  paid.forEach(p => p.supplier && (row(p.supplier).paid += p.amount || 0));
  const rows = Object.values(bal);
  const totalDue = rows.reduce((s, r) => s + r.bought - r.paid, 0);
  const supplierOpts = suppliers.map(s => ({ value: s._id, label: s.name }));

  return (
    <div className="grid fade">
      {internal}
      <div className="grid g3">
        <div className="card kpi"><div className="label">Bought for this project</div><div className="val">{inr(rows.reduce((s, r) => s + r.bought, 0))}</div></div>
        <div className="card kpi"><div className="label">Paid to suppliers</div><div className="val">{inr(rows.reduce((s, r) => s + r.paid, 0))}</div></div>
        <div className="card kpi dark"><div className="label">{totalDue >= 0 ? 'We have to pay' : 'Suppliers owe us'}</div><div className="val">{inr(Math.abs(totalDue))}</div></div>
      </div>

      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Supplier balances</h2>
          <div className="row">
            <button onClick={() => setModal('supplier')}><Plus size={15} /> New supplier</button>
            <button onClick={() => setModal('pay')} disabled={!suppliers.length}>Pay supplier</button>
            <button className="primary" onClick={() => setModal('buy')} disabled={!suppliers.length}><Plus size={15} /> Add delivery</button>
          </div></div>
        {!suppliers.length && <div className="notice warn"><Info size={16} /> Add a supplier first (nursery, soil vendor…), then record what you bought for this site.</div>}
        <div className="sup-grid">
          {rows.map(r => {
            const due = r.bought - r.paid;
            return (
              <div key={r.s._id} className="sup">
                <div className="row"><span className="ico"><Truck size={15} /></span><b className="grow">{r.s.name}</b></div>
                <div className="sup-nums"><span>Bought <b>{inr(r.bought)}</b></span><span>Paid <b>{inr(r.paid)}</b></span></div>
                <div className={'sup-due ' + (due > 0 ? 'neg' : due < 0 ? 'pos' : '')}>{due > 0 ? `To pay ${inr(due)}` : due < 0 ? `They owe us ${inr(-due)}` : 'Settled ✓'}</div>
              </div>
            );
          })}
          {!rows.length && suppliers.length > 0 && <small>No purchases for this project yet.</small>}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Deliveries from suppliers</h2>
          <small style={{ marginTop: -6, marginBottom: 10 }}>Items received for this site. Usage on site is taken from the oldest delivery first.</small>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Item</th><th className="num">Qty × rate</th><th className="num">Amount</th><th className="num">Used / at site</th><th /></tr></thead>
            <tbody>{buys.map(b => <tr key={b._id}><td className="nowrap">{dt(b.date)}</td><td>{b.supplier?.name}<small>{b.billNo}</small></td><td>{b.description || b.item?.name}</td>
              <td className="num">{b.qty} {b.unit} × {inr(b.rate)}</td><td className="num"><b>{inr(b.amount)}</b></td>
              <td className="num">{b.usedQty === null ? <small>not linked to an item</small> : <><span>{b.usedQty} used</span><small className={b.leftQty ? 'pos' : ''}>{b.leftQty ? `${b.leftQty} still at site` : 'all used ✓'}</small></>}</td>
              <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setModal({ buy: b })}><Pencil size={15} /></button>
                <button className="icon danger" onClick={() => del('/purchases/' + b._id, 'Delete purchase?')}><Trash2 size={15} /></button></div></td></tr>)}
              {!buys.length && <tr><td colSpan={7} className="empty">No deliveries yet</td></tr>}</tbody></table></div>
        </div>
        <div className="card">
          <h2>Payments to suppliers</h2>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Mode</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>{paid.map(p => <tr key={p._id}><td className="nowrap">{dt(p.date)}</td><td>{p.supplier?.name}<small>{p.reference}</small></td><td>{p.mode}</td>
              <td className={'num ' + (p.amount < 0 ? 'pos' : '')}>{p.amount < 0 ? `Refund ${inr(-p.amount)}` : inr(p.amount)}</td>
              <td><button className="icon danger" onClick={() => del('/supplier-payments/' + p._id, 'Delete payment?')}><Trash2 size={15} /></button></td></tr>)}
              {!paid.length && <tr><td colSpan={5} className="empty">No payments yet</td></tr>}</tbody></table></div>
        </div>
      </div>

      {modal === 'supplier' && <FormModal title="New supplier" onClose={() => setModal(null)} value={{}} fields={SUPPLIER_FIELDS}
        onSave={async x => { await api('/suppliers', { method: 'POST', body: x }); reloadS(); }} />}
      {(modal === 'buy' || modal?.buy) && <FormModal title={modal.buy ? 'Edit delivery' : 'Add delivery from supplier'} onClose={() => setModal(null)}
        value={modal.buy ? { ...modal.buy, supplier: modal.buy.supplier?._id, item: modal.buy.item?._id } : { date: new Date().toISOString(), qty: 1 }}
        fields={[
          { k: 'supplier', label: 'Supplier', options: supplierOpts, required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'item', label: 'Item (pick it so site stock is counted)', options: items.map(i => ({ value: i._id, label: i.name })) },
          { k: 'description', label: 'Description (optional)' },
          { k: 'qty', label: 'Quantity', type: 'number', required: true },
          { k: 'unit', label: 'Unit', placeholder: "No's / CUM / KG" },
          { k: 'rate', label: 'Rate we pay (₹)', type: 'number', required: true },
          { k: 'billNo', label: "Supplier's bill no." },
          { k: 'note', label: 'Note', full: true },
        ]}
        onSave={async x => {
          const it = items.find(i => i._id === x.item);
          const body = { ...x, project: id, item: x.item || undefined, unit: x.unit || it?.unit, description: x.description || it?.name };
          await api(modal.buy ? '/purchases/' + modal.buy._id : '/purchases', { method: modal.buy ? 'PUT' : 'POST', body });
          reloadAll();
        }} />}
      {modal === 'pay' && <FormModal title="Payment to supplier" onClose={() => setModal(null)} value={{ date: new Date().toISOString(), mode: 'Bank', direction: 'pay' }}
        fields={[
          { k: 'supplier', label: 'Supplier', options: supplierOpts, required: true },
          { k: 'direction', label: 'Type', options: [{ value: 'pay', label: 'We paid the supplier' }, { value: 'refund', label: 'Supplier returned money to us' }] },
          { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'mode', label: 'Mode', options: MODES },
          { k: 'reference', label: 'Reference' },
        ]}
        onSave={async x => {
          if (!(x.amount > 0)) throw new Error('Enter an amount more than 0');
          const { direction, ...rest } = x;
          await api('/supplier-payments', { method: 'POST', body: { ...rest, project: id, amount: direction === 'refund' ? -x.amount : x.amount } });
          reloadAll();
        }} />}
    </div>
  );
}

export const SUPPLIER_FIELDS = [
  { k: 'name', label: 'Supplier name', required: true, full: true },
  { k: 'phone', label: 'Phone' },
  { k: 'gstin', label: 'GSTIN' },
  { k: 'address', label: 'Address', type: 'textarea', full: true },
];

/* ---------------- Labour ---------------- */
export function LabourSection({ id, reloadAll, del, costsVersion }) {
  const v = `&v=${costsVersion}`;
  const [workers, reloadW] = useApi('/workers?' + v, []);
  const [rows] = useApi('/labour?project=' + id + v, []);
  const [settings] = useApi('/auth/settings');
  const [modal, setModal] = useState(null);
  const pfPct = settings?.pfPercent ?? 12, esiPct = settings?.esiPercent ?? 3.25;
  const w = x => workers.find(k => k._id === x.worker);
  const calc = x => {
    const wk = w(x), rate = x.rate || wk?.dailyWage || 0, wages = (x.days || 0) * rate;
    return { rate, wages, pf: wk?.pfApplicable ? +(wages * pfPct / 100).toFixed(2) : 0, esi: wk?.esiApplicable ? +(wages * esiPct / 100).toFixed(2) : 0 };
  };
  const t = rows.reduce((s, r) => ({ wages: s.wages + r.wages, pfesi: s.pfesi + r.pf + r.esi, total: s.total + r.totalCost, unpaid: s.unpaid + (r.paid ? 0 : r.totalCost), days: s.days + r.days }), { wages: 0, pfesi: 0, total: 0, unpaid: 0, days: 0 });
  const togglePaid = async r => { await api('/labour/' + r._id, { method: 'PUT', body: { paid: !r.paid, paidDate: !r.paid ? new Date() : null } }); reloadAll(); };
  const payAll = async () => {
    const un = rows.filter(r => !r.paid);
    if (!un.length || !confirm(`Mark ${un.length} entries (${inr(t.unpaid)}) as paid?`)) return;
    for (const r of un) await api('/labour/' + r._id, { method: 'PUT', body: { paid: true, paidDate: new Date() } });
    reloadAll(); toast('All labour marked paid');
  };

  return (
    <div className="grid fade">
      {internal}
      <div className="grid g4">
        <div className="card kpi"><div className="label">Wages ({t.days} man-days)</div><div className="val">{inr(t.wages)}</div></div>
        <div className="card kpi"><div className="label">PF + ESI (employer)</div><div className="val">{inr(t.pfesi)}</div><small>PF {pfPct}% · ESI {esiPct}% · set in Settings</small></div>
        <div className="card kpi"><div className="label">Total labour cost</div><div className="val">{inr(t.total)}</div></div>
        <div className="card kpi dark"><div className="label">Still to pay</div><div className="val">{inr(t.unpaid)}</div></div>
      </div>
      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Labour work on this site</h2><small>Your labour team is kept in <b>Workers</b> (left menu). Record their days here.</small></div>
          <div className="row">
            <button onClick={() => setModal('worker')}><Plus size={15} /> New worker</button>
            {t.unpaid > 0 && <button onClick={payAll}><CheckCircle2 size={15} /> Mark all paid</button>}
            <button className="primary" onClick={() => setModal('entry')} disabled={!workers.length}><Plus size={15} /> Add work days</button>
          </div></div>
        {!workers.length && <div className="notice warn"><Info size={16} /> Add your workers first (name, daily wage, PF yes/no).</div>}
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Worker</th><th className="num">Days × rate</th><th className="num">Wages</th><th className="num">PF + ESI</th><th className="num">Total</th><th>Paid</th><th /></tr></thead>
          <tbody>{rows.map(r => <tr key={r._id}><td>{dt(r.date)}</td><td><b>{r.worker?.name}</b><small>{r.worker?.role}{r.note ? ' · ' + r.note : ''}</small></td>
            <td className="num">{r.days} × {inr(r.rate)}</td><td className="num">{inr(r.wages)}</td><td className="num">{r.pf + r.esi ? inr(r.pf + r.esi) : '—'}</td>
            <td className="num"><b>{inr(r.totalCost)}</b></td><td><Tick on={r.paid} date={r.paidDate} onClick={() => togglePaid(r)} /></td>
            <td><button className="icon danger" onClick={() => del('/labour/' + r._id, 'Delete entry?')}><Trash2 size={15} /></button></td></tr>)}
            {!rows.length && <tr><td colSpan={8} className="empty">No labour recorded yet</td></tr>}</tbody></table></div>
      </div>

      {modal === 'worker' && <FormModal title="New worker" onClose={() => setModal(null)} value={{ role: 'Mali / Gardener', pfApplicable: 'no', esiApplicable: 'no' }} fields={WORKER_FIELDS}
        onSave={async x => { await api('/workers', { method: 'POST', body: workerBody(x) }); reloadW(); }} />}
      {modal === 'entry' && <FormModal title="Add work days" onClose={() => setModal(null)} value={{ date: new Date().toISOString(), days: 1 }}
        fields={[
          { k: 'worker', label: 'Worker', options: workers.filter(k => k.active !== false).map(k => ({ value: k._id, label: `${k.name} — ${inr(k.dailyWage)}/day` })), required: true, full: true },
          { k: 'date', label: 'Date (or week ending)', type: 'date' },
          { k: 'days', label: 'Days worked', type: 'number', required: true },
          { k: 'rate', label: 'Rate per day (blank = usual wage)', type: 'number',
            hint: x => { const c = calc(x); return w(x) ? `Wages ${inr(c.wages)}${c.pf ? ` + PF ${inr(c.pf)}` : ''}${c.esi ? ` + ESI ${inr(c.esi)}` : ''}` : ''; } },
          { k: 'paid', label: 'Already paid?', options: [{ value: 'no', label: 'Not yet' }, { value: 'yes', label: 'Yes, paid' }] },
          { k: 'note', label: 'Note (work done)', full: true },
        ]}
        onSave={async x => {
          if (!(x.days > 0)) throw new Error('Enter days worked');
          const c = calc(x);
          await api('/labour', { method: 'POST', body: { ...x, ...c, project: id, paid: x.paid === 'yes', paidDate: x.paid === 'yes' ? new Date() : undefined } });
          reloadAll();
        }} />}
    </div>
  );
}

export const WORKER_FIELDS = [
  { k: 'name', label: 'Name', required: true },
  { k: 'phone', label: 'Phone' },
  { k: 'role', label: 'Work', options: ['Mali / Gardener', 'Helper', 'Supervisor', 'Driver', 'Plumber (irrigation)', 'Other'] },
  { k: 'dailyWage', label: 'Daily wage (₹)', type: 'number', required: true },
  { k: 'pfApplicable', label: 'PF applicable?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
  { k: 'esiApplicable', label: 'ESI applicable?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
];
export const workerBody = x => ({ ...x, pfApplicable: x.pfApplicable === 'yes' || x.pfApplicable === true, esiApplicable: x.esiApplicable === 'yes' || x.esiApplicable === true });

/* ---------------- Other expenses ---------------- */
export function Expenses({ id, reloadAll, del, costsVersion }) {
  const [rows] = useApi('/expenses?project=' + id + `&v=${costsVersion}`, []);
  const [modal, setModal] = useState(null);
  const total = rows.reduce((s, x) => s + x.amount, 0);
  return (
    <div className="grid fade">
      {internal}
      <div className="card">
        <div className="head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Other expenses</h2><small>Transport, JCB, water tanker, tools… Total <b>{inr(total)}</b></small></div>
          <button className="primary" onClick={() => setModal('new')}><Plus size={15} /> Add expense</button></div>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Paid to</th><th>Note</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{rows.map(x => <tr key={x._id}><td>{dt(x.date)}</td><td><span className="badge">{x.category}</span></td><td>{x.paidTo}</td><td>{x.note}</td>
            <td className="num neg">{inr(x.amount)}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setModal({ x })}><Pencil size={15} /></button>
              <button className="icon danger" onClick={() => del('/expenses/' + x._id, 'Delete expense?')}><Trash2 size={15} /></button></div></td></tr>)}
            {!rows.length && <tr><td colSpan={6} className="empty">No other expenses yet</td></tr>}</tbody></table></div>
      </div>
      {modal && <FormModal title={modal.x ? 'Edit expense' : 'Add expense'} onClose={() => setModal(null)}
        value={modal.x || { date: new Date().toISOString(), category: 'Transport' }}
        fields={[
          { k: 'category', label: 'Type', options: EXPENSE_TYPES, required: true },
          { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'paidTo', label: 'Paid to' },
          { k: 'note', label: 'Note', full: true },
        ]}
        onSave={async x => {
          if (!(x.amount > 0)) throw new Error('Enter an amount more than 0');
          await api(modal.x ? '/expenses/' + modal.x._id : '/expenses', { method: modal.x ? 'PUT' : 'POST', body: { ...x, project: id } });
          reloadAll();
        }} />}
    </div>
  );
}

/* ---------------- Profit & loss ---------------- */
export function ProfitLoss({ sum, go }) {
  if (!sum) return null;
  const costs = [
    ['Plants & material', sum.materialCost, 'purchases', sum.materialEstimated ? 'Estimated from Price List purchase cost — add real purchases for exact figures' : 'From supplier purchases'],
    ['Labour wages', sum.labourWages, 'labour'],
    ['PF + ESI', sum.labourPfEsi, 'labour'],
    ['Other expenses', sum.expenses, 'expenses'],
  ];
  const totalCost = costs.reduce((s, c) => s + (c[1] || 0), 0);
  return (
    <div className="grid fade">
      {internal}
      <div className="grid g2">
        <div className="card pnl">
          <h2>Profit & loss</h2>
          <div className="pl-row big"><span>Revenue <small>billed, without GST</small></span><b>{inr(sum.revenue)}</b></div>
          <div className="pl-sub">Less costs</div>
          {costs.map(([l, val, tab, note]) => (
            <div key={l} className="pl-row link" onClick={() => go(tab)}>
              <span>{l}{note && <small>{note}</small>}</span><b className="neg">− {inr(val)}</b>
            </div>
          ))}
          <div className="pl-row"><span><b>Total costs</b></span><b className="neg">− {inr(totalCost)}</b></div>
          <div className={'pl-row total ' + (sum.profit < 0 ? 'loss' : '')}><span>{sum.profit < 0 ? 'Loss' : 'Profit'}</span><b>{inr(Math.abs(sum.profit))} <small>{sum.margin}%</small></b></div>
          <div className="meter"><Bar pct={sum.revenue ? Math.max(0, sum.profit) / sum.revenue * 100 : 0} /></div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>Money still to settle</h2>
            <div className="pl-row link" onClick={() => go('payments')}><span>Customer has to pay us</span><b className="pos">{inr(sum.outstanding)}</b></div>
            <div className="pl-row link" onClick={() => go('purchases')}><span>{sum.supplierDue >= 0 ? 'We have to pay suppliers' : 'Suppliers owe us'}</span><b className={sum.supplierDue >= 0 ? 'neg' : 'pos'}>{inr(Math.abs(sum.supplierDue))}</b></div>
            <div className="pl-row link" onClick={() => go('labour')}><span>Unpaid labour</span><b className="neg">{inr(sum.labourUnpaid)}</b></div>
          </div>
          <div className="card">
            <h2>Tax</h2>
            <div className="pl-row"><span>TDS deducted by customer <small>claim it against your income tax with the TDS certificates</small></span><b>{inr(sum.tds)}</b></div>
            <div className="pl-row"><span>GST collected on bills <small>to be paid to government</small></span><b>{inr(sum.billed - sum.revenue)}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
