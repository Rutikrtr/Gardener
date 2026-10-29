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
    try { await onSave(v); onClose(); toast('Saved'); } catch (x) { setErr(x.message); }
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
            ) : f.type === 'number' ? (
              <Num value={v[f.k]} onChange={n => set(f.k, n)} required={f.required} max={typeof f.max === 'function' ? f.max(v) : f.max} />
            ) : (
              <input type={f.type || 'text'} required={f.required} value={f.type === 'date' ? (v[f.k] || '').slice(0, 10) : v[f.k] ?? ''}
                onChange={e => set(f.k, e.target.value)} />
            )}
            {f.hint && f.hint(v) && <small>{f.hint(v)}</small>}
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

// Number input that keeps what the user types (no "010"): empty shows placeholder 0,
// text is selected on focus, and the parent always receives a number.
export function Num({ value, onChange, max, min = 0, ...props }) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    if ((parseFloat(text) || 0) !== (+value || 0)) setText(value ? String(value) : '');
  }, [value]);
  const change = e => {
    let t = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^0+(?=\d)/, '');
    let n = parseFloat(t) || 0;
    if (max !== undefined && n > max) { n = max; t = String(max); }
    if (n < min) { n = min; t = String(min); }
    setText(t); onChange(n);
  };
  return <input inputMode="decimal" placeholder="0" value={text} onChange={change} onFocus={e => e.target.select()} {...props} />;
}

// Small toast notifications: toast('Saved')
export function toast(msg, type = 'ok') { window.dispatchEvent(new CustomEvent('sg-toast', { detail: { msg, type } })); }
export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const on = e => {
      const t = { id: Math.random(), ...e.detail };
      setList(l => [...l, t]);
      setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), 2600);
    };
    window.addEventListener('sg-toast', on);
    return () => window.removeEventListener('sg-toast', on);
  }, []);
  return <div className="toasts">{list.map(t => <div key={t.id} className={'toast ' + t.type}>{t.type === 'ok' ? '✓' : '!'} {t.msg}</div>)}</div>;
}

const LABELS = { quotation: 'Quotation stage', active: 'Work in progress', completed: 'Completed', 'on-hold': 'On hold' };
export const Badge = ({ s }) => <span className={'badge b-' + s}>{LABELS[s] || s}</span>;
export const Bar = ({ pct, warn }) => <div className={'bar' + (warn ? ' warn' : '')}><i style={{ width: Math.min(100, Math.max(0, pct || 0)) + '%' }} /></div>;
