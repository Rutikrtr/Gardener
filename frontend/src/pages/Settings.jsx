import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, dt } from '../api';

export default function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/auth/settings').then(setS); }, []);
  if (!s) return <div className="empty">Loading…</div>;
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const save = async e => {
    e.preventDefault();
    try { await api('/auth/settings', { method: 'PUT', body: s }); setMsg('Settings saved'); } catch (x) { setMsg(x.message); }
    setTimeout(() => setMsg(''), 2500);
  };
  const half = (s.gstPercent || 0) / 2;
  const input = (k, label, props = {}) => <label className={props.full ? 'full' : ''}>{label}<input value={s[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} full={undefined} /></label>;

  return (
    <form onSubmit={save}>
      <div className="head"><div><h1>Settings</h1><small>Company details for quotations & bills, and GST defaults</small></div>
        <div className="row">{msg && <span className="pos">{msg}</span>}<button className="primary"><Save size={15} /> Save settings</button></div></div>

      <div className="grid g2">
        <div className="card">
          <h2>Company details</h2>
          <div className="form">
            {input('companyName', 'Company name', { full: true })}
            {input('tagline', 'Tagline', { full: true, placeholder: 'Making Gardening Easy' })}
            <label className="full">Address<textarea rows={2} value={s.address || ''} onChange={e => set('address', e.target.value)} /></label>
            {input('phone', 'Phone')}
            {input('email', 'Email', { type: 'email' })}
            {input('gstin', 'Your GSTIN', { full: true, placeholder: '27XXXXX0000X1ZX' })}
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>GST</h2>
            <label className="row" style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)' }}>
              <span>Add GST on quotations & bills</span>
              <span className={'switch' + (s.gstEnabled ? ' on' : '')} onClick={() => set('gstEnabled', !s.gstEnabled)}><i /></span>
            </label>
            {s.gstEnabled && (
              <div className="form" style={{ marginTop: 14 }}>
                <label>GST rate %<input type="number" step="any" value={s.gstPercent ?? 18} onChange={e => set('gstPercent', +e.target.value)} /></label>
                <label>GST type
                  <select value={s.gstType || 'cgst_sgst'} onChange={e => set('gstType', e.target.value)}>
                    <option value="cgst_sgst">CGST + SGST (same state)</option>
                    <option value="igst">IGST (other state)</option>
                  </select>
                </label>
                <div className="full" style={{ background: 'var(--green-soft)', borderRadius: 10, padding: 12 }}>
                  {s.gstType === 'igst' ? <b>IGST {s.gstPercent}%</b> : <b>CGST {half}% + SGST {half}% = {s.gstPercent}%</b>}
                  <small>Default for new documents. You can still change it on each quotation or bill.</small>
                </div>
              </div>
            )}
            {!s.gstEnabled && <small style={{ marginTop: 10 }}>New quotations and bills will be created without GST.</small>}
          </div>
          <div className="card">
            <h2>Default quotation terms</h2>
            <textarea rows={4} value={s.terms || ''} onChange={e => set('terms', e.target.value)} placeholder="The rate shall include the cost of all labour & materials… with 1 year maintenance" />
          </div>
          <div className="card kpi dark">
            <div className="label">Your plan</div>
            <div className="val">{s.plan?.name || '—'}</div>
            <small style={{ color: '#a9bba9' }}>{s.plan?.endDate ? 'Valid till ' + dt(s.plan.endDate) : 'No expiry'}</small>
          </div>
        </div>
      </div>
    </form>
  );
}
