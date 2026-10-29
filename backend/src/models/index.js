import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;
const opts = { timestamps: true };

// Every business record belongs to one client account (the logged-in user)
const owner = { type: Types.ObjectId, ref: 'User', required: true, index: true };
const projectRef = { type: Types.ObjectId, ref: 'Project', required: true, index: true };

// superadmin = software owner (manages client accounts & plans)
// user       = a client business (e.g. Shivsai Garden Developers) using the software
export const User = model('User', new Schema({
  name: String,
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'user'], default: 'user' },
  active: { type: Boolean, default: true },
  phone: String,
  plan: {
    name: { type: String, default: 'Annual' },
    amount: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
  },
  settings: {
    companyName: String,
    logo: String, // small data URL image shown on quotations & bills
    tagline: String,
    address: String,
    phone: String,
    email: String,
    gstin: String,
    gstEnabled: { type: Boolean, default: true },
    gstType: { type: String, enum: ['cgst_sgst', 'igst'], default: 'cgst_sgst' },
    gstPercent: { type: Number, default: 18 }, // default GST for items without their own rate
    tdsPercent: { type: Number, default: 1 },  // TDS the customer usually deducts on our bills (changeable)
    pfPercent: { type: Number, default: 12 },  // employer PF on labour wages
    esiPercent: { type: Number, default: 3.25 }, // employer ESI on labour wages
    terms: String,
  },
}, opts));

// Price list / catalog: plants, trees, soil, manure, lawn, irrigation, services
export const Item = model('Item', new Schema({
  owner,
  name: { type: String, required: true },
  category: { type: String, default: 'Plant' },
  unit: { type: String, default: "No's" },
  rate: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 0 }, // set by the client per item
  size: String,
  description: String,
}, opts));

export const Client = model('Client', new Schema({
  owner,
  name: { type: String, required: true },
  company: String,
  phone: String,
  email: String,
  address: String,
  gstin: String,
}, opts));

export const Project = model('Project', new Schema({
  owner,
  name: { type: String, required: true },
  client: { type: Types.ObjectId, ref: 'Client' },
  site: String,
  startDate: Date,
  status: { type: String, enum: ['quotation', 'active', 'completed', 'on-hold'], default: 'quotation' },
  notes: String,
}, opts));

const line = new Schema({
  item: { type: Types.ObjectId, ref: 'Item' },
  section: String, // e.g. "A - SOIL SUPPLY"
  description: String,
  qty: { type: Number, default: 0 },
  unit: String,
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  gstPercent: Number, // per line; old documents without it fall back to the document rate
  gstAmount: { type: Number, default: 0 },
  extra: { type: Boolean, default: false }, // bills only: quantity beyond the work order
  remark: String,
});

function totals(doc) {
  doc.lines.forEach(l => {
    l.amount = +((l.qty || 0) * (l.rate || 0)).toFixed(2);
    const pct = l.gstPercent ?? doc.gstPercent ?? 0;
    l.gstAmount = doc.gstEnabled ? +(l.amount * pct / 100).toFixed(2) : 0;
  });
  doc.subTotal = +doc.lines.reduce((s, l) => s + l.amount, 0).toFixed(2);
  doc.gstAmount = +doc.lines.reduce((s, l) => s + l.gstAmount, 0).toFixed(2);
  doc.discount = 0;
  doc.grandTotal = +(doc.subTotal + doc.gstAmount).toFixed(2);
}

const docFields = {
  owner,
  project: projectRef,
  number: String,
  date: { type: Date, default: Date.now },
  title: String,
  lines: [line],
  gstEnabled: { type: Boolean, default: true },
  gstType: { type: String, enum: ['cgst_sgst', 'igst'], default: 'cgst_sgst' },
  gstPercent: { type: Number, default: 18 },
  discount: { type: Number, default: 0 },
  subTotal: Number, gstAmount: Number, grandTotal: Number,
  notes: String,
};

// Quotations are revised again and again (R0, R1, R2…) until the customer finalises one.
// The final one is the Work Order (status "approved"), optionally with the customer's PO number.
const quotationSchema = new Schema({
  ...docFields,
  terms: String,
  baseNumber: String,                  // QT-2026-0001 (same for all revisions)
  revision: { type: Number, default: 0 },
  revisedFrom: { type: Types.ObjectId, ref: 'Quotation' },
  status: { type: String, enum: ['draft', 'sent', 'revised', 'approved', 'rejected'], default: 'draft' },
  poNumber: String,
  poDate: Date,
}, opts);
quotationSchema.pre('save', function () {
  totals(this);
  if (!this.baseNumber) this.baseNumber = this.number;
});
// Project status follows the work order: work order -> active, none -> back to quotation stage
quotationSchema.post('save', async function (doc) {
  const Project = mongoose.model('Project');
  const p = await Project.findById(doc.project);
  if (!p || ['completed', 'on-hold'].includes(p.status)) return;
  const anyApproved = await mongoose.model('Quotation').exists({ project: doc.project, status: 'approved' });
  const status = anyApproved ? 'active' : 'quotation';
  if (p.status !== status) await Project.updateOne({ _id: p._id }, { status });
});
export const Quotation = model('Quotation', quotationSchema);

// Step-wise (running) bill. The customer deducts TDS and must share TDS certificate & GST proof per bill.
const billSchema = new Schema({
  ...docFields,
  stage: { type: Number, default: 1 },
  tdsPercent: { type: Number, default: 0 },
  tdsAmount: { type: Number, default: 0 },
  netReceivable: Number,                    // grand total − TDS
  tdsCertReceived: { type: Boolean, default: false },
  tdsCertDate: Date,
  gstReportReceived: { type: Boolean, default: false },
  gstReportDate: Date,
}, opts);
billSchema.pre('save', function () {
  totals(this);
  this.tdsAmount = +(this.subTotal * (this.tdsPercent || 0) / 100).toFixed(2);
  this.netReceivable = +(this.grandTotal - this.tdsAmount).toFixed(2);
});
export const Bill = model('Bill', billSchema);

export const Payment = model('Payment', new Schema({
  owner,
  project: projectRef,
  bill: { type: Types.ObjectId, ref: 'Bill' },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String, default: 'Bank' },
  reference: String,
}, opts));

// Other internal project expenses (transport, JCB, water…) — never shown to the end client
export const Expense = model('Expense', new Schema({
  owner,
  project: projectRef,
  date: { type: Date, default: Date.now },
  category: { type: String, default: 'Transport' },
  amount: { type: Number, required: true },
  paidTo: String,
  note: String,
}, opts));

// Suppliers we buy plants & material from; balances are kept per project
export const Supplier = model('Supplier', new Schema({
  owner,
  name: { type: String, required: true },
  phone: String,
  gstin: String,
  address: String,
  note: String,
}, opts));

// What we bought from a supplier for a project
const purchaseSchema = new Schema({
  owner,
  project: projectRef,
  supplier: { type: Types.ObjectId, ref: 'Supplier', required: true },
  date: { type: Date, default: Date.now },
  billNo: String,
  item: { type: Types.ObjectId, ref: 'Item' },
  description: String,
  qty: { type: Number, default: 1 },
  unit: String,
  rate: { type: Number, default: 0 },
  amount: Number,
  note: String,
}, opts);
purchaseSchema.pre('save', function () { this.amount = +((this.qty || 0) * (this.rate || 0)).toFixed(2); });
export const Purchase = model('Purchase', purchaseSchema);

// Money paid to (or received back from) a supplier for a project
export const SupplierPayment = model('SupplierPayment', new Schema({
  owner,
  project: projectRef,
  supplier: { type: Types.ObjectId, ref: 'Supplier', required: true },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true }, // negative = refund received from supplier
  mode: { type: String, default: 'Bank' },
  reference: String,
}, opts));

// Labour team (kept outside projects); work is recorded per project
export const Worker = model('Worker', new Schema({
  owner,
  name: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'Mali / Gardener' },
  dailyWage: { type: Number, default: 0 },
  pfApplicable: { type: Boolean, default: false },
  esiApplicable: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, opts));

const labourSchema = new Schema({
  owner,
  project: projectRef,
  worker: { type: Types.ObjectId, ref: 'Worker', required: true },
  date: { type: Date, default: Date.now },
  days: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
  wages: Number,
  pf: { type: Number, default: 0 },   // employer PF
  esi: { type: Number, default: 0 },  // employer ESI
  totalCost: Number,                  // wages + pf + esi
  paid: { type: Boolean, default: false },
  paidDate: Date,
  note: String,
}, opts);
labourSchema.pre('save', function () {
  this.wages = +((this.days || 0) * (this.rate || 0)).toFixed(2);
  this.totalCost = +(this.wages + (this.pf || 0) + (this.esi || 0)).toFixed(2);
});
export const Labour = model('Labour', labourSchema);

// Daily site usage: "on 11th used 50 plants"
export const Usage = model('Usage', new Schema({
  owner,
  project: projectRef,
  item: { type: Types.ObjectId, ref: 'Item', required: true },
  qty: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  bill: { type: Types.ObjectId, ref: 'Bill' },
  note: String,
}, opts));
