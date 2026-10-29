import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, Printer, Copy, Info, AlertTriangle } from 'lucide-react';
import { useApi, Num, toast } from './ui';
import { api, inr, isoDate, gstParts, docTotals, lineGst } from '../api';

// Section headings follow the client's BOQ format
const SECTIONS = ['A - SOIL SUPPLY', 'B - MANURE SUPPLY', 'C - TREES', 'D - PLANTS & SHRUBS', 'E - LAWN', 'F - IRRIGATION', 'G - SERVICES'];
const blank = () => ({ section: '', item: '', description: '', qty: 1, unit: '', rate: 0, gstPercent: 0, extra: false, remark: '' });
const itemId = l => l.item?._id || l.item || '';

export default function DocEditor() {
  const { pid, kind, id } = useParams();
  const nav = useNavigate();
  const isBill = kind === 'bill';
  const base = isBill ? '/bills' : '/quotations';
  const [itemsRaw] = useApi('/items');
  const items = itemsRaw || [];
  // For bills: what is still left to bill per item from the work order (this bill excluded)
  const [billableRaw] = useApi(isBill ? `/projects/${pid}/billable${id ? '?excludeBill=' + id : ''}` : null);
  const [approvedRaw] = useApi(isBill ? `/quotations?project=${pid}&status=approved` : null);
  const billable = billableRaw || {}, approved = approvedRaw || [];
  const [docReady, setDocReady] = useState(false);
  const [doc, setDoc] = useState({ date: isoDate(), title: '', gstEnabled: true, gstType: 'cgst_sgst', gstPercent: 18, tdsPercent: 0, lines: [blank()], terms: '', notes: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) api(`${base}/${id}`).then(d => { setDoc({ ...d, date: isoDate(d.date), project: d.project?._id, lines: d.lines.map(l => ({ ...l, gstPercent: lineGst(l, d) })) }); setDocReady(true); });
    // New document: GST / TDS defaults & terms from Settings
    else api('/auth/settings').then(s => setDoc(d => ({
      ...d, gstEnabled: s.gstEnabled ?? true, gstType: s.gstType || 'cgst_sgst', gstPercent: s.gstPercent ?? 18,
      tdsPercent: isBill ? s.tdsPercent ?? 0 : 0, terms: isBill ? '' : s.terms || '',
    }))).finally(() => setDocReady(true));
  }, [id]);

  const wo = approved[0];
  const fromWO = {};
  (wo?.lines || []).forEach(l => { if (l.item) fromWO[itemId(l)] = l; });
  const limited = isBill && Object.keys(billable).length > 0;
  const choices = limited ? [...items.filter(it => billable[it._id]), ...items.filter(it => !billable[it._id])] : items;

  const set = (k, v) => setDoc(d => ({ ...d, [k]: v }));
  const setLine = (i, patch) => setDoc(d => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  // Left in the work order for a normal line = left to bill − same item on other normal lines of this bill
  const maxFor = (i, lines = doc.lines) => {
    const l = lines[i], b = billable[itemId(l)];
    if (!isBill || !b || l.extra) return undefined;
    const others = lines.reduce((s, x, j) => s + (j !== i && !x.extra && itemId(x) === itemId(l) ? +x.qty || 0 : 0), 0);
    return Math.max(0, b.left - others);
  };
  // Typing more than the work order allows: keep the allowed qty here and put the rest on an "Extra" line below
  const setQty = (i, n) => setDoc(d => {
    const lines = d.lines.map(l => ({ ...l }));
    const max = maxFor(i, lines);
    if (max !== undefined && n > max) {
      lines[i].qty = max;
      const extraQty = +(n - max).toFixed(3);
      const next = lines[i + 1];
      if (next && next.extra && itemId(next) === itemId(lines[i])) next.qty = extraQty;
      else lines.splice(i + 1, 0, { ...lines[i], _id: undefined, qty: extraQty, extra: true, remark: 'Extra beyond work order' });
      toast(`${extraQty} ${lines[i].unit || ''} added as extra work beyond the work order`);
    } else lines[i].qty = n;
    return { ...d, lines };
  });
  const pickItem = (i, iid) => {
    const it = items.find(x => x._id === iid);
    if (!it) return setLine(i, { item: '' });
    const q = fromWO[iid];
    setLine(i, {
      item: it._id, description: q?.description || it.name, unit: q?.unit || it.unit, rate: q?.rate ?? it.rate,
      gstPercent: q ? lineGst(q, wo) : it.gstPercent ?? 0, section: q?.section || doc.lines[i].section || guessSection(it.category),
    });
  };
  const fillPending = () => {
    const lines = Object.entries(billable).filter(([, b]) => b.left > 0).map(([k, b]) => {
      const q = fromWO[k] || {}, it = items.find(x => x._id === k) || {};
      return { ...blank(), item: k, section: q.section || '', description: q.description || it.name, unit: q.unit || it.unit, rate: q.rate ?? it.rate ?? 0, gstPercent: q.item ? lineGst(q, wo) : it.gstPercent ?? 0, qty: b.left };
    });
    if (!lines.length) return toast('Everything in the work order is already billed', 'err');
    set('lines', lines);
    toast(`${lines.length} items filled from the work order`);
  };

  const t = docTotals(doc);

  const save = async print => {
    setErr(''); setSaving(true);
    const body = { ...doc, lines: doc.lines.filter(l => l.description || l.item).map(l => ({ ...l, item: itemId(l) || undefined })) };
    try {
      const saved = id ? await api(`${base}/${id}`, { method: 'PUT', body }) : await api(`/projects/${pid}/${isBill ? 'bills' : 'quotations'}`, { method: 'POST', body });
      toast(`${isBill ? 'Bill' : 'Quotation'} ${saved.number} saved`);
      if (print) window.open(`/print/${kind}/${saved._id}`, '_blank');
      nav('/projects/' + pid, { state: { tab: isBill ? 'bills' : 'quotes' } });
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  // Wait until everything is loaded so values don't jump around on screen
  const ready = docReady && itemsRaw && (!isBill || (billableRaw && approvedRaw));
  if (!ready) return <EditorSkeleton title={`${id ? 'Edit' : 'New'} ${isBill ? 'stage bill' : 'quotation'}`} back={() => nav('/projects/' + pid)} />;

  const extraTotal = doc.lines.filter(l => l.extra).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);

  return (
    <>
      <div className="head">
        <div className="row"><button className="icon" onClick={() => nav('/projects/' + pid)}><ArrowLeft size={18} /></button>
          <div><h1>{id ? 'Edit' : 'New'} {isBill ? 'stage bill' : 'quotation'}</h1>
            <small>{doc.number || 'Number assigned on save'}{isBill && doc.stage ? ` · Stage ${doc.stage}` : ''}{!isBill && doc.revision ? ` · Revision ${doc.revision}` : ''}</small></div></div>
        <div className="row">
          {limited && <button onClick={fillPending}><Copy size={15} /> Fill remaining from work order</button>}
          <button disabled={saving} onClick={() => save(true)}><Printer size={15} /> Save & print</button>
          <button className="primary" disabled={saving} onClick={() => save(false)}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {err && <div className="notice err-notice">{err}</div>}
      {isBill && (limited
        ? <div className="notice"><Info size={16} /> Billing against work order <b>{wo?.number}</b>. If a quantity goes over the work order, the extra is put on its own line marked <b>Extra</b>.</div>
        : <div className="notice warn"><Info size={16} /> No work order for this project yet, so any item and quantity can be billed.</div>)}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form" style={{ gridTemplateColumns: isBill ? '2fr 1fr 1fr 1.3fr 1fr' : '2fr 1fr 1fr 1.3fr' }}>
          <label>Title<input value={doc.title || ''} onChange={e => set('title', e.target.value)} placeholder={isBill ? 'e.g. Stage 1 – Soil & tree plantation' : 'e.g. Bill of quantities for softscape work'} /></label>
          <label>Date<input type="date" value={doc.date} onChange={e => set('date', e.target.value)} /></label>
          <label>GST
            <span className="row" style={{ height: 40 }}>
              <span className={'switch' + (doc.gstEnabled ? ' on' : '')} onClick={() => set('gstEnabled', !doc.gstEnabled)}><i /></span>
              <span>{doc.gstEnabled ? 'On' : 'Off'}</span>
            </span>
          </label>
          <label>GST type
            <select disabled={!doc.gstEnabled} value={doc.gstType} onChange={e => set('gstType', e.target.value)}>
              <option value="cgst_sgst">CGST + SGST (same state)</option><option value="igst">IGST (other state)</option>
            </select>
          </label>
          {isBill && <label>TDS by customer %<Num value={doc.tdsPercent} max={20} onChange={n => set('tdsPercent', n)} /></label>}
        </div>
      </div>

      <div className="card table-wrap">
        <table className="lines">
          <thead><tr><th style={{ width: 140 }}>Section</th><th style={{ minWidth: 190 }}>Item (price list)</th><th style={{ minWidth: 200 }}>Description</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 70 }}>Unit</th><th style={{ width: 100 }}>Rate (₹)</th><th style={{ width: 80 }}>GST %</th><th className="num" style={{ width: 110 }}>Amount</th><th>Remark</th><th /></tr></thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const b = isBill && billable[itemId(l)];
              const max = maxFor(i);
              return (
                <tr key={i} className={l.extra ? 'extra-row' : ''}>
                  <td><select value={l.section || ''} onChange={e => setLine(i, { section: e.target.value })}><option value="">—</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td><select value={itemId(l)} onChange={e => pickItem(i, e.target.value)}>
                    <option value="">Custom line</option>
                    {choices.map(it => <option key={it._id} value={it._id}>{it.name}{limited && billable[it._id] ? ` — ${billable[it._id].left} left` : ''}</option>)}
                  </select>
                    {l.extra && <small className="tag-extra"><AlertTriangle size={12} /> Extra beyond work order</small>}
                    {b && !l.extra && <small>Work order {b.quoted} · billed {b.billed} · <b className={max ? 'pos' : 'neg'}>{max} left</b></small>}</td>
                  <td><input value={l.description || ''} onChange={e => setLine(i, { description: e.target.value })} /></td>
                  <td><Num value={l.qty} onChange={n => setQty(i, n)} /></td>
                  <td><input value={l.unit || ''} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                  <td><Num value={l.rate} onChange={n => setLine(i, { rate: n })} /></td>
                  <td><Num value={l.gstPercent} max={100} disabled={!doc.gstEnabled} onChange={n => setLine(i, { gstPercent: n })} /></td>
                  <td className="num"><b>{inr((+l.qty || 0) * (+l.rate || 0))}</b></td>
                  <td><input value={l.remark || ''} onChange={e => setLine(i, { remark: e.target.value })} /></td>
                  <td><button className="icon danger" onClick={() => set('lines', doc.lines.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <div className="grid" style={{ gap: 8 }}>
            <button onClick={() => set('lines', [...doc.lines, { ...blank(), section: doc.lines.at(-1)?.section || '' }])}><Plus size={15} /> Add line</button>
            <small>GST % comes from the Price List for each item (plants 0%). You can change it per line.</small>
          </div>
          <div className="totals">
            <div><span>Taxable amount</span><b>{inr(t.sub)}</b></div>
            {extraTotal > 0 && <div><span className="tag-extra" style={{ margin: 0 }}>incl. extra work</span><b>{inr(extraTotal)}</b></div>}
            {gstParts(doc).map(([lb, v]) => <div key={lb}><span>{lb}</span><b>{inr(v)}</b></div>)}
            {doc.gstEnabled && !gstParts(doc).length && <div><span>GST</span><small>0% on all items</small></div>}
            <div className="gt"><span>Grand total</span><span>{inr(t.total)}</span></div>
            {isBill && doc.tdsPercent > 0 && <>
              <div><span>TDS by customer ({doc.tdsPercent}%)</span><b className="neg">− {inr(t.tds)}</b></div>
              <div><span><b>You will receive</b></span><b className="pos">{inr(t.net)}</b></div>
            </>}
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

function EditorSkeleton({ title, back }) {
  return (
    <>
      <div className="head"><div className="row"><button className="icon" onClick={back}><ArrowLeft size={18} /></button><div><h1>{title}</h1><small>Loading…</small></div></div></div>
      <div className="card" style={{ marginBottom: 16 }}><div className="row" style={{ gap: 14 }}>{[2, 1, 1, 1.3].map((f, i) => <div key={i} className="skel" style={{ flex: f, height: 58 }} />)}</div></div>
      <div className="card" style={{ display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 38 }} />)}</div>
    </>
  );
}
