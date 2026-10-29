import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '../api';

// Load data from an API path; returns [data, reload, error]
export function useApi(path, initial = null) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!path) return;
    api(path).then(setData).catch(e => setError(e.message));
  }, [path]);
  useEffect(load, [load]);
  return [data, load, error];
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="head" style={{ marginBottom: 16 }}><h2 style={{ margin: 0 }}>{title}</h2><button className="icon" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// Simple form builder: fields = [{ k, label, type, options, full }]
export function FormModal({ title, fields, value, onClose, onSave }) {
  const [v, setV] = useState(value || {});
  const [err, setErr] = useState('');
  const set = (k, x) => setV(s => ({ ...s, [k]: x }));
  const submit = async e => {
    e.preventDefault();
    try { await onSave(v); onClose(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {fields.map(f => (
          <label key={f.k} className={f.full ? 'full' : ''}>
            {f.label}
            {f.options ? (
              <select value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} required={f.required}>
                <option value="">Select…</option>
                {f.options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea rows={3} value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} />
            ) : (
              <input type={f.type || 'text'} step="any" required={f.required} value={f.type === 'date' ? (v[f.k] || '').slice(0, 10) : v[f.k] ?? ''}
                onChange={e => set(f.k, f.type === 'number' ? +e.target.value : e.target.value)} />
            )}
          </label>
        ))}
        {err && <div className="err full">{err}</div>}
        <div className="row full" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export const Badge = ({ s }) => <span className={'badge b-' + s}>{s}</span>;
export const Bar = ({ pct, warn }) => <div className={'bar' + (warn ? ' warn' : '')}><i style={{ width: Math.min(100, Math.max(0, pct || 0)) + '%' }} /></div>;
