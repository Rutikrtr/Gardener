const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getUser = () => JSON.parse(localStorage.getItem('sg_user') || 'null');
export const logout = () => { localStorage.removeItem('sg_token'); localStorage.removeItem('sg_user'); location.href = '/login'; };

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('sg_token') || '') },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) logout();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const dt = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
export const isoDate = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);

export const COMPANY = {
  name: 'Shivsai Garden Developers',
  tagline: 'Making Gardening Easy',
  address: 'Malki No. 325, Near Satwai Temple, Manjari (Budruk), Hadapsar, Pune 412307',
  phone: '9561222712 / 8668289800',
  email: 'shivsaigarden712@gmail.com',
};
