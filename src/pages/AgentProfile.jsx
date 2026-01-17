import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { BADGES, CLASS_CODES } from "../lib/gameConfig";
import Navbar from "../components/Navbar";
import { Shield, Lock, Calendar, Star, User } from "lucide-react";

export default function AgentProfile() {
  const { user } = useAuth();
  const [agentData, setAgentData] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Listen to the database record
    const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
      setAgentData(doc.data());
    });
    return () => unsub();
  }, [user]);

  if (!agentData) return <div className="p-10 text-center">Loading Profile...</div>;

  // --- HELPER FUNCTIONS ---

  // 1. Get Name: Check DB first, then Google Auth, then fallback
  const getAgentName = () => {
      if (agentData?.name) return agentData.name;
      if (agentData?.displayName) return agentData.displayName;
      if (user?.displayName) return user.displayName;
      return "Unknown Agent";
  };

  // 2. Get Photo: Check DB first, then Google Auth
  const getAgentPhoto = () => {
      if (agentData?.photoURL) return agentData.photoURL;
      if (user?.photoURL) return user.photoURL;
      return null;
  };

  const getUserBadge = (badgeId) => agentData.badges?.find(b => b.id === badgeId);
  const getClassName = (id) => Object.values(CLASS_CODES).find(c => c.id === id)?.name || "Freelancer";

  const agentName = getAgentName();
  const agentPhoto = getAgentPhoto();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      
      <div className="max-w-4xl mx-auto p-6">
        
        {/* ID CARD HEADER */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8 relative overflow-hidden">
          {/* Decorative Background Shape */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start">
            
            {/* AVATAR LOGIC */}
            <div className="shrink-0">
                {agentPhoto ? (
                    <img 
                        src={agentPhoto} 
                        alt="Agent" 
                        className="w-24 h-24 rounded-2xl object-cover shadow-lg shadow-slate-200 border-4 border-white"
                    />
                ) : (
                    <div className="w-24 h-24 bg-slate-900 rounded-2xl flex items-center justify-center text-4xl text-white font-black shadow-lg shadow-slate-300 uppercase border-4 border-white">
                        {agentName.charAt(0)}
                    </div>
                )}
            </div>
            
            <div className="text-center md:text-left flex-1">
              {/* NAME DISPLAY */}
              <h1 className="text-3xl font-black text-slate-900 mb-1">
                {agentName}
              </h1>
              
              <p className="text-slate-500 font-bold flex items-center justify-center md:justify-start gap-2">
                <Shield size={16} className="text-indigo-600"/> 
                {getClassName(agentData.class_id)}
              </p>
              
              <div className="flex gap-4 mt-6 justify-center md:justify-start">
                 <div className="text-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-400 font-bold uppercase">Balance</div>
                    <div className="text-xl font-black text-green-600">${agentData.currency || 0}</div>
                 </div>
                 <div className="text-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-400 font-bold uppercase">Experience</div>
                    <div className="text-xl font-black text-indigo-600">{agentData.xp || 0} XP</div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* BADGE COLLECTION */}
        <div>
           <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
             <Star className="text-yellow-500 fill-yellow-500" /> Commendations & Medals
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {Object.values(BADGES).map((badgeDef) => {
               const earned = getUserBadge(badgeDef.id);
               
               return (
                 <div 
                   key={badgeDef.id} 
                   className={`relative p-5 rounded-xl border-2 transition-all duration-300 ${
                     earned 
                       ? "bg-white border-indigo-100 shadow-sm" 
                       : "bg-slate-50 border-slate-100 opacity-60 grayscale"
                   }`}
                 >
                   <div className="flex gap-4 items-start">
                     {/* ICON */}
                     <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0 ${
                        earned ? badgeDef.color + " text-white" : "bg-slate-200 text-slate-400"
                     }`}>
                        {earned ? badgeDef.icon : <Lock size={20}/>}
                     </div>

                     {/* TEXT */}
                     <div>
                       <h3 className={`font-bold text-lg ${earned ? "text-slate-800" : "text-slate-500"}`}>
                         {badgeDef.title}
                       </h3>
                       <p className="text-sm text-slate-500 leading-snug">
                         {badgeDef.description}
                       </p>
                       
                       {earned && (
                         <p className="text-xs text-indigo-600 font-bold mt-2 flex items-center gap-1">
                           <Calendar size={12}/> Earned {new Date(earned.earnedAt).toLocaleDateString()}
                         </p>
                       )}
                     </div>
                   </div>
                   
                   {/* Shine effect for earned badges */}
                   {earned && (
                     <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/40 to-transparent rounded-tr-xl pointer-events-none"></div>
                   )}
                 </div>
               );
             })}
           </div>
        </div>

      </div>
    </div>
  );
}