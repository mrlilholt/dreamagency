import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext"; // <--- Essential for filtering
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "../components/Navbar"; 
import { Trophy, Medal, Crown, Zap, LayoutList, Rocket, Lock } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function Leaderboard() {
  const { userData } = useAuth(); // Get current user's class_id
  const { theme } = useTheme();
  const labels = theme.labels;
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [contracts, setContracts] = useState([]); // <--- NEW: Store contracts
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("OVERALL");

  useEffect(() => {
    // 1. Listen to Users
    const unsubUsers = onSnapshot(
        collection(db, "users"),
        (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (error) => {
            console.error("Leaderboard users listener failed:", error);
            setLoading(false);
        }
    );

    // 2. Listen to Active Jobs
    const unsubJobs = onSnapshot(
        collection(db, "active_jobs"),
        (snap) => {
            setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (error) => {
            console.error("Leaderboard jobs listener failed:", error);
            setLoading(false);
        }
    );

    // 3. Listen to Contracts (NEW: This is our source of truth for Tabs)
    const unsubContracts = onSnapshot(
        collection(db, "contracts"),
        (snap) => {
            setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        },
        (error) => {
            console.error("Leaderboard contracts listener failed:", error);
            setLoading(false);
        }
    );

    return () => {
        unsubUsers();
        unsubJobs();
        unsubContracts();
    };
  }, []);

  // --- 🛡️ GATEKEEPER LOGIC 🛡️ ---
  
  // 1. Filter Users (Show only classmates)
  const visibleUsers = users.filter(u => {
      if (userData?.role === 'admin') return true;
      return u.class_id?.trim() === userData?.class_id?.trim();
  });

  // 2. Filter Contracts (Show only tabs assigned to this class)
  const visibleContracts = contracts.filter(c => {
      if (userData?.role === 'admin') return true;
      return c.class_id?.trim() === userData?.class_id?.trim();
  });

  // --- DYNAMIC TABS ---
  // Generate tabs based on the ALLOWED contracts, not just messy active jobs
  const contractTitles = visibleContracts.map(c => c.title).sort();

  // --- RANKING LOGIC ---
  const getRankings = () => {
    if (activeTab === "OVERALL") {
        return [...visibleUsers]
            .filter(u => u.xp > 0)
            .sort((a, b) => (b.xp || 0) - (a.xp || 0))
            .slice(0, 50);
    } else {
        // Filter jobs by the active tab Title AND ensure the student is in our visible list
        const relevantJobs = jobs.filter(j => j.contract_title === activeTab);
        
        return relevantJobs
            .map(job => {
                const student = visibleUsers.find(u => u.id === job.student_id);
                if (!student) return null; // Skip if student is not in this class
                return {
                    ...student,
                    rankingMetric: job.current_stage, 
                    jobId: job.id
                };
            })
            .filter(item => item !== null)
            // Sort by Stage Descending, then by XP Descending
            .sort((a, b) => {
                if (b.rankingMetric !== a.rankingMetric) {
                    return b.rankingMetric - a.rankingMetric;
                }
                return (b.xp || 0) - (a.xp || 0);
            });
    }
  };

  const rankings = getRankings();

  // --- HELPER: ROBUST NAME FINDER ---
  const getName = (u) => {
    if (u.name) return u.name;
    if (u.displayName) return u.displayName;
    return "Unknown Agent";
  };

  // --- HELPER: ICONS ---
  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="text-yellow-500 fill-yellow-500" size={24} />;
    if (index === 1) return <Medal className="text-slate-400 fill-slate-400" size={24} />;
    if (index === 2) return <Medal className="text-amber-700 fill-amber-700" size={24} />;
    return <span className="font-bold text-slate-400 w-6 text-center">{index + 1}</span>;
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading Encryption Keys...</div>;

  return (
    <div className="min-h-screen theme-bg pb-20">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold theme-text mb-2 flex justify-center items-center gap-3">
                <Trophy className="text-yellow-500" /> {labels.assignment} Leaderboards
            </h1>
            <p className="theme-muted flex items-center justify-center gap-2">
                Division Rankings: 
                <span className="font-bold theme-accent uppercase bg-indigo-50 px-2 py-1 rounded text-xs">
                    {userData?.role === 'admin' ? 'ALL AGENTS (ADMIN)' : userData?.class_id || "Unassigned"}
                </span>
            </p>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 custom-scrollbar">
            <button
                onClick={() => setActiveTab("OVERALL")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                    activeTab === "OVERALL" ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200"
                }`}
            >
                <Zap size={16} className={activeTab === "OVERALL" ? "fill-white" : ""} /> Overall {labels.xp}
            </button>
            
            {/* Render tabs from the Filtered Contracts list */}
            {contractTitles.map(title => (
                <button
                    key={title}
                    onClick={() => setActiveTab(title)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                        activeTab === title ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200"
                    }`}
                >
                    <LayoutList size={16} /> {title}
                </button>
            ))}
        </div>

        {/* LIST */}
        <div className="theme-surface rounded-2xl shadow-xl overflow-hidden border theme-border min-h-[400px]">
            {rankings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 theme-muted">
                    <Lock size={48} className="mb-4 opacity-20"/>
                    <p>No active agents found in the <span className="font-bold">{userData?.class_id}</span> division.</p>
                    {activeTab !== "OVERALL" && (
                        <p className="text-xs mt-2">Be the first to start this {labels.assignment.toLowerCase()}!</p>
                    )}
                </div>
            ) : (
                rankings.map((agent, index) => (
                    <div key={agent.id || agent.jobId} className="flex items-center justify-between p-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-5">
                            <div className="w-10 flex justify-center">{getRankIcon(index)}</div>
                            
                            {/* Avatar Initials */}
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 border border-slate-200 uppercase">
                                {getName(agent).charAt(0)}
                            </div>
                            
                            {/* Agent Name */}
                            <div>
                                <h3 className="font-bold text-slate-800">
                                    {getName(agent)}
                                </h3>
                                {index === 0 && activeTab === "OVERALL" && (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">
                                        TOP AGENT
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Score Display */}
                        <div className="text-right">
                            {activeTab === "OVERALL" ? (
                                <span className="block text-xl font-black text-slate-900">{agent.xp?.toLocaleString()} {labels.xp}</span>
                            ) : (
                                <span className="block text-xl font-black text-indigo-600">Stage {agent.rankingMetric}</span>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}
