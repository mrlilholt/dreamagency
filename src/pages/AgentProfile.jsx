import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore"; // <--- Updated imports
import Navbar from "../components/Navbar";
import { 
    Shield, Lock, Calendar, Star, User, Trophy, Medal, Crown, Zap, Target, Award, Rocket, Heart, Flag 
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

  useEffect(() => {
    if (!user) return;

    // 1. Listen to User Data (Realtime for when they earn new things)
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => {
      setAgentData(doc.data());
    });

    // 2. Fetch All Available Badges (Once)
    const fetchBadges = async () => {
        const snap = await getDocs(collection(db, "badges"));
        const badgeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllBadges(badgeList);
        setLoading(false);
    };
    fetchBadges();

    return () => unsubUser();
  }, [user]);

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
                <h1 className="text-3xl font-black mb-1">{getAgentName()}</h1>
                <p className="text-slate-400 text-sm">Agent ID: {user.uid.slice(0,8).toUpperCase()}</p>
            </div>

            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 text-center min-w-[120px]">
                <div className="text-2xl font-black text-yellow-400">{agentData.xp || 0}</div>
                <div className="text-xs font-bold text-slate-300 uppercase">Lifetime XP</div>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-10">
        
        {/* STATS ROW */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-center">
            <div>
                <div className="text-2xl font-black text-slate-800">{agentData.currency || 0}</div>
                <div className="text-xs font-bold text-slate-400 uppercase">Cash On Hand</div>
            </div>
            <div>
                <div className="text-2xl font-black text-slate-800">{agentData.completed_jobs || 0}</div>
                <div className="text-xs font-bold text-slate-400 uppercase">Missions</div>
            </div>
            <div>
                <div className="text-2xl font-black text-slate-800">
                    {Object.keys(agentData.badges || {}).length}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Medals</div>
            </div>
            <div>
                <div className="text-2xl font-black text-slate-800">98%</div>
                <div className="text-xs font-bold text-slate-400 uppercase">Rating</div>
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
    </div>
  );
}