import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import Navbar from "../components/Navbar"; // Import the Navbar we just made
import { Trophy, Medal, Crown } from "lucide-react";

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setLeaders(usersData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="text-yellow-500 fill-yellow-500" size={24} />;
    if (index === 1) return <Medal className="text-slate-400 fill-slate-400" size={24} />;
    if (index === 2) return <Medal className="text-amber-700 fill-amber-700" size={24} />;
    return <span className="font-bold text-slate-400 w-6 text-center">{index + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar /> {/* The Agency Header */}

      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Top Performers</h1>
            <p className="text-slate-500">The highest earning agents in the agency.</p>
        </div>

        {loading ? (
             <div className="text-center py-20 text-slate-400">Loading rankings...</div>
        ) : (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                {leaders.map((agent, index) => (
                    <div 
                        key={agent.id} 
                        className={`flex items-center justify-between p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition ${
                            index < 3 ? "bg-gradient-to-r from-white to-slate-50" : ""
                        }`}
                    >
                        <div className="flex items-center gap-6">
                            {/* RANK */}
                            <div className="w-10 flex justify-center">
                                {getRankIcon(index)}
                            </div>

                            {/* AVATAR */}
                            {agent.photoURL ? (
                                <img src={agent.photoURL} alt={agent.displayName} className="w-12 h-12 rounded-full border border-slate-200" />
                            ) : (
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                                    {agent.displayName?.charAt(0)}
                                </div>
                            )}

                            {/* NAME */}
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">
                                    {agent.displayName}
                                    {index === 0 && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">Top Agent</span>}
                                </h3>
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                                    {agent.class_id ? agent.class_id.replace('_', ' ') : 'Freelancer'}
                                </p>
                            </div>
                        </div>

                        {/* XP SCORE */}
                        <div className="text-right">
                            <span className="block text-2xl font-black text-indigo-600">{agent.xp?.toLocaleString()} XP</span>
                            <span className="text-xs text-slate-400 font-bold">LIFETIME EARNINGS</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}