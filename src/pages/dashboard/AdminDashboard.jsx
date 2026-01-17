import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { 
  collection, 
  query, 
  onSnapshot,
  doc, 
  updateDoc, 
  setDoc,
  getDoc, 
  deleteDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { 
    CheckCircle, 
    Clock, 
    ExternalLink, 
    AlertTriangle, 
    Users,
    Inbox,
    TrendingDown,
    Zap,
    MessageSquare,
    Layers,
    Code
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
  const [marketActive, setMarketActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // --- REJECTION STATE ---
  const [rejectingJob, setRejectingJob] = useState(null); 
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [customFeedback, setCustomFeedback] = useState("");

  // --- LISTENERS ---
  useEffect(() => {
    const q = query(collection(db, "active_jobs")); 
    const unsubJobs = onSnapshot(q, (snapshot) => {
      const allJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setStats(prev => ({ ...prev, activeCount: allJobs.length }));

      // --- FILTER LOGIC ---
      const pendingOnly = allJobs.filter(job => {
          // 1. Shop Purchases
          if (job.type === 'shop_purchase' && job.status === 'pending_fulfillment') return true;
          
          // 2. Check Root Status (This catches your "pending_review" job!)
          if (['pending_review', 'review', 'submitted', 'pending'].includes(job.status)) return true;

          // 3. Fallback: Check if any stage is explicitly pending
          if (job.stages) {
             const hasPendingStage = Object.values(job.stages).some(s => 
                 ['pending_review', 'review', 'submitted', 'pending'].includes(s.status)
             );
             if (hasPendingStage) return true;
          }

          return false;
      });

      setSubmissions(pendingOnly);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
         setStats(prev => ({ ...prev, agentCount: snap.size }));
    });

    const unsubMarket = onSnapshot(doc(db, "system", "market"), (snap) => {
        if (snap.exists()) setMarketActive(snap.data().saleActive);
    });

    return () => { unsubJobs(); unsubUsers(); unsubMarket(); };
  }, []);

  // --- ACTIONS ---

  const toggleMarketCrash = async () => {
    const newState = !marketActive;
    if (window.confirm(newState ? "⚠ CRASH MARKET?" : "RESTORE MARKET?")) {
        await setDoc(doc(db, "system", "market"), { saleActive: newState });
    }
  };

  const getActiveStageIndex = (job) => {
      if (!job.stages) return null;
      // 1. If we have current_stage, USE IT (This is the fix!)
      if (job.current_stage) return job.current_stage.toString();

      // 2. Fallback: Find first pending stage
      const isPending = (s) => ['pending_review', 'review', 'submitted', 'pending'].includes(s.status);
      const entry = Object.entries(job.stages).find(([key, stage]) => isPending(stage.status));
      return entry ? entry[0] : null;
  };

  const handleJobAction = async (job, status) => {
    if (status === 'rejected') {
        setRejectingJob(job);
        return;
    }

    if (!confirm(`Mark ${job.student_name}'s work as ${status}?`)) return;

    try {
        const userRef = doc(db, "users", job.student_id);
        const jobRef = doc(db, "active_jobs", job.id);
        
        let bounty = 100;
        let xp = 50;

        // Try to fetch specific contract rewards
        if (job.contract_id) {
            const contractSnap = await getDoc(doc(db, "contracts", job.contract_id));
            if (contractSnap.exists()) {
                bounty = parseInt(contractSnap.data().bounty) || 100;
                xp = parseInt(contractSnap.data().xp_reward) || 50;
            }
        }

        const stageIndex = getActiveStageIndex(job);

        if (stageIndex !== null) {
            // === SCENARIO A: STAGED CONTRACT ===
            // 1. Mark current stage as approved
            // 2. Increment current_stage to next step
            const nextStage = parseInt(stageIndex) + 1;
            const totalStages = Object.keys(job.stages || {}).length;

            if (nextStage > totalStages) {
                // All stages done!
                await deleteDoc(jobRef); 
                alert("Contract Fully Complete!");
            } else {
                // Move to next stage
                await updateDoc(jobRef, {
                    [`stages.${stageIndex}.status`]: "approved", 
                    status: "in_progress", // Set root back to in_progress
                    current_stage: nextStage // Advance the counter
                });
                alert("Stage Approved! Student moved to next step.");
            }
        } else {
            // === SCENARIO B: FLAT JOB ===
            await deleteDoc(jobRef);
            alert("Job Complete!");
        }

        // Pay User
        await updateDoc(userRef, {
            currency: increment(bounty),
            xp: increment(xp),
            completed_jobs: increment(1)
        });

    } catch (err) {
        console.error("Error approving:", err);
        alert("Error processing approval.");
    }
  };

  const submitRejection = async () => {
    if (!rejectingJob) return;
    try {
        const finalReason = reason === "Other (Write below)" ? customFeedback : reason;
        const jobRef = doc(db, "active_jobs", rejectingJob.id);
        const stageIndex = getActiveStageIndex(rejectingJob);

        if (stageIndex !== null) {
            await updateDoc(jobRef, {
                [`stages.${stageIndex}.status`]: "returned",
                [`stages.${stageIndex}.feedback`]: finalReason,
                status: "returned"
            });
        } else {
            await updateDoc(jobRef, {
                status: "returned",
                feedback: finalReason
            });
        }
        setRejectingJob(null);
        setCustomFeedback("");
    } catch (err) {
        console.error(err);
        alert("Error returning job.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar />

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COL: SUBMISSIONS --- */}
        <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Inbox className="text-indigo-600" /> Incoming
                    <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">{submissions.length}</span>
                </h2>
                <button 
                    onClick={() => setDebugMode(!debugMode)}
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border transition ${
                        debugMode ? "bg-black text-white border-black" : "bg-white text-slate-400 border-slate-200"
                    }`}
                >
                    <Code size={14} /> {debugMode ? "DEBUG ON" : "DEBUG OFF"}
                </button>
            </div>

            {submissions.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-dashed border-slate-300">
                    <CheckCircle className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-400">All Clear</h3>
                </div>
            ) : (
                submissions.map(job => {
                    const isShopPurchase = job.type === 'shop_purchase';
                    
                    // --- INTELLIGENT DATA EXTRACTION ---
                    // 1. Default Root values
                    let submissionLink = job.link || job.submissionLink || job.url || job.googleDoc || job.fileUrl || job.submission_content; // <--- ADDED submission_content
                    let submissionText = job.notes || job.message || job.submissionText;
                    let stageLabel = "";

                    // 2. CHECK SPECIFIC STAGE (Using job.current_stage from your JSON)
                    if (job.stages && job.current_stage) {
                        const stageData = job.stages[job.current_stage];
                        if (stageData) {
                            // PRIORITIZE STAGE DATA
                            // Look for 'submission_content' specifically!
                            submissionLink = stageData.submission_content || stageData.submissionLink || stageData.link || stageData.url || submissionLink;
                            submissionText = stageData.notes || stageData.submissionText || submissionText;
                            stageLabel = stageData.name || `Stage ${job.current_stage}`;
                        }
                    } 
                    // 3. Fallback: Scan for any pending stage if current_stage is missing
                    else if (job.stages) {
                        const pendingEntry = Object.entries(job.stages).find(([k, s]) => 
                            ['pending_review', 'review', 'submitted', 'pending'].includes(s.status)
                        );
                        if (pendingEntry) {
                            const [idx, stageData] = pendingEntry;
                            submissionLink = stageData.submission_content || stageData.submissionLink || stageData.link || submissionLink;
                            submissionText = stageData.notes || stageData.submissionText || submissionText;
                            stageLabel = `Stage ${parseInt(idx)}`;
                        }
                    }

                    return (
                        <div key={job.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
                            
                            {/* HEADER */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex gap-2 mb-2">
                                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block ${
                                            isShopPurchase ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                            {isShopPurchase ? 'ITEM PURCHASE' : 'CONTRACT SUBMISSION'}
                                        </span>
                                        {stageLabel && (
                                            <span className="bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">
                                                <Layers size={10} /> {stageLabel}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">{job.contract_title || "Unknown Mission"}</h3>
                                    <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                        <Users size={14} /> Agent: <span className="font-medium text-slate-700">{job.student_name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* --- DEBUG DATA VIEW --- */}
                            {debugMode && (
                                <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                                    <p className="text-white font-bold mb-2 border-b border-slate-700 pb-1">RAW FIRESTORE DATA:</p>
                                    <pre>{JSON.stringify(job, null, 2)}</pre>
                                </div>
                            )}

                            {/* LINK DISPLAY */}
                            {submissionLink && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between group hover:border-indigo-300 transition">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-white p-2 rounded border border-slate-200 text-slate-400">
                                            <ExternalLink size={16} />
                                        </div>
                                        <span className="text-sm text-slate-600 font-mono truncate">
                                            {submissionLink}
                                        </span>
                                    </div>
                                    <a 
                                        href={submissionLink.startsWith('http') ? submissionLink : `https://${submissionLink}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="whitespace-nowrap flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
                                    >
                                        OPEN FILE <ExternalLink size={12} />
                                    </a>
                                </div>
                            )}

                            {/* NOTES DISPLAY */}
                            {submissionText && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-slate-700 text-sm relative">
                                    <div className="absolute top-3 right-3 text-yellow-400">
                                        <MessageSquare size={16} />
                                    </div>
                                    <span className="font-bold text-yellow-700 text-xs uppercase mb-1 block">Student Note:</span>
                                    "{submissionText}"
                                </div>
                            )}

                            {/* ERROR STATE */}
                            {!submissionLink && !submissionText && !isShopPurchase && (
                                <div className="bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2 text-red-600 text-sm font-bold">
                                    <AlertTriangle size={16} />
                                    <span>No attachment found. (Turn on DEBUG MODE to investigate)</span>
                                </div>
                            )}

                            {/* ACTIONS */}
                            <div className="flex gap-3 pt-2 border-t border-slate-100 mt-2">
                                <button 
                                    onClick={() => handleJobAction(job, 'approved')}
                                    className="flex-1 bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-green-600 transition flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} /> {isShopPurchase ? 'Fulfill Order' : 'Approve Stage & Pay'}
                                </button>
                                
                                {!isShopPurchase && (
                                    <button 
                                        onClick={() => handleJobAction(job, 'rejected')}
                                        className="px-4 py-2 border border-slate-200 text-slate-500 font-bold rounded-lg hover:bg-red-50 hover:text-red-600 transition"
                                    >
                                        Return
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* --- RIGHT COL: CONTROLS --- */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-4">Agency Status</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-xl">
                        <p className="text-2xl font-black text-indigo-600">{stats.agentCount}</p>
                        <p className="text-xs text-indigo-400 font-bold">Agents</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
                        <p className="text-2xl font-black text-green-600">{stats.activeCount}</p>
                        <p className="text-xs text-green-500 font-bold">Jobs</p>
                    </div>
                </div>
            </div>

            {/* MARKET CONTROL */}
            <div className={`p-6 rounded-2xl border transition-all ${
                marketActive 
                ? "bg-red-50 border-red-200 shadow-inner" 
                : "bg-white border-slate-200 shadow-sm"
            }`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold flex items-center gap-2 ${marketActive ? "text-red-700" : "text-slate-700"}`}>
                        <TrendingDown size={20} /> Market
                    </h3>
                    {marketActive && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">
                            CRASH ACTIVE
                        </span>
                    )}
                </div>
                
                <button 
                    onClick={toggleMarketCrash}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg ${
                        marketActive
                        ? "bg-white text-red-600 border-2 border-red-600 hover:bg-red-50"
                        : "bg-red-600 text-white hover:bg-red-700 hover:scale-105"
                    }`}
                >
                    {marketActive ? "STABILIZE" : <><Zap size={18}/> CRASH MARKET</>}
                </button>
            </div>
        </div>

        {/* REJECTION MODAL */}
        {rejectingJob && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center gap-3 mb-4 text-red-600">
                        <AlertTriangle />
                        <h3 className="font-bold text-lg">Return Submission</h3>
                    </div>
                    
                    <p className="text-slate-600 mb-4 text-sm">
                        Why are you returning <span className="font-bold">{rejectingJob.student_name}</span>'s work?
                    </p>

                    <div className="space-y-3 mb-6">
                        {REJECTION_REASONS.map(r => (
                            <label key={r} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-500 transition">
                                <input 
                                    type="radio" 
                                    name="reason" 
                                    value={r}
                                    checked={reason === r}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-slate-700 font-medium text-sm">{r}</span>
                            </label>
                        ))}

                        {reason === "Other (Write below)" && (
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg p-3 mt-2 focus:ring-2 focus:ring-red-500 outline-none text-sm"
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
                            className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-lg text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={submitRejection}
                            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md text-sm"
                        >
                            Return to Agent
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}