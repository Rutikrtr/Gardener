import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Item } from '../models/index.js';
import { auth, superadmin, serviceBlock } from '../middleware/auth.js';
import { DEFAULT_ITEMS } from '../defaultItems.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const u = await User.findOne({ username: (username || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(password || '', u.password))) {
    return res.status(400).json({ message: 'Invalid username or password' });
  }
  const block = serviceBlock(u);
  if (block) return res.status(403).json({ message: block });
  const payload = { id: u._id, role: u.role, name: u.name, username: u.username };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload });
});

r.get('/me', auth, (req, res) => res.json(req.user));

// Own settings: company details shown on prints + GST defaults
r.get('/settings', auth, async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ ...(u.settings?.toObject?.() || {}), plan: u.plan });
});
r.put('/settings', auth, async (req, res) => {
  const u = await User.findById(req.user.id);
  const { plan, ...settings } = req.body;
  u.settings = { ...(u.settings?.toObject?.() || {}), ...settings };
  await u.save();
  res.json(u.settings);
});

// Superadmin: manage client accounts (service on/off, annual plan)
const clientView = '-password -settings.terms';
r.get('/accounts', auth, superadmin, async (_req, res) => {
  res.json(await User.find({ role: 'user' }).select(clientView).sort('-createdAt'));
});

r.post('/accounts', auth, superadmin, async (req, res) => {
  const { name, username, password, phone, plan } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  if (await User.findOne({ username: username.toLowerCase() })) return res.status(400).json({ message: 'Username already exists' });
  const u = await User.create({
    name, username, phone, plan, role: 'user',
    password: await bcrypt.hash(password, 10),
    settings: { companyName: name },
  });
  await Item.insertMany(DEFAULT_ITEMS.map(i => ({ ...i, owner: u._id })));
  res.json(await User.findById(u._id).select(clientView));
});

r.put('/accounts/:id', auth, superadmin, async (req, res) => {
  const { name, phone, active, plan, password } = req.body;
  const data = { name, phone, active, plan };
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  if (password) data.password = await bcrypt.hash(password, 10);
  res.json(await User.findOneAndUpdate({ _id: req.params.id, role: 'user' }, data, { new: true }).select(clientView));
});

export default r;
