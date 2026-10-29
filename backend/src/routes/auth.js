import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { auth, superadmin } from '../middleware/auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const u = await User.findOne({ username: (username || '').toLowerCase(), active: true });
  if (!u || !(await bcrypt.compare(password || '', u.password))) {
    return res.status(400).json({ message: 'Invalid username or password' });
  }
  const payload = { id: u._id, role: u.role, name: u.name, username: u.username };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload });
});

r.get('/me', auth, (req, res) => res.json(req.user));

// Superadmin user management
r.get('/users', auth, superadmin, async (_req, res) => {
  res.json(await User.find().select('-password').sort('-createdAt'));
});

r.post('/users', auth, superadmin, async (req, res) => {
  const { name, username, password, role = 'user' } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  if (await User.findOne({ username: username.toLowerCase() })) return res.status(400).json({ message: 'Username already exists' });
  const u = await User.create({ name, username, role, password: await bcrypt.hash(password, 10) });
  res.json({ ...u.toObject(), password: undefined });
});

r.put('/users/:id', auth, superadmin, async (req, res) => {
  const data = { ...req.body };
  if (data.password) data.password = await bcrypt.hash(data.password, 10);
  else delete data.password;
  res.json(await User.findByIdAndUpdate(req.params.id, data, { new: true }).select('-password'));
});

r.delete('/users/:id', auth, superadmin, async (req, res) => {
  if (req.params.id === String(req.user.id)) return res.status(400).json({ message: 'Cannot delete yourself' });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default r;
