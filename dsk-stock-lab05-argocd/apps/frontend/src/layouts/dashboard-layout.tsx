import { LogOut, Package, Settings, Waypoints, LayoutGrid } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../providers/auth-provider';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/products', label: 'Produits', icon: Package },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

export const DashboardLayout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="flex h-full">
        <aside className="w-64 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur">
          <div className="px-6 py-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
              <Waypoints />
            </div>
            <div>
              <p className="text-lg font-bold">DSK Stock</p>
              <p className="text-xs text-slate-400">Ops ready</p>
            </div>
          </div>
          <nav className="px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <Icon size={18} /> {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="px-4 py-6 mt-auto">
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-xs text-slate-400">
              Connecté en tant que
              <div className="text-sm text-white font-semibold">{user?.email}</div>
            </div>
          </div>
        </aside>
        <main className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-800 px-8 py-5">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="font-semibold text-white">
                Vue d'ensemble
              </Link>
              <span className="text-xs text-slate-400">Stock en temps réel</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut size={16} className="mr-2" /> Déconnexion
            </Button>
          </header>
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
