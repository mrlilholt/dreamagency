import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp, 
    onSnapshot // <--- IMPORT THIS
} from "firebase/firestore";
import { 
    ArrowLeft, 
    CheckCircle, 
    Clock, 
    Send, 
    Lock, 
    FileText, 
    DollarSign, 
    Zap, 
    AlertCircle 
} from "lucide-react";


export default function ContractDetails() {
  const { id } = useParams(); // This is the Contract ID (e.g. 'contract_123')
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [loading, setLoading] = useState(true);
const [showConfetti, setShowConfetti] = useState(false);
  // 1. Fetch the STATIC Contract Details (Title, Description, etc.)
  useEffect(() => {
    const fetchContract = async () => {
        if (!id) return;
        const docRef = doc(db, "contracts", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setContract({ id: snap.id, ...snap.data() });
        }
    };
    fetchContract();
  }, [id]);

  // 2. LISTEN to the ACTIVE JOB Status (Live Updates)
  useEffect(() => {
    if (!user?.uid || !id) return;

    // We need to find the specific 'active_jobs' document for this user & contract.
    // Since IDs are usually generated, we might know the ID if we created it deterministically,
    // OR we can query it. For simplicity, assuming you store the active_job ID or use a deterministic ID:
    // Ideally, active_jobs ID = `${user.uid}_${contractId}`
    const jobId = `${user.uid}_${id}`;
    const jobRef = doc(db, "active_jobs", jobId);

    const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (docSnap.exists()) {
            setActiveJob({ id: docSnap.id, ...docSnap.data() });
        } else {
            setActiveJob(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, id]);


  // --- ACTIONS ---

  const startContract = async () => {
    if (!user || !contract) return;
    
    // Create the ID deterministically so we can listen to it easily
    const jobId = `${user.uid}_${contract.id}`; 
    
    const newJob = {
        contract_id: contract.id,
        contract_title: contract.title,
        contract_bounty: contract.bounty,
        contract_xp: contract.xp_reward,
        student_id: user.uid,
        student_name: user.displayName || "Unknown Agent",
        status: "in_progress",
        current_stage: 1,
        stages: contract.stages, // Copy stages structure
        started_at: serverTimestamp(),
        last_updated: serverTimestamp()
    };

    await updateDoc(doc(db, "users", user.uid), {
        active_contracts: { [contract.id]: true } // Simple tracking
    });
    
    // Use setDoc to create with a specific ID
    const { setDoc } = await import("firebase/firestore"); 
    await setDoc(doc(db, "active_jobs", jobId), newJob);
  };

  const submitStage = async (stageNum) => {
    if (!submissionLink) return alert("Please add a link!");
    
    const updatedStages = { ...activeJob.stages };
    updatedStages[stageNum] = {
        ...updatedStages[stageNum],
        status: "completed", // Temporarily mark as done step locally
        submission_content: submissionLink,
        submitted_at: new Date().toISOString()
    };

    const jobRef = doc(db, "active_jobs", activeJob.id);
    await updateDoc(jobRef, {
        status: "pending_review",
        stages: updatedStages,
        last_updated: serverTimestamp()
    });
    setSubmissionLink("");
  };

  if (!contract) return <div className="p-10 text-center"><div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div></div>;

  const currentStageNum = activeJob ? activeJob.current_stage : 1;
  // If job is finished, cap it
  const displayStage = activeJob?.status === 'completed' ? 99 : currentStageNum;

  return (
    <div className="max-w-5xl mx-auto p-6">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition">
            <ArrowLeft size={18} className="mr-1"/> Back to Dashboard
        </button>

        {/* HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{contract.title}</h1>
                <p className="text-slate-500 text-lg max-w-2xl">{contract.description}</p>
            </div>
            <div className="text-right">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Value</p>
                    <div className="flex items-center gap-3 text-xl font-bold">
                        <span className="text-green-600 flex items-center"><DollarSign size={20}/>{contract.bounty}</span>
                        <span className="text-indigo-600 flex items-center"><Zap size={20}/>{contract.xp_reward} XP</span>
                    </div>
                </div>
                {activeJob && (
                    <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 text-green-800 text-sm font-bold text-center">
                        Earned So Far <br/>
                        ${Math.floor((contract.bounty / Object.keys(contract.stages).length) * (currentStageNum - 1))} / ${contract.bounty}
                    </div>
                )}
            </div>
        </div>

        {/* MAIN CONTENT GRID */}
        {!activeJob ? (
            // NOT STARTED STATE
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={40}/>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Ready to accept this mission?</h2>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    You will need to complete {Object.keys(contract.stages).length} stages to earn the full reward.
                </p>
                <button onClick={startContract} className="bg-indigo-600 text-white text-lg font-bold px-8 py-4 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                    Accept Contract
                </button>
            </div>
        ) : (
            // ACTIVE STATE
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT: PROGRESS LIST */}
                <div className="lg:col-span-1 space-y-3">
                    {Object.entries(contract.stages).map(([num, stage]) => {
                        const stageIndex = parseInt(num);
                        const isCompleted = stageIndex < displayStage;
                        const isCurrent = stageIndex === displayStage;
                        const isLocked = stageIndex > displayStage;

                        return (
                            <div key={num} className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                                isCurrent ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : 
                                isCompleted ? "bg-green-50 border-green-200" : 
                                "bg-white border-slate-100 opacity-60"
                            }`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    isCurrent ? "bg-indigo-600 text-white" : 
                                    isCompleted ? "bg-green-600 text-white" : 
                                    "bg-slate-200 text-slate-400"
                                }`}>
                                    {isCompleted ? <CheckCircle size={16}/> : 
                                     isLocked ? <Lock size={14}/> : 
                                     <div className="w-2 h-2 bg-white rounded-full"/>}
                                </div>
                                <span className={`font-bold ${isCurrent ? "text-indigo-900" : isCompleted ? "text-green-900" : "text-slate-400"}`}>
                                    {stage.name}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* RIGHT: CURRENT STAGE ACTION */}
                <div className="lg:col-span-2">
                    {activeJob.status === 'completed' ? (
                         <div className="bg-green-600 text-white p-12 rounded-2xl text-center shadow-lg">
                            <CheckCircle size={64} className="mx-auto mb-4 text-green-200" />
                            <h2 className="text-3xl font-bold mb-2">Mission Accomplished!</h2>
                            <p className="text-green-100 text-lg">You have completed all stages and earned full rewards.</p>
                         </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                            <div className="mb-6">
                                <span className="text-indigo-600 font-bold tracking-wider text-xs uppercase mb-2 block">Stage {currentStageNum}</span>
                                <h2 className="text-3xl font-bold text-slate-900 mb-4">{contract.stages[currentStageNum].name}</h2>
                                
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-6">
                                    <h3 className="font-bold text-slate-700 mb-2">Deliverable Required:</h3>
                                    <p className="text-slate-600">{contract.stages[currentStageNum].req}</p>
                                </div>
                            </div>

                            {/* DYNAMIC ACTION AREA */}
                            {activeJob.status === 'pending_review' ? (
                                <div className="bg-yellow-50 border border-yellow-100 p-8 rounded-xl text-center animate-in fade-in">
                                    <Clock className="mx-auto text-yellow-500 mb-3" size={40} />
                                    <h3 className="text-xl font-bold text-yellow-800 mb-1">In Review</h3>
                                    <p className="text-yellow-700">The Creative Director is reviewing your work.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                     {/* REJECTION ALERT (UPDATED) */}
                                     {activeJob.stages?.[currentStageNum]?.status === 'rejected' && (
                                        <div className="bg-red-50 border border-red-200 p-6 rounded-xl flex gap-4 items-start animate-pulse">
                                            <div className="bg-white p-2 rounded-full shadow-sm text-red-500 shrink-0">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-red-800 text-lg">Action Required</h4>
                                                <p className="text-red-700 mt-1">
                                                    "{activeJob.stages[currentStageNum].feedback}"
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block font-bold text-slate-700">Proof of Work (Link)</label>
                                        <input 
                                            className="w-full border border-slate-300 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                            placeholder="https://docs.google.com/..."
                                            value={submissionLink}
                                            onChange={(e) => setSubmissionLink(e.target.value)}
                                        />
                                        <p className="text-xs text-slate-400">Paste a link to your Google Doc, Slide, or Image.</p>
                                    </div>

                                    <button 
                                        onClick={() => submitStage(currentStageNum)}
                                        className={`w-full text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 ${
                                            activeJob.stages?.[currentStageNum]?.status === 'rejected' 
                                            ? "bg-red-600 hover:bg-red-700"
                                            : "bg-black hover:bg-slate-800"
                                        }`}
                                    >
                                        <Send size={18} /> 
                                        {activeJob.stages?.[currentStageNum]?.status === 'rejected' ? "Submit Fixes" : "Submit for Review"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}