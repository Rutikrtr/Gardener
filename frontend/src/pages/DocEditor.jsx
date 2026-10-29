import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, Printer, Copy, Info } from 'lucide-react';
import { useApi, Num, toast } from './ui';
import { api, inr, isoDate, gstParts } from '../api';

// Section headings follow the client's BOQ format
const SECTIONS = ['A - SOIL SUPPLY', 'B - MANURE SUPPLY', 'C - TREES', 'D - PLANTS & SHRUBS', 'E - LAWN', 'F - IRRIGATION', 'G - SERVICES'];
const blank = () => ({ section: '', item: '', description: '', qty: 1, unit: '', rate: 0, remark: '' });
const itemId = l => l.item?._id || l.item || '';

export default function DocEditor() {
  const { pid, kind, id } = useParams();
  const nav = useNavigate();
  const isBill = kind === 'bill';
  const base = isBill ? '/bills' : '/quotations';
  const [items] = useApi('/items', []);
  // For bills: what is still left to bill per item from the approved quotation (this bill excluded)
  const [billable] = useApi(isBill ? `/projects/${pid}/billable${id ? '?excludeBill=' + id : ''}` : null, {});
  const [approved] = useApi(isBill ? `/quotations?project=${pid}&status=approved` : null, []);
  const [doc, setDoc] = useState({ date: isoDate(), title: '', gstEnabled: true, gstType: 'cgst_sgst', gstPercent: 18, discount: 0, lines: [blank()], terms: '', notes: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) api(`${base}/${id}`).then(d => setDoc({ ...d, date: isoDate(d.date), project: d.project?._id }));
    // New document: take GST defaults & terms from Settings
    else api('/auth/settings').then(s => setDoc(d => ({
      ...d, gstEnabled: s.gstEnabled ?? true, gstType: s.gstType || 'cgst_sgst', gstPercent: s.gstPercent ?? 18, terms: isBill ? '' : s.terms || '',
    })));
  }, [id]);

  // Rate/section/description of each item as written in the approved quotation
  const fromQuote = {};
  approved.forEach(q => q.lines.forEach(l => { if (l.item) fromQuote[itemId(l)] = l; }));
  const limited = isBill && Object.keys(billable).length > 0;
  // Bills with an approved quotation only offer the quoted items
  const choices = limited ? items.filter(it => billable[it._id]) : items;

  const set = (k, v) => setDoc(d => ({ ...d, [k]: v }));
  const setLine = (i, patch) => setDoc(d => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  // Max qty for a line = left to bill minus the same item on other lines of this bill
  const maxFor = i => {
    const l = doc.lines[i], b = billable[itemId(l)];
    if (!isBill || !b) return undefined;
    const others = doc.lines.reduce((s, x, j) => s + (j !== i && itemId(x) === itemId(l) ? +x.qty || 0 : 0), 0);
    return Math.max(0, b.left - others);
  };
  const pickItem = (i, id) => {
    const it = items.find(x => x._id === id);
    if (!it) return setLine(i, { item: '' });
    const q = fromQuote[id];
    const patch = { item: it._id, description: q?.description || it.name, unit: q?.unit || it.unit, rate: q?.rate ?? it.rate, section: q?.section || doc.lines[i].section || guessSection(it.category) };
    setDoc(d => {
      const lines = d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
      if (isBill && billable[id]) {
        const others = lines.reduce((s, x, j) => s + (j !== i && itemId(x) === id ? +x.qty || 0 : 0), 0);
        lines[i].qty = Math.min(+lines[i].qty || 0, Math.max(0, billable[id].left - others));
      }
      return { ...d, lines };
    });
  };
  // For a stage bill: pull every item still left to bill from the approved quotation
  const fillPending = () => {
    const lines = Object.entries(billable).filter(([, b]) => b.left > 0).map(([k, b]) => {
      const q = fromQuote[k] || {}, it = items.find(x => x._id === k) || {};
      return { ...blank(), item: k, section: q.section || '', description: q.description || it.name, unit: q.unit || it.unit, rate: q.rate ?? it.rate ?? 0, qty: b.left };
    });
    if (!lines.length) return toast('Everything in the approved quotation is already billed', 'err');
    set('lines', lines);
    toast(`${lines.length} items filled from the approved quotation`);
  };

  const sub = doc.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
  const gst = doc.gstEnabled ? sub * (+doc.gstPercent || 0) / 100 : 0;
  const total = sub + gst - (+doc.discount || 0);

  const save = async print => {
    setErr(''); setSaving(true);
    const body = { ...doc, lines: doc.lines.filter(l => l.description || l.item).map(l => ({ ...l, item: itemId(l) || undefined })) };
    try {
      const saved = id ? await api(`${base}/${id}`, { method: 'PUT', body }) : await api(`/projects/${pid}/${isBill ? 'bills' : 'quotations'}`, { method: 'POST', body });
      toast(`${isBill ? 'Bill' : 'Quotation'} ${saved.number} saved`);
      if (print) window.open(`/print/${kind}/${saved._id}`, '_blank');
      nav('/projects/' + pid, { state: { tab: isBill ? 'Stage Bills' : 'Quotations' } });
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <>
      <div className="head">
        <div className="row"><button className="icon" onClick={() => nav('/projects/' + pid)}><ArrowLeft size={18} /></button>
          <div><h1>{id ? 'Edit' : 'New'} {isBill ? 'stage bill' : 'quotation'}</h1><small>{doc.number || 'Number assigned on save'}{isBill && doc.stage ? ` · Stage ${doc.stage}` : ''}</small></div></div>
        <div className="row">
          {limited && <button onClick={fillPending}><Copy size={15} /> Fill remaining from quotation</button>}
          <button disabled={saving} onClick={() => save(true)}><Printer size={15} /> Save & print</button>
          <button className="primary" disabled={saving} onClick={() => save(false)}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {err && <div className="notice err-notice">{err}</div>}
      {isBill && (limited
        ? <div className="notice"><Info size={16} /> Billing against approved quotation <b>{approved.map(q => q.number).join(', ')}</b>. Quantities can't go over what's left in the quotation.</div>
        : <div className="notice warn"><Info size={16} /> No approved quotation for this project yet, so any item and quantity can be billed.</div>)}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.4fr 0.8fr' }}>
          <label>Title<input value={doc.title || ''} onChange={e => set('title', e.target.value)} placeholder={isBill ? 'e.g. Stage 1 – Soil & tree plantation' : 'e.g. Bill of quantities for softscape work'} /></label>
          <label>Date<input type="date" value={doc.date} onChange={e => set('date', e.target.value)} /></label>
          <label>GST
            <span className="row" style={{ height: 40 }}>
              <span className={'switch' + (doc.gstEnabled ? ' on' : '')} onClick={() => set('gstEnabled', !doc.gstEnabled)}><i /></span>
              <span>{doc.gstEnabled ? 'Enabled' : 'No GST'}</span>
            </span>
          </label>
          <label>GST type
            <select disabled={!doc.gstEnabled} value={doc.gstType} onChange={e => set('gstType', e.target.value)}>
              <option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option>
            </select>
          </label>
          <label>Rate %<Num disabled={!doc.gstEnabled} max={100} value={doc.gstPercent} onChange={n => set('gstPercent', n)} /></label>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="lines">
          <thead><tr><th style={{ width: 150 }}>Section</th><th style={{ minWidth: 200 }}>Item (price list)</th><th style={{ minWidth: 220 }}>Description</th><th style={{ width: 100 }}>Qty</th><th style={{ width: 80 }}>Unit</th><th style={{ width: 110 }}>Rate (₹)</th><th className="num" style={{ width: 110 }}>Amount</th><th>Remark</th><th /></tr></thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const b = isBill && billable[itemId(l)];
              const max = maxFor(i);
              return (
                <tr key={i}>
                  <td><select value={l.section || ''} onChange={e => setLine(i, { section: e.target.value })}><option value="">—</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td><select value={itemId(l)} onChange={e => pickItem(i, e.target.value)}>
                    <option value="">{limited ? 'Extra item (not in quotation)' : 'Custom line'}</option>
                    {choices.map(it => <option key={it._id} value={it._id}>{it.name}{limited ? ` — ${billable[it._id].left} left` : ''}</option>)}
                  </select>
                    {b && <small>Quoted {b.quoted} · already billed {b.billed} · <b className={max ? 'pos' : 'neg'}>max {max}</b></small>}</td>
                  <td><input value={l.description || ''} onChange={e => setLine(i, { description: e.target.value })} /></td>
                  <td><Num value={l.qty} max={max} onChange={n => setLine(i, { qty: n })} /></td>
                  <td><input value={l.unit || ''} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                  <td><Num value={l.rate} onChange={n => setLine(i, { rate: n })} /></td>
                  <td className="num"><b>{inr((+l.qty || 0) * (+l.rate || 0))}</b></td>
                  <td><input value={l.remark || ''} onChange={e => setLine(i, { remark: e.target.value })} /></td>
                  <td><button className="icon danger" onClick={() => set('lines', doc.lines.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <button onClick={() => set('lines', [...doc.lines, { ...blank(), section: doc.lines.at(-1)?.section || '' }])}><Plus size={15} /> Add line</button>
          <div className="totals">
            <div><span>Basic total</span><b>{inr(sub)}</b></div>
            {gstParts({ ...doc, gstAmount: gst }).map(([l, v]) => <div key={l}><span>{l}</span><b>{inr(v)}</b></div>)}
            <div><span>Discount (₹)</span><Num style={{ width: 120, textAlign: 'right' }} value={doc.discount} onChange={n => set('discount', n)} /></div>
            <div className="gt"><span>Grand total</span><span>{inr(total)}</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label>{isBill ? 'Notes' : 'Terms & conditions'}
          <textarea rows={4} value={(isBill ? doc.notes : doc.terms) || ''} onChange={e => set(isBill ? 'notes' : 'terms', e.target.value)}
            placeholder="The rate shall include the cost of all labour & materials (taxes, royalty, duty, site labour) with 1 year maintenance…" /></label>
      </div>
    </>
  );
}

function guessSection(cat) {
  return { Soil: SECTIONS[0], Manure: SECTIONS[1], Tree: SECTIONS[2], Plant: SECTIONS[3], Lawn: SECTIONS[4], Irrigation: SECTIONS[5], Service: SECTIONS[6] }[cat] || '';
}
