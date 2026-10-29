import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { useApi, FormModal, Badge } from './ui';
import { api, dt } from '../api';

export const STATUSES = ['quotation', 'active', 'completed', 'on-hold'];

export function projectFields(clients) {
  return [
    { k: 'name', label: 'Project name', required: true, full: true },
    { k: 'client', label: 'Client', options: (clients || []).map(c => ({ value: c._id, label: c.name + (c.company ? ' — ' + c.company : '') })) },
    { k: 'status', label: 'Status', options: STATUSES },
    { k: 'site', label: 'Site address', full: true },
    { k: 'startDate', label: 'Start date', type: 'date' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
}

export default function Projects() {
  const [rows, reload] = useApi('/projects', []);
  const [clients] = useApi('/clients', []);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const list = rows.filter(p => !filter || p.status === filter);
  return (
    <>
      <div className="head"><div><h1>Projects</h1><small>Every garden job — quotation → stage bills → payments</small></div>
        <button className="primary" onClick={() => setOpen(true)}><Plus size={16} /> New project</button></div>
      <div className="tabs" style={{ width: 'fit-content' }}>
        {['', ...STATUSES].map(s => <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s || 'All'}</button>)}
      </div>
      <div className="grid g3">
        {list.map(p => (
          <Link key={p._id} to={'/projects/' + p._id} className="card" style={{ display: 'grid', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b style={{ fontSize: 16 }}>{p.name}</b><Badge s={p.status} /></div>
            <small>{p.client?.name || 'No client'}</small>
            {p.site && <small className="row" style={{ gap: 4 }}><MapPin size={12} /> {p.site}</small>}
            <small>Created {dt(p.createdAt)}</small>
          </Link>
        ))}
      </div>
      {!list.length && <div className="card empty">No projects. Create the first one.</div>}
      {open && <FormModal title="New project" fields={projectFields(clients)} value={{ status: 'quotation' }} onClose={() => setOpen(false)}
        onSave={async v => { await api('/projects', { method: 'POST', body: { ...v, client: v.client || undefined } }); reload(); }} />}
    </>
  );
}
