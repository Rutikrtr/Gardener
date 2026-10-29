import { Router } from 'express';
import mongoose from 'mongoose';
import { Project, Quotation, Bill, Payment, Usage, Item, Client } from '../models/index.js';

const r = Router();

r.get('/', async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.user.id);
  const total = async (M, match, f) => (await M.aggregate([{ $match: { ...match, owner } }, { $group: { _id: null, t: { $sum: f } } }]))[0]?.t || 0;
  const since = new Date();
  since.setDate(1); since.setHours(0, 0, 0, 0); since.setMonth(since.getMonth() - 11);
  const monthly = (M, f) => M.aggregate([
    { $match: { owner, date: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, t: { $sum: f } } },
  ]);

  const [projects, byStatus, clients, items, quotedApproved, quotations, billed, received, mBills, mPay, topItems, recentPayments, projectRows] = await Promise.all([
    Project.countDocuments({ owner }),
    Project.aggregate([{ $match: { owner } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Client.countDocuments({ owner }),
    Item.countDocuments({ owner }),
    total(Quotation, { status: 'approved' }, '$grandTotal'),
    Quotation.aggregate([{ $match: { owner } }, { $group: { _id: '$status', n: { $sum: 1 }, t: { $sum: '$grandTotal' } } }]),
    total(Bill, {}, '$grandTotal'),
    total(Payment, {}, '$amount'),
    monthly(Bill, '$grandTotal'),
    monthly(Payment, '$amount'),
    Usage.aggregate([
      { $match: { owner } },
      { $group: { _id: '$item', qty: { $sum: '$qty' } } }, { $sort: { qty: -1 } }, { $limit: 6 },
      { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } }, { $unwind: '$item' },
      { $project: { name: '$item.name', unit: '$item.unit', qty: 1 } },
    ]),
    Payment.find({ owner }).populate('project', 'name').sort('-date').limit(6),
    Project.aggregate([
      { $match: { owner } },
      { $lookup: { from: 'bills', localField: '_id', foreignField: 'project', as: 'b' } },
      { $lookup: { from: 'payments', localField: '_id', foreignField: 'project', as: 'p' } },
      { $lookup: { from: 'quotations', localField: '_id', foreignField: 'project', as: 'q' } },
      { $lookup: { from: 'clients', localField: 'client', foreignField: '_id', as: 'c' } },
      { $project: {
        name: 1, status: 1, client: { $first: '$c.name' },
        billed: { $sum: '$b.grandTotal' }, received: { $sum: '$p.amount' },
        quoted: { $sum: { $map: { input: { $filter: { input: '$q', cond: { $eq: ['$$this.status', 'approved'] } } }, in: '$$this.grandTotal' } } },
      } },
      { $sort: { billed: -1 } }, { $limit: 8 },
    ]),
  ]);

  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(since); d.setMonth(since.getMonth() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      month: d.toLocaleString('en-IN', { month: 'short' }),
      billed: mBills.find(x => x._id === k)?.t || 0,
      received: mPay.find(x => x._id === k)?.t || 0,
    });
  }

  res.json({
    projects, clients, items, quotedApproved, billed, received, outstanding: billed - received,
    byStatus, quotations, monthly: months, topItems, recentPayments, projectRows,
  });
});

export default r;
