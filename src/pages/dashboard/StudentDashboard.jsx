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
  ArrowRight, 
  Trophy,     
  PlayCircle,
  Lock // <--- Added Lock icon for empty state
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

 // --- STATE FOR CLASSES (New) ---
  const [allowedClasses, setAllowedClasses] = useState([]);

  // 1. LIVE LISTENER: User Profile (XP, Money, AND Classes)
  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // A. Update Stats
            setStats({
                currency: data.currency || 0,
                xp: data.xp || 0
            });

            // B. Update Class List
            // If the array exists, use it. If not, use the single class_id.
            if (data.enrolled_classes && data.enrolled_classes.length > 0) {
                setAllowedClasses(data.enrolled_classes);
            } else if (data.class_id) {
                setAllowedClasses([data.class_id]);
            }
        }
    });
    return () => unsubscribe();
  }, [user]);

  // 2. LIVE LISTENER: Contracts (Depends on allowedClasses)
  useEffect(() => {
    // Wait until we have a class list so we don't query empty
    if (allowedClasses.length === 0) return;

    // Query Firestore for ANY class in the list
    const q = query(
        collection(db, "contracts"),
        where("class_id", "in", allowedClasses)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const liveContracts = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            // Filter for "open" status here (Safest way to avoid Index errors)
            .filter(job => job.status === "open");

        setContracts(liveContracts);
    });

    return () => unsubscribe();
  }, [allowedClasses]); 

  // 3. LIVE LISTENER: Active Jobs (Student Progress)
  useEffect(() => {
    if (!user?.uid) return;

    // This query finds jobs the student has ACCEPTED (active_jobs collection)
    const q = query(
        collection(db, "active_jobs"),
        where("student_id", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const mapping = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            mapping[data.contract_id] = data;
        });
        setActiveJobs(mapping);
    });
    return () => unsubscribe();
  }, [user]);// <--- dependency ensures it updates if user data changes

// --- 🛡️ THE GATEKEEPER LOGIC 🛡️ ---
  // This filters the raw "contracts" list before we map over it
  const visibleContracts = contracts.filter(contract => {
    // 1. Admins see EVERYTHING
    if (userData?.role === 'admin') return true;

    // 2. Students see contracts if they are in the 'allowedClasses' list
    // (We use the state we built earlier, rather than the single userData.class_id)
    return allowedClasses.includes(contract.class_id);
  });

  // --- LEVEL CALCULATIONS ---
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
            <p className="text-slate-500">
                Class Clearance: <span className="font-bold text-indigo-600 uppercase">{userData?.class_id || "Unassigned"}</span>
            </p>
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
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>
            
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase className="text-slate-400" size={20}/> Available Contracts
        </h2>
        
        {/* WE NOW USE visibleContracts INSTEAD OF contracts */}
        {visibleContracts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <Lock className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Restricted Access</h3>
                <p className="max-w-md mx-auto mt-2">
                    No active contracts found for the <span className="font-mono text-slate-600 font-bold">{userData?.class_id}</span> division.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleContracts.map(contract => {
                    const myJob = activeJobs[contract.id];

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
                                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider">
                                        {contract.class_id?.replace(/_/g, " ")}
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