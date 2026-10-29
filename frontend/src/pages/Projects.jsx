import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { useApi, FormModal, Badge } from './ui';
import { api, dt } from '../api';

export const STATUSES = ['quotation', 'active', 'completed', 'on-hold'];
// Plain-language meaning of each project status
export const STATUS_INFO = {
  quotation: ['Quotation stage', 'Quotation made, waiting for client approval'],
  active: ['Work in progress', 'Quotation approved — billing & planting going on'],
  completed: ['Completed', 'Work finished'],
  'on-hold': ['On hold', 'Paused for now'],
};

export function projectFields(clients) {
  return [
    { k: 'name', label: 'Project name', required: true, full: true },
    { k: 'client', label: 'Client', options: (clients || []).map(c => ({ value: c._id, label: c.name + (c.company ? ' — ' + c.company : '') })) },
    { k: 'status', label: 'Status', options: STATUSES.map(s => ({ value: s, label: STATUS_INFO[s][0] })) },
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
        {['', ...STATUSES].map(s => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {s ? STATUS_INFO[s][0] : 'All'} <span className="count">{s ? rows.filter(p => p.status === s).length : rows.length}</span>
          </button>
        ))}
      </div>
      <small style={{ marginBottom: 16 }}>{filter ? STATUS_INFO[filter][1] : 'Status updates automatically: approving a quotation moves the project to Work in progress.'}</small>
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
      {!list.length && <div className="card empty">{filter ? `No projects in "${STATUS_INFO[filter][0]}".` : 'No projects yet. Click "New project" to create the first one.'}</div>}
      {open && <FormModal title="New project" fields={projectFields(clients)} value={{ status: 'quotation' }} onClose={() => setOpen(false)}
        onSave={async v => { await api('/projects', { method: 'POST', body: { ...v, client: v.client || undefined } }); reload(); }} />}
    </>
  );
}
