import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

export function superadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Superadmin only' });
  next();
}
