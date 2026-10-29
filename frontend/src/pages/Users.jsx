import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApi, FormModal, Badge } from './ui';
import { api, dt, getUser } from '../api';

export default function Users() {
  const [rows, reload, error] = useApi('/auth/users', []);
  const [edit, setEdit] = useState(null);
  if (getUser()?.role !== 'superadmin') return <div className="card empty">Only superadmin can manage users.</div>;
  const fields = [
    { k: 'name', label: 'Full name' },
    { k: 'username', label: 'Username', required: true },
    { k: 'password', label: edit?._id ? 'New password (leave blank to keep)' : 'Password', type: 'password', required: !edit?._id },
    { k: 'role', label: 'Role', options: ['user', 'superadmin'] },
  ];
  return (
    <>
      <div className="head"><div><h1>Users</h1><small>Create logins for staff and supervisors</small></div>
        <button className="primary" onClick={() => setEdit({ role: 'user' })}><Plus size={16} /> Add user</button></div>
      {error && <p className="err">{error}</p>}
      <div className="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead>
        <tbody>{rows.map(u => (
          <tr key={u._id}><td><b>{u.name}</b></td><td>{u.username}</td><td><Badge s={u.role === 'superadmin' ? 'completed' : 'active'} /> {u.role}</td>
            <td><button onClick={async () => { await api('/auth/users/' + u._id, { method: 'PUT', body: { active: !u.active } }); reload(); }}>{u.active ? 'Active' : 'Disabled'}</button></td>
            <td>{dt(u.createdAt)}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}><button className="icon" onClick={() => setEdit({ ...u, password: '' })}><Pencil size={15} /></button>
              <button className="icon danger" onClick={async () => { if (confirm('Delete user?')) { await api('/auth/users/' + u._id, { method: 'DELETE' }).catch(e => alert(e.message)); reload(); } }}><Trash2 size={15} /></button></div></td></tr>
        ))}</tbody>
      </table></div>
      {edit && <FormModal title={edit._id ? 'Edit user' : 'Add user'} fields={fields} value={edit} onClose={() => setEdit(null)}
        onSave={async v => { await api(edit._id ? '/auth/users/' + edit._id : '/auth/users', { method: edit._id ? 'PUT' : 'POST', body: v }); reload(); }} />}
    </>
  );
}
