import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { CLASS_CODES } from "../../lib/gameConfig";
import { 
    TrendingUp, Users, DollarSign, Trophy, 
    PieChart, Activity, Clock, BarChart3
} from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

export default function AdminAnalytics() {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // DRILL DOWN STATE
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedContract, setSelectedContract] = useState("ALL_XP");

  // --- DATA FETCHING ---
  useEffect(() => {
    // Listen to Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        const userList = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                // ROBUST DATA CHECKS: Check both 'name' and 'displayName', 'xp' and 'experience'
                displayName: data.displayName || data.name || "Unknown Agent",
                xp: data.xp || data.experience || 0,
                currency: data.currency || data.balance || 0
            };
        });
        setUsers(userList);
    });

    // Listen to Jobs
    const unsubJobs = onSnapshot(collection(db, "active_jobs"), (snap) => {
        setJobs(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        setLoading(false);
    });

    return () => { unsubUsers(); unsubJobs(); };
  }, []);

  if (loading) return <div className="p-10 text-center">Crunching numbers...</div>;

  // --- CALCULATIONS ---
  const totalMoney = users.reduce((acc, u) => acc + u.currency, 0);
  const totalXP = users.reduce((acc, u) => acc + u.xp, 0);
  const avgLevel = users.length ? Math.floor((totalXP / users.length) / 1000) + 1 : 1;

  // Class Stats Grouping
  const classStats = {};
  users.forEach(u => {
      const cId = u.class_id;
      if (!cId) return;
      if (!classStats[cId]) {
          const classObj = Object.values(CLASS_CODES).find(c => c.id === cId);
          classStats[cId] = { 
              id: cId,
              xp: 0, 
              money: 0, 
              count: 0, 
              name: classObj ? classObj.name : cId 
          };
      }
      classStats[cId].xp += u.xp;
      classStats[cId].money += u.currency;
      classStats[cId].count++;
  });

  const classComparison = Object.values(classStats).map(c => ({
      ...c,
      avgXp: c.count ? Math.floor(c.xp / c.count) : 0
  }));
  const maxAvgXp = Math.max(...classComparison.map(c => c.avgXp), 1);

  // Job Stats
  const jobCounts = {};
  jobs.forEach(j => {
      if (!jobCounts[j.contract_title]) jobCounts[j.contract_title] = { active: 0, returned: 0, total: 0 };
      jobCounts[j.contract_title].total++;
      if (j.status === 'in_progress') jobCounts[j.contract_title].active++;
      if (j.status === 'returned') jobCounts[j.contract_title].returned++;
  });
  const sortedJobs = Object.entries(jobCounts).sort((a, b) => b[1].total - a[1].total);

  // --- DRILL DOWN PREP ---
  const selectedClassName = selectedClassId ? classComparison.find(c => c.id === selectedClassId)?.name : "Select a Class";
  
  const studentsInSelectedClass = selectedClassId
      ? users.filter(u => u.class_id === selectedClassId)
      : [];

  // Contracts active in this class for the "Tabs"
  const activeContractsInClass = new Set();
  if (selectedClassId) {
      studentsInSelectedClass.forEach(s => {
          const sJobs = jobs.filter(j => j.student_id === s.id);
          sJobs.forEach(j => activeContractsInClass.add(j.contract_title));
      });
  }
  const contractTabs = Array.from(activeContractsInClass).sort();

  // Prepare Graph Data
  let graphData = [];
  let graphMax = 100;
  
  if (selectedContract === "ALL_XP") {
      // XP MODE
      // Force graphMax to be at least 2000 so bars don't look weird if everyone is low level
      const highestStudentXP = Math.max(...studentsInSelectedClass.map(s => s.xp), 0);
      graphMax = Math.max(highestStudentXP, 2000); 

      graphData = studentsInSelectedClass
          .sort((a,b) => b.xp - a.xp)
          .map(s => ({
              id: s.id,
              name: s.displayName,
              value: s.xp,
              displayValue: `${s.xp} XP`,
              heightPercent: (s.xp / graphMax) * 100,
              color: "bg-indigo-500",
              isRed: false
          }));
  } else {
      // CONTRACT MODE
      graphMax = 6; // Max stages
      const relevantStudents = studentsInSelectedClass.filter(s => 
          jobs.some(j => j.student_id === s.id && j.contract_title === selectedContract)
      );

      graphData = relevantStudents
          .map(s => {
              const job = jobs.find(j => j.student_id === s.id && j.contract_title === selectedContract);
              const isRejected = job?.stages?.[job.current_stage]?.status === 'rejected';
              return {
                  id: s.id,
                  name: s.displayName,
                  value: job ? job.current_stage : 0,
                  displayValue: `Stage ${job ? job.current_stage : 0}`,
                  heightPercent: ((job ? job.current_stage : 0) / graphMax) * 100,
                  color: isRejected ? "bg-red-500" : "bg-green-500",
                  isRed: isRejected
              };
          })
          .sort((a,b) => b.value - a.value);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AdminNavbar />

      <div className="max-w-7xl mx-auto p-8">
        
        {/* HEADER */}
        <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="text-indigo-600"/> Agency Analytics
            </h1>
            <p className="text-slate-500">Deep dive into agency performance and economic health.</p>
        </div>

        {/* --- ROW 1: MACRO ECONOMICS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total GDP</p>
                <h2 className="text-4xl font-black text-green-600 mt-2 flex items-center gap-1">
                    <DollarSign size={28}/> {totalMoney.toLocaleString()}
                </h2>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Knowledge</p>
                <h2 className="text-4xl font-black text-indigo-600 mt-2 flex items-center gap-1">
                    <Trophy size={28}/> {totalXP.toLocaleString()}
                </h2>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Seniority</p>
                <h2 className="text-4xl font-black text-slate-700 mt-2">Level {avgLevel}</h2>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            {/* CLASS PERFORMANCE */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-indigo-500"/> Class Performance
                    </h3>
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded uppercase animate-pulse">
                        Click bars to view Details
                    </span>
                </div>
                <div className="space-y-6">
                    {classComparison.map((cls) => {
                        const isSelected = selectedClassId === cls.id;
                        return (
                            <div 
                                key={cls.id} 
                                onClick={() => {
                                    setSelectedClassId(isSelected ? null : cls.id);
                                    setSelectedContract("ALL_XP");
                                }}
                                className={`cursor-pointer transition group ${isSelected ? 'opacity-100' : 'hover:opacity-80'}`}
                            >
                                <div className="flex justify-between text-sm font-bold mb-1">
                                    <span className={`${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{cls.name}</span>
                                    <span className="text-indigo-600">{cls.avgXp} XP Avg</span>
                                </div>
                                <div className={`w-full h-4 rounded-full overflow-hidden ${isSelected ? 'ring-2 ring-indigo-300 ring-offset-1' : 'bg-slate-100'}`}>
                                    <div 
                                        className={`h-full transition-all duration-500 ${isSelected ? 'bg-indigo-600' : 'bg-indigo-400'}`} 
                                        style={{ width: `${(cls.avgXp / maxAvgXp) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CONTRACT POPULARITY */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                    <PieChart size={20} className="text-orange-500"/> Contract Popularity
                </h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedJobs.map(([title, stats], idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                            <div>
                                <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]" title={title}>{title}</p>
                                <div className="flex gap-3 text-xs mt-1">
                                    <span className="text-green-600 font-bold">{stats.active} Active</span>
                                    <span className="text-red-400 font-bold">{stats.returned} Returns</span>
                                </div>
                            </div>
                            <span className="text-xl font-black text-slate-200">#{idx + 1}</span>
                        </div>
                    ))}
                    {sortedJobs.length === 0 && <p className="text-slate-400 italic">No contracts started.</p>}
                </div>
            </div>
        </div>

        {/* --- THE DRILL DOWN SECTION --- */}
        {selectedClassId && (
            <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. HEADER & TABS */}
                <div className="bg-indigo-50/50 p-6 border-b border-indigo-100">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                                <Activity className="text-indigo-600" />
                                {selectedClassName} Performance
                            </h2>
                            <p className="text-slate-500 text-sm">Comparing {studentsInSelectedClass.length} agents.</p>
                        </div>
                        <button onClick={() => setSelectedClassId(null)} className="text-sm font-bold text-slate-400 hover:text-indigo-600">Close</button>
                    </div>

                    {/* CONTRACT TABS */}
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => setSelectedContract("ALL_XP")}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                                selectedContract === "ALL_XP" 
                                ? "bg-indigo-600 text-white shadow-md" 
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                            <Trophy size={14} className="inline mr-1 mb-0.5"/> Overall XP
                        </button>
                        {contractTabs.map(title => (
                            <button 
                                key={title}
                                onClick={() => setSelectedContract(title)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                                    selectedContract === title 
                                    ? "bg-indigo-600 text-white shadow-md" 
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                                <BarChart3 size={14} className="inline mr-1 mb-0.5"/> {title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. THE CHART AREA */}
                <div className="p-8 overflow-x-auto">
                    {graphData.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic">No data available for this view.</div>
                    ) : (
                        <div className="flex items-end gap-3 h-64 min-w-max pb-4 px-2 border-b border-slate-200">
                            {graphData.map((data) => {
                                // Ensure min height of 10% so bar is always visible even if value is low
                                const finalHeight = Math.max(data.heightPercent, 10); 

                                return (
                                    <div key={data.id} className="flex flex-col items-center group w-20 relative">
                                        
                                        {/* Value Label (Always visible on hover or if bar is tall) */}
                                        <div className="mb-2 text-xs font-bold text-slate-500 transition-all group-hover:text-indigo-600 group-hover:scale-110">
                                            {data.displayValue}
                                        </div>

                                        {/* The Bar */}
                                        <div 
                                            className={`w-full rounded-t-md transition-all duration-500 relative ${data.color} ${data.isRed ? 'animate-pulse' : ''} hover:brightness-110`}
                                            style={{ height: `${finalHeight}%` }}
                                        ></div>

                                        {/* Student Name */}
                                        <div className="mt-3 text-xs font-bold text-slate-500 truncate w-full text-center" title={data.name}>
                                            {data.name.split(' ')[0]} 
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        )}
      </div>
    </div>
  );
}