import { Router } from 'express';
import mongoose from 'mongoose';
import { Project, Quotation, Bill, Payment, Usage, Item, User, Expense, Purchase, SupplierPayment, Labour } from '../models/index.js';

const r = Router();
const oid = s => new mongoose.Types.ObjectId(s);
const sum = async (M, match, f) => (await M.aggregate([{ $match: match }, { $group: { _id: null, t: { $sum: f } } }]))[0]?.t || 0;

// Purchase cost estimate of everything billed = billed qty × item purchase cost (Price List).
// Used only when no actual supplier purchases are recorded.
export async function billedMaterialCost(match) {
  const rows = await Bill.aggregate([
    { $match: match }, { $unwind: '$lines' }, { $match: { 'lines.item': { $ne: null } } },
    { $lookup: { from: 'items', localField: 'lines.item', foreignField: '_id', as: 'it' } },
    { $group: { _id: null, t: { $sum: { $multiply: ['$lines.qty', { $ifNull: [{ $first: '$it.costPrice' }, 0] }] } } } },
  ]);
  return rows[0]?.t || 0;
}

// Money picture for one project ({ project }) or a whole account ({ owner })
export async function finance(match) {
  const [quoted, billed, billedNet, tds, received, revenue, purchases, supplierPaid, labourCost, labourUnpaid, labourWages, labourPfEsi, expenses, byCategory, extraBilled, estimate] = await Promise.all([
    sum(Quotation, { ...match, status: 'approved' }, '$grandTotal'),
    sum(Bill, match, '$grandTotal'),
    sum(Bill, match, { $ifNull: ['$netReceivable', '$grandTotal'] }),
    sum(Bill, match, { $ifNull: ['$tdsAmount', 0] }),
    sum(Payment, match, '$amount'),
    sum(Bill, match, '$subTotal'), // revenue excludes GST (GST goes to government)
    sum(Purchase, match, '$amount'),
    sum(SupplierPayment, match, '$amount'),
    sum(Labour, match, '$totalCost'),
    sum(Labour, { ...match, paid: false }, '$totalCost'),
    sum(Labour, match, '$wages'),
    sum(Labour, match, { $add: ['$pf', '$esi'] }),
    sum(Expense, match, '$amount'),
    Expense.aggregate([{ $match: match }, { $group: { _id: '$category', t: { $sum: '$amount' } } }, { $sort: { t: -1 } }]),
    Bill.aggregate([{ $match: match }, { $unwind: '$lines' }, { $match: { 'lines.extra': true } }, { $group: { _id: null, t: { $sum: '$lines.amount' } } }]).then(x => x[0]?.t || 0),
    billedMaterialCost(match),
  ]);
  const materialEstimated = purchases === 0 && estimate > 0;
  const materialCost = materialEstimated ? estimate : purchases;
  const profit = revenue - materialCost - labourCost - expenses;
  return {
    quoted, billed, billedNet, tds, received, outstanding: billedNet - received, toBill: Math.max(0, quoted - billed), extraBilled,
    revenue, purchases, materialCost, materialEstimated, supplierPaid, supplierDue: purchases - supplierPaid,
    labourCost, labourWages, labourPfEsi, labourUnpaid, expenses, byCategory,
    profit, margin: revenue ? Math.round(profit / revenue * 100) : 0,
  };
}

// Every /:pid route must belong to the logged-in client account
r.param('pid', async (req, res, next, pid) => {
  if (!mongoose.isValidObjectId(pid) || !(await Project.exists({ _id: pid, owner: req.user.id }))) {
    return res.status(404).json({ message: 'Project not found' });
  }
  next();
});

async function nextNumber(Model, owner, prefix) {
  const n = Model === Quotation ? (await Quotation.distinct('baseNumber', { owner })).length : await Model.countDocuments({ owner });
  return `${prefix}-${new Date().getFullYear()}-${String(n + 1).padStart(4, '0')}`;
}

// New documents take GST / TDS defaults from the account settings unless given
async function newDoc(req, Model, prefix, extra = {}) {
  const s = (await User.findById(req.user.id)).settings || {};
  const defaults = { gstEnabled: s.gstEnabled ?? true, gstType: s.gstType || 'cgst_sgst', gstPercent: s.gstPercent ?? 18 };
  if (Model === Quotation && s.terms) defaults.terms = s.terms;
  if (Model === Bill) defaults.tdsPercent = s.tdsPercent ?? 0;
  const number = req.body.number || await nextNumber(Model, req.user.id, prefix);
  return new Model({ ...defaults, ...extra, ...req.body, owner: req.user.id, project: req.params.pid, number }).save();
}

r.post('/:pid/quotations', async (req, res) => {
  const { revision, revisedFrom, baseNumber, status, ...body } = req.body;
  req.body = body;
  res.json(await newDoc(req, Quotation, 'QT'));
});

// Revise: copy a quotation as the next revision (R1, R2…) and mark the old one "revised"
r.post('/:pid/quotations/:qid/revise', async (req, res) => {
  const old = await Quotation.findOne({ _id: req.params.qid, project: req.params.pid });
  if (!old) return res.status(404).json({ message: 'Quotation not found' });
  const base = old.baseNumber || old.number;
  const last = await Quotation.findOne({ project: req.params.pid, baseNumber: base }).sort('-revision');
  const revision = (last?.revision || 0) + 1;
  const o = old.toObject();
  ['_id', 'createdAt', 'updatedAt', '__v', 'poNumber', 'poDate'].forEach(k => delete o[k]);
  o.lines = o.lines.map(({ _id, ...l }) => l);
  const copy = await new Quotation({ ...o, number: `${base}-R${revision}`, baseNumber: base, revision, revisedFrom: old._id, status: 'draft', date: new Date() }).save();
  if (old.status !== 'rejected') { old.status = 'revised'; await old.save(); }
  res.json(copy);
});

// Finalise as Work Order: only one work order per project, the others become "revised"
r.post('/:pid/quotations/:qid/work-order', async (req, res) => {
  const q = await Quotation.findOne({ _id: req.params.qid, project: req.params.pid });
  if (!q) return res.status(404).json({ message: 'Quotation not found' });
  const others = await Quotation.find({ project: req.params.pid, status: 'approved', _id: { $ne: q._id } });
  for (const o of others) { o.status = 'revised'; await o.save(); }
  q.status = 'approved';
  q.poNumber = req.body.poNumber || q.poNumber;
  q.poDate = req.body.poDate || q.poDate || new Date();
  res.json(await q.save());
});

r.post('/:pid/bills', async (req, res) => {
  const over = await billOverLimit(req.params.pid, req.body.lines);
  if (over) return res.status(400).json({ message: over });
  const stage = (await Bill.countDocuments({ project: req.params.pid })) + 1;
  res.json(await newDoc(req, Bill, 'INV', { stage }));
});

// Work order qty per item, and qty already billed against it (extra lines don't count)
async function quotedAndBilled(pid, excludeBill) {
  const p = oid(pid);
  const sumLines = (Model, match, onlyNormal) => Model.aggregate([
    { $match: match }, { $unwind: '$lines' },
    { $match: { 'lines.item': { $ne: null }, ...(onlyNormal ? { 'lines.extra': { $ne: true } } : {}) } },
    { $group: { _id: '$lines.item', qty: { $sum: '$lines.qty' } } },
  ]);
  const billMatch = { project: p, ...(excludeBill ? { _id: { $ne: oid(excludeBill) } } : {}) };
  const [q, b] = await Promise.all([sumLines(Quotation, { project: p, status: 'approved' }), sumLines(Bill, billMatch, true)]);
  const toMap = a => Object.fromEntries(a.map(x => [String(x._id), x.qty]));
  return { quoted: toMap(q), billed: toMap(b) };
}

// Normal bill lines can't go over the work order. Extra quantity must be on a line marked "extra".
export async function billOverLimit(pid, lines = [], excludeBill) {
  const { quoted, billed } = await quotedAndBilled(pid, excludeBill);
  const want = {};
  lines.forEach(l => { if (l.item && !l.extra) want[String(l.item)] = (want[String(l.item)] || 0) + (+l.qty || 0); });
  for (const [itemId, qty] of Object.entries(want)) {
    if (quoted[itemId] === undefined) continue;
    const left = quoted[itemId] - (billed[itemId] || 0);
    if (qty > left) {
      const it = await Item.findById(itemId);
      return `${it?.name || 'Item'}: only ${Math.max(0, left)} ${it?.unit || ''} left in the work order (you entered ${qty}). Put the extra quantity on a line marked "Extra".`;
    }
  }
  return null;
}

// Stock at site comes from what the suppliers delivered for this project.
// Items never bought from a supplier (e.g. from own nursery) fall back to the billed quantity.
// Daily usage can't go over what is at site. Returns an error message or null.
export async function usageOverLimit(pid, itemId, qty, excludeUsage) {
  const p = oid(pid), it = oid(itemId);
  const [received, billed, used, item] = await Promise.all([
    Purchase.aggregate([{ $match: { project: p, item: it } }, { $group: { _id: null, q: { $sum: '$qty' } } }]),
    Bill.aggregate([{ $match: { project: p } }, { $unwind: '$lines' }, { $match: { 'lines.item': it } }, { $group: { _id: null, q: { $sum: '$lines.qty' } } }]),
    Usage.aggregate([{ $match: { project: p, item: it, ...(excludeUsage ? { _id: { $ne: oid(excludeUsage) } } : {}) } }, { $group: { _id: null, q: { $sum: '$qty' } } }]),
    Item.findById(it),
  ]);
  const fromSupplier = received.length > 0;
  const atSite = (fromSupplier ? received[0].q : billed[0]?.q || 0) - (used[0]?.q || 0);
  if (+qty <= 0) return 'Quantity must be more than 0';
  if (+qty > atSite) return `${item?.name || 'Item'}: only ${Math.max(0, atSite)} ${item?.unit || ''} at site (${fromSupplier ? 'received from suppliers' : 'billed'} but not used yet). You entered ${qty}.`;
  return null;
}

// Share each item's site usage across its purchases, oldest first, so every purchase shows used / still at site
export function allocateUsage(purchases, usages) {
  const key = (proj, item) => `${proj}|${item}`;
  const usedBy = {};
  usages.forEach(u => { const k = key(u.project?._id || u.project, u.item?._id || u.item); usedBy[k] = (usedBy[k] || 0) + u.qty; });
  const sorted = [...purchases].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.map(b => {
    const o = b.toObject ? b.toObject() : b;
    if (!o.item) return { ...o, usedQty: null, leftQty: null };
    const k = key(o.project?._id || o.project, o.item?._id || o.item);
    const take = Math.min(o.qty || 0, usedBy[k] || 0);
    usedBy[k] = (usedBy[k] || 0) - take;
    return { ...o, usedQty: take, leftQty: (o.qty || 0) - take };
  });
}

// How much of each item can still be billed against the work order (used by the bill editor)
r.get('/:pid/billable', async (req, res) => {
  const { quoted, billed } = await quotedAndBilled(req.params.pid, req.query.excludeBill);
  res.json(Object.fromEntries(Object.entries(quoted).map(([k, q]) => [k, { quoted: q, billed: billed[k] || 0, left: Math.max(0, q - (billed[k] || 0)) }])));
});

// Material ledger per item: quoted (work order), billed (incl. extra), used on site, in hand, left to bill
r.get('/:pid/ledger', async (req, res) => {
  const pid = oid(req.params.pid);
  const lineSum = (M, match) => M.aggregate([
    { $match: match }, { $unwind: '$lines' }, { $match: { 'lines.item': { $ne: null } } },
    { $group: { _id: '$lines.item', qty: { $sum: '$lines.qty' }, extra: { $sum: { $cond: ['$lines.extra', '$lines.qty', 0] } } } },
  ]);
  const [quoted, billed, used, received] = await Promise.all([
    lineSum(Quotation, { project: pid, status: 'approved' }),
    lineSum(Bill, { project: pid }),
    Usage.aggregate([{ $match: { project: pid } }, { $group: { _id: '$item', qty: { $sum: '$qty' } } }]),
    Purchase.aggregate([
      { $match: { project: pid, item: { $ne: null } } },
      { $lookup: { from: 'suppliers', localField: 'supplier', foreignField: '_id', as: 's' } },
      { $group: { _id: { item: '$item', supplier: { $first: '$s.name' } }, qty: { $sum: '$qty' } } },
    ]),
  ]);
  const map = {};
  const get = id => (map[String(id)] ??= { quoted: 0, billed: 0, extra: 0, used: 0, received: 0, suppliers: [] });
  quoted.forEach(x => { get(x._id).quoted = x.qty; });
  billed.forEach(x => { get(x._id).billed = x.qty; get(x._id).extra = x.extra; });
  used.forEach(x => { get(x._id).used = x.qty; });
  received.forEach(x => { const m = get(x._id.item); m.received += x.qty; m.suppliers.push({ name: x._id.supplier, qty: x.qty }); });
  const items = await Item.find({ _id: { $in: Object.keys(map) } });
  res.json(items
    .map(item => {
      const m = map[String(item._id)];
      const source = m.suppliers.length ? 'supplier' : 'billed';
      const inHand = (source === 'supplier' ? m.received : m.billed) - m.used;
      return { item, ...m, source, inHand, toReceive: Math.max(0, m.billed - m.received), pendingToBill: Math.max(0, m.quoted - (m.billed - m.extra)) };
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name)));
});

// Day-wise usage report: rows of date -> item -> qty, with running remaining stock
r.get('/:pid/daywise', async (req, res) => {
  const pid = oid(req.params.pid);
  const [bills, usage, buys] = await Promise.all([
    Bill.find({ project: pid }).sort('date'),
    Usage.find({ project: pid }).populate('item').sort('date'),
    Purchase.find({ project: pid, item: { $ne: null } }).populate('supplier', 'name').sort('date'),
  ]);
  const events = [];
  const supplied = new Set(buys.map(b => String(b.item)));
  // Items bought from suppliers move in when received; other items move in when billed
  buys.forEach(b => events.push({ date: b.date, item: String(b.item), qty: b.qty, type: 'received', ref: `From ${b.supplier?.name || 'supplier'}${b.billNo ? ' · ' + b.billNo : ''}` }));
  bills.forEach(b => b.lines.forEach(l => l.item && !supplied.has(String(l.item)) && events.push({ date: b.date, item: String(l.item), qty: l.qty, type: 'billed', ref: `Stage ${b.stage}${l.extra ? ' extra' : ''} (${b.number})` })));
  usage.forEach(u => events.push({ date: u.date, item: String(u.item._id), qty: -u.qty, type: 'used', ref: u.note || '' }));
  const names = Object.fromEntries((await Item.find({ _id: { $in: [...new Set(events.map(e => e.item))] } })).map(i => [String(i._id), i]));
  events.sort((a, b) => a.date - b.date || (a.type === 'used' ? 1 : -1));
  const bal = {};
  res.json(events.map(e => {
    bal[e.item] = (bal[e.item] || 0) + e.qty;
    return { ...e, name: names[e.item]?.name, unit: names[e.item]?.unit, qty: Math.abs(e.qty), remaining: bal[e.item] };
  }).reverse());
});

// Purchases of this project with how much of each delivery is used / still at site
r.get('/:pid/purchases', async (req, res) => {
  const pid = oid(req.params.pid);
  const [buys, usage] = await Promise.all([
    Purchase.find({ project: pid }).populate('supplier item'),
    Usage.find({ project: pid }),
  ]);
  res.json(allocateUsage(buys, usage).reverse());
});

// Project financial summary (client side + internal costs)
r.get('/:pid/summary', async (req, res) => res.json(await finance({ project: oid(req.params.pid) })));

export default r;
