import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { FolderKanban, FileText, Receipt, Wallet, AlertCircle } from 'lucide-react';
import { useApi, Badge, Bar } from './ui';
import { inr, dt } from '../api';

const COLORS = { quotation: '#d99a1c', active: '#3f9b2e', completed: '#0f1a12', 'on-hold': '#d64545' };
const short = n => n >= 1e7 ? (n / 1e7).toFixed(1) + 'Cr' : n >= 1e5 ? (n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : n;

export default function Dashboard() {
  const [a] = useApi('/analytics');
  if (!a) return <div className="empty">Loading dashboard…</div>;
  const collected = a.billed ? Math.round(a.received / a.billed * 100) : 0;
  const kpis = [
    ['Projects', a.projects, FolderKanban],
    ['Approved quotations', inr(a.quotedApproved), FileText],
    ['Total billed', inr(a.billed), Receipt],
    ['Payment received', inr(a.received), Wallet],
  ];
  return (
    <>
      <div className="head"><div><h1>Dashboard</h1><small>Business overview across all projects</small></div>
        <Link className="btn primary" to="/projects">+ New project</Link></div>

      <div className="grid g4">
        {kpis.map(([l, v, I]) => <div className="card kpi" key={l}><div className="label"><span className="ico"><I size={16} /></span>{l}</div><div className="val">{v}</div></div>)}
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Billed vs received · last 12 months</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={a.monthly} barGap={2}>
                <CartesianGrid vertical={false} stroke="#eef1ed" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={12} width={44} />
                <Tooltip formatter={v => inr(v)} cursor={{ fill: '#f4f6f2' }} />
                <RBar dataKey="billed" name="Billed" fill="#0f1a12" radius={[6, 6, 0, 0]} />
                <RBar dataKey="received" name="Received" fill="#7bc950" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card kpi dark">
          <div className="label"><span className="ico"><AlertCircle size={16} /></span>Outstanding</div>
          <div className="val">{inr(a.outstanding)}</div>
          <small style={{ color: '#a9bba9' }}>{collected}% of billed amount collected</small>
          <div className="bar" style={{ background: '#1f3024' }}><i style={{ width: collected + '%', background: '#7bc950' }} /></div>
          <h2 style={{ marginTop: 18, color: '#fff' }}>Projects by status</h2>
          <div style={{ height: 150 }}>
            <ResponsiveContainer>
              <PieChart><Pie data={a.byStatus} dataKey="n" nameKey="_id" innerRadius={42} outerRadius={64} paddingAngle={3} stroke="none">
                {a.byStatus.map(s => <Cell key={s._id} fill={s._id === 'completed' ? '#fff' : COLORS[s._id]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="row">{a.byStatus.map(s => <span key={s._id} className="badge" style={{ background: '#1f3024', color: '#dfe8dc' }}>{s._id}: {s.n}</span>)}</div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Project performance</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Project</th><th>Status</th><th className="num">Quoted</th><th className="num">Billed</th><th>Collected</th></tr></thead>
            <tbody>
              {a.projectRows.map(p => (
                <tr key={p._id}><td><Link to={'/projects/' + p._id}><b>{p.name}</b></Link><small>{p.client}</small></td><td><Badge s={p.status} /></td>
                  <td className="num">{inr(p.quoted)}</td><td className="num">{inr(p.billed)}</td>
                  <td><div className="row"><Bar pct={p.billed ? p.received / p.billed * 100 : 0} /><small>{p.billed ? Math.round(p.received / p.billed * 100) : 0}%</small></div></td></tr>
              ))}
              {!a.projectRows.length && <tr><td colSpan={5} className="empty">No projects yet</td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="grid">
          <div className="card">
            <h2>Most used materials</h2>
            {a.topItems.map(t => <div key={t._id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}><span>{t.name}</span><b>{t.qty} {t.unit}</b></div>)}
            {!a.topItems.length && <small>No site usage logged yet</small>}
          </div>
          <div className="card">
            <h2>Recent payments</h2>
            {a.recentPayments.map(p => <div key={p._id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}><div><b>{p.project?.name}</b><small>{dt(p.date)} · {p.mode}</small></div><span className="pos">{inr(p.amount)}</span></div>)}
            {!a.recentPayments.length && <small>No payments yet</small>}
          </div>
        </div>
      </div>
    </>
  );
}
