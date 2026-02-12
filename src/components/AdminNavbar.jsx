import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Layout, Users, FilePlus, LogOut, FolderOpen, TrendingUp } from "lucide-react"; // Import TrendingUp
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
        <div className="flex justify-between items-center h-14">
          
          {/* LEFT: BRANDING */}
          <div className="flex items-center gap-6">
            <Link to="/admin/dashboard" className="flex items-center gap-2 group">
                <img src="/brand/xplabslogo.png" alt="XP Labs" className="h-9 w-9 object-cover" />
                <span className="font-extrabold text-slate-800 tracking-tight text-base">ADMIN</span>
            </Link>

            {/* CENTER: NAVIGATION LINKS */}
            <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/admin/dashboard')}`}>
                    <Layout size={16}/> Dashboard
                </Link>
                <Link to="/admin/roster" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/admin/roster')}`}>
                    <Users size={16}/> Agent Roster
                </Link>
                <Link to="/admin/contracts" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/admin/contracts')}`}>
                    <FolderOpen size={16}/> Library
                </Link>
                <Link to="/admin/analytics" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/admin/analytics')}`}>
                    <TrendingUp size={16}/> Analytics
                </Link>
            </div>
          </div>

          {/* RIGHT: USER PROFILE */}
          <div className="flex items-center gap-3">
            <Link to="/admin/create" className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition ${isActive('/admin/create') === "bg-indigo-100 text-indigo-700" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-indigo-300 hover:text-indigo-600"}`}>
                <FilePlus size={16}/> New Contract
            </Link>

            <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-2">
                <div className="text-right hidden lg:block">
                    <p className="text-xs font-bold text-slate-900 leading-none">Director {user.displayName?.split(' ')[1] || ""}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Admin Access</p>
                </div>
                
                <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-xs">
                    {user.displayName?.charAt(0) || "A"}
                </div>

                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition ml-1" title="Sign Out">
                    <LogOut size={16}/>
                </button>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
