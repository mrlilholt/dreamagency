import { useState, useEffect } from "react"; // Added hooks
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { db } from "../lib/firebase"; // Added db
import { doc, onSnapshot } from "firebase/firestore"; // Added firestore functions
import { Link, useLocation } from "react-router-dom";
import { Layout, ShoppingBag, LogOut, User } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { theme } = useTheme();
  const labels = theme.labels;
  
  // New State for Live Stats
  const [stats, setStats] = useState({ currency: 0, xp: 0, displayName: "" });

  // Real-time Listener
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(
        doc(db, "users", user.uid),
        (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setStats({
                    currency: data.currency || 0,
                    xp: data.xp || 0,
                    displayName: data.displayName || user.displayName // Fallback to Auth name
                });
            }
        },
        (error) => {
            console.error("Navbar user listener failed:", error);
        }
    );

    return () => unsub();
  }, [user]);

  if (!user) return null;

  const isActive = (path) => location.pathname === path ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900";

  return (
    <nav className="theme-surface border-b theme-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          
          {/* LEFT: BRANDING */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <img src="/brand/xplabslogo.png" alt="XP Labs" className="h-9 w-9 object-cover" />
            </div>

            {/* CENTER: NAVIGATION LINKS */}
            <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/dashboard')}`}>
                    <Layout size={16}/> Dashboard
                </Link>
                <Link to="/shop" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/shop')}`}>
                    <ShoppingBag size={16}/> {labels.shop}
                </Link>
                <Link to="/profile" className={`px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition ${isActive('/profile')}`}>
                    <User size={16}/> {labels.student} Profile
                </Link>
            </div>
          </div>

          {/* RIGHT: USER PROFILE */}
          <div className="flex items-center gap-3">
            
            {/* STATS PILL (Now using 'stats' state) */}
            <div className="hidden sm:flex items-center gap-2.5 theme-card px-2.5 py-1 rounded-full border theme-border">
                <div className="text-xs font-bold text-green-600 flex items-center gap-1">
                    $ {stats.currency}
                </div>
                <div className="w-px h-3 bg-slate-300"></div>
                <div className="text-xs font-bold theme-accent flex items-center gap-1">
                    {stats.xp} {labels.xp}
                </div>
            </div>

            {/* AVATAR & DROPDOWN */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                <div className="text-right hidden lg:block">
                    <p className="text-xs font-bold theme-text leading-none">{stats.displayName}</p>
                    <p className="text-[10px] theme-muted mt-0.5">Junior {labels.student}</p>
                </div>
                
                {user.photoURL ? (
                    <img 
                        src={user.photoURL} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                        <User size={16}/>
                    </div>
                )}

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
