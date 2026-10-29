import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApi, FormModal } from './ui';
import { api } from '../api';

const fields = [
  { k: 'name', label: 'Contact name', required: true },
  { k: 'company', label: 'Company / builder' },
  { k: 'phone', label: 'Phone' },
  { k: 'email', label: 'Email', type: 'email' },
  { k: 'gstin', label: 'GSTIN' },
  { k: 'address', label: 'Address', type: 'textarea', full: true },
];

export default function Clients() {
  const [rows, reload] = useApi('/clients', []);
  const [edit, setEdit] = useState(null);
  return (
    <>
      <div className="head"><div><h1>Clients</h1><small>Builders, companies and individuals</small></div>
        <button className="primary" onClick={() => setEdit({})}><Plus size={16} /> Add client</button></div>
      <div className="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>GSTIN</th><th /></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r._id}><td><b>{r.name}</b><small>{r.address}</small></td><td>{r.company}</td><td>{r.phone}</td><td>{r.email}</td><td>{r.gstin}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setEdit(r)}><Pencil size={15} /></button>
              <button className="icon danger" onClick={async () => { if (confirm('Delete client?')) { await api('/clients/' + r._id, { method: 'DELETE' }); reload(); } }}><Trash2 size={15} /></button></div></td></tr>
        ))}
          {!rows.length && <tr><td colSpan={6} className="empty">No clients yet</td></tr>}</tbody>
      </table></div>
      {edit && <FormModal title={edit._id ? 'Edit client' : 'Add client'} fields={fields} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/clients/' + edit._id : '/clients', { method: edit._id ? 'PUT' : 'POST', body: v }); reload(); }} />}
    </>
  );
}
