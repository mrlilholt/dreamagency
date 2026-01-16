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
    Plus, 
    CheckCircle, 
    XCircle, 
    Clock, 
    ExternalLink, 
    AlertTriangle, 
    Folder 
} from "lucide-react";

const REJECTION_REASONS = [
    "Link is broken or not accessible",
    "Submission is incomplete",
    "Did not meet the requirements",
    "Other (Write below)"
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  // --- DASHBOARD STATE ---
  const [submissions, setSubmissions] = useState([]);
  
  // --- REJECTION STATE ---
  const [rejectingJob, setRejectingJob] = useState(null); 
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [customFeedback, setCustomFeedback] = useState("");

  // --- EFFECT: Real-time Listener for Deliverables ---
  useEffect(() => {
    const q = query(collection(db, "active_jobs")); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(job => job.status === 'pending_review');
      setSubmissions(pending);
    });
    return () => unsubscribe();
  }, []);

  // --- APPROVE LOGIC ---
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

  // --- REJECT LOGIC ---
  const submitRejection = async () => {
    if (!rejectingJob) return;
    
    const finalFeedback = reason === "Other (Write below)" ? customFeedback : reason;
    if (!finalFeedback) return alert("Please provide a reason.");

    try {
        const jobRef = doc(db, "active_jobs", rejectingJob.id);
        const currentStageIndex = rejectingJob.current_stage;
        
        // 1. Mark the specific stage as 'rejected'
        const updatedStages = { ...rejectingJob.stages };
        if (updatedStages[currentStageIndex]) {
            updatedStages[currentStageIndex].status = "rejected";
            updatedStages[currentStageIndex].feedback = finalFeedback;
        }

        // 2. Set global status to 'returned'
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

  return (
    <div className="p-8 max-w-6xl mx-auto relative">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Agency Command Center</h1>
            <p className="text-slate-500 mt-2">Manage contracts and review deliverables.</p>
        </div>
        
        <div className="flex gap-3">
            <button 
                onClick={() => navigate('/admin/contracts')}
                className="bg-white border border-slate-300 text-slate-700 px-5 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
            >
                <Folder size={20} /> Manage Contracts
            </button>
            <button 
                // THIS NOW GOES TO YOUR ROBUST PAGE
                onClick={() => navigate('/admin/create')}
                className="bg-indigo-600 shadow-lg shadow-indigo-200 text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition font-medium"
            >
                <Plus size={20} /> New Client Contract
            </button>
        </div>
      </header>

      {/* --- REVIEW QUEUE --- */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="text-orange-500" /> Incoming Deliverables
            {submissions.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-sm py-1 px-3 rounded-full font-bold">
                    {submissions.length} Pending
                </span>
            )}
        </h2>

        {submissions.length === 0 ? (
            <div className="bg-slate-50 p-16 rounded-xl text-center border-2 border-dashed border-slate-200">
                <div className="mx-auto w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <CheckCircle size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-600">All Caught Up!</h3>
                <p className="text-slate-400 mt-2">No active missions are waiting for review.</p>
            </div>
        ) : (
            <div className="space-y-6">
                {submissions.map(job => {
                    const submissionContent = job.stages?.[job.current_stage]?.submission_content || "No content found";
                    const stageTitle = job.stages?.[job.current_stage]?.name || "Unknown Stage";

                    return (
                        <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide border border-orange-200">
                                        Stage {job.current_stage}: {stageTitle}
                                    </span>
                                    <span className="text-slate-400 text-sm font-mono">• {job.student_name}</span>
                                </div>
                                
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{job.contract_title}</h3>
                                
                                <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 mt-4">
                                    <div className="flex items-center gap-2 text-indigo-600 font-medium">
                                        <ExternalLink size={16} />
                                        <a href={submissionContent} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                                            {submissionContent}
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col justify-center gap-3 min-w-[200px] border-l border-slate-100 pl-6">
                                <button onClick={() => handleApprove(job)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                                    <CheckCircle size={18} /> Approve & Pay
                                </button>
                                <button 
                                    onClick={() => setRejectingJob(job)}
                                    className="bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    <XCircle size={18} /> Request Changes
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
  );
}