// Excel reports for the client and their CA. ExcelJS is loaded only when a report is downloaded.
import { api, lineGst } from './api';

const GREEN = 'FF2F5C2A', SOFT = 'FFEAF6E3', DARK = 'FF0F1A12';
const FMT = { money: '₹ #,##0.00;[Red]-₹ #,##0.00', date: 'dd-mmm-yyyy', pct: '0.##"%"', num: '#,##0.###' };

const d = v => (v ? new Date(v) : null);
const inRange = (v, from, to) => { const t = new Date(v); return (!from || t >= new Date(from)) && (!to || t <= new Date(to + 'T23:59:59')); };

// sheets: [{ name, title?, columns: [{ header, key, width?, type? }], rows, totals?: [keys] }]
export async function downloadWorkbook(filename, heading, sheets) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smart Garden';
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });
    const n = s.columns.length;
    // Title rows
    ws.mergeCells(1, 1, 1, n);
    Object.assign(ws.getCell(1, 1), { value: heading });
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: GREEN } };
    ws.mergeCells(2, 1, 2, n);
    ws.getCell(2, 1).value = s.title || s.name;
    ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF4B5A4F' } };
    // Header
    const head = ws.getRow(3);
    s.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      ws.getColumn(i + 1).width = c.width || Math.max(12, c.header.length + 4);
      if (c.type) ws.getColumn(i + 1).numFmt = FMT[c.type];
    });
    head.height = 22;
    // Data
    s.rows.forEach((r, ri) => {
      const row = ws.addRow(s.columns.map(c => r[c.key] ?? null));
      if (r._section) { row.font = { bold: true, color: { argb: GREEN } }; row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; }); }
      else if (ri % 2) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFCF9' } }; });
    });
    // Totals
    if (s.totals?.length && s.rows.length) {
      const first = 4, last = 3 + s.rows.length;
      const row = ws.addRow(s.columns.map((c, i) => (i === 0 ? 'TOTAL' : s.totals.includes(c.key) ? { formula: `SUM(${col(i + 1)}${first}:${col(i + 1)}${last})` } : null)));
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.eachCell({ includeEmpty: true }, c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }; });
    }
    if (s.rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + s.rows.length, column: n } };
    if (!s.rows.length) ws.addRow(['No records for this period']);
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const col = i => { let s = ''; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };

/* ---------- row builders shared by project and CA reports ---------- */

// GST sales register: one row per bill per GST rate (what a CA needs for GSTR-1)
export function gstRows(bills) {
  const rows = [];
  bills.forEach(b => {
    const byRate = {};
    b.lines.forEach(l => {
      const pct = b.gstEnabled ? +lineGst(l, b) : 0;
      byRate[pct] ??= 0;
      byRate[pct] += (+l.qty || 0) * (+l.rate || 0);
    });
    Object.entries(byRate).sort((a, z) => a[0] - z[0]).forEach(([pct, taxable]) => {
      const tax = taxable * pct / 100, igst = b.gstType === 'igst';
      rows.push({
        date: d(b.date), number: b.number, customer: b.project?.client?.company || b.project?.client?.name, gstin: b.project?.client?.gstin,
        project: b.project?.name, rate: +pct, taxable, cgst: igst ? 0 : tax / 2, sgst: igst ? 0 : tax / 2, igst: igst ? tax : 0, total: taxable + tax,
      });
    });
  });
  return rows;
}
export const GST_COLS = [
  { header: 'Invoice date', key: 'date', type: 'date', width: 13 }, { header: 'Invoice no.', key: 'number', width: 17 },
  { header: 'Customer', key: 'customer', width: 26 }, { header: 'Customer GSTIN', key: 'gstin', width: 18 }, { header: 'Project', key: 'project', width: 24 },
  { header: 'GST rate', key: 'rate', type: 'pct', width: 9 }, { header: 'Taxable value', key: 'taxable', type: 'money', width: 15 },
  { header: 'CGST', key: 'cgst', type: 'money' }, { header: 'SGST', key: 'sgst', type: 'money' }, { header: 'IGST', key: 'igst', type: 'money' },
  { header: 'Total', key: 'total', type: 'money', width: 15 },
];

export function billRows(bills, pays) {
  return bills.map(b => {
    const paid = pays.filter(p => (p.bill?._id || p.bill) === b._id).reduce((s, p) => s + p.amount, 0);
    const net = b.netReceivable ?? b.grandTotal;
    const extra = b.lines.filter(l => l.extra).reduce((s, l) => s + l.amount, 0);
    return {
      date: d(b.date), number: b.number, stage: b.stage, project: b.project?.name, customer: b.project?.client?.company || b.project?.client?.name, title: b.title,
      taxable: b.subTotal, gst: b.gstAmount, total: b.grandTotal, extra, tdsPct: b.tdsPercent || 0, tds: b.tdsAmount || 0, net, paid, due: net - paid,
      tdsCert: b.tdsAmount ? (b.tdsCertReceived ? 'Received' : 'Pending') : 'No TDS', tdsCertDate: d(b.tdsCertDate),
      gstReport: b.gstReportReceived ? 'Received' : 'Pending', gstReportDate: d(b.gstReportDate),
    };
  });
}
export const BILL_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Bill no.', key: 'number', width: 16 }, { header: 'Stage', key: 'stage', width: 7 },
  { header: 'Project', key: 'project', width: 22 }, { header: 'Customer', key: 'customer', width: 20 }, { header: 'Title', key: 'title', width: 24 },
  { header: 'Taxable', key: 'taxable', type: 'money', width: 14 }, { header: 'GST', key: 'gst', type: 'money' }, { header: 'Bill total', key: 'total', type: 'money', width: 14 },
  { header: 'of which extra work', key: 'extra', type: 'money', width: 14 }, { header: 'TDS %', key: 'tdsPct', type: 'pct', width: 8 }, { header: 'TDS', key: 'tds', type: 'money' },
  { header: 'To receive', key: 'net', type: 'money', width: 14 }, { header: 'Received', key: 'paid', type: 'money', width: 14 }, { header: 'Due', key: 'due', type: 'money', width: 14 },
  { header: 'TDS certificate', key: 'tdsCert', width: 14 }, { header: 'TDS cert date', key: 'tdsCertDate', type: 'date', width: 13 },
  { header: 'GST report', key: 'gstReport', width: 12 }, { header: 'GST report date', key: 'gstReportDate', type: 'date', width: 14 },
];
export const TDS_COLS = BILL_COLS.filter(c => ['date', 'number', 'project', 'customer', 'taxable', 'tdsPct', 'tds', 'tdsCert', 'tdsCertDate'].includes(c.key));

export const paymentRows = pays => pays.map(p => ({ date: d(p.date), project: p.project?.name, bill: p.bill ? `Stage ${p.bill.stage} · ${p.bill.number}` : 'Advance', mode: p.mode, reference: p.reference, amount: p.amount }));
export const PAYMENT_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Project', key: 'project', width: 24 }, { header: 'Against bill', key: 'bill', width: 26 },
  { header: 'Mode', key: 'mode', width: 10 }, { header: 'Reference', key: 'reference', width: 20 }, { header: 'Amount', key: 'amount', type: 'money', width: 14 },
];

export const purchaseRows = buys => buys.map(b => ({ date: d(b.date), supplier: b.supplier?.name, gstin: b.supplier?.gstin, billNo: b.billNo, project: b.project?.name, item: b.description || b.item?.name, qty: b.qty, unit: b.unit, rate: b.rate, amount: b.amount, used: b.usedQty ?? null, left: b.leftQty ?? null }));
export const PURCHASE_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Supplier', key: 'supplier', width: 22 }, { header: 'Supplier GSTIN', key: 'gstin', width: 18 },
  { header: "Supplier's bill no.", key: 'billNo', width: 16 }, { header: 'Project', key: 'project', width: 22 }, { header: 'Item', key: 'item', width: 26 },
  { header: 'Qty', key: 'qty', type: 'num', width: 8 }, { header: 'Unit', key: 'unit', width: 8 }, { header: 'Rate', key: 'rate', type: 'money', width: 12 }, { header: 'Amount', key: 'amount', type: 'money', width: 14 },
  { header: 'Used on site', key: 'used', type: 'num', width: 12 }, { header: 'Still at site', key: 'left', type: 'num', width: 12 },
];
export const supplierPayRows = ps => ps.map(p => ({ date: d(p.date), supplier: p.supplier?.name, project: p.project?.name, type: p.amount < 0 ? 'Refund from supplier' : 'Paid to supplier', mode: p.mode, reference: p.reference, amount: p.amount }));
export const SUPPLIER_PAY_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Supplier', key: 'supplier', width: 22 }, { header: 'Project', key: 'project', width: 22 },
  { header: 'Type', key: 'type', width: 20 }, { header: 'Mode', key: 'mode', width: 10 }, { header: 'Reference', key: 'reference', width: 18 }, { header: 'Amount', key: 'amount', type: 'money', width: 14 },
];
// Supplier balance per supplier (and project when given)
export function supplierBalanceRows(buys, ps) {
  const m = {};
  const k = (s, p) => (m[s?._id + '|' + (p?._id || '')] ??= { supplier: s?.name, gstin: s?.gstin, project: p?.name, bought: 0, paid: 0 });
  buys.forEach(b => { k(b.supplier, b.project).bought += b.amount || 0; });
  ps.forEach(p => { k(p.supplier, p.project).paid += p.amount || 0; });
  return Object.values(m).map(r => ({ ...r, balance: r.bought - r.paid, status: r.bought - r.paid > 0 ? 'We have to pay' : r.bought - r.paid < 0 ? 'Supplier owes us' : 'Settled' }));
}
export const SUPPLIER_BAL_COLS = [
  { header: 'Supplier', key: 'supplier', width: 22 }, { header: 'GSTIN', key: 'gstin', width: 18 }, { header: 'Project', key: 'project', width: 24 },
  { header: 'Bought', key: 'bought', type: 'money', width: 14 }, { header: 'Paid', key: 'paid', type: 'money', width: 14 }, { header: 'Balance', key: 'balance', type: 'money', width: 14 }, { header: 'Status', key: 'status', width: 16 },
];

export const labourRows = rows => rows.map(r => ({ date: d(r.date), worker: r.worker?.name, role: r.worker?.role, project: r.project?.name, days: r.days, rate: r.rate, wages: r.wages, pf: r.pf, esi: r.esi, total: r.totalCost, paid: r.paid ? 'Paid' : 'Unpaid', paidDate: d(r.paidDate), note: r.note }));
export const LABOUR_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Worker', key: 'worker', width: 20 }, { header: 'Work', key: 'role', width: 16 }, { header: 'Project', key: 'project', width: 22 },
  { header: 'Days', key: 'days', type: 'num', width: 7 }, { header: 'Rate/day', key: 'rate', type: 'money', width: 11 }, { header: 'Wages', key: 'wages', type: 'money', width: 13 },
  { header: 'PF (employer)', key: 'pf', type: 'money', width: 13 }, { header: 'ESI (employer)', key: 'esi', type: 'money', width: 13 }, { header: 'Total cost', key: 'total', type: 'money', width: 13 },
  { header: 'Paid?', key: 'paid', width: 8 }, { header: 'Paid on', key: 'paidDate', type: 'date', width: 13 }, { header: 'Note', key: 'note', width: 24 },
];

export const expenseRows = xs => xs.map(x => ({ date: d(x.date), project: x.project?.name, category: x.category, paidTo: x.paidTo, note: x.note, amount: x.amount }));
export const EXPENSE_COLS = [
  { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Project', key: 'project', width: 22 }, { header: 'Type', key: 'category', width: 16 },
  { header: 'Paid to', key: 'paidTo', width: 18 }, { header: 'Note', key: 'note', width: 28 }, { header: 'Amount', key: 'amount', type: 'money', width: 14 },
];

export function plRows(sum) {
  return [
    { line: 'Revenue (billed, without GST)', amount: sum.revenue },
    { line: 'Plants & material' + (sum.materialEstimated ? ' (estimated from price list)' : ' (supplier purchases)'), amount: -sum.materialCost },
    { line: 'Labour wages', amount: -sum.labourWages },
    { line: 'PF + ESI (employer)', amount: -sum.labourPfEsi },
    { line: 'Other expenses', amount: -sum.expenses },
    { line: sum.profit < 0 ? 'LOSS' : 'PROFIT', amount: sum.profit, _section: true },
    { line: `Margin: ${sum.margin}%` },
    { line: '' },
    { line: 'Still to settle', _section: true },
    { line: 'Customer has to pay us (after TDS)', amount: sum.outstanding },
    { line: sum.supplierDue >= 0 ? 'We have to pay suppliers' : 'Suppliers owe us', amount: Math.abs(sum.supplierDue) },
    { line: 'Unpaid labour', amount: sum.labourUnpaid },
    { line: '' },
    { line: 'Tax', _section: true },
    { line: 'GST collected on bills', amount: sum.billed - sum.revenue },
    { line: 'TDS deducted by customer', amount: sum.tds },
  ];
}
export const PL_COLS = [{ header: 'Particulars', key: 'line', width: 48 }, { header: 'Amount', key: 'amount', type: 'money', width: 18 }];

const fileSafe = s => (s || 'report').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

/* ---------- Full project workbook: the whole process of one site ---------- */
export async function exportProject(pid) {
  const [p, sum, quotes, bills, pays, ledger, buys, sp, labour, exps, usage, s] = await Promise.all([
    api('/projects/' + pid), api(`/projects/${pid}/summary`), api('/quotations?project=' + pid), api('/bills?project=' + pid), api('/payments?project=' + pid),
    api(`/projects/${pid}/ledger`), api(`/projects/${pid}/purchases`), api('/supplier-payments?project=' + pid), api('/labour?project=' + pid),
    api('/expenses?project=' + pid), api('/usage?project=' + pid), api('/auth/settings'),
  ]);
  pays.forEach(x => { x.project = p; });
  exps.forEach(x => { x.project = p; });
  const wo = quotes.find(q => q.status === 'approved');
  const woRows = [];
  if (wo) {
    let sec = null;
    wo.lines.forEach(l => {
      if (l.section && l.section !== sec) { sec = l.section; woRows.push({ description: l.section, _section: true }); }
      woRows.push({ description: l.description, qty: l.qty, unit: l.unit, rate: l.rate, gst: lineGst(l, wo), amount: l.amount, remark: l.remark });
    });
  }
  const info = [
    { k: 'Project', v: p.name }, { k: 'Customer', v: [p.client?.name, p.client?.company].filter(Boolean).join(' — ') }, { k: 'Customer GSTIN', v: p.client?.gstin },
    { k: 'Site', v: p.site }, { k: 'Status', v: p.status }, { k: 'Work order', v: wo ? `${wo.number}${wo.poNumber ? ' · PO ' + wo.poNumber : ''}` : 'Not finalised' },
    { k: 'Work order value', v: sum.quoted }, { k: 'Billed', v: sum.billed }, { k: 'Received', v: sum.received }, { k: 'Due from customer', v: sum.outstanding },
  ];
  await downloadWorkbook(`${fileSafe(p.name)}-full-report.xlsx`, `${s.companyName || 'Smart Garden'} — ${p.name}`, [
    { name: 'Summary', title: 'Project details & profit and loss', columns: [{ header: 'Detail', key: 'k', width: 26 }, { header: 'Value', key: 'v', width: 40 }], rows: info },
    { name: 'Profit & Loss', title: 'Internal — profit and loss', columns: PL_COLS, rows: plRows(sum) },
    { name: 'Quotations', title: 'All quotation versions', columns: [
      { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Number', key: 'number', width: 20 }, { header: 'Revision', key: 'rev', width: 9 },
      { header: 'Status', key: 'status', width: 14 }, { header: 'Taxable', key: 'sub', type: 'money', width: 14 }, { header: 'GST', key: 'gst', type: 'money' },
      { header: 'Total', key: 'total', type: 'money', width: 14 }, { header: 'Customer PO', key: 'po', width: 16 }],
      rows: quotes.map(q => ({ date: d(q.date), number: q.number, rev: q.revision ? 'R' + q.revision : 'R0', status: q.status === 'approved' ? 'WORK ORDER' : q.status, sub: q.subTotal, gst: q.gstAmount, total: q.grandTotal, po: q.poNumber })) },
    { name: 'Work Order', title: wo ? `Work order ${wo.number}` : 'No work order yet', columns: [
      { header: 'Description', key: 'description', width: 40 }, { header: 'Qty', key: 'qty', type: 'num', width: 9 }, { header: 'Unit', key: 'unit', width: 8 },
      { header: 'Rate', key: 'rate', type: 'money', width: 12 }, { header: 'GST %', key: 'gst', type: 'pct', width: 8 }, { header: 'Amount', key: 'amount', type: 'money', width: 14 }, { header: 'Remark', key: 'remark', width: 20 }],
      rows: woRows, totals: ['amount'] },
    { name: 'Bills', title: 'Stage bills with TDS & GST papers', columns: BILL_COLS, rows: billRows(bills, pays), totals: ['taxable', 'gst', 'total', 'extra', 'tds', 'net', 'paid', 'due'] },
    { name: 'GST Register', title: 'Bill-wise, rate-wise GST', columns: GST_COLS, rows: gstRows(bills), totals: ['taxable', 'cgst', 'sgst', 'igst', 'total'] },
    { name: 'Payments', title: 'Payments received from customer', columns: PAYMENT_COLS, rows: paymentRows(pays), totals: ['amount'] },
    { name: 'Plant Stock', title: 'Received from supplier → used → at site (items not bought from a supplier are counted from bills)', columns: [
      { header: 'Item', key: 'item', width: 32 }, { header: 'Unit', key: 'unit', width: 8 }, { header: 'Work order', key: 'quoted', type: 'num' }, { header: 'Received from supplier', key: 'received', type: 'num', width: 14 }, { header: 'Billed', key: 'billed', type: 'num' },
      { header: 'of which extra', key: 'extra', type: 'num' }, { header: 'Used', key: 'used', type: 'num' }, { header: 'At site', key: 'inHand', type: 'num' }, { header: 'Left to bill', key: 'left', type: 'num' }],
      rows: ledger.map(l => ({ item: l.item.name, unit: l.item.unit, quoted: l.quoted, received: l.source === 'supplier' ? l.received : null, billed: l.billed, extra: l.extra, used: l.used, inHand: l.inHand, left: l.pendingToBill })) },
    { name: 'Daily Usage', title: 'Plants & material used on site', columns: [
      { header: 'Date', key: 'date', type: 'date', width: 13 }, { header: 'Item', key: 'item', width: 30 }, { header: 'Qty', key: 'qty', type: 'num' }, { header: 'Unit', key: 'unit' }, { header: 'Note', key: 'note', width: 28 }],
      rows: usage.map(u => ({ date: d(u.date), item: u.item?.name, qty: u.qty, unit: u.item?.unit, note: u.note })) },
    { name: 'Purchases', title: 'Bought from suppliers', columns: PURCHASE_COLS, rows: purchaseRows(buys), totals: ['amount'] },
    { name: 'Supplier Payments', title: 'Paid to / refunded by suppliers', columns: SUPPLIER_PAY_COLS, rows: supplierPayRows(sp), totals: ['amount'] },
    { name: 'Supplier Balance', title: 'What we owe each supplier for this project', columns: SUPPLIER_BAL_COLS, rows: supplierBalanceRows(buys, sp), totals: ['bought', 'paid', 'balance'] },
    { name: 'Labour', title: 'Labour work, PF / ESI', columns: LABOUR_COLS, rows: labourRows(labour), totals: ['days', 'wages', 'pf', 'esi', 'total'] },
    { name: 'Other Expenses', title: 'Transport, JCB, water…', columns: EXPENSE_COLS, rows: expenseRows(exps), totals: ['amount'] },
  ]);
}

/* ---------- CA reports for a date range, across all projects ---------- */
export async function exportForCA({ from, to, which }) {
  const [bills, pays, buys, sp, labour, exps, s] = await Promise.all([
    api('/bills'), api('/payments'), api('/purchase-usage'), api('/supplier-payments'), api('/labour'), api('/expenses'), api('/auth/settings'),
  ]);
  const projects = Object.fromEntries((await api('/projects')).map(p => [p._id, p]));
  const withProject = xs => xs.map(x => ({ ...x, project: typeof x.project === 'object' ? x.project : projects[x.project] }));
  const f = xs => xs.filter(x => inRange(x.date, from, to));
  const B = f(bills), P = withProject(f(pays)), BU = f(buys), SP = f(sp), L = f(labour), E = withProject(f(exps));
  const period = from || to ? `${from || 'start'} to ${to || 'today'}` : 'all dates';
  const all = {
    gst: { name: 'GST Sales Register', title: `For GSTR-1 · ${period}`, columns: GST_COLS, rows: gstRows(B), totals: ['taxable', 'cgst', 'sgst', 'igst', 'total'] },
    bills: { name: 'Bills', title: `All bills · ${period}`, columns: BILL_COLS, rows: billRows(B, pays), totals: ['taxable', 'gst', 'total', 'extra', 'tds', 'net', 'paid', 'due'] },
    tds: { name: 'TDS Register', title: `TDS deducted by customers · ${period}`, columns: TDS_COLS, rows: billRows(B, pays).filter(r => r.tds > 0), totals: ['taxable', 'tds'] },
    receipts: { name: 'Receipts', title: `Payments received · ${period}`, columns: PAYMENT_COLS, rows: paymentRows(P), totals: ['amount'] },
    purchases: { name: 'Purchase Register', title: `Purchases from suppliers · ${period}`, columns: PURCHASE_COLS, rows: purchaseRows(BU), totals: ['amount'] },
    supplierPay: { name: 'Supplier Payments', title: `Paid to suppliers · ${period}`, columns: SUPPLIER_PAY_COLS, rows: supplierPayRows(SP), totals: ['amount'] },
    supplierBal: { name: 'Supplier Balances', title: 'Balance per supplier & project (all dates)', columns: SUPPLIER_BAL_COLS, rows: supplierBalanceRows(buys, sp), totals: ['bought', 'paid', 'balance'] },
    labour: { name: 'Labour & PF', title: `Wages, PF, ESI · ${period}`, columns: LABOUR_COLS, rows: labourRows(L), totals: ['days', 'wages', 'pf', 'esi', 'total'] },
    expenses: { name: 'Expenses', title: `Other expenses · ${period}`, columns: EXPENSE_COLS, rows: expenseRows(E), totals: ['amount'] },
  };
  const keys = which?.length ? which : Object.keys(all);
  const label = keys.length === 1 ? fileSafe(all[keys[0]].name) : 'CA-Reports';
  await downloadWorkbook(`${label}${from || to ? `-${from || 'start'}-to-${to || 'today'}` : ''}.xlsx`, `${s.companyName || 'Smart Garden'}${s.gstin ? ' · GSTIN ' + s.gstin : ''}`, keys.map(k => all[k]));
}
