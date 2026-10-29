const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getUser = () => JSON.parse(localStorage.getItem('sg_user') || 'null');
export const logout = msg => {
  localStorage.removeItem('sg_token'); localStorage.removeItem('sg_user');
  if (typeof msg === 'string') sessionStorage.setItem('sg_msg', msg);
  location.href = '/login';
};

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('sg_token') || '') },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/login')) logout(data.message);
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const dt = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
// YYYY-MM-DD in local (India) time — toISOString() would shift midnight to the previous day
export const isoDate = d => { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

// GST rate of a line (old documents without a line rate use the document rate)
export const lineGst = (l, d) => l.gstPercent ?? d.gstPercent ?? 0;

// GST rows for display, grouped by rate: CGST + SGST (same state) or IGST (other state)
export function gstParts(d) {
  if (!d.gstEnabled) return [];
  const byRate = {};
  (d.lines || []).forEach(l => {
    const pct = +lineGst(l, d);
    if (!pct) return;
    byRate[pct] = (byRate[pct] || 0) + (+l.qty || 0) * (+l.rate || 0) * pct / 100;
  });
  return Object.entries(byRate).sort((a, b) => a[0] - b[0]).flatMap(([pct, amt]) => d.gstType === 'igst'
    ? [[`IGST ${pct}%`, amt]]
    : [[`CGST ${pct / 2}%`, amt / 2], [`SGST ${pct / 2}%`, amt / 2]]);
}

// Totals of a quotation / bill as the editor shows them
export function docTotals(d) {
  const sub = (d.lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
  const gst = gstParts(d).reduce((s, [, v]) => s + v, 0);
  const tds = sub * (+d.tdsPercent || 0) / 100;
  return { sub, gst, total: sub + gst, tds, net: sub + gst - tds };
}

// Quotation status in plain words
export const Q_STATUS = { draft: 'Draft', sent: 'Sent to customer', revised: 'Revised (old)', approved: 'Work Order', rejected: 'Rejected' };
