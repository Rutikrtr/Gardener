import { Router } from 'express';
import mongoose from 'mongoose';
import { Project, Quotation, Bill, Payment, Usage, Item, User, Expense } from '../models/index.js';

const r = Router();
const oid = s => new mongoose.Types.ObjectId(s);

// Purchase cost of everything billed = billed qty × item purchase cost (Price List)
export async function billedMaterialCost(match) {
  const rows = await Bill.aggregate([
    { $match: match }, { $unwind: '$lines' }, { $match: { 'lines.item': { $ne: null } } },
    { $lookup: { from: 'items', localField: 'lines.item', foreignField: '_id', as: 'it' } },
    { $group: { _id: null, t: { $sum: { $multiply: ['$lines.qty', { $ifNull: [{ $first: '$it.costPrice' }, 0] }] } } } },
  ]);
  return rows[0]?.t || 0;
}

// Every /:pid route must belong to the logged-in client account
r.param('pid', async (req, res, next, pid) => {
  if (!mongoose.isValidObjectId(pid) || !(await Project.exists({ _id: pid, owner: req.user.id }))) {
    return res.status(404).json({ message: 'Project not found' });
  }
  next();
});

async function nextNumber(Model, owner, prefix) {
  const n = await Model.countDocuments({ owner });
  return `${prefix}-${new Date().getFullYear()}-${String(n + 1).padStart(4, '0')}`;
}

// New documents take GST defaults from the account settings unless given
async function newDoc(req, Model, prefix, extra = {}) {
  const s = (await User.findById(req.user.id)).settings || {};
  const defaults = { gstEnabled: s.gstEnabled ?? true, gstType: s.gstType || 'cgst_sgst', gstPercent: s.gstPercent ?? 18 };
  if (Model === Quotation && s.terms) defaults.terms = s.terms;
  const number = req.body.number || await nextNumber(Model, req.user.id, prefix);
  return new Model({ ...defaults, ...extra, ...req.body, owner: req.user.id, project: req.params.pid, number }).save();
}

// Create quotation / bill with auto numbering (bill stage = next stage of the project)
r.post('/:pid/quotations', async (req, res) => res.json(await newDoc(req, Quotation, 'QT')));

r.post('/:pid/bills', async (req, res) => {
  const over = await billOverLimit(req.params.pid, req.body.lines);
  if (over) return res.status(400).json({ message: over });
  const stage = (await Bill.countDocuments({ project: req.params.pid })) + 1;
  res.json(await newDoc(req, Bill, 'INV', { stage }));
});

// Approved quotation qty per item, and qty already billed (optionally excluding one bill)
async function quotedAndBilled(pid, excludeBill) {
  const p = oid(pid);
  const sumLines = (Model, match) => Model.aggregate([
    { $match: match }, { $unwind: '$lines' }, { $match: { 'lines.item': { $ne: null } } },
    { $group: { _id: '$lines.item', qty: { $sum: '$lines.qty' } } },
  ]);
  const billMatch = { project: p, ...(excludeBill ? { _id: { $ne: oid(excludeBill) } } : {}) };
  const [q, b] = await Promise.all([sumLines(Quotation, { project: p, status: 'approved' }), sumLines(Bill, billMatch)]);
  const toMap = a => Object.fromEntries(a.map(x => [String(x._id), x.qty]));
  return { quoted: toMap(q), billed: toMap(b) };
}

// Bills can't go over the approved quotation: returns an error message, or null when ok.
// Items that aren't in an approved quotation (extra work) are not limited.
export async function billOverLimit(pid, lines = [], excludeBill) {
  const { quoted, billed } = await quotedAndBilled(pid, excludeBill);
  const want = {};
  lines.forEach(l => { if (l.item) want[String(l.item)] = (want[String(l.item)] || 0) + (+l.qty || 0); });
  for (const [itemId, qty] of Object.entries(want)) {
    if (quoted[itemId] === undefined) continue;
    const left = quoted[itemId] - (billed[itemId] || 0);
    if (qty > left) {
      const it = await Item.findById(itemId);
      return `${it?.name || 'Item'}: only ${Math.max(0, left)} ${it?.unit || ''} left to bill from the approved quotation (you entered ${qty}).`;
    }
  }
  return null;
}

// Daily usage can't go over what is in hand (billed qty − already used). Returns error or null.
export async function usageOverLimit(pid, itemId, qty, excludeUsage) {
  const p = oid(pid), it = oid(itemId);
  const [billed, used, item] = await Promise.all([
    Bill.aggregate([{ $match: { project: p } }, { $unwind: '$lines' }, { $match: { 'lines.item': it } }, { $group: { _id: null, q: { $sum: '$lines.qty' } } }]),
    Usage.aggregate([{ $match: { project: p, item: it, ...(excludeUsage ? { _id: { $ne: oid(excludeUsage) } } : {}) } }, { $group: { _id: null, q: { $sum: '$qty' } } }]),
    Item.findById(it),
  ]);
  const inHand = (billed[0]?.q || 0) - (used[0]?.q || 0);
  if (+qty <= 0) return 'Quantity must be more than 0';
  if (+qty > inHand) return `${item?.name || 'Item'}: only ${Math.max(0, inHand)} ${item?.unit || ''} in hand (billed but not used yet). You entered ${qty}.`;
  return null;
}

// How much of each item can still be billed (used by the bill editor)
r.get('/:pid/billable', async (req, res) => {
  const { quoted, billed } = await quotedAndBilled(req.params.pid, req.query.excludeBill);
  res.json(Object.fromEntries(Object.entries(quoted).map(([k, q]) => [k, { quoted: q, billed: billed[k] || 0, left: Math.max(0, q - (billed[k] || 0)) }])));
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
  const [quoted, billed, received, revenue, expenses, byCategory, materialCost] = await Promise.all([
    sum(Quotation, { project: pid, status: 'approved' }, '$grandTotal'),
    sum(Bill, { project: pid }, '$grandTotal'),
    sum(Payment, { project: pid }, '$amount'),
    sum(Bill, { project: pid }, '$subTotal'), // revenue excludes GST (GST is paid to government)
    sum(Expense, { project: pid }, '$amount'),
    Expense.aggregate([{ $match: { project: pid } }, { $group: { _id: '$category', t: { $sum: '$amount' } } }, { $sort: { t: -1 } }]),
    billedMaterialCost({ project: pid }),
  ]);
  const profit = revenue - materialCost - expenses;
  res.json({
    quoted, billed, received, outstanding: billed - received, toBill: Math.max(0, quoted - billed),
    revenue, materialCost, expenses, byCategory, profit, margin: revenue ? Math.round(profit / revenue * 100) : 0,
  });
});

export default r;
