import { Router } from 'express';

// Generic CRUD router. `filters` are query params copied into the find() filter.
export function crud(Model, { populate = '', sort = '-createdAt', filters = [] } = {}) {
  const r = Router();

  r.get('/', async (req, res) => {
    const q = {};
    filters.forEach(f => { if (req.query[f]) q[f] = req.query[f]; });
    res.json(await Model.find(q).populate(populate).sort(sort));
  });

  r.get('/:id', async (req, res) => {
    const d = await Model.findById(req.params.id).populate(populate);
    d ? res.json(d) : res.status(404).json({ message: 'Not found' });
  });

  r.post('/', async (req, res) => res.json(await new Model(req.body).save()));

  r.put('/:id', async (req, res) => {
    const d = await Model.findById(req.params.id);
    if (!d) return res.status(404).json({ message: 'Not found' });
    d.set(req.body);
    res.json(await d.save());
  });

  r.delete('/:id', async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  return r;
}
