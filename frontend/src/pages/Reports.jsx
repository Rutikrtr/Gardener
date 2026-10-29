import { useState } from 'react';
import { FileSpreadsheet, Download, Calendar, Info } from 'lucide-react';
import { toast } from './ui';
import { isoDate } from '../api';
import { exportForCA } from '../excel';

const REPORTS = [
  ['gst', 'GST Sales Register', 'Bill-wise and rate-wise taxable value, CGST, SGST, IGST — for GSTR-1'],
  ['bills', 'All Bills', 'Every stage bill with GST, TDS, amount received, due, and TDS / GST paper status'],
  ['tds', 'TDS Register', 'TDS deducted by customers on each bill, with certificate received or pending'],
  ['receipts', 'Receipts', 'All payments received from customers'],
  ['purchases', 'Purchase Register', 'What was bought from each supplier, with supplier GSTIN and bill no.'],
  ['supplierPay', 'Supplier Payments', 'Money paid to (or refunded by) suppliers'],
  ['supplierBal', 'Supplier Balances', 'How much is still to pay each supplier, per project'],
  ['labour', 'Labour & PF', 'Wages, employer PF and ESI per worker and project'],
  ['expenses', 'Other Expenses', 'Transport, JCB, water and other site costs'],
];

// Indian financial year starts 1 April
function presets() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const fyStart = m >= 3 ? y : y - 1;
  const q = Math.floor(((m + 9) % 12) / 3); // 0 = Apr–Jun
  const qStart = new Date(fyStart, 3 + q * 3, 1), qEnd = new Date(fyStart, 6 + q * 3, 0);
  return [
    ['This month', isoDate(new Date(y, m, 1)), isoDate(new Date(y, m + 1, 0))],
    ['Last month', isoDate(new Date(y, m - 1, 1)), isoDate(new Date(y, m, 0))],
    ['This quarter', isoDate(qStart), isoDate(qEnd)],
    [`FY ${fyStart}-${String(fyStart + 1).slice(2)}`, `${fyStart}-04-01`, `${fyStart + 1}-03-31`],
    [`FY ${fyStart - 1}-${String(fyStart).slice(2)}`, `${fyStart - 1}-04-01`, `${fyStart}-03-31`],
    ['All dates', '', ''],
  ];
}

export default function Reports() {
  const P = presets();
  const [from, setFrom] = useState(P[0][1]);
  const [to, setTo] = useState(P[0][2]);
  const [busy, setBusy] = useState(null);
  const run = async which => {
    setBusy(which?.[0] || 'all');
    try { await exportForCA({ from, to, which }); toast('Excel downloaded'); } catch (e) { toast(e.message, 'err'); }
    setBusy(null);
  };
  return (
    <>
      <div className="head"><div><h1>Reports</h1><small>Excel reports for your CA, accountant or customer</small></div>
        <button className="primary" disabled={!!busy} onClick={() => run()}><FileSpreadsheet size={16} /> {busy === 'all' ? 'Preparing…' : 'Download all (one Excel file)'}</button></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
          <label style={{ width: 170 }}>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ width: 170 }}>To<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <div className="row" style={{ gap: 6 }}>
            {P.map(([l, f, t]) => (
              <button key={l} className={from === f && to === t ? 'dark-btn small' : 'small'} onClick={() => { setFrom(f); setTo(t); }}><Calendar size={13} /> {l}</button>
            ))}
          </div>
        </div>
        <small style={{ marginTop: 12 }}>Reports use the bill, payment, purchase and labour dates. The financial year runs 1 April – 31 March.</small>
      </div>

      <div className="report-grid">
        {REPORTS.map(([k, name, desc]) => (
          <div key={k} className="card report">
            <span className="ico"><FileSpreadsheet size={18} /></span>
            <div className="grow"><b>{name}</b><small>{desc}</small></div>
            <button disabled={!!busy} onClick={() => run([k])}><Download size={15} /> {busy === k ? 'Preparing…' : 'Excel'}</button>
          </div>
        ))}
      </div>

      <div className="notice" style={{ marginTop: 16 }}><Info size={16} /> For one site's full story (quotations, work order, bills, stock, suppliers, labour, profit), open the project and click <b>Excel report</b>.</div>
    </>
  );
}
