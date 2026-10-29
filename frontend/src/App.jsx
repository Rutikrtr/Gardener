import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Sprout, Users, UserCog, LogOut, Leaf } from 'lucide-react';
import { getUser, logout } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import DocEditor from './pages/DocEditor';
import PrintDoc from './pages/PrintDoc';
import Items from './pages/Items';
import Clients from './pages/Clients';
import UsersPage from './pages/Users';

function Shell({ children }) {
  const user = getUser();
  const nav = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/projects', 'Projects', FolderKanban],
    ['/items', 'Price List', Sprout],
    ['/clients', 'Clients', Users],
    ...(user?.role === 'superadmin' ? [['/users', 'Users', UserCog]] : []),
  ];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo"><Leaf size={18} /></span><div><b>Smart Garden</b><small>Shivsai Garden Developers</small></div></div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}><Icon size={18} /> <span>{label}</span></NavLink>
          ))}
        </nav>
        <div className="me">
          <div className="avatar">{(user?.name || user?.username || '?')[0].toUpperCase()}</div>
          <div className="grow"><b>{user?.name || user?.username}</b><small>{user?.role}</small></div>
          <button className="icon" title="Logout" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const authed = !!localStorage.getItem('sg_token');
  if (loc.pathname === '/login') return <Login />;
  if (!authed) return <Navigate to="/login" replace />;
  if (loc.pathname.startsWith('/print/')) return <Routes><Route path="/print/:kind/:id" element={<PrintDoc />} /></Routes>;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:pid/:kind/new" element={<DocEditor />} />
        <Route path="/projects/:pid/:kind/:id" element={<DocEditor />} />
        <Route path="/items" element={<Items />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
