import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, Printer, Copy } from 'lucide-react';
import { useApi } from './ui';
import { api, inr, isoDate } from '../api';

// Section headings follow the client's BOQ format
const SECTIONS = ['A - SOIL SUPPLY', 'B - MANURE SUPPLY', 'C - TREES', 'D - PLANTS & SHRUBS', 'E - LAWN', 'F - IRRIGATION', 'G - SERVICES'];
const blank = () => ({ section: '', item: '', description: '', qty: 1, unit: '', rate: 0, remark: '' });

export default function DocEditor() {
  const { pid, kind, id } = useParams();
  const nav = useNavigate();
  const isBill = kind === 'bill';
  const base = isBill ? '/bills' : '/quotations';
  const [items] = useApi('/items', []);
  const [ledger] = useApi(isBill ? `/projects/${pid}/ledger` : null, []);
  const [doc, setDoc] = useState({ date: isoDate(), title: '', gstPercent: 18, discount: 0, lines: [blank()], terms: '', notes: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (id) api(`${base}/${id}`).then(d => setDoc({ ...d, date: isoDate(d.date), project: d.project?._id }));
  }, [id]);

  const set = (k, v) => setDoc(d => ({ ...d, [k]: v }));
  const setLine = (i, patch) => setDoc(d => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const pickItem = (i, itemId) => {
    const it = items.find(x => x._id === itemId);
    setLine(i, it ? { item: it._id, description: it.name, unit: it.unit, rate: it.rate, section: doc.lines[i].section || guessSection(it.category) } : { item: '' });
  };
  // For a stage bill: pull every item still pending to bill from the approved quotation
  const fillPending = async () => {
    const qs = await api(`/quotations?project=${pid}&status=approved`);
    const rateOf = {};
    qs.forEach(q => q.lines.forEach(l => { if (l.item) rateOf[l.item] = { rate: l.rate, section: l.section, description: l.description }; }));
    const lines = ledger.filter(l => l.pendingToBill > 0).map(l => ({ ...blank(), item: l.item._id, unit: l.item.unit, qty: l.pendingToBill, ...rateOf[l.item._id] }));
    if (!lines.length) return alert('Nothing pending from approved quotation');
    set('lines', lines);
  };

  const sub = doc.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
  const gst = sub * (+doc.gstPercent || 0) / 100;
  const total = sub + gst - (+doc.discount || 0);

  const save = async print => {
    setErr('');
    const body = { ...doc, lines: doc.lines.filter(l => l.description || l.item).map(l => ({ ...l, item: l.item || undefined })) };
    try {
      const saved = id ? await api(`${base}/${id}`, { method: 'PUT', body }) : await api(`/projects/${pid}/${isBill ? 'bills' : 'quotations'}`, { method: 'POST', body });
      if (print) window.open(`/print/${kind}/${saved._id}`, '_blank');
      nav('/projects/' + pid);
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <div className="head">
        <div className="row"><button className="icon" onClick={() => nav('/projects/' + pid)}><ArrowLeft size={18} /></button>
          <div><h1>{id ? 'Edit' : 'New'} {isBill ? 'stage bill' : 'quotation'}</h1><small>{doc.number || 'Number assigned on save'}{isBill && doc.stage ? ` · Stage ${doc.stage}` : ''}</small></div></div>
        <div className="row">
          {isBill && <button onClick={fillPending}><Copy size={15} /> Fill pending from quotation</button>}
          <button onClick={() => save(true)}><Printer size={15} /> Save & print</button>
          <button className="primary" onClick={() => save(false)}><Save size={15} /> Save</button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <label style={{ gridColumn: 'span 2' }}>Title<input value={doc.title || ''} onChange={e => set('title', e.target.value)} placeholder={isBill ? 'e.g. Stage 1 – Soil & tree plantation' : 'e.g. Bill of quantities for softscape work'} /></label>
          <label>Date<input type="date" value={doc.date} onChange={e => set('date', e.target.value)} /></label>
          <label>GST %<input type="number" value={doc.gstPercent} onChange={e => set('gstPercent', +e.target.value)} /></label>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="lines">
          <thead><tr><th style={{ width: 150 }}>Section</th><th style={{ minWidth: 200 }}>Item (price list)</th><th style={{ minWidth: 220 }}>Description</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 80 }}>Unit</th><th style={{ width: 110 }}>Rate</th><th className="num" style={{ width: 110 }}>Amount</th><th>Remark</th><th /></tr></thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const stock = isBill && ledger.find(x => x.item._id === l.item);
              return (
                <tr key={i}>
                  <td><select value={l.section || ''} onChange={e => setLine(i, { section: e.target.value })}><option value="">—</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td><select value={l.item?._id || l.item || ''} onChange={e => pickItem(i, e.target.value)}><option value="">Custom line</option>{items.map(it => <option key={it._id} value={it._id}>{it.name}</option>)}</select>
                    {stock && <small>Quoted {stock.quoted} · billed {stock.billed} · in hand {stock.inHand}</small>}</td>
                  <td><input value={l.description || ''} onChange={e => setLine(i, { description: e.target.value })} /></td>
                  <td><input type="number" step="any" value={l.qty} onChange={e => setLine(i, { qty: +e.target.value })} /></td>
                  <td><input value={l.unit || ''} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                  <td><input type="number" step="any" value={l.rate} onChange={e => setLine(i, { rate: +e.target.value })} /></td>
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
            <div><span>GST {doc.gstPercent}%</span><b>{inr(gst)}</b></div>
            <div><span>Discount</span><input type="number" style={{ width: 120, textAlign: 'right' }} value={doc.discount} onChange={e => set('discount', +e.target.value)} /></div>
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
