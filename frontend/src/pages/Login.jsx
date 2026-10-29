import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { api, COMPANY } from '../api';

export default function Login() {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: f });
      localStorage.setItem('sg_token', r.token);
      localStorage.setItem('sg_user', JSON.stringify(r.user));
      location.href = '/';
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="login">
      <div className="art">
        <div className="brand"><span className="logo"><Leaf size={18} /></span><div><b>Smart Garden</b><small>{COMPANY.name}</small></div></div>
        <h1>Quotations, stage bills & plant stock — <em>all in one garden.</em></h1>
        <small>{COMPANY.phone}</small>
      </div>
      <div className="formside">
        <form onSubmit={submit}>
          <div><h1>Welcome back</h1><small>Sign in to continue</small></div>
          <label>Username<input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} required /></label>
          <label>Password<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></label>
          {err && <div className="err">{err}</div>}
          <button className="primary" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
