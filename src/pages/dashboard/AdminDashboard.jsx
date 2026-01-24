import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { 
  collection, 
  onSnapshot,
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  increment,
  serverTimestamp,
  deleteField, 
  writeBatch,
  query,    // <--- ADD THIS
  orderBy   
} from "firebase/firestore";
import { 
    CheckCircle, 
    ExternalLink, 
    AlertTriangle, 
    Users,
    Inbox,
    Zap,
    ShoppingBag,
    Trash2,
    Plus,
    X,
    Pencil,
    HelpCircle,
    Filter,
    Percent,     
    TrendingDown,
    RotateCcw,
    Calendar,
    Rocket,
    DollarSign
} from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

// --- ICON LIST (For Shop) ---
const AVAILABLE_ICONS = [
    "life-buoy", "map-pin", "briefcase", "pen-tool", "clock", 
    "trophy", "file-signature", "coffee", "sun", "ghost", 
    "music", "user-check", "zap", "crown", "mic", 
    "monitor", "trash-2", "lock", "smartphone", "headphones"
];

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
  const [filterClass, setFilterClass] = useState("all"); 
  const [activeTab, setActiveTab] = useState("approvals"); 
    const [showLinksOnly, setShowLinksOnly] = useState(false);

  // --- LOOKUP STATE ---
  const [contractLookup, setContractLookup] = useState({});
  const [availableClasses, setAvailableClasses] = useState([]);

  // --- REJECTION STATE ---
  const [rejectingJob, setRejectingJob] = useState(null); 
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [customFeedback, setCustomFeedback] = useState("");

  // --- SHOP STATE ---
  const [shopItems, setShopItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null); 
  const [isShopFormOpen, setIsShopFormOpen] = useState(false);
  const [shopForm, setShopForm] = useState({ 
      title: "", desc: "", price: 0, stock: 0, iconName: "briefcase" 
  });

  // --- NEW: SUGGESTION BOX STATE ---
  const [suggestions, setSuggestions] = useState([]);
  const [showInbox, setShowInbox] = useState(false);

  // --- MARKET CRASH STATE ---
  const [isSaleActive, setIsSaleActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(50); // Default 50%
// --- DAILY MISSIONS STATE ---
const [showDailyMissions, setShowDailyMissions] = useState(false);  
const [missions, setMissions] = useState([]);
  const [newMission, setNewMission] = useState({
      title: "",
      instruction: "",
      code_word: "",
      reward_xp: 50,
      reward_cash: 100,
      class_id: "", // We will set this dynamically when loading
      active_date: new Date().toISOString().split('T')[0]
  });

  // FETCH DAILY MISSIONS
  useEffect(() => {
      const q = query(collection(db, "daily_missions"), orderBy("active_date", "desc"));
      const unsub = onSnapshot(q, (snap) => {
          setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
  }, []);

  // AUTO-SELECT FIRST CLASS (Once availableClasses loads)
  useEffect(() => {
      if(availableClasses.length > 0 && !newMission.class_id) {
          setNewMission(prev => ({ ...prev, class_id: availableClasses[0] }));
      }
  }, [availableClasses]);

  const handleCreateMission = async (e) => {
      e.preventDefault();
      try {
          // Safety Check: ensure we have a class selected
          const targetClass = newMission.class_id || availableClasses[0] || "Unassigned";

          await addDoc(collection(db, "daily_missions"), {
              ...newMission,
              class_id: targetClass,
              createdAt: serverTimestamp()
          });
          alert("Mission Deployed!");
          // Reset form (keep date/class for rapid-fire entry)
          setNewMission({ ...newMission, title: "", instruction: "", code_word: "" }); 
      } catch (err) {
          console.error(err);
          alert("Error creating mission");
      }
  };

  const handleDeleteMission = async (id) => {
      if(confirm("Delete this mission?")) {
          await deleteDoc(doc(db, "daily_missions", id));
      }
  };
  // --- LISTENERS ---
  useEffect(() => {
    // 1. Fetch Submissions (Active Jobs)
    const unsubJobs = onSnapshot(collection(db, "active_jobs"), (snap) => {
        const subs = [];
        let active = 0;
        
        snap.docs.forEach(d => {
            const data = d.data();
            const currentStageNum = data.current_stage || 1;
            const currentStageData = data.stages ? data.stages[currentStageNum] : null;

            const isRootPending = data.status === 'review' || data.status === 'pending_review';
            const isStagePending = currentStageData && (currentStageData.status === 'review' || currentStageData.status === 'pending_review');

            if (isRootPending || isStagePending) {
                const deepLink = currentStageData?.submission_content || data.submission_link || data.submission_content;
                subs.push({ 
                    id: d.id, 
                    ...data, 
                    displayLink: deepLink, 
                    displayStage: currentStageNum
                });
            }
            if (data.status !== 'completed') active++;
        });
        subs.sort((a,b) => (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0));
        setSubmissions(subs);
        setStats(prev => ({ ...prev, activeCount: active }));
    });

    // 2. Fetch User Count
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        setStats(prev => ({ ...prev, agentCount: snap.size }));
    });

    // 3. Fetch Shop Items & DETECT SALE
    const unsubShop = onSnapshot(collection(db, "shop_items"), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setShopItems(items);
        
        // Auto-detect if a sale is active by checking if ANY item has an 'original_price' field
        const saleDetected = items.some(item => item.original_price !== undefined && item.original_price !== null);
        setIsSaleActive(saleDetected);
    });

    // 4. Fetch Contracts
    const unsubContracts = onSnapshot(collection(db, "contracts"), (snap) => {
        const lookup = {};
        const classesSet = new Set();
        
        snap.docs.forEach(d => {
            const data = d.data();
            // This handles the fallback right here, once.
            const classId = data.class_id || "Unassigned"; 
            
            // Your suggestion:
            lookup[d.id] = { 
                ...data,      // Keeps 'bounty', 'xp_reward' (for payments)
                id: d.id, 
                classId       // Keeps the clean class name (for filtering)
            }; 
            
            classesSet.add(classId);
        });
        
        setContractLookup(lookup);
        setAvailableClasses(Array.from(classesSet).sort());
    });

    return () => {
        unsubJobs();
        unsubUsers();
        unsubShop();
        unsubContracts();
    };
  }, []);

  // LISTEN TO SUGGESTIONS
  useEffect(() => {
    // Order by newest first
    const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
       const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setSuggestions(list);
    });
    return () => unsub();
  }, []);

  // Helper to mark as read (optional, but nice visual)
  const markAsRead = async (id, currentStatus) => {
      if(currentStatus) return; // already read
      await updateDoc(doc(db, "suggestions", id), { read: true });
  };

  // Helper to delete message
  const deleteSuggestion = async (id) => {
      if(window.confirm("Delete this message?")) {
          await deleteDoc(doc(db, "suggestions", id));
      }
  };

  // --- MARKET CRASH LOGIC ---
  const toggleMarketCrash = async () => {
      const batch = writeBatch(db);
      
      if (!isSaleActive) {
          // START SALE: Loop all items, save original price, set new price
          if(!confirm(`⚠️ WARNING: This will crash market prices by ${discountPercent}%. Continue?`)) return;

          shopItems.forEach(item => {
              const ref = doc(db, "shop_items", item.id);
              // Avoid double-discounting if data is messy
              const basePrice = item.original_price || item.price; 
              const newPrice = Math.floor(basePrice * ((100 - discountPercent) / 100));

              batch.update(ref, {
                  price: newPrice,
                  original_price: basePrice // Save the old price here!
              });
          });

      } else {
          // END SALE: Restore original prices
          if(!confirm("Restore market prices to normal?")) return;

          shopItems.forEach(item => {
              // Only restore if we have an original price
              if (item.original_price) {
                  const ref = doc(db, "shop_items", item.id);
                  batch.update(ref, {
                      price: item.original_price,
                      original_price: deleteField() // Remove the hidden field
                  });
              }
          });
      }

      await batch.commit();
  };

  // --- APPROVAL ACTIONS ---
  const approveSubmission = async (job) => {
      try {
          const currentStage = Number(job.current_stage || 1);
          const totalStages = Object.keys(job.stages || {}).length;
          
          // 1. GET THE REWARDS FROM LOOKUP
          const contractData = contractLookup[job.contract_id];
          const payAmount = contractData?.bounty ? Number(contractData.bounty) : 0;
          const xpAmount = contractData?.xp_reward ? Number(contractData.xp_reward) : 0;

          console.log(`Approving Stage ${currentStage}. Paying: $${payAmount} & ${xpAmount}XP`);

          const updates = {};
          
          // A. Mark CURRENT stage as completed
          updates[`stages.${currentStage}.status`] = "completed";
          updates[`stages.${currentStage}.completedAt`] = new Date().toISOString();

          // B. PAY THE STUDENT (Happens every time now)
          const userRef = doc(db, "users", job.student_id);
          await updateDoc(userRef, {
              currency: increment(payAmount), 
              xp: increment(xpAmount),        
              completed_jobs: increment(1) // Optional: counts stages as "jobs" done
          });

          // C. CHECK PROGRESS
          if (currentStage >= totalStages) {
              // --- MISSION COMPLETE ---
              updates['status'] = "completed";
              updates['completedAt'] = serverTimestamp();

              await addDoc(collection(db, "users", job.student_id, "alerts"), {
                  type: "success",
                  message: `Mission "${job.contract_title}" COMPLETED! Final Payment: $${payAmount}.`,
                  read: false,
                  createdAt: serverTimestamp()
              });

          } else {
              // --- MOVE TO NEXT STAGE ---
              const nextStage = currentStage + 1;
              
              // *** CRITICAL FIX: Unlock the dashboard ***
              updates['status'] = "active"; // This removes the "Reviewing" badge
              
              updates['current_stage'] = nextStage;
              updates[`stages.${nextStage}.status`] = "active"; 
              
              await addDoc(collection(db, "users", job.student_id, "alerts"), {
                  type: "success",
                  message: `Stage ${currentStage} approved! You earned $${payAmount}. Proceed to Stage ${nextStage}.`,
                  read: false,
                  createdAt: serverTimestamp()
              });
          }

          // D. PUSH UPDATES TO JOB
          await updateDoc(doc(db, "active_jobs", job.id), updates);

      } catch (error) {
          console.error("Error approving:", error);
          alert("Error approving mission. Check console.");
      }
  };

  const openRejectionModal = (job) => {
      setRejectingJob(job);
      setReason(REJECTION_REASONS[0]);
      setCustomFeedback("");
  };

  const submitRejection = async () => {
      if (!rejectingJob) return;
      const finalMessage = reason === "Other (Write below)" ? customFeedback : reason;
      const currentStage = rejectingJob.current_stage || 1;
      try {
          const updates = {};
          updates['status'] = "active"; 
          updates['status_message'] = `Rejection: ${finalMessage}`;
          updates['last_updated'] = serverTimestamp();
          updates[`stages.${currentStage}.status`] = "active";
          await updateDoc(doc(db, "active_jobs", rejectingJob.id), updates);
          await addDoc(collection(db, "users", rejectingJob.student_id, "alerts"), {
              type: "error",
              message: `Mission Stage ${currentStage} returned: ${finalMessage}`,
              read: false,
              createdAt: serverTimestamp()
          });
          setRejectingJob(null);
      } catch (error) { console.error("Error rejecting:", error); }
  };

  // --- SHOP ACTIONS ---
  const handleSaveItem = async (e) => {
      e.preventDefault();
      try {
          if (editingItem) {
              await updateDoc(doc(db, "shop_items", editingItem.id), shopForm);
          } else {
              await addDoc(collection(db, "shop_items"), {
                  ...shopForm,
                  createdAt: serverTimestamp()
              });
          }
          closeShopForm();
      } catch (err) { alert("Error saving item"); }
  };

  const deleteItem = async (id) => {
      if(!confirm("Delete this item?")) return;
      await deleteDoc(doc(db, "shop_items", id));
  };

  const startEdit = (item) => {
      setEditingItem(item);
      setShopForm({ 
          title: item.title, desc: item.desc, price: item.original_price || item.price, // Always edit the REAL price
          stock: item.stock, iconName: item.iconName 
      });
      setIsShopFormOpen(true);
  };

  const closeShopForm = () => {
      setIsShopFormOpen(false);
      setEditingItem(null);
      setShopForm({ title: "", desc: "", price: Number(shopForm.price) || 0,
              stock: Number(shopForm.stock) || 0, iconName: "briefcase" });
  };

  // --- FILTERING ---
  const filteredSubmissions = submissions.map(sub => {
      // HELPER: Normalize the link so the filter AND the button see the same thing
      // We attach a 'displayLink' property to the object if it's missing, 
      // trying every possible field name your database might use.
      const rawLink = sub.current_stage_link || sub.link || sub.url || sub.submission_link || sub.displayLink;
      
      return { ...sub, displayLink: rawLink };
  }).filter(sub => {
      // 1. Identify the Class
      const associatedClass = contractLookup[sub.contract_id] || "Unassigned";

      // 2. Class Filter Check
      if (filterClass !== "all" && associatedClass !== filterClass) {
          return false;
      }

      // 3. Link Filter Check (Now checks the normalized 'displayLink')
      if (showLinksOnly && !sub.displayLink) {
          return false;
      }

      return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar />
      
      <div className="max-w-6xl mx-auto p-6">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-black text-slate-900">HQ Dashboard</h1>
                <p className="text-slate-500">Overview of agency performance and pending tasks.</p>
            </div>
            
            <div className="flex items-center gap-3">
                {/* INBOX BUTTON */}
                <button 
                    onClick={() => setShowInbox(true)}
                    className="relative bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition group h-[42px] w-[42px] flex items-center justify-center"
                >
                    <Inbox className="text-slate-600 group-hover:text-indigo-600" size={20} />
                    {suggestions.some(s => !s.read) && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                </button>

                {/* TABS */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => setActiveTab("approvals")}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${
                            activeTab === "approvals" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        <Inbox size={16}/> 
                        Approvals 
                        {submissions.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{submissions.length}</span>
                        )}
                    </button>
                    <button 
                        onClick={() => setActiveTab("shop")}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${
                            activeTab === "shop" ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        <ShoppingBag size={16}/> Market
                    </button>
                </div>
            </div>
        </div>

        {/* MISSION LOG */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-slate-700 text-sm uppercase">Mission Log (Newest First)</h3>
                 <button onClick={() => setShowDailyMissions(true)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition">
                    Open Mission Control
                 </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {missions.length === 0 ? (
                    <div className="lg:col-span-3 text-slate-400 text-sm italic p-4 border border-dashed rounded-lg text-center">
                        No active orders. Deploy one to start the day.
                    </div>
                ) : (
                    missions.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 transition group shadow-sm">
                            <div className="flex items-center gap-4 overflow-hidden">
                                {/* Date Badge */}
                                <div className="text-center bg-slate-100 px-3 py-1 rounded-lg min-w-[60px]">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                                        {new Date(m.active_date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short'})}
                                    </div>
                                    <div className="text-xs font-black text-slate-700">
                                        {m.active_date.slice(5)}
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                            {m.class_id}
                                        </span>
                                        <h4 className="font-bold text-slate-700 truncate text-sm">{m.title}</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">
                                        {m.instruction} 
                                    </p>
                                </div>
                            </div>
                            
                            <button onClick={() => handleDeleteMission(m.id)} className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* ==================== TAB 1: APPROVALS ==================== */}
        {activeTab === "approvals" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* STATS CARDS */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase">Pending Reviews</p>
                            <p className="text-3xl font-black text-slate-900">{submissions.length}</p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Inbox size={24}/></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase">Active Agents</p>
                            <p className="text-3xl font-black text-slate-900">{stats.agentCount}</p>
                        </div>
                        <div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><Users size={24}/></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase">Missions Underway</p>
                            <p className="text-3xl font-black text-slate-900">{stats.activeCount}</p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Zap size={24}/></div>
                    </div>
                </div>

                {/* APPROVAL QUEUE */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Inbox className="text-indigo-600" size={20} /> 
                                Submission Queue
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                <Filter size={16} className="text-slate-400" />
                                <select 
                                    className="bg-white border border-slate-200 text-slate-700 text-sm font-bold py-2 px-4 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
                                    value={filterClass}
                                    onChange={(e) => setFilterClass(e.target.value)}
                                >
                                    <option value="all">All Classes</option>
                                    {availableClasses.length > 0 ? (
                                        availableClasses.map((cls) => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))
                                    ) : (
                                        <option disabled>Loading classes...</option>
                                    )}
                                </select>
                            </div>
                            {/* 2. NEW TOGGLE SWITCH */}
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition select-none">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={showLinksOnly}
                                        onChange={() => setShowLinksOnly(!showLinksOnly)}
                                    />
                                    {/* Switch Track */}
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    Has Link
                                </span>
                            </label>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-slate-100">
                            {submissions.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>All clear. No missions pending review.</p>
                                </div>
                            ) : filteredSubmissions.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <p>No pending submissions for this class.</p>
                                    <button onClick={() => setFilterClass('all')} className="text-indigo-600 font-bold text-sm mt-2 hover:underline">
                                        View All
                                    </button>
                                </div>
                            ) : (
                                filteredSubmissions.map(sub => (
                                    <div key={sub.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-slate-50 transition">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-900 truncate text-lg">
                                                    {sub.contract_title}
                                                </h3>
                                                {sub.displayLink ? (
                                                    <a 
                                                        href={sub.displayLink.startsWith('http') ? sub.displayLink : `https://${sub.displayLink}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 transition"
                                                        title="View Work"
                                                    >
                                                        <ExternalLink size={14} /> View Work
                                                    </a>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded cursor-not-allowed">
                                                        <HelpCircle size={14} /> No Link
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-slate-700">{sub.student_name}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                                    {contractLookup[sub.contract_id]?.classId || "Unknown Class"}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                    Stage {sub.displayStage}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                {sub.submittedAt ? (
                                                    <span>{new Date(sub.submittedAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                ) : (
                                                    <span>Just now</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <button 
                                                onClick={() => openRejectionModal(sub)}
                                                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition text-sm flex items-center gap-2"
                                            >
                                                <AlertTriangle size={16}/> Reject
                                            </button>
                                            <button 
                                                onClick={() => approveSubmission(sub)}
                                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg transition text-sm flex items-center gap-2"
                                            >
                                                <CheckCircle size={16}/> Approve
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ==================== TAB 2: SHOP MANAGEMENT ==================== */}
        {activeTab === "shop" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 
                 {/* LEFT: CONTROLS */}
                 <div className="lg:col-span-1 space-y-6">
                    
                    {/* NEW: MARKET SALE CONTROL */}
                    <div className={`p-6 rounded-xl border shadow-sm transition-all ${isSaleActive ? "bg-red-50 border-red-200 ring-2 ring-red-500" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center gap-2 mb-4">
                             <div className={`p-2 rounded-lg ${isSaleActive ? "bg-red-200 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                                 <TrendingDown size={20} />
                             </div>
                             <div>
                                 <h3 className={`font-bold ${isSaleActive ? "text-red-900" : "text-slate-900"}`}>
                                     {isSaleActive ? "MARKET CRASH ACTIVE" : "Market Control"}
                                 </h3>
                                 <p className="text-xs text-slate-500">Temporarily discount all items.</p>
                             </div>
                        </div>

                        {!isSaleActive ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 flex justify-between">
                                        Discount Percentage
                                        <span className="text-indigo-600">{discountPercent}% Off</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="90" 
                                        step="5"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(e.target.value)}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                                        <span>10%</span>
                                        <span>50%</span>
                                        <span>90%</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={toggleMarketCrash}
                                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2"
                                >
                                    <Zap size={16}/> INITIATE CRASH
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="bg-red-100 text-red-800 text-xs font-bold p-3 rounded mb-4 text-center">
                                    Prices are currently slashed by {discountPercent}%!
                                </div>
                                <button 
                                    onClick={toggleMarketCrash}
                                    className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={16}/> RESTORE PRICES
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CREATE ITEM FORM */}
                    <div className={`p-6 rounded-xl border shadow-sm transition-all ${isShopFormOpen ? "bg-white border-slate-200 ring-2 ring-indigo-500 ring-offset-2" : "bg-white border-slate-200"}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                {editingItem ? <Pencil size={18}/> : <Plus size={18}/>}
                                {editingItem ? "Edit Item" : "Create Item"}
                            </h3>
                            {isShopFormOpen && (
                                <button onClick={closeShopForm} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                            )}
                        </div>
                        
                        <form onSubmit={handleSaveItem} className="space-y-4" onFocus={() => setIsShopFormOpen(true)}>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Item Name</label>
                                <input 
                                    className="w-full p-2 border rounded mt-1 text-sm"
                                    value={shopForm.title}
                                    onChange={e => setShopForm({...shopForm, title: e.target.value})}
                                    required 
                                    placeholder="e.g. Late Pass"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Description</label>
                                <textarea 
                                    className="w-full p-2 border rounded mt-1 text-sm"
                                    value={shopForm.desc}
                                    onChange={e => setShopForm({...shopForm, desc: e.target.value})}
                                    required 
                                    rows={3}
                                    placeholder="What does it do?"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">
                                        {isSaleActive && !editingItem ? "Base Price ($)" : "Price ($)"}
                                    </label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border rounded mt-1 text-sm"
                                        value={shopForm.price}
                                        onChange={e => setShopForm({...shopForm, price: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Stock</label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border rounded mt-1 text-sm"
                                        value={shopForm.stock}
                                        onChange={e => setShopForm({...shopForm, stock: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Icon</label>
                                <select 
                                    className="w-full p-2 border rounded mt-1 bg-white text-sm"
                                    value={shopForm.iconName}
                                    onChange={e => setShopForm({...shopForm, iconName: e.target.value})}
                                >
                                    {AVAILABLE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>

                            {isShopFormOpen && (
                                <button className="w-full bg-slate-900 text-white font-bold py-2 rounded hover:bg-slate-800 transition">
                                    {editingItem ? "Save Changes" : "Publish to Shop"}
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                {/* RIGHT: LIST */}
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shopItems.length === 0 ? (
                            <div className="col-span-2 p-12 text-center border-2 border-dashed border-slate-300 rounded-xl">
                                <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4"/>
                                <p className="text-slate-500">Shop is empty.</p>
                            </div>
                        ) : (
                            shopItems.map(item => (
                                <div key={item.id} className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between transition relative overflow-hidden ${isSaleActive ? "bg-red-50 border-red-100" : "bg-white border-slate-200"}`}>
                                    
                                    {/* SALE BADGE */}
                                    {item.original_price && (
                                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                            SALE
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-800">{item.title}</h4>
                                            
                                            <div className="flex flex-col items-end">
                                                {item.original_price ? (
                                                    <>
                                                        <span className="text-xs text-slate-400 line-through font-mono">
                                                            ${item.original_price}
                                                        </span>
                                                        <span className="font-mono font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs animate-pulse">
                                                            ${item.price}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs">
                                                        ${item.price}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-snug">{item.desc}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
                                        <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Inbox size={12}/> {item.stock} left
                                        </div>
                                        
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => startEdit(item)} 
                                                className="text-slate-400 hover:text-amber-600 p-2 transition bg-white/50 rounded-lg hover:bg-amber-50"
                                                title="Edit Item"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button 
                                                onClick={() => deleteItem(item.id)} 
                                                className="text-slate-400 hover:text-red-500 p-2 transition bg-white/50 rounded-lg hover:bg-red-50"
                                                title="Delete Item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* REJECTION MODAL */}
        {rejectingJob && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <AlertTriangle className="text-red-500"/> Return Mission?
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">
                        This will send the mission back to <strong>{rejectingJob.student_name}</strong> for corrections.
                    </p>

                    <div className="space-y-3 mb-6">
                        {REJECTION_REASONS.map((r) => (
                            <label key={r} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition">
                                <input 
                                    type="radio" 
                                    name="reason"
                                    checked={reason === r}
                                    onChange={() => setReason(r)}
                                    className="w-4 h-4 text-red-600 border-slate-300 focus:ring-red-500"
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
      {/* --- INBOX MODAL --- */}
      {showInbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                        <Inbox size={20} className="text-indigo-600"/> Agent Feedback ({suggestions.length})
                    </h2>
                    <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* List of Messages */}
                <div className="overflow-y-auto p-4 space-y-3 bg-slate-50/50 flex-1">
                    {suggestions.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic">No messages from the field.</div>
                    ) : (
                        suggestions.map(msg => (
                            <div 
                                key={msg.id} 
                                onClick={() => markAsRead(msg.id, msg.read)}
                                className={`group p-4 rounded-xl border transition-all cursor-pointer relative ${
                                    msg.read ? "bg-white border-slate-200 opacity-75" : "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50"
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${msg.read ? "bg-slate-300" : "bg-indigo-500"}`}></div>
                                        <span className="font-bold text-slate-700 text-sm">{msg.agentName || "Unknown Agent"}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                            {msg.createdAt?.toDate().toLocaleDateString() || "Just now"}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteSuggestion(msg.id); }}
                                        className="text-slate-300 hover:text-red-500 transition p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                
                                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-slate-100">
                                    {msg.text}
                                </p>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
      )}
      {/* --- DAILY ORDERS MODAL --- */}
      {/* --- DAILY ORDERS MODAL --- */}
      {showDailyMissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                        <Calendar className="text-indigo-600"/> MISSION CONTROL
                    </h2>
                    <button onClick={() => setShowDailyMissions(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* CONTENT GRID */}
                <div className="p-6 overflow-y-auto bg-slate-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
                        {/* LEFT: CREATE FORM */}
                        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                            <h3 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wider border-b pb-2">Deploy New Mission</h3>
                            <form onSubmit={handleCreateMission} className="space-y-4">
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Target Class</label>
                                        <select 
                                            className="w-full p-2.5 rounded-lg border text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newMission.class_id}
                                            onChange={e => setNewMission({...newMission, class_id: e.target.value})}
                                        >
                                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Live Date</label>
                                        <input 
                                            type="date" 
                                            className="w-full p-2.5 rounded-lg border text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newMission.active_date}
                                            onChange={e => setNewMission({...newMission, active_date: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Mission Title</label>
                                    <input 
                                        placeholder="e.g. 'Mindset Check'" 
                                        className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newMission.title}
                                        onChange={e => setNewMission({...newMission, title: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Briefing / Instructions</label>
                                    <textarea 
                                        placeholder="What is the objective?" 
                                        className="w-full p-2.5 rounded-lg border text-sm h-24 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        value={newMission.instruction}
                                        onChange={e => setNewMission({...newMission, instruction: e.target.value})}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Passcode (Optional)</label>
                                    <input 
                                        placeholder="REQUIRED to claim reward..." 
                                        className="w-full p-2.5 rounded-lg border text-sm bg-indigo-50/50 border-indigo-100 font-mono text-indigo-600"
                                        value={newMission.code_word}
                                        onChange={e => setNewMission({...newMission, code_word: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">XP Reward</label>
                                        <input type="number" className="w-full p-2.5 border rounded-lg text-sm"
                                            value={newMission.reward_xp} onChange={e => setNewMission({...newMission, reward_xp: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Cash Reward</label>
                                        <input type="number" className="w-full p-2.5 border rounded-lg text-sm"
                                            value={newMission.reward_cash} onChange={e => setNewMission({...newMission, reward_cash: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>

                                <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition flex items-center justify-center gap-2">
                                    <Rocket size={18} /> Deploy
                                </button>
                            </form>
                        </div>

                        {/* RIGHT: UPCOMING SCHEDULE */}
                        <div className="lg:col-span-2">
                            <h3 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wider border-b pb-2">Active Mission Log</h3>
                            <div className="space-y-3">
                                {missions.length === 0 ? (
                                    <div className="text-slate-400 text-sm italic p-8 border-2 border-dashed rounded-xl text-center bg-slate-50">
                                        No active orders in the database.
                                    </div>
                                ) : (
                                    missions.map(m => (
                                        <div key={m.id} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition group">
                                            {/* Date Badge */}
                                            <div className="text-center bg-slate-100 px-3 py-2 rounded-lg min-w-[70px] shrink-0 border border-slate-200">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {new Date(m.active_date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short'})}
                                                </div>
                                                <div className="text-lg font-black text-slate-700 leading-none mt-1">
                                                    {m.active_date.slice(5)}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-wide">
                                                        {m.class_id}
                                                    </span>
                                                    <h4 className="font-bold text-slate-800 truncate">{m.title}</h4>
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-2 mb-2">
                                                    {m.instruction} 
                                                </p>
                                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                                    <span className="flex items-center gap-1"><Zap size={12}/> {m.reward_xp} XP</span>
                                                    <span className="flex items-center gap-1"><DollarSign size={12}/> ${m.reward_cash}</span>
                                                    {m.code_word && <span className="text-indigo-500 bg-indigo-50 px-1.5 rounded font-mono border border-indigo-100">PASS: {m.code_word}</span>}
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => handleDeleteMission(m.id)} 
                                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                                title="Revoke Order"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
      )}
      </div>
  );
}