import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc } from "firebase/firestore";
import { 
    Folder, Edit, Trash, Plus, Trophy, Medal, Shield, 
    Star, Crown, Zap, Target, Award, Rocket, Bookmark,
    Hexagon, Heart, Flag, Lock
} from "lucide-react";
import AdminShell from "../../components/AdminShell";

// --- 1. ICON MAP FOR BADGES ---
const AVAILABLE_ICONS = [
    "trophy", "medal", "shield", "star", "crown", 
    "zap", "target", "award", "rocket", "heart", "flag"
];

// --- 2. DEFAULT SEED DATA (To save you typing) ---
const SEED_BADGES = [
    { title: "First Blood", description: "Completed your first mission.", xpReward: 100, iconName: "star" },
    { title: "Pixel Perfect", description: "Submitted a design with zero requested revisions.", xpReward: 500, iconName: "target" },
    { title: "Night Owl", description: "Submitted a mission after 8 PM.", xpReward: 200, iconName: "medal" },
    { title: "Top Earner", description: "Reached $10,000 in career earnings.", xpReward: 1000, iconName: "crown" },
    { title: "Streak Master", description: "Completed 3 missions in a row without rejection.", xpReward: 800, iconName: "zap" }
];

export default function AllContracts() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("contracts"); // 'contracts' or 'badges'
  const [loading, setLoading] = useState(true);

  // DATA STATE
  const [contracts, setContracts] = useState({});
  const [badges, setBadges] = useState([]);

  // FORM STATE (For Badges)
  const [editingBadgeId, setEditingBadgeId] = useState(null);
  const [badgeForm, setBadgeForm] = useState({ title: "", description: "", xpReward: 0, iconName: "medal" });

  const fetchData = async () => {
      setLoading(true);
      
      // 1. Fetch Contracts
      const cSnap = await getDocs(collection(db, "contracts"));
      const grouped = {};
      cSnap.docs.forEach(doc => {
        const data = doc.data();
        const group = data.class_id || "Global / Unassigned";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push({ id: doc.id, ...data });
      });
      setContracts(grouped);

      // 2. Fetch Badges
      const bSnap = await getDocs(collection(db, "badges"));
      setBadges(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      setLoading(false);
  };

  // --- INITIAL FETCH ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // --- CONTRACT ACTIONS ---
  const handleDeleteContract = async (id) => {
    if (!confirm("Delete this contract forever?")) return;
    await deleteDoc(doc(db, "contracts", id));
    fetchData(); 
  };

  // --- BADGE ACTIONS ---
  const handleSaveBadge = async (e) => {
      e.preventDefault();
      if (editingBadgeId) {
          await updateDoc(doc(db, "badges", editingBadgeId), badgeForm);
      } else {
          await addDoc(collection(db, "badges"), badgeForm);
      }
      setBadgeForm({ title: "", description: "", xpReward: 0, iconName: "medal" });
      setEditingBadgeId(null);
      fetchData();
  };

  const editBadge = (badge) => {
      setEditingBadgeId(badge.id);
      setBadgeForm({ 
          title: badge.title, 
          description: badge.description, 
          xpReward: badge.xpReward, 
          iconName: badge.iconName 
      });
  };

  const deleteBadge = async (id) => {
      if(!confirm("Delete this badge?")) return;
      await deleteDoc(doc(db, "badges", id));
      fetchData();
  };

  const seedBadges = async () => {
      if(!confirm("Upload default badges to DB?")) return;
      for(const b of SEED_BADGES) {
          await addDoc(collection(db, "badges"), b);
      }
      fetchData();
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Loading library...</div>;

  return (
    <AdminShell>
        <div className="max-w-6xl mx-auto">
            
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Library & Awards</h1>
                    <p className="text-slate-500">Manage mission files and agent recognitions.</p>
                </div>
                
                {/* TABS */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => setActiveTab("contracts")}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === "contracts" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-900"}`}
                    >
                        Contracts
                    </button>
                    <button 
                        onClick={() => setActiveTab("badges")}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === "badges" ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:text-slate-900"}`}
                    >
                        Medals & Badges
                    </button>
                </div>
            </div>

            {/* ==================== CONTRACTS TAB ==================== */}
            {activeTab === "contracts" && (
                <div className="space-y-8">
                    {Object.keys(contracts).length === 0 && (
                        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-slate-300">
                            <Folder size={48} className="mx-auto text-slate-300 mb-4"/>
                            <p className="text-slate-500">No contracts found.</p>
                        </div>
                    )}

                    {Object.keys(contracts).sort().map(group => (
                        <div key={group} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                    <Folder size={16} className="text-indigo-500" />
                                    {group.replace(/_/g, " ")}
                                </h2>
                                <span className="bg-white border border-slate-200 px-2 py-1 rounded text-xs font-mono text-slate-500">
                                    {contracts[group].length} Files
                                </span>
                            </div>
                            
                            <div className="divide-y divide-slate-100">
                                {contracts[group].map(contract => (
                                    <div key={contract.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{contract.title}</h3>
                                            <div className="flex gap-3 text-xs font-bold mt-1">
                                                <span className="text-green-600">${contract.bounty}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-indigo-500">{contract.xp_reward} XP</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => navigate(`/admin/edit/${contract.id}`)}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteContract(contract.id)}
                                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ==================== BADGES TAB ==================== */}
            {activeTab === "badges" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT: FORM */}
                    <div className="lg:col-span-1">
                        <div className={`p-6 rounded-xl border shadow-sm ${editingBadgeId ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                {editingBadgeId ? <Edit size={18}/> : <Plus size={18}/>}
                                {editingBadgeId ? "Edit Medal" : "Create New Medal"}
                            </h3>
                            
                            <form onSubmit={handleSaveBadge} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Title</label>
                                    <input 
                                        className="w-full p-2 border rounded mt-1"
                                        value={badgeForm.title}
                                        onChange={e => setBadgeForm({...badgeForm, title: e.target.value})}
                                        required 
                                        placeholder="e.g. Night Owl"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Description</label>
                                    <textarea 
                                        className="w-full p-2 border rounded mt-1"
                                        value={badgeForm.description}
                                        onChange={e => setBadgeForm({...badgeForm, description: e.target.value})}
                                        required 
                                        rows={3}
                                        placeholder="How do they earn this?"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">XP Reward</label>
                                        <input 
                                            type="number"
                                            className="w-full p-2 border rounded mt-1"
                                            value={badgeForm.xpReward}
                                            onChange={e => setBadgeForm({...badgeForm, xpReward: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Icon</label>
                                        <select 
                                            className="w-full p-2 border rounded mt-1 bg-white"
                                            value={badgeForm.iconName}
                                            onChange={e => setBadgeForm({...badgeForm, iconName: e.target.value})}
                                        >
                                            {AVAILABLE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button className="flex-1 bg-slate-900 text-white font-bold py-2 rounded hover:bg-slate-800">
                                        {editingBadgeId ? "Save Changes" : "Create Medal"}
                                    </button>
                                    {editingBadgeId && (
                                        <button 
                                            type="button" 
                                            onClick={() => {setEditingBadgeId(null); setBadgeForm({ title: "", description: "", xpReward: 0, iconName: "medal" });}}
                                            className="px-4 bg-slate-200 text-slate-600 font-bold py-2 rounded"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT: LIST */}
                    <div className="lg:col-span-2">
                        {badges.length === 0 ? (
                            <div className="text-center p-12 border-2 border-dashed border-slate-300 rounded-xl">
                                <Trophy size={48} className="mx-auto text-slate-300 mb-4"/>
                                <p className="text-slate-500 mb-4">No medals created yet.</p>
                                <button onClick={seedBadges} className="bg-green-100 text-green-700 px-4 py-2 rounded font-bold hover:bg-green-200">
                                    Generate Defaults
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {badges.map(badge => (
                                    <div key={badge.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:shadow-md transition">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                            {/* Simple Icon Preview */}
                                            <Star size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800">{badge.title}</h4>
                                            <p className="text-xs text-slate-500 leading-snug mb-2">{badge.description}</p>
                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">
                                                +{badge.xpReward || 0} XP
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => editBadge(badge)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit size={16}/></button>
                                            <button onClick={() => deleteBadge(badge.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            )}

        </div>
    </AdminShell>
  );
}
