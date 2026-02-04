import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, FolderOpen, TrendingUp, FilePlus, LogOut, Search } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard Home", path: "/dashboard", icon: LayoutDashboard },
  { label: "Agent Roster", path: "/admin/roster", icon: Users },
  { label: "Contract Library", path: "/admin/contracts", icon: FolderOpen },
  { label: "Analytics", path: "/admin/analytics", icon: TrendingUp },
  { label: "New Contract", path: "/admin/create", icon: FilePlus },
];

export default function AdminShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return children;

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_#f8fafc_45%,_#ffffff_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-16 md:w-20 bg-white/80 backdrop-blur border-r border-slate-200 flex flex-col items-center py-6 gap-6">
          <Link to="/dashboard" className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 text-white font-black shadow-lg">
            <img src="/brand/xplabslogo.svg" alt="XP Labs" className="h-5 w-5" />
          </Link>
          <nav className="flex flex-col items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    active
                      ? "border-indigo-200 bg-indigo-100 text-indigo-700 shadow-sm"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} />
                  <span className="pointer-events-none absolute left-14 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow-lg opacity-0 translate-x-2 transition group-hover:opacity-100 group-hover:translate-x-0">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center shadow">
              {user.displayName?.charAt(0) || "A"}
            </div>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-500 transition"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
            <div className="px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">XP Labs Admin</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                  Command Center
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    className="pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="Search classes, students..."
                  />
                </div>
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-500">Director</span>
                  <span className="text-sm font-bold text-slate-900">
                    {user.displayName || "Admin"}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold">
                  {user.displayName?.charAt(0) || "A"}
                </div>
              </div>
            </div>
          </header>
          <main className="admin-shell-main flex-1 px-6 py-8 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
