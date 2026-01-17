import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { CLASS_CODES } from "../../lib/gameConfig"; 
import { 
    Users, Filter, Search, Trophy, DollarSign, 
    Briefcase, AlertCircle, Trash2, Gavel, ArrowLeft, ChevronRight, User
} from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

export default function AdminRoster() {
  // --- STATE ---
  const [students, setStudents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filterClass, setFilterClass] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // THE FIX: Store the ID, not the object
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  
  const [loading, setLoading] = useState(true);
  const [bonusForm, setBonusForm] = useState({ currency: 0, xp: 0 });

  // --- LISTENERS ---
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // SORT BY 'NAME' (Fall back to displayName if empty)
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

  // --- DERIVED STATE ---
  // This ensures 'selectedStudent' is ALWAYS the latest version from the live 'students' array
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // --- ACTIONS ---
  const handleRedeem = async (studentId, itemIndex, currentInventory) => {
    if(!confirm("Mark this item as used and remove it from inventory?")) return;
    
    // Create deep copy to be safe
    const newInventory = [...currentInventory];
    newInventory.splice(itemIndex, 1); 

    try {
        await updateDoc(doc(db, "users", studentId), { inventory: newInventory });
        // No need to manually update state; onSnapshot will trigger a re-render
        // and 'selectedStudent' will automatically recalculate with the new data.
    } catch (err) { 
        console.error(err);
        alert("Error redeeming item"); 
    }
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

  // --- FILTERING ---
  const filteredStudents = students.filter(s => {
      // 1. Class Filter
      const matchesClass = filterClass === "all" || s.class_id === filterClass;
      
      // 2. Search by NAME (Prioritize 'name' field)
      const nameToCheck = (s.name || s.displayName || "Unknown Agent").toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = nameToCheck.includes(searchLower);
      
      return matchesClass && matchesSearch;
  });

  const selectedStudentJobs = selectedStudent 
    ? jobs.filter(j => j.student_id === selectedStudent.id) 
    : [];

  const getClassName = (id) => {
      const entry = Object.values(CLASS_CODES).find(c => c.id === id);
      return entry ? entry.name : "Unknown Class";
  };

  const getName = (s) => s.name || s.displayName || "Unknown Agent";

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Roster...</div>;

  // ================= VIEW 1: THE LIST (ROSTER) =================
  // Check against selectedStudentId, not the object
  if (!selectedStudentId) {
    return (
        <div className="max-w-5xl mx-auto p-6 min-h-screen">
            <AdminNavbar />
            {/* HEADER */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="text-indigo-600"/> Agent Roster
                </h1>
                <p className="text-slate-500">Select an agent to view their profile, inventory, and missions.</p>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Search student name..." 
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

            {/* STUDENT LIST */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Agent Name</th>
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
                                // UPDATE: Set ID, not Object
                                onClick={() => setSelectedStudentId(student.id)}
                                className="hover:bg-indigo-50/50 cursor-pointer transition group"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                                            {getName(student).charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-900 group-hover:text-indigo-700">
                                            {getName(student)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 hidden sm:table-cell">
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                                        {getClassName(student.class_id)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-medium text-green-600">
                                    ${student.currency || 0}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-medium text-indigo-600">
                                    {student.xp || 0} XP
                                </td>
                                <td className="px-6 py-4 text-right text-slate-400">
                                    <ChevronRight size={18} />
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">
                                    No agents found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
  }

  // Handle case where ID is set but student not found (e.g. deleted/loading)
  if (!selectedStudent) return <div className="p-10 text-center">Loading Agent Data...</div>;

  // ================= VIEW 2: DRILL-DOWN (PROFILE) =================
  return (
    <div className="max-w-5xl mx-auto p-6 min-h-screen">
        <button 
            // UPDATE: Clear ID
            onClick={() => setSelectedStudentId(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-6 transition"
        >
            <ArrowLeft size={20}/> Back to Roster
        </button>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 text-white text-2xl font-bold rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 uppercase">
                    {getName(selectedStudent).charAt(0)}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">{getName(selectedStudent)}</h1>
                    <p className="text-slate-500 font-medium">{getClassName(selectedStudent.class_id)}</p>
                </div>
            </div>
            
            <div className="flex gap-6">
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Balance</p>
                    <p className="text-2xl font-black text-green-600 flex items-center justify-end gap-1">
                        <DollarSign size={20}/> {selectedStudent.currency || 0}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Experience</p>
                    <p className="text-2xl font-black text-indigo-600 flex items-center justify-end gap-1">
                        <Trophy size={20}/> {selectedStudent.xp || 0}
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: MISSIONS (Wide) */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* ACTIVE MISSIONS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Briefcase className="text-indigo-600" size={20}/> Active Contracts
                    </h2>
                    
                    {selectedStudentJobs.length === 0 ? (
                        <p className="text-slate-400 italic">This agent has no active contracts.</p>
                    ) : (
                        <div className="space-y-4">
                            {selectedStudentJobs.map(job => (
                                <div key={job.id} className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50 transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-800">{job.contract_title}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                            job.stages?.[job.current_stage]?.status === 'rejected' 
                                            ? "bg-red-100 text-red-700" 
                                            : "bg-indigo-50 text-indigo-700"
                                        }`}>
                                            Stage {job.current_stage}
                                        </span>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                                        <div 
                                            className={`h-full ${job.stages?.[job.current_stage]?.status === 'rejected' ? 'bg-red-500' : 'bg-indigo-600'}`} 
                                            style={{ width: `${(job.current_stage / 6) * 100}%` }}
                                        ></div>
                                    </div>

                                    {job.stages?.[job.current_stage]?.status === 'rejected' && (
                                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                                            <AlertCircle size={12}/> Needs Revision
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* INVENTORY & REDEMPTION */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={20}/> Inventory Redemption
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">Click an item to mark it as "Used" and remove it.</p>

                    <div className="flex flex-wrap gap-3">
                        {(!selectedStudent.inventory || selectedStudent.inventory.length === 0) && (
                            <span className="text-slate-400 italic text-sm">Inventory is empty.</span>
                        )}
                        {selectedStudent.inventory?.map((item, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleRedeem(selectedStudent.id, idx, selectedStudent.inventory)}
                                className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition group shadow-sm"
                            >
                                <span className="font-bold text-sm">
                                    {typeof item === 'object' ? item.name : item}
                                </span>
                                <Trash2 size={14} className="text-slate-400 group-hover:text-red-600"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* COLUMN 2: MANAGEMENT (Narrow) */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Gavel className="text-slate-600" size={20}/> Admin Actions
                    </h2>
                    
                    <form onSubmit={handleBonusSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adjust Funds ($)</label>
                            <input 
                                type="number" 
                                className="w-full border border-slate-300 p-2 rounded-lg font-mono focus:ring-2 focus:ring-green-500 outline-none" 
                                placeholder="0" 
                                value={bonusForm.currency}
                                onChange={e => setBonusForm({...bonusForm, currency: e.target.value})}
                            />
                            <p className="text-xs text-slate-400 mt-1">Negative to fine, Positive to bonus.</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adjust XP</label>
                            <input 
                                type="number" 
                                className="w-full border border-slate-300 p-2 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="0" 
                                value={bonusForm.xp}
                                onChange={e => setBonusForm({...bonusForm, xp: e.target.value})}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-indigo-600 transition shadow-md"
                        >
                            Apply Adjustments
                        </button>
                    </form>
                </div>
            </div>

        </div>
    </div>
  );
}