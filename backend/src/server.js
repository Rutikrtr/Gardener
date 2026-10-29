import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import { connectDB } from './db.js';
import { auth, clientOnly } from './middleware/auth.js';
import { crud } from './routes/crud.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import analyticsRoutes from './routes/analytics.js';
import { User, Item, Client, Project, Quotation, Bill, Payment, Usage } from './models/index.js';

const app = express();
const origins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());

app.use(helmet());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'smart-garden' }));
app.use('/api/auth', authRoutes);
// Business data: client accounts only, each sees only its own records
const biz = [auth, clientOnly];
app.use('/api/items', biz, crud(Item, { sort: 'name', filters: ['category'] }));
app.use('/api/clients', biz, crud(Client, { sort: 'name' }));
app.use('/api/projects', biz, projectRoutes, crud(Project, { populate: 'client', filters: ['status'] }));
app.use('/api/quotations', biz, crud(Quotation, { populate: { path: 'project', populate: 'client' }, filters: ['project', 'status'] }));
app.use('/api/bills', biz, crud(Bill, { populate: { path: 'project', populate: 'client' }, sort: 'stage', filters: ['project'] }));
app.use('/api/payments', biz, crud(Payment, { populate: 'bill', sort: '-date', filters: ['project', 'bill'] }));
app.use('/api/usage', biz, crud(Usage, { populate: 'item', sort: '-date', filters: ['project', 'item'] }));
app.use('/api/analytics', biz, analyticsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

async function ensureSuperadmin() {
  const username = (process.env.SUPERADMIN_USERNAME || 'rutik@rtr').toLowerCase();
  if (await User.findOne({ username })) return;
  if (!process.env.SUPERADMIN_PASSWORD) throw new Error('Set SUPERADMIN_PASSWORD in .env to create the superadmin');
  const password = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10);
  await User.create({ name: 'Rutik', username, role: 'superadmin', password });
  console.log('Superadmin created:', username);
}

const port = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI)
  .then(ensureSuperadmin)
  .then(() => app.listen(port, () => console.log('Smart Garden API on :' + port)))
  .catch(e => { console.error(e); process.exit(1); });
