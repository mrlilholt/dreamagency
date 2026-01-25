import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, getDocs, addDoc, serverTimestamp, updateDoc, arrayRemove } from "firebase/firestore"; // <--- Updated imports
import Navbar from "../components/Navbar";
import { 
    Shield, Lock, Calendar, Star, User, Trophy, Medal, Crown, Zap, Target, Award, Rocket, Heart, Flag, DollarSign, Mail, Send, X, Bomb,            // <--- ADD THIS
    AlertTriangle, Pencil, Save  
} from "lucide-react";

// --- ICON MAPPER ---
const ICON_MAP = {
    "trophy": <Trophy size={24} />,
    "medal": <Medal size={24} />,
    "shield": <Shield size={24} />,
    "star": <Star size={24} />,
    "crown": <Crown size={24} />,
    "zap": <Zap size={24} />,
    "target": <Target size={24} />,
    "award": <Award size={24} />,
    "rocket": <Rocket size={24} />,
    "heart": <Heart size={24} />,
    "flag": <Flag size={24} />,
    "default": <Star size={24} />
};

export default function AgentProfile() {
  const { user } = useAuth();
  const [agentData, setAgentData] = useState(null);
  const [allBadges, setAllBadges] = useState([]); // <--- New State for Badge Library
  const [loading, setLoading] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [isSending, setIsSending] = useState(false);
  // --- NAME CHANGE LOGIC ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
// 1. Logic to save the name
  const handleUpdateName = async () => {
      if (!newName.trim()) return;
      
      // 1. Find the specific token object in the inventory so we can remove it
      const tokenObject = agentData.inventory.find(item => item.name === "Identity Scrambler");

      if (!tokenObject) {
          alert("Security Error: Token not found in inventory.");
          return;
      }

      try {
          const userRef = doc(db, "users", user.uid);
          
          await updateDoc(userRef, {
              displayName: newName,
              name: newName,
              // We pass the WHOLE object to arrayRemove so Firestore knows exactly which map to delete
              inventory: arrayRemove(tokenObject) 
          });

          setIsEditingName(false);
          alert("Identity successfully scrambled."); 
      } catch (error) {
          console.error("Error updating name:", error);
          alert("Failed to scramble identity.");
      }
  };
  // Check if they own the item
const hasNameChangeToken = agentData?.inventory?.some(item => item.name === "Identity Scrambler");

  useEffect(() => {
    // 1. GUARD CLAUSE: Stop if no user is logged in (Fixes "Permission Denied")
    if (!user) return;

    setLoading(true);

    // 2. Listen to User Data (Realtime updates for XP, Credits, Inventory)
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
            setAgentData(docSnapshot.data());
        }
    }, (error) => {
        console.error("Error listening to agent data:", error);
    });

    // 3. Fetch All Available Badges (One-time fetch)
    const fetchBadges = async () => {
        try {
            const snap = await getDocs(collection(db, "badges"));
            const badgeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllBadges(badgeList);
        } catch (error) {
            console.error("Error fetching badges:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchBadges();

    // Cleanup listener on unmount or logout
    return () => unsubUser();
  }, [user]);

  
// --- EASTER EGG STATE ---
  
const [panicMode, setPanicMode] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [exploded, setExploded] = useState(false);

  // THE COUNTDOWN EFFECT
  useEffect(() => {
    let timer;
    if (panicMode && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setExploded(true);
    }
    return () => clearTimeout(timer);
  }, [panicMode, countdown]);

  const triggerSelfDestruct = () => {
      setPanicMode(true);
      setCountdown(5); // Reset timer
      setExploded(false);
  };

  const closeSimulation = () => {
      setPanicMode(false);
      setExploded(false);
      setCountdown(5);
  };

  const handleSendSuggestion = async (e) => {
      e.preventDefault();
      if (!suggestionText.trim()) return;

      setIsSending(true);
      try {
          await addDoc(collection(db, "suggestions"), {
              text: suggestionText,
              agentName: getAgentName(),
              agentId: user.uid,
              createdAt: serverTimestamp(),
              read: false
          });
          
          alert("Message sent to HQ. Over and out.");
          setSuggestionText("");
          setShowSuggestionBox(false);
      } catch (error) {
          console.error("Error sending suggestion:", error);
          alert("Transmission failed. Try again.");
      }
      setIsSending(false);
  };

  if (loading || !agentData) return <div className="p-10 text-center">Loading Profile...</div>;

  // --- HELPER FUNCTIONS ---
  const getAgentName = () => agentData?.name || agentData?.displayName || user?.displayName || "Unknown Agent";
  const getAgentPhoto = () => agentData?.photoURL || user?.photoURL || null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white pb-20 pt-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
            {/* ID CARD HEADER */}
            <div className="shrink-0">
                {getAgentPhoto() ? (
                    <img 
                        src={getAgentPhoto()} 
                        alt="Agent" 
                        className="w-24 h-24 rounded-2xl object-cover shadow-lg shadow-slate-200/20 border-4 border-white/10"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-4xl text-white font-black shadow-lg border-4 border-white/10">
                        {getAgentName().charAt(0)}
                    </div>
                )}
            </div>

            <div className="text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                        {agentData.class_id || "Unassigned"}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                        Level {Math.floor((agentData.xp || 0) / 1000) + 1}
                    </span>
                </div>
{/* DYNAMIC NAME SECTION */}
                {isEditingName ? (
                    <div className="flex items-center gap-2 mb-1 animate-in fade-in slide-in-from-left-4">
                        <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-slate-800 text-white font-bold px-3 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 w-full md:w-auto"
                            placeholder="New Code Name"
                            maxLength={20}
                            autoFocus
                        />
                        <button 
                            onClick={handleUpdateName}
                            className="bg-green-600 hover:bg-green-500 text-white p-2 rounded transition shadow-lg shadow-green-900/20"
                            title="Confirm Change (Consumes Token)"
                        >
                            <Save size={16} />
                        </button>
                        <button 
                            onClick={() => setIsEditingName(false)}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-2 rounded transition"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 mb-1 group">
                        {/* 1. Show the Name (Checks both fields to prevent "Agent" bug) */}
                        <h1 className="text-3xl font-black">
                            {agentData?.displayName || agentData?.name || "Agent"}
                        </h1>
                        
                        {/* 2. Show Button ONLY if they have the token */}
                        {hasNameChangeToken && (
                            <button 
                                onClick={() => {
                                    setNewName(agentData?.displayName || agentData?.name || "");
                                    setIsEditingName(true);
                                }}
                                className="text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-indigo-500/40 cursor-pointer"
                            >
                                <Pencil size={12} /> Scramble ID
                            </button>
                        )}
                    </div>
                )}
                
                <p className="text-slate-400 text-sm">Agent ID: {user.uid.slice(0,8).toUpperCase()}</p>
                {/* --- NEW BUTTON: CONTACT HQ --- */}
                    <button 
                        onClick={() => setShowSuggestionBox(true)}
                        className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold uppercase tracking-wider rounded-full transition-all border border-white/10"
                    >
                        <Mail size={12} /> Contact HQ
                    </button>
            </div>

            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 text-center min-w-[120px]">
                <div className="text-2xl font-black text-yellow-400">{agentData.xp || 0}</div>
                <div className="text-xs font-bold text-slate-300 uppercase">Lifetime XP</div>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-10">
        
        {/* --- UPGRADED STATS ROW --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            
            {/* 1. CASH CARD (Emerald Theme) */}
            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-24 h-24 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-emerald-600">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider text-emerald-700/60">Bankroll</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                        ${(agentData.currency || 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* 2. MISSIONS CARD (Blue Theme) */}
            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -right-6 -bottom-6 bg-blue-500/10 w-24 h-24 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                    {/* --- SECRET BUTTON --- */}
                <button 
                    onClick={triggerSelfDestruct}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-20 hover:!opacity-100 transition-opacity text-red-500"
                    title="DO NOT PRESS"
                >
                    <Bomb size={16} />
                </button>
                {/* --------------------- */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-blue-600">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Target size={20} />
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider text-blue-700/60">Mission Log</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                        {agentData.completed_jobs || 0}
                    </div>
                </div>
            </div>

            {/* 3. MEDALS CARD (Amber Theme) */}
            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -right-6 -bottom-6 bg-amber-500/10 w-24 h-24 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-amber-600">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Medal size={20} />
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-700/60">Honors</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                        {Object.keys(agentData.badges || {}).length}
                    </div>
                </div>
            </div>

        </div>

        {/* MEDALS / BADGES SECTION */}
        <div className="mb-12">
           <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Shield className="text-indigo-600"/> Commendations & Medals
           </h2>

           {allBadges.length === 0 ? (
               <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">
                   No medals have been authorized by HQ yet.
               </div>
           ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {allBadges.map((badge) => {
                   // Check if user has this badge
                   // Structure: agentData.badges = { "badgeID": { earnedAt: "..." } }
                   const earnedData = agentData.badges?.[badge.id];
                   const isEarned = !!earnedData;
                   
                   const BadgeIcon = ICON_MAP[badge.iconName] || ICON_MAP["default"];

                   return (
                     <div key={badge.id} className={`relative p-5 rounded-xl border flex items-center gap-5 transition overflow-hidden ${
                       isEarned ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50 border-slate-100 opacity-60 grayscale"
                     }`}>
                       
                       {/* ICON CIRCLE */}
                       <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0 ${
                          isEarned ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-400"
                       }`}>
                          {isEarned ? BadgeIcon : <Lock size={20}/>}
                       </div>

                       {/* TEXT */}
                       <div>
                         <h3 className={`font-bold text-lg ${isEarned ? "text-slate-800" : "text-slate-500"}`}>
                           {badge.title}
                         </h3>
                         <p className="text-sm text-slate-500 leading-snug">
                           {badge.description}
                         </p>
                         
                         {isEarned && (
                           <p className="text-xs text-indigo-600 font-bold mt-2 flex items-center gap-1">
                             <Calendar size={12}/> Earned {new Date(earnedData.earnedAt).toLocaleDateString()}
                           </p>
                         )}
                         {!isEarned && (
                             <p className="text-xs text-slate-400 font-bold mt-2">
                                 Reward: {badge.xpReward || 0} XP
                             </p>
                         )}
                       </div>
                       
                       {/* Shine effect for earned badges */}
                       {isEarned && (
                         <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-tr-xl pointer-events-none"></div>
                       )}
                     </div>
                   );
                 })}
               </div>
           )}
        </div>

      </div>
      {/* --- SUGGESTION BOX MODAL --- */}
      {showSuggestionBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                
                {/* Modal Header */}
                <div className="bg-slate-100 p-4 flex items-center justify-between border-b border-slate-200">
                    <h3 className="font-black text-slate-700 flex items-center gap-2">
                        <Mail size={20} className="text-indigo-600"/> 
                        SECURE LINE TO HQ
                    </h3>
                    <button 
                        onClick={() => setShowSuggestionBox(false)}
                        className="text-slate-400 hover:text-slate-600 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSendSuggestion} className="p-6">
                    <p className="text-sm text-slate-500 mb-4">
                        Have an idea for a new mission? Found a bug? Or just want to say hi? 
                        Send a secure transmission directly to the Director.
                    </p>

                    <textarea
                        value={suggestionText}
                        onChange={(e) => setSuggestionText(e.target.value)}
                        placeholder="Type your message here..."
                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 mb-4"
                        autoFocus
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowSuggestionBox(false)}
                            className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !suggestionText.trim()}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                        >
                            {isSending ? "Transmitting..." : (
                                <>
                                    Send Message <Send size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
      )}
      {/* --- EASTER EGG: SELF DESTRUCT SEQUENCE --- */}
      {panicMode && (
        <div className="fixed inset-0 z-[100] bg-red-600 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
            
            {/* STAGE 1: THE COUNTDOWN */}
            {!exploded && (
                <div className="text-center space-y-8 animate-pulse">
                    <AlertTriangle size={80} className="mx-auto mb-4" />
                    <h1 className="text-6xl font-black uppercase tracking-widest">
                        Warning
                    </h1>
                    <p className="text-2xl font-mono uppercase">
                        Self-Destruct Sequence Initiated
                    </p>
                    <div className="text-[150px] font-black font-mono leading-none">
                        0:0{countdown}
                    </div>
                    <p className="text-white/50 animate-bounce mt-10">
                        (Do not panic)
                    </p>
                </div>
            )}

            {/* STAGE 2: THE AFTERMATH */}
            {exploded && (
                <div className="text-center max-w-lg p-8 bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 animate-in zoom-in duration-300">
                    <div className="bg-white text-red-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-xl">
                        😅
                    </div>
                    <h2 className="text-3xl font-black mb-4">Simulation Complete</h2>
                    <p className="text-xl opacity-90 mb-8 leading-relaxed">
                        "You miss 100% of the shots you don't take... - unless you're me."<br/>
                        <span className="text-sm opacity-60">-Mr. Lilholt</span>
                    </p>
                    <button 
                        onClick={closeSimulation}
                        className="bg-white text-red-600 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-red-50 transition shadow-lg"
                    >
                        Return to work lol
                    </button>
                </div>
            )}
        </div>
      )}
    </div>
  );
}