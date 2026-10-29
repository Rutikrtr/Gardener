import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useApi, FormModal } from './ui';
import { api, inr } from '../api';

export const CATEGORIES = ['Tree', 'Plant', 'Shrub', 'Soil', 'Manure', 'Lawn', 'Irrigation', 'Service', 'Tools', 'Other'];
const UNITS = ["No's", 'CUM', 'KG', 'Brass', 'S.mt', 'Sft', 'Bag', 'Rmt', 'Lumpsum'];
const fields = [
  { k: 'name', label: 'Name', required: true, full: true },
  { k: 'category', label: 'Category', options: CATEGORIES },
  { k: 'unit', label: 'Unit', options: UNITS },
  { k: 'rate', label: 'Selling rate (₹)', type: 'number' },
  { k: 'costPrice', label: 'Purchase cost (₹)', type: 'number' },
  { k: 'size', label: 'Size / height (e.g. 3-4 ft)' },
  { k: 'description', label: 'Specification', type: 'textarea', full: true },
];

export default function Items() {
  const [rows, reload] = useApi('/items', []);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const list = rows.filter(r => (!cat || r.category === cat) && r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="head"><div><h1>Price List</h1><small>Plants, trees, soil, manure & services with rates</small></div>
        <button className="primary" onClick={() => setEdit({ category: 'Plant', unit: "No's", rate: 0 })}><Plus size={16} /> Add item</button></div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="row grow" style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--muted)' }} />
            <input placeholder="Search items…" style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} /></div>
          <select style={{ width: 180 }} value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Size</th><th className="num">Cost</th><th className="num">Rate</th><th className="num">Margin</th><th /></tr></thead>
          <tbody>{list.map(r => (
            <tr key={r._id}><td><b>{r.name}</b>{r.description && <small>{r.description.slice(0, 80)}</small>}</td><td><span className="badge">{r.category}</span></td><td>{r.unit}</td><td>{r.size}</td>
              <td className="num">{inr(r.costPrice)}</td><td className="num"><b>{inr(r.rate)}</b></td>
              <td className="num">{r.rate ? <span className={r.rate >= r.costPrice ? 'pos' : 'neg'}>{Math.round((r.rate - r.costPrice) / r.rate * 100)}%</span> : '—'}</td>
              <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setEdit(r)}><Pencil size={15} /></button>
                <button className="icon danger" onClick={async () => { if (confirm('Delete item?')) { await api('/items/' + r._id, { method: 'DELETE' }); reload(); } }}><Trash2 size={15} /></button></div></td></tr>
          ))}
            {!list.length && <tr><td colSpan={8} className="empty">No items yet. Add your plants and materials with rates.</td></tr>}</tbody>
        </table></div>
      </div>
      {edit && <FormModal title={edit._id ? 'Edit item' : 'Add item'} fields={fields} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/items/' + edit._id : '/items', { method: edit._id ? 'PUT' : 'POST', body: v }); reload(); }} />}
    </>
  );
}
