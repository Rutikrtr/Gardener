import { useParams } from 'react-router-dom';
import { Printer, Leaf } from 'lucide-react';
import { useApi } from './ui';
import { inr, dt, gstParts, lineGst } from '../api';

// Decorative leafy branch for the header / footer (pure SVG, prints in colour)
function Foliage({ flip, className }) {
  return (
    <svg className={className} viewBox="0 0 260 120" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <path d="M10 110 C80 95 150 70 250 12" fill="none" stroke="#4f8a3a" strokeWidth="2.2" strokeLinecap="round" />
      {[[40, 100, -30], [75, 90, -40], [110, 78, -35], [145, 64, -45], [180, 48, -40], [212, 32, -50]].map(([x, y, r], i) => (
        <g key={i}>
          <path d="M0 0 C10 -18 30 -20 42 -14 C30 -4 14 2 0 0Z" fill={i % 2 ? '#7bc950' : '#3f9b2e'} opacity=".9" transform={`translate(${x} ${y}) rotate(${r})`} />
          <path d="M0 0 C10 18 30 20 42 14 C30 4 14 -2 0 0Z" fill={i % 2 ? '#3f9b2e' : '#9ad672'} opacity=".85" transform={`translate(${x + 6} ${y - 2}) rotate(${r + 70})`} />
        </g>
      ))}
      <circle cx="246" cy="14" r="5" fill="#e8b64c" />
    </svg>
  );
}

export default function PrintDoc() {
  const { kind, id } = useParams();
  const isBill = kind === 'bill';
  const [d] = useApi((isBill ? '/bills/' : '/quotations/') + id);
  const [s] = useApi('/auth/settings');
  if (!d || !s) return <div className="empty">Loading…</div>;
  const project = d.project;
  const isWO = !isBill && d.status === 'approved';
  const client = project?.client;

  // group lines by section, keeping order of first appearance
  const groups = [];
  d.lines.forEach(l => {
    let g = groups.find(x => x.section === (l.section || ''));
    if (!g) groups.push(g = { section: l.section || '', lines: [] });
    g.lines.push(l);
  });
  let sr = 0;

  return (
    <div className="print-bg">
      <div className="no-print print-bar">
        <button className="primary" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
      </div>
      <div className="print-page doc">
        <header className="doc-head">
          <Foliage className="doc-leaf" />
          <div className="doc-brand">
            <div className="doc-logo">{s.logo ? <img src={s.logo} alt="" /> : <Leaf size={34} />}</div>
            <div>
              <div className="doc-firm">{s.companyName}</div>
              {s.tagline && <div className="doc-tag">{s.tagline}</div>}
              <div className="doc-contact">
                {s.address && <span>{s.address}</span>}
                {(s.phone || s.email) && <span>{[s.phone, s.email].filter(Boolean).join('  ·  ')}</span>}
                {s.gstin && <span>GSTIN: <b>{s.gstin}</b></span>}
              </div>
            </div>
          </div>
          <div className="doc-type">
            <div className="doc-title">{isBill ? (d.gstEnabled ? 'TAX INVOICE' : 'INVOICE') : isWO ? 'WORK ORDER' : 'QUOTATION'}</div>
            {isBill && <div className="doc-stage">Running bill · Stage {d.stage}</div>}
            {!isBill && <div className="doc-stage">{isWO ? 'Final quotation' : d.revision ? `Revision ${d.revision}` : 'Original'}</div>}
            <table className="doc-meta"><tbody>
              <tr><td>No.</td><td><b>{d.number}</b></td></tr>
              <tr><td>Date</td><td><b>{dt(d.date)}</b></td></tr>
              {isWO && d.poNumber && <tr><td>Customer PO</td><td><b>{d.poNumber}</b></td></tr>}
              {isWO && d.poDate && <tr><td>PO date</td><td><b>{dt(d.poDate)}</b></td></tr>}
            </tbody></table>
          </div>
        </header>

        <section className="doc-parties">
          <div>
            <div className="doc-label">{isBill ? 'Bill to' : 'Quotation for'}</div>
            <b>{client?.name || '—'}</b>
            {client?.company && <div>{client.company}</div>}
            {client?.address && <div className="muted">{client.address}</div>}
            {client?.gstin && <div className="muted">GSTIN: {client.gstin}</div>}
          </div>
          <div>
            <div className="doc-label">Project / site</div>
            <b>{project?.name}</b>
            {project?.site && <div className="muted">{project.site}</div>}
          </div>
        </section>

        {d.title && <div className="doc-subject">{d.title}</div>}

        <table className="doc-table">
          <thead><tr><th style={{ width: 46 }}>Sr.</th><th>Description</th><th className="num">Qty</th><th>Unit</th><th className="num">Rate</th>{d.gstEnabled && <th className="num">GST</th>}<th className="num">Amount</th><th>Remark</th></tr></thead>
          <tbody>
            {groups.map((g, gi) => [
              g.section && <tr key={'s' + gi} className="sec"><td colSpan={d.gstEnabled ? 8 : 7}><Leaf size={12} /> {g.section}</td></tr>,
              ...g.lines.map((l, i) => (
                <tr key={gi + '-' + i}><td>{++sr}</td><td>{l.description}{l.extra && <div className="muted" style={{ fontSize: 11 }}>Extra beyond work order</div>}</td><td className="num">{l.qty}</td><td>{l.unit}</td>
                  <td className="num">{inr(l.rate)}</td>{d.gstEnabled && <td className="num">{lineGst(l, d)}%</td>}<td className="num">{inr(l.amount)}</td><td>{l.remark}</td></tr>
              )),
            ])}
          </tbody>
        </table>

        <div className="doc-bottom">
          <div className="doc-words">
            {(d.terms || d.notes) && <><div className="doc-label">{isBill ? 'Notes' : 'Terms & conditions'}</div><div style={{ whiteSpace: 'pre-wrap' }}>{d.terms || d.notes}</div></>}
          </div>
          <table className="doc-sum"><tbody>
            <tr><td>Taxable amount</td><td className="num">{inr(d.subTotal)}</td></tr>
            {gstParts(d).map(([l, v]) => <tr key={l}><td>{l}</td><td className="num">{inr(v)}</td></tr>)}
            {!d.gstEnabled && <tr><td>GST</td><td className="num">Not applicable</td></tr>}
            <tr className="gt"><td>Grand total</td><td className="num">{inr(d.grandTotal)}</td></tr>
          </tbody></table>
        </div>

        <div className="doc-sign">
          <div>Client signature</div>
          <div>For <b>{s.companyName}</b><br /><span className="muted">Authorised signatory</span></div>
        </div>

        <footer className="doc-foot">
          <Foliage className="doc-foot-leaf" flip />
          <span>Thank you for growing with us 🌿</span>
          <Foliage className="doc-foot-leaf" />
        </footer>
      </div>
    </div>
  );
}
