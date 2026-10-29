import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApi } from './ui';
import { inr, dt, gstParts } from '../api';

export default function PrintDoc() {
  const { kind, id } = useParams();
  const isBill = kind === 'bill';
  const [d] = useApi((isBill ? '/bills/' : '/quotations/') + id);
  const [s] = useApi('/auth/settings');
  if (!d || !s) return <div className="empty">Loading…</div>;
  const project = d.project;
  const COMPANY = { name: s.companyName, tagline: s.tagline, address: s.address, phone: s.phone, email: s.email, gstin: s.gstin };

  // group lines by section, keeping order of first appearance
  const groups = [];
  d.lines.forEach(l => {
    let g = groups.find(x => x.section === (l.section || ''));
    if (!g) groups.push(g = { section: l.section || '', lines: [] });
    g.lines.push(l);
  });
  let sr = 0;
  const client = project?.client;

  return (
    <div style={{ background: '#e9ede7', minHeight: '100vh', padding: '24px 0' }}>
      <div className="no-print" style={{ maxWidth: 900, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="primary" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
      </div>
      <div className="print-page">
        <div className="print-head">
          <div>
            <h1 style={{ color: 'var(--green)' }}>{COMPANY.name}</h1>
            <small style={{ fontStyle: 'italic' }}>{COMPANY.tagline}</small>
            <small>{COMPANY.address}</small>
            <small>{[COMPANY.phone, COMPANY.email].filter(Boolean).join(' · ')}</small>
            {COMPANY.gstin && <small>GSTIN: <b>{COMPANY.gstin}</b></small>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: 22 }}>{isBill ? `RUNNING BILL – STAGE ${d.stage}` : 'QUOTATION'}</h1>
            <small>No. <b>{d.number}</b></small>
            <small>Date: <b>{dt(d.date)}</b></small>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 24 }}>
          <div><small>To</small><b>{client?.name}</b>{client?.company && <div>{client.company}</div>}<small>{client?.address}</small>{client?.gstin && <small>GSTIN: {client.gstin}</small>}</div>
          <div style={{ textAlign: 'right' }}><small>Project / Site</small><b>{project?.name}</b><small>{project?.site}</small></div>
        </div>
        {d.title && <h2 style={{ textAlign: 'center', textTransform: 'uppercase' }}>{d.title}</h2>}
        <table>
          <thead><tr><th>Sr.No.</th><th>Description</th><th className="num">QTY</th><th>UNIT</th><th className="num">RATE</th><th className="num">AMOUNT</th><th>REMARK</th></tr></thead>
          <tbody>
            {groups.map((g, gi) => [
              g.section && <tr key={'s' + gi} className="sec"><td colSpan={7}>{g.section}</td></tr>,
              ...g.lines.map((l, i) => (
                <tr key={gi + '-' + i}><td>{++sr}</td><td>{l.description}</td><td className="num">{l.qty}</td><td>{l.unit}</td>
                  <td className="num">{inr(l.rate)}</td><td className="num">{inr(l.amount)}</td><td>{l.remark}</td></tr>
              )),
            ])}
            <tr><td colSpan={5} className="num"><b>Basic Total Amount</b></td><td className="num"><b>{inr(d.subTotal)}</b></td><td /></tr>
            {gstParts(d).map(([l, v]) => <tr key={l}><td colSpan={5} className="num">{l}</td><td className="num">{inr(v)}</td><td /></tr>)}
            {d.discount > 0 && <tr><td colSpan={5} className="num">Discount</td><td className="num">− {inr(d.discount)}</td><td /></tr>}
            <tr><td colSpan={5} className="num"><b>Grand Total Amount</b></td><td className="num"><b>{inr(d.grandTotal)}</b></td><td /></tr>
          </tbody>
        </table>
        {(d.terms || d.notes) && <div style={{ marginTop: 18, whiteSpace: 'pre-wrap', fontSize: 12 }}><b>{isBill ? 'Notes' : 'Terms & Conditions'}</b><br />{d.terms || d.notes}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 60 }}>
          <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #999', width: 200, paddingTop: 6 }}>For {COMPANY.name}</div></div>
        </div>
      </div>
    </div>
  );
}
