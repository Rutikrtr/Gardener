import { useEffect, useState } from 'react';
import { Save, Upload, Leaf } from 'lucide-react';
import { api, dt } from '../api';
import { Num, toast } from './ui';

// Shrink the chosen image to max 320px so it stays small in the database
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/auth/settings').then(setS); }, []);
  if (!s) return <div className="empty">Loading…</div>;
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const save = async e => {
    e.preventDefault();
    try { await api('/auth/settings', { method: 'PUT', body: s }); toast('Settings saved'); window.dispatchEvent(new Event('sg-settings')); } catch (x) { toast(x.message, 'err'); }
  };
  const pickLogo = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { set('logo', await readLogo(f)); } catch (x) { toast(x.message, 'err'); }
  };
  const half = (s.gstPercent || 0) / 2;
  const input = (k, label, props = {}) => <label className={props.full ? 'full' : ''}>{label}<input value={s[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} full={undefined} /></label>;

  return (
    <form onSubmit={save}>
      <div className="head"><div><h1>Settings</h1><small>Company details for quotations & bills, and GST defaults</small></div>
        <button className="primary"><Save size={15} /> Save settings</button></div>

      <div className="grid g2">
        <div className="card">
          <h2>Company details</h2>
          <div className="row" style={{ marginBottom: 16, gap: 16 }}>
            <div className="logo-box">{s.logo ? <img src={s.logo} alt="logo" /> : <Leaf size={28} />}</div>
            <div className="grid" style={{ gap: 8 }}>
              <b>Company logo</b>
              <small>Shown on every quotation and bill. PNG or JPG.</small>
              <div className="row">
                <label className="btn" style={{ flexDirection: 'row', cursor: 'pointer' }}><Upload size={15} /> Upload logo
                  <input type="file" accept="image/*" hidden onChange={pickLogo} /></label>
                {s.logo && <button type="button" className="danger" onClick={() => set('logo', '')}>Remove</button>}
              </div>
            </div>
          </div>
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
                <label>GST rate %<Num value={s.gstPercent ?? 18} max={100} onChange={n => set('gstPercent', n)} /></label>
                <label>GST type
                  <select value={s.gstType || 'cgst_sgst'} onChange={e => set('gstType', e.target.value)}>
                    <option value="cgst_sgst">CGST + SGST (same state)</option>
                    <option value="igst">IGST (other state)</option>
                  </select>
                </label>
                <div className="full" style={{ background: 'var(--green-soft)', borderRadius: 10, padding: 12 }}>
                  {s.gstType === 'igst' ? <b>IGST {s.gstPercent}%</b> : <b>CGST {half}% + SGST {half}% = {s.gstPercent}%</b>}
                  <small>Used for items without their own GST rate. Each item has its own GST % in the Price List (e.g. plants 0%).</small>
                </div>
              </div>
            )}
            {!s.gstEnabled && <small style={{ marginTop: 10 }}>New quotations and bills will be created without GST.</small>}
          </div>
          <div className="card">
            <h2>TDS & labour</h2>
            <div className="form">
              <label>TDS customer deducts %<Num value={s.tdsPercent ?? 1} max={20} onChange={n => set('tdsPercent', n)} /></label>
              <label>Employer PF %<Num value={s.pfPercent ?? 12} max={30} onChange={n => set('pfPercent', n)} /></label>
              <label>Employer ESI %<Num value={s.esiPercent ?? 3.25} max={10} onChange={n => set('esiPercent', n)} /></label>
            </div>
            <small style={{ marginTop: 10 }}>TDS is pre-filled on new bills. PF / ESI are added to labour cost for workers who have them.</small>
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
