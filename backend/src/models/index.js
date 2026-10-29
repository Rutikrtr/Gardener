import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;
const opts = { timestamps: true };

export const User = model('User', new Schema({
  name: String,
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'user'], default: 'user' },
  active: { type: Boolean, default: true },
}, opts));

// Price list / catalog: plants, trees, soil, manure, lawn, irrigation, services
export const Item = model('Item', new Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'Plant' },
  unit: { type: String, default: "No's" },
  rate: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  size: String,
  description: String,
}, opts));

export const Client = model('Client', new Schema({
  name: { type: String, required: true },
  company: String,
  phone: String,
  email: String,
  address: String,
  gstin: String,
}, opts));

export const Project = model('Project', new Schema({
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
  remark: String,
});

function totals(doc) {
  doc.lines.forEach(l => { l.amount = +((l.qty || 0) * (l.rate || 0)).toFixed(2); });
  doc.subTotal = doc.lines.reduce((s, l) => s + l.amount, 0);
  doc.gstAmount = +(doc.subTotal * (doc.gstPercent || 0) / 100).toFixed(2);
  doc.grandTotal = +(doc.subTotal + doc.gstAmount - (doc.discount || 0)).toFixed(2);
}

const docFields = {
  project: { type: Types.ObjectId, ref: 'Project', required: true },
  number: String,
  date: { type: Date, default: Date.now },
  title: String,
  lines: [line],
  gstPercent: { type: Number, default: 18 },
  discount: { type: Number, default: 0 },
  subTotal: Number, gstAmount: Number, grandTotal: Number,
  notes: String,
};

const quotationSchema = new Schema({
  ...docFields,
  terms: String,
  status: { type: String, enum: ['draft', 'sent', 'approved', 'rejected'], default: 'draft' },
}, opts);
quotationSchema.pre('save', function () { totals(this); });
export const Quotation = model('Quotation', quotationSchema);

// Step-wise (running) bill
const billSchema = new Schema({ ...docFields, stage: { type: Number, default: 1 } }, opts);
billSchema.pre('save', function () { totals(this); });
export const Bill = model('Bill', billSchema);

export const Payment = model('Payment', new Schema({
  project: { type: Types.ObjectId, ref: 'Project', required: true },
  bill: { type: Types.ObjectId, ref: 'Bill' },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String, default: 'Bank' },
  reference: String,
}, opts));

// Daily site usage: "on 11th used 50 plants"
export const Usage = model('Usage', new Schema({
  project: { type: Types.ObjectId, ref: 'Project', required: true },
  item: { type: Types.ObjectId, ref: 'Item', required: true },
  qty: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  bill: { type: Types.ObjectId, ref: 'Bill' },
  note: String,
}, opts));
