import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Bills from './pages/Bills';
import Suppliers from './pages/Suppliers';
import Workers from './pages/Workers';
import Reports from './pages/Reports';
import { LayoutDashboard, FolderKanban, Receipt, Truck, HardHat, FileSpreadsheet, Sprout, Users, Building2, Settings as SettingsIcon, LogOut, Leaf, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { api, getUser, logout } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import DocEditor from './pages/DocEditor';
import PrintDoc from './pages/PrintDoc';
import Items from './pages/Items';
import Clients from './pages/Clients';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import { Toasts } from './pages/ui';

function Shell({ nav, children }) {
  const user = getUser();
  const loc = useLocation();
  // Show a divider under the page's top bar once its content is scrolled (the page area scrolls, not the window)
  useEffect(() => {
    const scroller = document.querySelector('.main .page');
    const on = e => {
      const top = e?.target?.scrollTop ?? Math.max(scroller?.scrollTop || 0, window.scrollY);
      document.querySelector('.main .head')?.classList.toggle('stuck', top > 4);
    };
    on();
    document.addEventListener('scroll', on, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', on, { capture: true });
  }, [loc.pathname]);
  // Sidebar starts closed (icons only); the choice is remembered on this device
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('sg_side') === 'open'; } catch { return false; } });
  const toggle = () => setOpen(o => { try { localStorage.setItem('sg_side', o ? 'closed' : 'open'); } catch {} return !o; });
  // Company logo from Settings (cached so it doesn't flicker on every page load)
  const [logo, setLogo] = useState(() => { try { return sessionStorage.getItem('sg_logo') || ''; } catch { return ''; } });
  useEffect(() => {
    if (user?.role !== 'user') return;
    const load = () => api('/auth/settings').then(s => { setLogo(s.logo || ''); try { sessionStorage.setItem('sg_logo', s.logo || ''); } catch {} }).catch(() => {});
    load();
    window.addEventListener('sg-settings', load);
    return () => window.removeEventListener('sg-settings', load);
  }, []);
  const mark = logo ? <img src={logo} alt="" /> : <Leaf size={18} />;
  return (
    <div className={'shell' + (open ? ' side-open' : ' side-closed')}>
      <aside className="side">
        <div className="brand">
          {open ? (
            <>
              <span className={'logo' + (logo ? ' has-img' : '')}>{mark}</span>
              <div className="side-text grow"><b>Smart Garden</b><small>{user?.role === 'superadmin' ? 'Admin console' : user?.name}</small></div>
              <button className="side-collapse" onClick={toggle} title="Close menu" aria-label="Close menu" aria-expanded="true"><PanelLeftClose size={17} /></button>
            </>
          ) : (
            <button className={'logo side-toggle' + (logo ? ' has-img' : '')} onClick={toggle} title="Open menu" aria-label="Open menu" aria-expanded="false">
              <span className="tg-leaf">{mark}</span><span className="tg-menu"><PanelLeftOpen size={18} /></span>
            </button>
          )}
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} title={open ? undefined : label} data-tip={label}><Icon size={18} /> <span className="side-text">{label}</span></NavLink>
          ))}
        </nav>
        <div className="me">
          <div className="avatar" title={user?.name || user?.username}>{(user?.name || user?.username || '?')[0].toUpperCase()}</div>
          <div className="grow side-text"><b>{user?.name || user?.username}</b><small>{user?.role === 'superadmin' ? 'superadmin' : user?.username}</small></div>
          <button className="icon" title="Logout" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="main"><div className="page" key={loc.pathname}>{children}</div></main>
      <Toasts />
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const user = getUser();
  if (loc.pathname === '/login') return <Login />;
  if (!localStorage.getItem('sg_token') || !user) return <Navigate to="/login" replace />;

  // Superadmin (software owner): only manages client accounts & plans
  if (user.role === 'superadmin') {
    return (
      <Shell nav={[['/', 'Client Accounts', Building2]]}>
        <Routes><Route path="*" element={<Accounts />} /></Routes>
      </Shell>
    );
  }

  if (loc.pathname.startsWith('/print/')) return <Routes><Route path="/print/:kind/:id" element={<PrintDoc />} /></Routes>;
  const nav = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/projects', 'Projects', FolderKanban],
    ['/bills', 'Bills', Receipt],
    ['/suppliers', 'Suppliers', Truck],
    ['/workers', 'Workers', HardHat],
    ['/reports', 'Reports', FileSpreadsheet],
    ['/items', 'Price List', Sprout],
    ['/clients', 'Clients', Users],
    ['/settings', 'Settings', SettingsIcon],
  ];
  return (
    <Shell nav={nav}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:pid/:kind/new" element={<DocEditor />} />
        <Route path="/projects/:pid/:kind/:id" element={<DocEditor />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/items" element={<Items />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
