import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { 
  collection, 
  query, 
  onSnapshot,
  doc, 
  updateDoc, 
  increment 
} from "firebase/firestore";
import { 
    CheckCircle, 
    XCircle, 
    Clock, 
    ExternalLink, 
    AlertTriangle, 
    Briefcase,
    Users,
    Inbox
} from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

const REJECTION_REASONS = [
    "Link is broken or not accessible",
    "Submission is incomplete",
    "Did not meet the requirements",
    "Other (Write below)"
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  // --- STATE ---
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ activeCount: 0, agentCount: 0 });
  
  // --- REJECTION STATE ---
  const [rejectingJob, setRejectingJob] = useState(null); 
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [customFeedback, setCustomFeedback] = useState("");

  // --- LISTENERS ---
  useEffect(() => {
    const q = query(collection(db, "active_jobs")); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const pending = allJobs.filter(job => job.status === 'pending_review');
      setSubmissions(pending);

      const active = allJobs.filter(job => job.status === 'in_progress').length;
      setStats(prev => ({ ...prev, activeCount: active }));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
        setStats(prev => ({ ...prev, agentCount: snap.size }));
    });
    return () => unsub();
  }, []);

  // --- ACTIONS ---
  const handleApprove = async (job) => {
    if(!confirm("Approve this work and send payment?")) return;

    try {
      const jobRef = doc(db, "active_jobs", job.id);
      const studentRef = doc(db, "users", job.student_id);

      const bounty = job.contract_bounty || 500; 
      const xp = job.contract_xp || 1000;
      const stageCount = Object.keys(job.stages || {}).length || 6;
      
      const payout = Math.floor(bounty / stageCount);
      const xpGain = Math.floor(xp / stageCount);
      const nextStage = job.current_stage + 1;
      
      await updateDoc(jobRef, {
        status: 'in_progress', 
        current_stage: nextStage,
        last_updated: new Date().toISOString()
      });

      await updateDoc(studentRef, {
        currency: increment(payout),
        xp: increment(xpGain)
      });
    } catch (error) {
      console.error(error);
      alert("Error approving work.");
    }
  };

  const submitRejection = async () => {
    if (!rejectingJob) return;
    
    const finalFeedback = reason === "Other (Write below)" ? customFeedback : reason;
    if (!finalFeedback) return alert("Please provide a reason.");

    try {
        const jobRef = doc(db, "active_jobs", rejectingJob.id);
        const currentStageIndex = rejectingJob.current_stage;
        
        const updatedStages = { ...rejectingJob.stages };
        if (updatedStages[currentStageIndex]) {
            updatedStages[currentStageIndex].status = "rejected";
            updatedStages[currentStageIndex].feedback = finalFeedback;
        }

        await updateDoc(jobRef, {
            status: "returned", 
            stages: updatedStages,
            last_updated: new Date().toISOString()
        });

        setRejectingJob(null);
        setCustomFeedback("");
    } catch (error) {
        console.error("Error rejecting:", error);
        alert("Error sending feedback.");
    }
  };

  // --- NAVIGATION HELPERS ---
  const scrollToQueue = () => {
      document.getElementById('queue-section').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AdminNavbar />

      <div className="p-8 max-w-6xl mx-auto relative">
        
        {/* SECTION 1: MORNING BRIEFING (HUD) */}
        <div className="mb-10">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-6">Agency Command Center</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* HUD CARD 1: INBOX (Scrolls to Queue) */}
                <div 
                    onClick={scrollToQueue}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group"
                >
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-orange-600 transition-colors">Review Queue</p>
                        <h2 className={`text-4xl font-black ${submissions.length > 0 ? "text-orange-500" : "text-slate-300"}`}>
                            {submissions.length}
                        </h2>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${submissions.length > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-400"}`}>
                        <Inbox size={24} />
                    </div>
                </div>

                {/* HUD CARD 2: ACTIVE MISSIONS (Goes to Roster) */}
                <div 
                    onClick={() => navigate('/admin/contracts')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-indigo-600 transition-colors">Missions in Progress</p>
                        <h2 className="text-4xl font-black text-indigo-600">{stats.activeCount}</h2>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Briefcase size={24} />
                    </div>
                </div>

                {/* HUD CARD 3: TOTAL AGENTS (Goes to Roster) */}
                <div 
                    onClick={() => navigate('/admin/roster')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
                >
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-slate-800 transition-colors">Total Agents</p>
                        <h2 className="text-4xl font-black text-slate-700">{stats.agentCount}</h2>
                    </div>
                    <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-all">
                        <Users size={24} />
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 2: THE REVIEW QUEUE */}
        <div id="queue-section"> {/* <--- Added ID for scrolling */}
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Clock className="text-slate-400" /> Incoming Deliverables
            </h2>

            {submissions.length === 0 ? (
                <div className="bg-white p-16 rounded-xl text-center border border-slate-200 shadow-sm">
                    <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 text-green-500 animate-pulse">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">All Caught Up!</h3>
                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                        No submissions are waiting for review. You can check the Roster to see who is falling behind.
                    </p>
                    <button 
                        onClick={() => navigate('/admin/roster')}
                        className="mt-6 text-indigo-600 font-bold hover:underline"
                    >
                        Check Agent Roster
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {submissions.map(job => {
                        const submissionContent = job.stages?.[job.current_stage]?.submission_content || "No content found";
                        const stageTitle = job.stages?.[job.current_stage]?.name || "Unknown Stage";

                        return (
                            <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8 animate-in slide-in-from-bottom-2">
                                {/* CONTENT SIDE */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide border border-orange-200">
                                            Stage {job.current_stage}: {stageTitle}
                                        </span>
                                        <span className="text-slate-400 text-sm font-bold flex items-center gap-1">
                                            <Users size={14}/> {job.student_name || "Unknown Agent"}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{job.contract_title}</h3>
                                    
                                    {/* The Link Box */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 group hover:border-indigo-300 transition-colors">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Submission Link</p>
                                        <div className="flex items-center gap-2 text-indigo-600 font-medium">
                                            <ExternalLink size={16} />
                                            <a href={submissionContent} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                                                {submissionContent}
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION SIDE */}
                                <div className="flex flex-col justify-center gap-3 min-w-[200px] border-l border-slate-100 pl-6 lg:ml-4">
                                    <button onClick={() => handleApprove(job)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95">
                                        <CheckCircle size={20} /> Approve & Pay
                                    </button>
                                    <button 
                                        onClick={() => setRejectingJob(job)}
                                        className="bg-white border-2 border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <XCircle size={20} /> Request Changes
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* --- REJECTION MODAL --- */}
        {rejectingJob && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 text-red-600 mb-4">
                        <AlertTriangle />
                        <h3 className="text-xl font-bold">Request Changes</h3>
                    </div>
                    
                    <p className="text-slate-600 mb-4">
                        Why are you returning <strong>{rejectingJob.contract_title}</strong>?
                    </p>

                    <div className="space-y-3 mb-6">
                        {REJECTION_REASONS.map((r) => (
                            <label key={r} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                                <input 
                                    type="radio" 
                                    name="reason" 
                                    value={r} 
                                    checked={reason === r} 
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                                />
                                <span className="text-slate-700 font-medium">{r}</span>
                            </label>
                        ))}

                        {reason === "Other (Write below)" && (
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg p-3 mt-2 focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="Type specific feedback here..."
                                rows={3}
                                value={customFeedback}
                                onChange={(e) => setCustomFeedback(e.target.value)}
                            />
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setRejectingJob(null)}
                            className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={submitRejection}
                            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md"
                        >
                            Return to Student
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}