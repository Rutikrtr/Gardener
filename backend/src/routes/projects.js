import { Router } from 'express';
import mongoose from 'mongoose';
import { Quotation, Bill, Payment, Usage, Item } from '../models/index.js';

const r = Router();
const oid = s => new mongoose.Types.ObjectId(s);

async function nextNumber(Model, prefix) {
  const n = await Model.countDocuments();
  return `${prefix}-${new Date().getFullYear()}-${String(n + 1).padStart(4, '0')}`;
}

// Create quotation / bill with auto numbering (bill stage = next stage of the project)
r.post('/:pid/quotations', async (req, res) => {
  const number = req.body.number || await nextNumber(Quotation, 'QT');
  res.json(await new Quotation({ ...req.body, project: req.params.pid, number }).save());
});

r.post('/:pid/bills', async (req, res) => {
  const stage = (await Bill.countDocuments({ project: req.params.pid })) + 1;
  const number = req.body.number || await nextNumber(Bill, 'INV');
  res.json(await new Bill({ stage, ...req.body, project: req.params.pid, number }).save());
});

// Material ledger per item:
//   quoted  = qty in approved quotation(s)
//   billed  = qty supplied & billed across all stage bills
//   used    = qty planted/used on site (daily usage log)
//   inHand  = billed - used  (paid/billed but not yet used -> carries to next stage)
//   pendingToBill = quoted - billed
r.get('/:pid/ledger', async (req, res) => {
  const pid = oid(req.params.pid);
  const lineSum = M => M.aggregate([
    { $match: M === Quotation ? { project: pid, status: 'approved' } : { project: pid } },
    { $unwind: '$lines' },
    { $match: { 'lines.item': { $ne: null } } },
    { $group: { _id: '$lines.item', qty: { $sum: '$lines.qty' } } },
  ]);
  const [quoted, billed, used] = await Promise.all([
    lineSum(Quotation),
    lineSum(Bill),
    Usage.aggregate([{ $match: { project: pid } }, { $group: { _id: '$item', qty: { $sum: '$qty' } } }]),
  ]);
  const map = {};
  const add = (arr, k) => arr.forEach(x => {
    const key = String(x._id);
    map[key] ??= { quoted: 0, billed: 0, used: 0 };
    map[key][k] = x.qty;
  });
  add(quoted, 'quoted'); add(billed, 'billed'); add(used, 'used');
  const items = await Item.find({ _id: { $in: Object.keys(map) } });
  res.json(items
    .map(item => {
      const m = map[String(item._id)];
      return { item, ...m, inHand: m.billed - m.used, pendingToBill: Math.max(0, m.quoted - m.billed) };
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name)));
});

// Day-wise usage report: rows of date -> item -> qty, with running remaining stock
r.get('/:pid/daywise', async (req, res) => {
  const pid = oid(req.params.pid);
  const [bills, usage] = await Promise.all([
    Bill.find({ project: pid }).sort('date'),
    Usage.find({ project: pid }).populate('item').sort('date'),
  ]);
  const events = [];
  bills.forEach(b => b.lines.forEach(l => l.item && events.push({ date: b.date, item: String(l.item), qty: l.qty, type: 'billed', ref: `Stage ${b.stage} (${b.number})` })));
  usage.forEach(u => events.push({ date: u.date, item: String(u.item._id), name: u.item.name, unit: u.item.unit, qty: -u.qty, type: 'used', ref: u.note || '' }));
  const names = Object.fromEntries((await Item.find({ _id: { $in: [...new Set(events.map(e => e.item))] } })).map(i => [String(i._id), i]));
  events.sort((a, b) => a.date - b.date || (a.type === 'billed' ? -1 : 1));
  const bal = {};
  res.json(events.map(e => {
    bal[e.item] = (bal[e.item] || 0) + e.qty;
    return { ...e, name: names[e.item]?.name, unit: names[e.item]?.unit, qty: Math.abs(e.qty), remaining: bal[e.item] };
  }).reverse());
});

// Project financial summary
r.get('/:pid/summary', async (req, res) => {
  const pid = oid(req.params.pid);
  const sum = async (M, match, f) => (await M.aggregate([{ $match: match }, { $group: { _id: null, t: { $sum: f } } }]))[0]?.t || 0;
  const [quoted, billed, received] = await Promise.all([
    sum(Quotation, { project: pid, status: 'approved' }, '$grandTotal'),
    sum(Bill, { project: pid }, '$grandTotal'),
    sum(Payment, { project: pid }, '$amount'),
  ]);
  res.json({ quoted, billed, received, outstanding: billed - received, toBill: Math.max(0, quoted - billed) });
});

export default r;
