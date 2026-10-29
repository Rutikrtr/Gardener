import { Router } from 'express';

// Generic CRUD router scoped to the logged-in client account (owner).
// `filters` are query params copied into the find() filter.
export function crud(Model, { populate = '', sort = '-createdAt', filters = [] } = {}) {
  const r = Router();
  const mine = (req, extra = {}) => ({ ...extra, owner: req.user.id });

  r.get('/', async (req, res) => {
    const q = mine(req);
    filters.forEach(f => { if (req.query[f]) q[f] = req.query[f]; });
    res.json(await Model.find(q).populate(populate).sort(sort));
  });

  r.get('/:id', async (req, res) => {
    const d = await Model.findOne(mine(req, { _id: req.params.id })).populate(populate);
    d ? res.json(d) : res.status(404).json({ message: 'Not found' });
  });

  r.post('/', async (req, res) => res.json(await new Model({ ...req.body, owner: req.user.id }).save()));

  r.put('/:id', async (req, res) => {
    const d = await Model.findOne(mine(req, { _id: req.params.id }));
    if (!d) return res.status(404).json({ message: 'Not found' });
    const { owner, ...body } = req.body;
    d.set(body);
    res.json(await d.save());
  });

  r.delete('/:id', async (req, res) => {
    await Model.deleteOne(mine(req, { _id: req.params.id }));
    res.json({ ok: true });
  });

  return r;
}
