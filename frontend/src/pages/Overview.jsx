import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Receipt, Wallet, Flag, ArrowRight, Sprout, MapPin, User, Phone, Calendar } from 'lucide-react';
import { Bar } from './ui';
import { inr, dt } from '../api';

// Simple, plain-language summary of one project
export default function Overview({ p, sum, quotes, bills, pays, usage, ledger, go }) {
  const approved = quotes.filter(q => q.status === 'approved');
  const billed = sum?.billed || 0, quoted = sum?.quoted || 0, received = sum?.received || 0;
  const fullyBilled = quoted > 0 && billed >= quoted;
  const fullyPaid = billed > 0 && received >= billed;

  const steps = [
    { label: 'Quotation', icon: FileText, done: quotes.length > 0, note: quotes.length ? `${quotes.length} made` : 'Not yet' },
    { label: 'Approved', icon: CheckCircle2, done: approved.length > 0, note: approved.length ? approved[0].number : 'Waiting' },
    { label: 'Billing', icon: Receipt, done: fullyBilled, active: bills.length > 0 && !fullyBilled, note: bills.length ? `${bills.length} stage bill${bills.length > 1 ? 's' : ''}` : 'Not started' },
    { label: 'Payment', icon: Wallet, done: fullyPaid && fullyBilled, active: pays.length > 0 && !(fullyPaid && fullyBilled), note: billed ? `${Math.round(received / billed * 100)}% received` : '—' },
    { label: 'Completed', icon: Flag, done: p.status === 'completed', note: p.status === 'completed' ? 'Done' : '' },
  ];
  const current = steps.findIndex(s => !s.done);

  // What should the user do next?
  const next =
    !quotes.length ? { text: 'Start by making a quotation for this site.', btn: 'Create quotation', to: `/projects/${p._id}/quotation/new` }
    : !approved.length ? { text: 'Quotation is ready. Once the client agrees, mark it Approved.', btn: 'Go to quotations', tab: 'Quotations' }
    : !fullyBilled ? { text: `Approved quotation ${approved[0].number} — ${inr(sum?.toBill)} is still left to bill.`, btn: bills.length ? 'Create next stage bill' : 'Create first stage bill', to: `/projects/${p._id}/bill/new` }
    : !fullyPaid ? { text: `All work is billed. ${inr(billed - received)} payment is still due from the client.`, btn: 'Add payment', tab: 'Payments' }
    : p.status !== 'completed' ? { text: 'Everything is billed and paid. You can mark this project completed.', btn: 'Edit project', tab: 'edit' }
    : { text: 'This project is complete. 🎉', btn: null };

  // Plant totals across all items
  const tot = ledger.reduce((s, l) => ({ quoted: s.quoted + l.quoted, billed: s.billed + l.billed, used: s.used + l.used, inHand: s.inHand + l.inHand }), { quoted: 0, billed: 0, used: 0, inHand: 0 });

  const activity = [
    ...quotes.map(q => ({ date: q.date, icon: FileText, text: `Quotation ${q.number} · ${q.status}`, amt: q.grandTotal })),
    ...bills.map(b => ({ date: b.date, icon: Receipt, text: `Stage ${b.stage} bill ${b.number}`, amt: b.grandTotal })),
    ...pays.map(x => ({ date: x.date, icon: Wallet, text: `Payment received · ${x.mode}`, amt: x.amount, pos: true })),
    ...usage.map(u => ({ date: u.date, icon: Sprout, text: `Used ${u.qty} ${u.item?.unit || ''} ${u.item?.name || ''}${u.note ? ' · ' + u.note : ''}` })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

  return (
    <div className="grid fade">
      <div className="card">
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s.label} className={'step' + (s.done ? ' done' : i === current ? ' now' : '')}>
              <div className="dot"><s.icon size={16} /></div>
              <b>{s.label}</b><small>{s.note}</small>
            </div>
          ))}
        </div>
      </div>

      {next.btn !== undefined && (
        <div className="card next">
          <div><small>Next step</small><b>{next.text}</b></div>
          {next.btn && (next.to
            ? <Link className="btn primary" to={next.to}>{next.btn} <ArrowRight size={15} /></Link>
            : <button className="primary" onClick={() => go(next.tab)}>{next.btn} <ArrowRight size={15} /></button>)}
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h2>Money</h2>
          <div className="money">
            <div><small>Quotation value</small><b>{inr(quoted)}</b></div>
            <div><small>Billed so far</small><b>{inr(billed)}</b></div>
            <div><small>Received</small><b className="pos">{inr(received)}</b></div>
            <div><small>Payment due</small><b className={billed - received > 0 ? 'neg' : ''}>{inr(billed - received)}</b></div>
          </div>
          <div className="meter">
            <div className="row" style={{ justifyContent: 'space-between' }}><span>Work billed</span><small>{inr(billed)} of {inr(quoted)}</small></div>
            <Bar pct={quoted ? billed / quoted * 100 : 0} />
          </div>
          <div className="meter">
            <div className="row" style={{ justifyContent: 'space-between' }}><span>Payment collected</span><small>{inr(received)} of {inr(billed)}</small></div>
            <Bar pct={billed ? received / billed * 100 : 0} />
          </div>
        </div>

        <div className="card">
          <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Profit <small style={{ display: 'inline' }}>· internal</small></h2><button onClick={() => go('Expenses & Profit')}>Details</button></div>
          <div className="money" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div><small>Revenue (excl. GST)</small><b>{inr(sum?.revenue)}</b></div>
            <div><small>Plant + labour + other costs</small><b className="neg">{inr((sum?.materialCost || 0) + (sum?.expenses || 0))}</b></div>
          </div>
          <div className="meter">
            <div className="row" style={{ justifyContent: 'space-between' }}><b>Profit</b><b className={sum?.profit < 0 ? 'neg' : 'pos'}>{inr(sum?.profit)} · {sum?.margin || 0}%</b></div>
            <Bar pct={sum?.revenue ? Math.max(0, sum.profit) / sum.revenue * 100 : 0} />
          </div>
          <h2 style={{ marginTop: 20 }}>Project details</h2>
          <div className="facts">
            <div><User size={15} /><span>Client</span><b>{p.client?.name || '—'}{p.client?.company ? ` (${p.client.company})` : ''}</b></div>
            {p.client?.phone && <div><Phone size={15} /><span>Phone</span><b>{p.client.phone}</b></div>}
            <div><MapPin size={15} /><span>Site</span><b>{p.site || '—'}</b></div>
            <div><Calendar size={15} /><span>Started</span><b>{p.startDate ? dt(p.startDate) : dt(p.createdAt)}</b></div>
          </div>
          {p.notes && <p style={{ color: 'var(--ink-2)', marginBottom: 0 }}>{p.notes}</p>}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="head" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Plants & material</h2><button onClick={() => go('Plant Stock')}>Full stock</button></div>
          {ledger.length ? (
            <>
              <div className="money" style={{ marginBottom: 14 }}>
                <div><small>Quoted</small><b>{tot.quoted}</b></div>
                <div><small>Billed</small><b>{tot.billed}</b></div>
                <div><small>Planted / used</small><b>{tot.used}</b></div>
                <div><small>In hand</small><b className="pos">{tot.inHand}</b></div>
              </div>
              {ledger.slice(0, 5).map(l => (
                <div key={l.item._id} className="meter">
                  <div className="row" style={{ justifyContent: 'space-between' }}><span>{l.item.name}</span><small>{l.used} used of {l.billed || l.quoted} {l.item.unit}</small></div>
                  <Bar pct={(l.billed || l.quoted) ? l.used / (l.billed || l.quoted) * 100 : 0} />
                </div>
              ))}
            </>
          ) : <small>No plants added yet. They appear here once a quotation is approved or a bill is made.</small>}
        </div>

        <div className="card">
          <h2>Recent activity</h2>
          {activity.map((a, i) => (
            <div key={i} className="act">
              <span className="ico"><a.icon size={15} /></span>
              <div className="grow"><span>{a.text}</span><small>{dt(a.date)}</small></div>
              {a.amt !== undefined && <b className={a.pos ? 'pos' : ''}>{inr(a.amt)}</b>}
            </div>
          ))}
          {!activity.length && <small>Nothing yet.</small>}
        </div>
      </div>
    </div>
  );
}
