import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import {    collection, 
            query, 
            where, 
            onSnapshot, 
            doc, 
            getDocs, 
            updateDoc, 
            increment, 
            arrayUnion } from "firebase/firestore"; 
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
  Lock,
  FileText, 
  Unlock, 
  Star, 
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { THEME_OPTIONS } from "../../lib/themeConfig";
import { useTheme } from "../../context/ThemeContext";

export default function StudentDashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const labels = theme.labels;
  const [classThemeId, setClassThemeId] = useState("agency");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  
  const [contracts, setContracts] = useState([]);
  const [activeJobs, setActiveJobs] = useState({}); 
// --- NEW: DAILY MISSION STATE ---
  const [dailyMission, setDailyMission] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [missionCode, setMissionCode] = useState("");
  const [missionError, setMissionError] = useState("");

  // --- LIVE WALLET STATE ---
  const [stats, setStats] = useState({ 
    currency: userData?.currency || 0, 
    xp: userData?.xp || 0,
    completed_missions: [] 
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
                xp: data.xp || 0,
                completed_missions: data.completed_missions || []
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

  useEffect(() => {
    if (!userData?.class_id) return;
    const unsub = onSnapshot(doc(db, "classes", userData.class_id), (snap) => {
      if (!snap.exists()) return;
      setClassThemeId(snap.data()?.theme_id || "agency");
    });
    return () => unsub();
  }, [userData?.class_id]);

  // 2. CHECK FOR DAILY MISSIONS (The Intercept)
  useEffect(() => {
      // Wait until we know the student's classes
      if (allowedClasses.length === 0) return;

      const checkMissions = async () => {
          const today = new Date().toISOString().split('T')[0];
          
          // Query: Is there a mission for TODAY?
          const q = query(
              collection(db, "daily_missions"), 
              where("active_date", "==", today)
          );

          const snap = await getDocs(q);
          const missions = snap.docs.map(d => ({id: d.id, ...d.data()}));

          // Filter: Is there a mission for MY class?
          // (Checks if the mission's class_id matches ANY of the student's allowed classes)
          const validMission = missions.find(m => allowedClasses.includes(m.class_id));

          if (validMission) {
              // Check if I already did it
              const alreadyDone = stats.completed_missions.includes(validMission.id);
              
              if (!alreadyDone) {
                  setDailyMission(validMission);
                  setShowMissionModal(true); // <--- TRIGGER THE POPUP
              }
          }
      };

      checkMissions();
  }, [allowedClasses, stats.completed_missions]); // Re-run if classes load or if we finish a mission

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

  const handleClaimMission = async (e) => {
      e.preventDefault();
      setMissionError("");

      // 1. Check Password (If mission has one)
      if (dailyMission.code_word) {
          if (missionCode.toUpperCase().trim() !== dailyMission.code_word.toUpperCase()) {
              setMissionError("INCORRECT PASSCODE.");
              return;
          }
      }

      try {
          // 2. Reward the Student
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
              currency: increment(dailyMission.reward_cash),
              xp: increment(dailyMission.reward_xp),
              completed_missions: arrayUnion(dailyMission.id) // Mark done so popup never comes back
          });

          // 3. Success Animation
          setShowMissionModal(false);
          setMissionCode("");
          alert(`MISSION COMPLETE.\n+${dailyMission.reward_xp} XP\n+$${dailyMission.reward_cash}`);
          
      } catch (err) {
          console.error("Error claiming mission:", err);
          setMissionError("Connection failed. Try again.");
      }
  };

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
    <div className="min-h-screen theme-bg pb-20">
      <Navbar />
    
      <div className="max-w-6xl mx-auto p-8">
        
        {/* WELCOME SECTION */}
        <div className="mb-8">
            <h1 className="text-3xl font-extrabold theme-text">
                Welcome back, {user?.displayName?.split(' ')[0]}.
            </h1>
            <p className="theme-muted">
                Class Clearance: <span className="font-bold theme-accent uppercase">{userData?.class_id || "Unassigned"}</span>
            </p>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            
            {/* CARD 1: BANK ACCOUNT */}
            <div className="theme-surface p-6 rounded-2xl shadow-sm border theme-border flex items-center justify-between relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider mb-1">{labels.currency} Earned</p>
                    <h2 className="text-4xl font-black theme-text">${stats.currency}</h2>
                    <button 
                        onClick={() => navigate('/shop')} 
                        className="theme-accent text-sm font-bold mt-2 hover:underline flex items-center gap-1"
                    >
                        Visit {labels.shop} <ArrowRight size={14}/>
                    </button>
                </div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 z-10">
                    <DollarSign size={32} />
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>

            {/* CARD 2: XP & LEVEL */}
            <div className="theme-surface p-6 rounded-2xl shadow-sm border theme-border flex items-center justify-between relative overflow-hidden group">
                <div className="relative z-10 w-full mr-4">
                    <div className="flex justify-between items-end mb-1">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">{labels.xp} Progress</p>
                        <span className="theme-accent font-bold text-xs">{stats.xp} / {nextLevelXp} {labels.xp}</span>
                    </div>
                    <h2 className="text-4xl font-black theme-text mb-3">Level {currentLevel}</h2>
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

        <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
            <Briefcase className="text-slate-400" size={20}/> Available {labels.assignments}
        </h2>
        
        {/* WE NOW USE visibleContracts INSTEAD OF contracts */}
        {visibleContracts.length === 0 ? (
            <div className="p-12 text-center theme-muted border-2 border-dashed theme-border rounded-xl theme-card">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <Lock className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold theme-text">Restricted Access</h3>
                <p className="max-w-md mx-auto mt-2">
                    No active {labels.assignments.toLowerCase()} found for the <span className="font-mono text-slate-600 font-bold">{userData?.class_id}</span> division.
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
                        <div key={contract.id} className={`rounded-xl overflow-hidden shadow-sm border transition flex flex-col h-full ${borderClass} theme-border`}>
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

                                <h3 className="text-lg font-bold theme-text mb-2">
                                    {contract.title}
                                </h3>
                                <p className="theme-muted text-sm line-clamp-3 mb-4">
                                    {contract.description}
                                </p>
                                
                                <div className="flex items-center gap-4 text-sm font-medium mt-auto">
                                    <span className="flex items-center text-green-600"><DollarSign size={14}/> {contract.bounty}</span>
                                    <span className="flex items-center text-indigo-600"><Zap size={14}/> {contract.xp_reward} {labels.xp}</span>
                                </div>
                            </div>
                            <div className="px-6 py-3 border-t border-black/5 mt-auto">
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
      {["teacher", "admin", "super_admin", "department_admin", "teacher_admin", "chair"].includes(userData?.role) && userData?.class_id && (
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Class Theme</h3>
                <p className="text-slate-600 text-sm">Set the experience theme for your current class.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-700 bg-white"
                  value={classThemeId}
                  onChange={(e) => setClassThemeId(e.target.value)}
                >
                  {THEME_OPTIONS.map((themeOption) => (
                    <option key={themeOption.id} value={themeOption.id}>
                      {themeOption.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    setIsSavingTheme(true);
                    try {
                      await updateDoc(doc(db, "classes", userData.class_id), {
                        theme_id: classThemeId,
                        updatedAt: new Date().toISOString()
                      });
                    } catch (err) {
                      console.error("Theme update failed", err);
                      alert("Failed to update theme.");
                    } finally {
                      setIsSavingTheme(false);
                    }
                  }}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-600 transition"
                  disabled={isSavingTheme}
                >
                  {isSavingTheme ? "Saving..." : "Update Theme"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* --- TOP SECRET MISSION POPUP --- */}
      {showMissionModal && dailyMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            
            {/* MANILA FOLDER UI */}
            <div className="bg-[#fdf6e3] w-full max-w-lg rounded-sm shadow-2xl overflow-hidden relative rotate-1 border border-[#d1c7ad]">
                
                {/* Folder Tab */}
                <div className="absolute top-0 left-0 bg-[#e6dcc3] w-1/3 h-8 rounded-br-xl border-r border-b border-[#d1c7ad] flex items-center justify-center">
                    <span className="text-[10px] font-black tracking-widest text-slate-500/50 uppercase">Confidential</span>
                </div>

                {/* "Classified" Stamp */}
                <div className="absolute top-6 right-6 border-4 border-red-600/20 text-red-600/20 font-black text-4xl uppercase -rotate-12 px-4 py-2 pointer-events-none select-none">
                    Classified
                </div>

                {/* Close Button (In case they want to ignore it) */}
                <button 
                    onClick={() => setShowMissionModal(false)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 z-20"
                >
                    <X size={20} />
                </button>

                <div className="p-8 pt-12">
                    
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-2">
                            <Zap size={12} className="text-yellow-400"/> Priority Message
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase leading-none mb-1">
                            {dailyMission.title}
                        </h2>
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                            Target: {dailyMission.class_id} // {dailyMission.active_date}
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-white p-6 border-2 border-slate-200 border-dashed rounded-xl mb-6 font-mono text-sm text-slate-700 leading-relaxed shadow-inner">
                        {dailyMission.instruction}
                    </div>

                    {/* Rewards */}
                    <div className="flex justify-center gap-4 mb-6">
                        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-green-200">
                            <DollarSign size={18} /> ${dailyMission.reward_cash}
                        </div>
                        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-indigo-200">
                            <Star size={18} /> {dailyMission.reward_xp} XP
                        </div>
                    </div>

                    {/* Interaction Area */}
                    <form onSubmit={handleClaimMission}>
                        {dailyMission.code_word && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 text-center">
                                    Input Security Code
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="ENTER CODE WORD..."
                                    className="w-full bg-slate-800 text-green-400 font-mono text-center p-3 rounded-lg border-2 border-slate-700 focus:border-green-500 outline-none uppercase tracking-widest placeholder:text-slate-600 transition-colors"
                                    value={missionCode}
                                    onChange={e => setMissionCode(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        )}

                        {missionError && (
                            <p className="text-center text-red-600 font-bold text-sm mb-4 animate-pulse">
                                ⚠️ {missionError}
                            </p>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition flex items-center justify-center gap-2"
                        >
                            <Unlock size={18} /> CLAIM REWARD
                        </button>
                    </form>

                </div>
            </div>
        </div>
      )}
    </div>
  );
}
