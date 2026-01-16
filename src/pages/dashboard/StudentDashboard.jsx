import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"; 
import { 
  Briefcase, 
  DollarSign, 
  Zap, 
  Clock, 
  CheckCircle, 
  Loader, 
  AlertCircle, 
  ArrowRight, // <--- Added
  Trophy,     // <--- Added (You will need this for the XP card)
  PlayCircle  // <--- Added (You will need this for the Active Missions header)
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";

export default function StudentDashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [contracts, setContracts] = useState([]);
  const [activeJobs, setActiveJobs] = useState({}); 

  // --- LIVE WALLET STATE ---
  const [stats, setStats] = useState({ 
    currency: userData?.currency || 0, 
    xp: userData?.xp || 0 
  });

  // 1. Listen for Money/XP Updates
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log("💰 Listening for Wallet Updates for:", user.uid);
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("💰 Wallet Updated:", data.currency);
            setStats({
                currency: data.currency || 0,
                xp: data.xp || 0
            });
        }
    });
    return () => unsubscribe();
  }, [user?.uid]); // Only restart if UID changes

  // 2. Listen for Job Updates (Status changes)
  useEffect(() => {
    if (!user?.uid) return;

    console.log("🔥 Listening for Active Jobs for:", user.uid);
    const q = query(collection(db, "active_jobs"), where("student_id", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const mapping = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            mapping[data.contract_id] = data;
        });
        
        console.log("🔥 Jobs Updated. Active Count:", Object.keys(mapping).length);
        console.log("🔥 Current Jobs Data:", mapping);
        
        setActiveJobs(mapping);
    });
    return () => unsubscribe();
  }, [user?.uid]); // Only restart if UID changes

  // 3. Listen for New Contracts
  useEffect(() => {
    const q = query(collection(db, "contracts"), where("status", "==", "open"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const liveContracts = snapshot.docs.map(doc => ({
            id: doc.id, 
            ...doc.data()
        }));
        setContracts(liveContracts);
    });
    return () => unsubscribe();
  }, []);
// --- LEVEL CALCULATIONS ---
  // Calculates level based on 1000 XP per level
  const currentLevel = Math.floor((stats.xp || 0) / 1000) + 1;
  const nextLevelXp = currentLevel * 1000;
  const progress = ((stats.xp % 1000) / 1000) * 100;
  
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
    
      <div className="max-w-6xl mx-auto p-8">
        
        {/* WELCOME SECTION */}
        <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900">
                Welcome back, {user?.displayName?.split(' ')[0]}.
            </h1>
            <p className="text-slate-500">Here is your current Contract status.</p>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            
            {/* CARD 1: BANK ACCOUNT */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Agency Earnings</p>
                    <h2 className="text-4xl font-black text-slate-900">${stats.currency}</h2>
                    <button 
                        onClick={() => navigate('/shop')} 
                        className="text-indigo-600 text-sm font-bold mt-2 hover:underline flex items-center gap-1"
                    >
                        Visit Store <ArrowRight size={14}/>
                    </button>
                </div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 z-10">
                    <DollarSign size={32} />
                </div>
                {/* Decoration */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>

            {/* CARD 2: XP & LEVEL */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden group">
                <div className="relative z-10 w-full mr-4">
                    <div className="flex justify-between items-end mb-1">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Career Progress</p>
                        <span className="text-indigo-600 font-bold text-xs">{stats.xp} / {nextLevelXp} XP</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-3">Level {currentLevel}</h2>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 z-10 shrink-0">
                    <Trophy size={32} />
                </div>
                {/* Decoration */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>
            
        </div> {/* <--- THIS CLOSING TAG MUST BE HERE, AFTER BOTH CARDS */}

        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase className="text-slate-400" size={20}/> Available Contracts
        </h2>
        
        {contracts.length === 0 ? (
            <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No active contracts available right now.
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contracts.map(contract => {
                    const myJob = activeJobs[contract.id];

                    // Determine Styles based on status
                    let badgeClass = "bg-indigo-100 text-indigo-700";
                    let borderClass = "bg-white border-slate-200 hover:shadow-md";
                    let buttonClass = "bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white";
                    let buttonText = "View Brief";

                    if (myJob) {
                        buttonText = "Continue Mission";
                        buttonClass = "bg-indigo-600 text-white hover:bg-indigo-700";
                        borderClass = "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100";
                        
                        if (myJob.status === 'pending_review') {
                            badgeClass = "bg-yellow-100 text-yellow-700";
                        } else if (myJob.status === 'completed') {
                            badgeClass = "bg-green-100 text-green-700";
                            buttonText = "Completed";
                            buttonClass = "bg-green-600 text-white";
                        } else if (myJob.status === 'returned') {
                            badgeClass = "bg-red-100 text-red-700 animate-pulse";
                            borderClass = "bg-red-50 border-red-200 ring-1 ring-red-100";
                            buttonText = "Fix Issues";
                            buttonClass = "bg-red-600 text-white hover:bg-red-700";
                        }
                    }

                    return (
                        <div key={contract.id} className={`rounded-xl overflow-hidden shadow-sm border transition flex flex-col h-full ${borderClass}`}>
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded uppercase font-bold tracking-wider">
                                        {contract.class_id === 'all' ? 'Global' : contract.class_id}
                                    </span>
                                    
                                    {/* STATUS BADGE */}
                                    {myJob && (
                                        <span className={`text-xs px-2 py-1 rounded uppercase font-bold tracking-wider flex items-center gap-1 ${badgeClass}`}>
                                            {myJob.status === 'completed' ? <CheckCircle size={12}/> :
                                             myJob.status === 'pending_review' ? <Clock size={12}/> :
                                             myJob.status === 'returned' ? <AlertCircle size={12}/> :
                                             <Loader size={12}/>
                                            }
                                            {myJob.status === 'completed' ? 'Done' : 
                                             myJob.status === 'pending_review' ? 'Reviewing' : 
                                             myJob.status === 'returned' ? 'Action Required' :
                                             `Stage ${myJob.current_stage}`}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-2">
                                    {contract.title}
                                </h3>
                                <p className="text-slate-500 text-sm line-clamp-3 mb-4">
                                    {contract.description}
                                </p>
                                
                                <div className="flex items-center gap-4 text-sm font-medium mt-auto">
                                    <span className="flex items-center text-green-600"><DollarSign size={14}/> {contract.bounty}</span>
                                    <span className="flex items-center text-indigo-600"><Zap size={14}/> {contract.xp_reward} XP</span>
                                </div>
                            </div>
                            <div className="px-6 py-3 border-t border-black/5 mt-auto bg-black/5">
                                <button 
                                    onClick={() => navigate(`/contract/${contract.id}`)}
                                    className={`w-full font-medium py-2 rounded-lg transition ${buttonClass}`}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
}