import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Layout, Users, FilePlus, LogOut, Shield, FolderOpen, TrendingUp } from "lucide-react"; // Import TrendingUp
export default function AdminNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => {
    // specific check for create path to highlight it correctly
    if (path === '/admin/create' && location.pathname === '/admin/create') return "bg-indigo-100 text-indigo-700";
    // general check
    return location.pathname === path ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900";
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* LEFT: BRANDING */}
          <div className="flex items-center gap-8">
            <Link to="/admin/dashboard" className="flex items-center gap-2 group">
                <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:bg-indigo-600 transition">
                    <Shield size={20} />
                </div>
                <span className="font-extrabold text-slate-800 tracking-tight text-lg">AGENCY <span className="text-slate-400">ADMIN</span></span>
            </Link>

            {/* CENTER: NAVIGATION LINKS */}
            <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${isActive('/admin/dashboard')}`}>
                    <Layout size={18}/> Dashboard
                </Link>
                <Link to="/admin/roster" className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${isActive('/admin/roster')}`}>
                    <Users size={18}/> Agent Roster
                </Link>
                <Link to="/admin/contracts" className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${isActive('/admin/contracts')}`}>
                    <FolderOpen size={18}/> Library
                </Link>
                <Link to="/admin/analytics" className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${isActive('/admin/analytics')}`}>
                    <TrendingUp size={18}/> Analytics
                </Link>
            </div>
          </div>

          {/* RIGHT: USER PROFILE */}
          <div className="flex items-center gap-4">
            <Link to="/admin/create" className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition ${isActive('/admin/create') === "bg-indigo-100 text-indigo-700" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-indigo-300 hover:text-indigo-600"}`}>
                <FilePlus size={16}/> New Contract
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>

            <div className="flex items-center gap-3">
                <div className="text-right hidden lg:block">
                    <p className="text-sm font-bold text-slate-900 leading-none">Director {user.displayName?.split(' ')[1] || ""}</p>
                    <p className="text-xs text-slate-500 mt-1">Admin Access</p>
                </div>
                
                <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold">
                    {user.displayName?.charAt(0) || "A"}
                </div>

                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition ml-2" title="Sign Out">
                    <LogOut size={20}/>
                </button>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}