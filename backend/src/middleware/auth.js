import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Returns a message if the client account may not use the software, else null
export function serviceBlock(u) {
  if (!u || !u.active) return 'Your service is inactive. Please contact support.';
  if (u.role === 'user' && u.plan?.endDate && new Date(u.plan.endDate) < new Date()) return 'Your plan has expired. Please contact support to renew.';
  return null;
}

export async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  // Re-check on every request so stopping a service takes effect immediately
  const u = await User.findById(payload.id).select('-password');
  const block = serviceBlock(u);
  if (block) return res.status(401).json({ message: block });
  req.user = { id: String(u._id), role: u.role, name: u.name, username: u.username };
  next();
}

export function superadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Superadmin only' });
  next();
}

// Business data is only for client accounts
export function clientOnly(req, res, next) {
  if (req.user?.role !== 'user') return res.status(403).json({ message: 'Client accounts only' });
  next();
}
