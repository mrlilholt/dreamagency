import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, increment, addDoc, serverTimestamp} from "firebase/firestore";
import { CLASS_CODES, BADGES } from "../../lib/gameConfig"; // <--- 1. IMPORT BADGES
import { 
    Users, Filter, Search, Trophy, DollarSign, 
    Briefcase, AlertCircle, Trash2, Gavel, ArrowLeft, ChevronRight, Medal, Send, MessageSquare
} from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

export default function AdminRoster() {
  // --- STATE ---
  const [students, setStudents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filterClass, setFilterClass] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // Forms
  const [bonusForm, setBonusForm] = useState({ currency: 0, xp: 0 });
  const [selectedBadgeId, setSelectedBadgeId] = useState(""); // <--- 2. BADGE STATE

  const [adminMessage, setAdminMessage] = useState("");
const [sendingMsg, setSendingMsg] = useState(false);
  // --- LISTENERS ---
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        userList.sort((a, b) => {
            const nameA = a.name || a.displayName || "";
            const nameB = b.name || b.displayName || "";
            return nameA.localeCompare(nameB);
        });
        setStudents(userList);
    });

    const unsubJobs = onSnapshot(collection(db, "active_jobs"), (snap) => {
        const jobList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(jobList);
        setLoading(false);
    });

    return () => { unsubUsers(); unsubJobs(); };
  }, []);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const sendDirectMessage = async (e) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedStudentId) return;
    
    setSendingMsg(true);
    try {
        // Write to the 'alerts' subcollection we just set up listeners for
        await addDoc(collection(db, "users", selectedStudentId, "alerts"), {
            message: adminMessage,
            createdAt: serverTimestamp(),
            read: false
        });
        
        setAdminMessage(""); // Clear box
        alert("Transmission Sent!"); 
    } catch (error) {
        console.error("Error sending:", error);
        alert("Transmission Failed");
    } finally {
        setSendingMsg(false);
    }
};
  // --- ACTIONS ---

  const handleRedeem = async (studentId, itemIndex, currentInventory) => {
    if(!confirm("Mark this item as used and remove it from inventory?")) return;
    const newInventory = [...currentInventory];
    newInventory.splice(itemIndex, 1); 
    try {
        await updateDoc(doc(db, "users", studentId), { inventory: newInventory });
    } catch (err) { alert("Error redeeming item"); }
  };

  const handleBonusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
        await updateDoc(doc(db, "users", selectedStudent.id), {
            currency: increment(Number(bonusForm.currency)),
            xp: increment(Number(bonusForm.xp))
        });
        setBonusForm({ currency: 0, xp: 0 });
        alert("Stats updated successfully.");
    } catch (err) { alert("Error updating stats"); }
  };

  // --- NEW: GRANT BADGE LOGIC ---
  const handleGrantBadge = async (e) => {
      e.preventDefault();
      if (!selectedStudent || !selectedBadgeId) return;

      // 1. Check if they already have it
      const currentBadges = selectedStudent.badges || [];
      if (currentBadges.find(b => b.id === selectedBadgeId)) {
          alert("This agent already has that badge!");
          return;
      }

      // 2. Add badge with 'new: true' to trigger popup
      const newBadge = {
          id: selectedBadgeId,
          earnedAt: new Date().toISOString(),
          new: true 
      };

      try {
          await updateDoc(doc(db, "users", selectedStudent.id), {
              badges: [...currentBadges, newBadge]
          });
          alert(`Granted "${BADGES[selectedBadgeId].title}" successfully!`);
          setSelectedBadgeId(""); // Reset dropdown
      } catch (err) {
          console.error(err);
          alert("Error granting badge.");
      }
  };
{/* --- SEND DIRECT INTEL --- */}
<div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6">
    <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
        <MessageSquare size={16}/> Send Classified Intel
    </h3>
    <form onSubmit={sendDirectMessage}>
        <textarea
            className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
            rows="3"
            placeholder={`Message for ${selectedStudent?.name || "Agent"}...`}
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
        />
        <button 
            type="submit" 
            disabled={sendingMsg || !adminMessage}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {sendingMsg ? "Transmitting..." : <><Send size={14}/> Send Transmission</>}
        </button>
    </form>
</div>

  // --- RENDERING HELPERS ---
  const filteredStudents = students.filter(s => {
      const matchesClass = filterClass === "all" || s.class_id === filterClass;
      const nameToCheck = (s.name || s.displayName || "Unknown Agent").toLowerCase();
      return matchesClass && nameToCheck.includes(searchQuery.toLowerCase());
  });

  const selectedStudentJobs = selectedStudent ? jobs.filter(j => j.student_id === selectedStudent.id) : [];
  const getClassName = (id) => Object.values(CLASS_CODES).find(c => c.id === id)?.name || "Unknown Class";
  const getName = (s) => s.name || s.displayName || "Unknown Agent";

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Roster...</div>;

  // --- VIEW 1: ROSTER LIST ---
  if (!selectedStudentId) {
    return (
        <div className="max-w-5xl mx-auto p-6 min-h-screen">
            <AdminNavbar />
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="text-indigo-600"/> Agent Roster
                </h1>
                <p className="text-slate-500">Select an agent to manage their file.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Search agent..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 rounded-lg">
                    <Filter size={18} className="text-slate-400" />
                    <select 
                        className="bg-transparent font-bold text-slate-700 outline-none"
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                    >
                        <option value="all">All Classes</option>
                        {Object.values(CLASS_CODES).map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Agent</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">Class</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Balance</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">XP</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(student => (
                            <tr 
                                key={student.id} 
                                onClick={() => setSelectedStudentId(student.id)}
                                className="hover:bg-indigo-50/50 cursor-pointer transition group"
                            >
                                <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-indigo-700">
                                    {getName(student)}
                                </td>
                                <td className="px-6 py-4 hidden sm:table-cell text-sm text-slate-600">
                                    {getClassName(student.class_id)}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                                    ${student.currency || 0}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                                    {student.xp || 0} XP
                                </td>
                                <td className="px-6 py-4 text-right text-slate-400">
                                    <ChevronRight size={18} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  }

  // --- VIEW 2: PROFILE DETAIL ---
  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen">
        <button 
            onClick={() => setSelectedStudentId(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-6 transition"
        >
            <ArrowLeft size={20}/> Back to Roster
        </button>

        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black text-slate-900">{getName(selectedStudent)}</h1>
                <p className="text-slate-500 font-medium">{getClassName(selectedStudent.class_id)}</p>
                
                {/* Badge Display Row */}
                <div className="flex gap-2 mt-2">
                    {selectedStudent.badges?.map((b, i) => (
                        <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200" title={BADGES[b.id]?.title}>
                             {BADGES[b.id]?.icon || "🏅"}
                        </span>
                    ))}
                </div>
            </div>
            <div className="text-right">
                <p className="text-3xl font-black text-green-600">${selectedStudent.currency || 0}</p>
                <p className="text-xl font-bold text-indigo-600">{selectedStudent.xp || 0} XP</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT: INFO & INVENTORY */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* ACTIVE JOBS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Briefcase className="text-indigo-600" size={20}/> Active Contracts
                    </h2>
                    {selectedStudentJobs.length === 0 ? <p className="text-slate-400 italic">No active work.</p> : (
                        <div className="space-y-3">
                            {selectedStudentJobs.map(job => (
                                <div key={job.id} className="p-3 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50">
                                    <span className="font-bold text-slate-700">{job.contract_title}</span>
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Stage {job.current_stage}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* INVENTORY */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={20}/> Inventory Redemption
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {(!selectedStudent.inventory || selectedStudent.inventory.length === 0) && (
                            <span className="text-slate-400 italic text-sm">Empty inventory.</span>
                        )}
                        {selectedStudent.inventory?.map((item, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleRedeem(selectedStudent.id, idx, selectedStudent.inventory)}
                                className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition group"
                            >
                                <span className="font-bold text-sm">{typeof item === 'object' ? item.name : item}</span>
                                <Trash2 size={14} className="text-slate-400 group-hover:text-red-600"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: ACTIONS */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* 1. ADJUST FUNDS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Gavel className="text-slate-600" size={20}/> Adjust Stats
                    </h2>
                    <form onSubmit={handleBonusSubmit} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Cash ($)</label>
                            <input 
                                type="number" 
                                className="w-full border p-2 rounded font-mono mt-1" 
                                value={bonusForm.currency}
                                onChange={e => setBonusForm({...bonusForm, currency: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">XP</label>
                            <input 
                                type="number" 
                                className="w-full border p-2 rounded font-mono mt-1" 
                                value={bonusForm.xp}
                                onChange={e => setBonusForm({...bonusForm, xp: e.target.value})}
                            />
                        </div>
                        <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded hover:bg-slate-800">
                            Apply
                        </button>
                    </form>
                </div>

                {/* 2. GRANT BADGE (NEW) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Medal className="text-yellow-500" size={20}/> Grant Badge
                    </h2>
                    <form onSubmit={handleGrantBadge} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Select Medal</label>
                            <select 
                                className="w-full border p-2 rounded mt-1 text-sm bg-white"
                                value={selectedBadgeId}
                                onChange={e => setSelectedBadgeId(e.target.value)}
                            >
                                <option value="">-- Choose Badge --</option>
                                {Object.values(BADGES).map(badge => (
                                    <option key={badge.id} value={badge.id}>
                                        {badge.icon} {badge.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            disabled={!selectedBadgeId}
                            className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Award Badge
                        </button>
                    </form>
                </div>
                {/* 3. SEND CLASSIFIED INTEL (PASTE THIS HERE) */}
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <MessageSquare className="text-indigo-600" size={20}/> Send Classified Intel
    </h2>
    <form onSubmit={sendDirectMessage} className="space-y-3">
        <textarea
            className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            rows="3"
            placeholder={`Message for ${selectedStudent?.name || selectedStudent?.displayName || "Agent"}...`}
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
        />
        <button 
            type="submit" 
            disabled={sendingMsg || !adminMessage}
            className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-indigo-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {sendingMsg ? "Transmitting..." : <><Send size={14}/> Send Transmission</>}
        </button>
    </form>
</div>
            </div>
        </div>
    </div>
  );
}