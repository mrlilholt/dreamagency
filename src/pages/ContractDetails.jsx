import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { 
    doc, 
    updateDoc, 
    serverTimestamp, 
    onSnapshot 
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
    AlertCircle,
    TrendingUp
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";

const DEFAULT_STAGE_TEMPLATES = [
  { name: "Research & Ideate", req: "Submit 3 sketches and research links." },
  { name: "Proposal", req: "Submit a 1-paragraph proposal." },
  { name: "Prototype", req: "Submit photo/link of first build." },
  { name: "Test", req: "Submit testing data/feedback notes." },
  { name: "Iterate", req: "What changes did you make based on data?" },
  { name: "Deliver & Reflect", req: "Final project link and reflection." }
];

const buildStageMapFromList = (stagesList) => {
  const map = {};
  stagesList.forEach((stage, index) => {
    map[index + 1] = { ...stage };
  });
  return map;
};

const normalizeStageMap = (stages) => {
  if (!stages) return null;
  if (Array.isArray(stages)) {
    if (stages.length === 0) return null;
    return buildStageMapFromList(stages);
  }
  if (typeof stages === "object") {
    const keys = Object.keys(stages);
    if (keys.length === 0) return null;
    return stages;
  }
  return null;
};

export default function ContractDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const labels = theme.labels;

  const [contract, setContract] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [loading, setLoading] = useState(true);

  // 1. Fetch Contract Static Info
  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, "contracts", id);
    const unsub = onSnapshot(
        docRef,
        (snap) => {
            if (snap.exists()) {
                setContract({ id: snap.id, ...snap.data() });
            } else {
                setContract(null);
            }
            setLoading(false);
        },
        (error) => {
            console.error("ContractDetails contract listener failed:", error);
            setLoading(false);
        }
    );
    return () => unsub();
  }, [id]);

  // 2. Listen for User's Progress
  useEffect(() => {
    if (!user || !id) return;
    const jobRef = doc(db, "active_jobs", `${user.uid}_${id}`);
    const unsub = onSnapshot(
        jobRef,
        (docSnap) => {
            if (docSnap.exists()) {
                setActiveJob(docSnap.data());
            } else {
                setActiveJob(null);
            }
        },
        (error) => {
            console.error("ContractDetails job listener failed:", error);
        }
    );
    return () => unsub();
  }, [user, id]);

  // --- ACTIONS ---

  const startContract = async () => {
    if (!contract) return;
    
    // Using setDoc to ensure it creates correctly
    const { setDoc } = await import("firebase/firestore");

    const contractStageMap = normalizeStageMap(contract.stages);
    const stageDefinitionMap = contractStageMap || buildStageMapFromList(DEFAULT_STAGE_TEMPLATES);
    const stageNumbers = Object.keys(stageDefinitionMap)
        .map((num) => Number(num))
        .filter((num) => Number.isFinite(num))
        .sort((a, b) => a - b);

    const jobStages = {};
    stageNumbers.forEach((num, index) => {
        const stageDef = stageDefinitionMap[num] || stageDefinitionMap[String(num)] || {};
        jobStages[num] = {
            name: stageDef.name || `Stage ${num}`,
            req: stageDef.req || "",
            status: index === 0 ? "active" : "locked"
        };
    });

    const firstStage = stageNumbers[0] || 1;

    await setDoc(doc(db, "active_jobs", `${user.uid}_${id}`), {
        student_id: user.uid,
        student_name: user.displayName || user.email,
        contract_id: id,
        contract_title: contract.title,
        contract_bounty: contract.bounty,
        contract_xp: contract.xp_reward,
        status: "in_progress",
        started_at: serverTimestamp(),
        current_stage: firstStage,
        stages: jobStages
    });
  };

  const submitStage = async (stageNum) => {
    if (!submissionLink) return alert("Please add a link!");
    
    const jobRef = doc(db, "active_jobs", `${user.uid}_${id}`);
    
    await updateDoc(jobRef, {
        [`stages.${stageNum}.status`]: "pending_review",
        [`stages.${stageNum}.submission_content`]: submissionLink,
        [`stages.${stageNum}.submitted_at`]: new Date().toISOString(),
        status: "pending_review" 
    });
    
    setSubmissionLink("");
    alert("Stage submitted for review!");
  };

  // --- RENDER ---

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Mission...</div>;
  if (!contract) return <div className="min-h-screen flex items-center justify-center">Mission Data Not Found.</div>;

  const isStarted = !!activeJob;
  const currentStageNum = activeJob?.current_stage || 1;

  const contractStageMap = normalizeStageMap(contract?.stages);
  const activeStageMap = normalizeStageMap(activeJob?.stages);
  const stageDefinitionMap = contractStageMap || activeStageMap || buildStageMapFromList(DEFAULT_STAGE_TEMPLATES);
  const stageNumbers = Object.keys(stageDefinitionMap || {})
      .map((num) => Number(num))
      .filter((num) => Number.isFinite(num))
      .sort((a, b) => a - b);
  
  // Calculate Totals to show the massive incentive
  const totalStages = stageNumbers.length || 0;
  const totalPotentialMoney = (contract.bounty || 0) * totalStages;
  const totalPotentialXP = (contract.xp_reward || 0) * totalStages;

  return (
    <div className="min-h-screen theme-bg pb-20">
      <Navbar /> 

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 theme-muted hover:theme-accent mb-6 transition">
            <ArrowLeft size={18} /> Back to Dashboard
        </button>

        {/* HEADER CARD */}
        <div className="theme-surface rounded-2xl shadow-sm border theme-border overflow-hidden mb-8">
            <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-block bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded mb-3">
                                {contract.category || "Classified"}
                            </span>
                            <h1 className="text-3xl font-black mb-2">{contract.title}</h1>
                        </div>
                        
                        {/* TOTAL VALUE BADGE */}
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total {labels.assignment} Value</p>
                            <div className="flex items-center gap-3 justify-end">
                                <span className="text-2xl font-black text-green-400 flex items-center gap-1">
                                    <DollarSign size={20} className="text-green-500" />{totalPotentialMoney}
                                </span>
                                <span className="text-xl font-bold text-indigo-400 flex items-center gap-1">
                                    <Zap size={18} className="text-indigo-500" />{totalPotentialXP}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* PER STAGE PAYOUTS */}
                    <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                             <div className="bg-green-500/10 p-2 rounded-lg">
                                <DollarSign size={18} className="text-green-400"/> 
                             </div>
                             <div>
                                 <span className="block text-lg font-bold text-white leading-none">${contract.bounty}</span>
                                 <span className="text-xs text-slate-400 uppercase font-bold">{labels.currency} Per Stage</span>
                             </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <div className="bg-indigo-500/10 p-2 rounded-lg">
                                <Zap size={18} className="text-indigo-400"/> 
                             </div>
                             <div>
                                 <span className="block text-lg font-bold text-white leading-none">{contract.xp_reward} XP</span>
                                 <span className="text-xs text-slate-400 uppercase font-bold">{labels.xp} Per Stage</span>
                             </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <div className="bg-slate-700/50 p-2 rounded-lg">
                                <TrendingUp size={18} className="text-slate-300"/> 
                             </div>
                             <div>
                                 <span className="block text-lg font-bold text-white leading-none">{totalStages} Stages</span>
                                 <span className="text-xs text-slate-400 uppercase font-bold">Milestones</span>
                             </div>
                        </div>
                    </div>

                </div>
                
                {/* Decoration */}
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <FileText size={120} />
                </div>
            </div>
            
            <div className="p-8">
                <h3 className="font-bold theme-text mb-2">{labels.assignment} Brief</h3>
                <p className="theme-muted leading-relaxed mb-8">{contract.description}</p>

                {/* START BUTTON */}
                {!isStarted && (
                    <div className="theme-card border theme-border rounded-xl p-8 text-center">
                        <p className="theme-muted mb-4 text-sm font-medium">
                            Ready to begin? This {labels.assignment.toLowerCase()} pays <strong>${contract.bounty}</strong> upon completion of <strong>each stage</strong>.
                        </p>
                        <button 
                            onClick={startContract}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-lg shadow-indigo-200"
                        >
                            Accept {labels.assignment}
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* STAGES VIEW (Only if Started) */}
        {isStarted && (
            <div>
                <h3 className="text-lg font-black theme-text mb-4 px-2 flex justify-between items-center">
                    <span>{labels.assignment} Milestones</span>
                    <span className="text-xs font-bold theme-muted uppercase tracking-wider">
                        Stage {currentStageNum} of {totalStages}
                    </span>
                </h3>
                
                <div className="space-y-4">
                    {stageNumbers.map((num) => {
                        const stageDef = stageDefinitionMap[num] || stageDefinitionMap[String(num)] || {};
                        const jobStage = activeJob?.stages?.[num] || activeJob?.stages?.[String(num)] || {};
                        const stage = {
                            ...stageDef,
                            ...jobStage,
                            name: stageDef.name || jobStage.name || `Stage ${num}`,
                            req: stageDef.req || jobStage.req || ""
                        };

                        const isCurrent = num === currentStageNum;
                        const isLocked = num > currentStageNum;
                        const isCompleted = stage.status === 'completed' || stage.status === 'approved';
                        const isPending = stage.status === 'pending_review';
                        const isRejected = stage.status === 'returned';

                        return (
                            <div key={num} className={`theme-surface border theme-border rounded-xl p-6 transition-all ${
                                isCurrent ? "border-indigo-500 ring-4 ring-indigo-50 shadow-lg" : "border-slate-200 opacity-60"
                            } ${isLocked ? "grayscale bg-slate-50" : ""}`}>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                            isCompleted ? "bg-green-100 text-green-600" : 
                                            isCurrent ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                                        }`}>
                                            {isCompleted ? <CheckCircle size={16}/> : num}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold ${isCurrent ? "theme-accent" : "theme-text"}`}>{stage.name}</h4>
                                            
                                            {/* Status Badges */}
                                            <div className="flex items-center gap-2 mt-1">
                                                {isRejected && <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertCircle size={12}/> Returned for edits</span>}
                                                {isPending && <span className="text-xs font-bold text-yellow-600 flex items-center gap-1"><Clock size={12}/> Under Review</span>}
                                                {isCompleted && <span className="text-xs font-bold text-green-600 flex items-center gap-1">PAID: ${contract.bounty}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {isLocked && <Lock size={16} className="text-slate-300"/>}
                                    
                                    {/* Reward Tag per stage */}
                                    {!isLocked && !isCompleted && (
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                            {labels.currency}: ${contract.bounty}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm theme-muted mb-4 pl-11">{stage.req}</p>
                                
                                {/* FEEDBACK DISPLAY */}
                                {stage.feedback && (
                                    <div className="ml-11 mb-4 bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-700">
                                        <span className="font-bold block text-xs uppercase mb-1">Director Feedback:</span>
                                        "{stage.feedback}"
                                    </div>
                                )}

                                {/* ACTION AREA (Only for Current Stage) */}
                                {isCurrent && !isPending && (
                                    <div className="pl-11">
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold theme-muted uppercase mb-2">Submission Link</label>
                                            <input 
                                                type="text" 
                                                className="w-full border theme-border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                                placeholder="https://docs.google.com/..."
                                                value={submissionLink}
                                                onChange={(e) => setSubmissionLink(e.target.value)}
                                            />
                                            <p className="text-xs theme-muted mt-2">Paste a link to your Google Doc, Slide, or Image.</p>
                                        </div>

                                        <button 
                                            onClick={() => submitStage(currentStageNum)}
                                            className={`w-full text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 ${
                                                isRejected 
                                                ? "bg-red-600 hover:bg-red-700"
                                                : "bg-black hover:bg-slate-800"
                                            }`}
                                        >
                                            <Send size={18} /> 
                                            {isRejected ? "Resubmit Fixes" : "Submit for Review"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
