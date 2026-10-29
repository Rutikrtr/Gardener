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
export const isoDate = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);

// GST split for display: CGST + SGST (same state) or IGST (other state)
export function gstParts(d) {
  if (!d.gstEnabled) return [];
  const amt = d.gstAmount ?? 0, pct = d.gstPercent || 0;
  return d.gstType === 'igst'
    ? [[`IGST ${pct}%`, amt]]
    : [[`CGST ${pct / 2}%`, amt / 2], [`SGST ${pct / 2}%`, amt / 2]];
}
