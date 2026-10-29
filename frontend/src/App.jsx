import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Bills from './pages/Bills';
import { LayoutDashboard, FolderKanban, Receipt, Sprout, Users, Building2, Settings as SettingsIcon, LogOut, Leaf } from 'lucide-react';
import { getUser, logout } from './api';
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
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo"><Leaf size={18} /></span><div><b>Smart Garden</b><small>{user?.role === 'superadmin' ? 'Admin console' : user?.name}</small></div></div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}><Icon size={18} /> <span>{label}</span></NavLink>
          ))}
        </nav>
        <div className="me">
          <div className="avatar">{(user?.name || user?.username || '?')[0].toUpperCase()}</div>
          <div className="grow"><b>{user?.name || user?.username}</b><small>{user?.role === 'superadmin' ? 'superadmin' : user?.username}</small></div>
          <button className="icon" title="Logout" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="main" key={useLocation().pathname}>{children}</main>
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
        <Route path="/items" element={<Items />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
