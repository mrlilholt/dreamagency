import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, 
  onSnapshot,
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc,
  addDoc,
  increment,
  serverTimestamp,
  deleteField, 
  writeBatch,
  setDoc,
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
    DollarSign,
    RefreshCw, 
    History,
    Archive,
    ArrowRight,
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { CLASS_CODES } from "../../lib/gameConfig";
import { THEME_OPTIONS } from "../../lib/themeConfig";
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

const BASE_SIDE_HUSTLE_REWARD = { cash: 50, xp: 25 };
const getAutoLevelRewards = (levelNumber) => {
    const multiplier = Math.pow(2, Math.max(0, levelNumber - 1));
    return {
        reward_cash: BASE_SIDE_HUSTLE_REWARD.cash * multiplier,
        reward_xp: BASE_SIDE_HUSTLE_REWARD.xp * multiplier
    };
};
const MAX_SIDE_HUSTLE_IMAGE_BYTES = 350 * 1024;
const formatSideHustleStatus = (status, scheduledDate) => {
    if (status === "archived") return "Archived";
    if (status !== "scheduled") return "Live";
    if (!scheduledDate) return "Dropping Soon";
    const today = new Date();
    const dropDate = new Date(`${scheduledDate}T12:00:00`);
    if (dropDate <= today) return "Live";
    const diffDays = Math.floor((dropDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 6) {
        return `Dropping on ${dropDate.toLocaleDateString(undefined, { weekday: "long" })}`;
    }
    return "Dropping Soon";
};

export default function AdminDashboard() {
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
      title: "", 
      desc: "", 
      price: 0, 
      stock: 0, 
      iconName: "briefcase",
      effectType: "none",
      xpBoostPercent: 10,
      xpBoostDays: 14
  });

  // --- NEW: SUGGESTION BOX STATE ---
  const [suggestions, setSuggestions] = useState([]);
  const [showInbox, setShowInbox] = useState(false);

  // --- MARKET CRASH STATE ---
  const [isSaleActive, setIsSaleActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(50); // Default 50%
// --- DAILY MISSIONS STATE ---
const [viewArchive, setViewArchive] = useState(false);
const [showDailyMissions, setShowDailyMissions] = useState(false);  
const [missions, setMissions] = useState([]);
  const [editingMissionId, setEditingMissionId] = useState(null);
  // --- SIDE HUSTLES STATE ---
  const [sideHustles, setSideHustles] = useState([]);
  const [sideHustleSubmissions, setSideHustleSubmissions] = useState([]);
  const [showSideHustleEditor, setShowSideHustleEditor] = useState(false);
  const [editingSideHustleId, setEditingSideHustleId] = useState(null);
  const [sideHustleForm, setSideHustleForm] = useState({
      title: "",
      tagline: "",
      summary: "",
      details: "",
      reward_cash: 50,
      reward_xp: 25,
      class_id: "all",
      image_url: "",
      status: "live",
      scheduled_date: ""
  });
  const [sideHustleLevels, setSideHustleLevels] = useState([
      { title: "Level 1", req: "", ...getAutoLevelRewards(1) }
  ]);
  const [sideHustleImagePreview, setSideHustleImagePreview] = useState("");
  const [classForm, setClassForm] = useState({
      id: "",
      code: "",
      name: "",
      division: "MS",
      department: "",
      theme_id: "agency"
  });
  const [isSavingClass, setIsSavingClass] = useState(false);

  // SEPARATE MISSIONS BY DATE
  const todayDate = new Date().toISOString().split('T')[0];
  
  const activeMissions = missions.filter(m => m.active_date >= todayDate);
  const archivedMissions = missions.filter(m => m.active_date < todayDate);
  // --- REDEPLOY FUNCTION ---
  // Takes an old mission and puts it back in the form
  const handleRedeploy = (mission) => {
      setNewMission({
          title: mission.title,
          instruction: mission.instruction,
          code_word: mission.code_word || "",
          reward_xp: mission.reward_xp,
          reward_cash: mission.reward_cash,
          class_id: mission.class_id, // Keeps old class, but you can change it
          active_date: todayDate // Defaults to TODAY
      });
      // Optional: Flash a message or focus the form
      // alert("Mission loaded into form! Adjust Date/Class and Deploy.");
  };
  const [newMission, setNewMission] = useState({
      title: "",
      instruction: "",
      code_word: "",
      reward_xp: 50,
      reward_cash: 100,
      class_id: "", // We will set this dynamically when loading
      active_date: new Date().toISOString().split('T')[0]
  });
  
  // 1. PREP THE FORM FOR EDITING
  const handleEditClick = (mission) => {
      setNewMission({
          title: mission.title,
          instruction: mission.instruction,
          code_word: mission.code_word || "",
          reward_xp: mission.reward_xp,
          reward_cash: mission.reward_cash,
          class_id: mission.class_id,
          active_date: mission.active_date
      });
      setEditingMissionId(mission.id); // Triggers "Edit Mode"
  };
  // 2. SAVE CHANGES
  const handleUpdateMission = async (e) => {
      e.preventDefault();
      if (!editingMissionId) return;

      try {
          const missionRef = doc(db, "daily_missions", editingMissionId);
          await updateDoc(missionRef, newMission);
          
          // Reset Form
          setNewMission({
              title: "", instruction: "", code_word: "", 
              reward_xp: 50, reward_cash: 100, 
              class_id: "Period 1", active_date: new Date().toISOString().split('T')[0]
          });
          setEditingMissionId(null); // Exit "Edit Mode"
          alert("Mission Updated!");
      } catch (error) {
          console.error("Error updating mission:", error);
      }
  };

  // 3. CANCEL EDIT
  const handleCancelEdit = () => {
      setNewMission({
          title: "", instruction: "", code_word: "", 
          reward_xp: 50, reward_cash: 100, 
          class_id: "Period 1", active_date: new Date().toISOString().split('T')[0]
      });
      setEditingMissionId(null);
  };

  // FETCH DAILY MISSIONS
  useEffect(() => {
      const q = query(collection(db, "daily_missions"), orderBy("active_date", "desc"));
      const unsub = onSnapshot(q, (snap) => {
          setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
  }, []);

  // FETCH SIDE HUSTLES
  useEffect(() => {
      const unsub = onSnapshot(collection(db, "side_hustles"), (snap) => {
          setSideHustles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
  }, []);

  // FETCH SIDE HUSTLE SUBMISSIONS
  useEffect(() => {
      const unsub = onSnapshot(collection(db, "side_hustle_jobs"), (snap) => {
          const pending = [];
          snap.docs.forEach(d => {
              const data = d.data();
              if (data.status === "pending_review") {
                  pending.push({ id: d.id, ...data });
              }
          });
          pending.sort((a, b) => (a.submitted_at?.seconds || 0) - (b.submitted_at?.seconds || 0));
          setSideHustleSubmissions(pending);
      });
      return () => unsub();
  }, []);

  // AUTO-SELECT FIRST CLASS (Once availableClasses loads)
  useEffect(() => {
      if(availableClasses.length > 0 && !newMission.class_id) {
          setNewMission(prev => ({ ...prev, class_id: availableClasses[0] }));
      }
  }, [availableClasses, newMission.class_id]);

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

  const resetSideHustleForm = () => {
      if (sideHustleImagePreview?.startsWith("blob:")) {
          URL.revokeObjectURL(sideHustleImagePreview);
      }
      setSideHustleForm({
          title: "",
          tagline: "",
          summary: "",
          details: "",
          reward_cash: 50,
          reward_xp: 25,
          class_id: "all",
          image_url: "",
          status: "live",
          scheduled_date: ""
      });
      setSideHustleLevels([{ title: "Level 1", req: "", ...getAutoLevelRewards(1) }]);
      setSideHustleImagePreview("");
      setEditingSideHustleId(null);
  };

  const setSideHustlePreview = (nextUrl) => {
      if (sideHustleImagePreview?.startsWith("blob:")) {
          URL.revokeObjectURL(sideHustleImagePreview);
      }
      setSideHustleImagePreview(nextUrl || "");
  };

  const handleSideHustleImageChange = (event) => {
      const file = event.target.files?.[0];
      if (!file) {
          setSideHustlePreview(sideHustleForm.image_url || "");
          return;
      }
      if (file.size > MAX_SIDE_HUSTLE_IMAGE_BYTES) {
          alert("Image too large. Please upload a file 350KB or smaller.");
          event.target.value = "";
          setSideHustlePreview(sideHustleForm.image_url || "");
          return;
      }
      const reader = new FileReader();
      reader.onload = () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : "";
          if (!dataUrl) return;
          setSideHustleForm(prev => ({ ...prev, image_url: dataUrl }));
          setSideHustlePreview(dataUrl);
      };
      reader.onerror = () => {
          alert("Failed to read image file.");
      };
      reader.readAsDataURL(file);
  };

  const handleSideHustleLevelChange = (index, field, value) => {
      const nextLevels = [...sideHustleLevels];
      nextLevels[index][field] = value;
      setSideHustleLevels(nextLevels);
  };

  const addSideHustleLevel = () => {
      const nextLevelNumber = sideHustleLevels.length + 1;
      setSideHustleLevels([
          ...sideHustleLevels,
          {
              title: `Level ${nextLevelNumber}`,
              req: "",
              ...getAutoLevelRewards(nextLevelNumber)
          }
      ]);
  };

  const removeSideHustleLevel = (index) => {
      if (sideHustleLevels.length === 1) return;
      setSideHustleLevels(sideHustleLevels.filter((_, i) => i !== index));
  };

  const handleSaveSideHustle = async (e) => {
      e.preventDefault();

      if (sideHustleForm.status === "scheduled" && !sideHustleForm.scheduled_date) {
          alert("Please choose a drop date for scheduled side hustles.");
          return;
      }

      const cleanedLevels = sideHustleLevels
          .map((level, index) => ({
              title: level.title || `Level ${index + 1}`,
              req: level.req || "",
              reward_cash: Number(level.reward_cash ?? getAutoLevelRewards(index + 1).reward_cash) || 0,
              reward_xp: Number(level.reward_xp ?? getAutoLevelRewards(index + 1).reward_xp) || 0
          }))
          .filter(level => level.title || level.req);

      const payload = {
          ...sideHustleForm,
          reward_cash: Number(sideHustleForm.reward_cash) || 0,
          reward_xp: Number(sideHustleForm.reward_xp) || 0,
          levels: cleanedLevels,
          updatedAt: serverTimestamp(),
          scheduled_date: sideHustleForm.status === "scheduled" ? sideHustleForm.scheduled_date : ""
      };

      try {
          const newDocRef = editingSideHustleId
              ? doc(db, "side_hustles", editingSideHustleId)
              : doc(collection(db, "side_hustles"));

          const finalPayload = {
              ...payload,
              image_url: sideHustleForm.image_url || ""
          };

          if (editingSideHustleId) {
              await updateDoc(newDocRef, finalPayload);
          } else {
              await setDoc(newDocRef, {
                  ...finalPayload,
                  createdAt: serverTimestamp()
              });
          }
          resetSideHustleForm();
      } catch (error) {
          console.error("Error saving side hustle:", error);
          alert(error?.message || "Error saving side hustle.");
      }
  };

  const handleEditSideHustle = (hustle) => {
      if (sideHustleImagePreview?.startsWith("blob:")) {
          URL.revokeObjectURL(sideHustleImagePreview);
      }
      setSideHustleForm({
          title: hustle.title || "",
          tagline: hustle.tagline || "",
          summary: hustle.summary || "",
          details: hustle.details || "",
          reward_cash: hustle.reward_cash || 0,
          reward_xp: hustle.reward_xp || 0,
          class_id: hustle.class_id || "all",
          image_url: hustle.image_url || "",
          status: hustle.status || "live",
          scheduled_date: hustle.scheduled_date || ""
      });
      setSideHustleImagePreview(hustle.image_url || "");
      setSideHustleLevels(
          Array.isArray(hustle.levels) && hustle.levels.length > 0
              ? hustle.levels.map((level, index) => ({
                  title: level.title || `Level ${index + 1}`,
                  req: level.req || "",
                  reward_cash: level.reward_cash ?? getAutoLevelRewards(index + 1).reward_cash,
                  reward_xp: level.reward_xp ?? getAutoLevelRewards(index + 1).reward_xp
              }))
              : [{
                  title: "Level 1",
                  req: "",
                  ...getAutoLevelRewards(1)
              }]
      );
      setEditingSideHustleId(hustle.id);
      setShowSideHustleEditor(true);
  };

  const handleDeleteSideHustle = async (id) => {
      if (!confirm("Delete this side hustle?")) return;
      await deleteDoc(doc(db, "side_hustles", id));
  };

  const handleCreateClass = async (e) => {
      e.preventDefault();
      if (!classForm.id || !classForm.code || !classForm.name) {
          alert("Please provide class code, ID, and name.");
          return;
      }
      setIsSavingClass(true);
      try {
          await setDoc(doc(db, "classes", classForm.id.trim()), {
              id: classForm.id.trim(),
              code: classForm.code.trim().toUpperCase(),
              name: classForm.name.trim(),
              division: classForm.division,
              department: classForm.department.trim() || null,
              theme_id: classForm.theme_id || "agency",
              createdAt: serverTimestamp()
          });
          setClassForm({
              id: "",
              code: "",
              name: "",
              division: "MS",
              department: "",
              theme_id: "agency"
          });
      } catch (error) {
          console.error("Create class failed:", error);
          alert("Failed to create class.");
      } finally {
          setIsSavingClass(false);
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

  const getBoostedXp = (baseXp, userData) => {
      const rawExpiry = userData?.xpBoostExpiresAt;
      if (!rawExpiry) return baseXp;
      const expiryDate = rawExpiry?.toDate ? rawExpiry.toDate() : new Date(rawExpiry);
      if (!expiryDate || Number.isNaN(expiryDate.getTime())) return baseXp;
      if (expiryDate <= new Date()) return baseXp;
      const boostPercent = Number(userData?.xpBoostPercent) || 10;
      return Math.ceil(Number(baseXp || 0) * (1 + boostPercent / 100));
  };

  // --- APPROVAL ACTIONS ---
  const approveSubmission = async (job) => {
      try {
          const currentStage = Number(job.current_stage || 1);
          const totalStages = Object.keys(job.stages || {}).length;
          
          // 1. GET THE REWARDS FROM LOOKUP
          const contractData = contractLookup[job.contract_id];
          const payAmount = contractData?.bounty ? Number(contractData.bounty) : 0;
          const baseXp = contractData?.xp_reward ? Number(contractData.xp_reward) : 0;

          const userRef = doc(db, "users", job.student_id);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const xpAmount = getBoostedXp(baseXp, userData);

          console.log(`Approving Stage ${currentStage}. Paying: $${payAmount} & ${xpAmount}XP`);

          const updates = {};
          
          // A. Mark CURRENT stage as completed
          updates[`stages.${currentStage}.status`] = "completed";
          updates[`stages.${currentStage}.completedAt`] = new Date().toISOString();

          // B. PAY THE STUDENT (Happens every time now)
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
                  message: `Mission "${job.contract_title}" COMPLETED! Final Payment: $${payAmount} and +${xpAmount} XP.`,
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
                  message: `Stage ${currentStage} approved! You earned $${payAmount} and +${xpAmount} XP. Proceed to Stage ${nextStage}.`,
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

  const approveSideHustleSubmission = async (job, hustle) => {
      try {
          const submittedLevel = Number(job.last_submitted_level || job.current_level || 1);
          const levelData = Array.isArray(hustle?.levels) ? hustle.levels[submittedLevel - 1] : null;
          const payAmount = levelData?.reward_cash ?? hustle?.reward_cash ?? 0;
          const baseXp = levelData?.reward_xp ?? hustle?.reward_xp ?? 0;

          const totalLevels = Array.isArray(hustle?.levels) ? hustle.levels.length : 0;
          const nextLevel = totalLevels > 0 ? Math.min(submittedLevel + 1, totalLevels) : submittedLevel + 1;

          const userRef = doc(db, "users", job.student_id);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const xpAmount = getBoostedXp(baseXp, userData);

          await updateDoc(userRef, {
              currency: increment(Number(payAmount) || 0),
              xp: increment(Number(xpAmount) || 0)
          });

          await updateDoc(doc(db, "side_hustle_jobs", job.id), {
              status: "active",
              current_level: nextLevel,
              completed_count: increment(1),
              last_approved_at: serverTimestamp(),
              status_message: ""
          });

          await addDoc(collection(db, "users", job.student_id, "alerts"), {
              type: "success",
              message: `Side Hustle "${hustle?.title || job.side_hustle_title}" approved! +$${payAmount} and +${xpAmount} XP.`,
              read: false,
              createdAt: serverTimestamp()
          });
      } catch (error) {
          console.error("Error approving side hustle:", error);
          alert("Error approving side hustle.");
      }
  };

  const returnSideHustleSubmission = async (job) => {
      const reason = prompt("Return reason for this side hustle?");
      if (!reason) return;
      try {
          await updateDoc(doc(db, "side_hustle_jobs", job.id), {
              status: "active",
              status_message: `Returned: ${reason}`,
              last_returned_at: serverTimestamp()
          });

          await addDoc(collection(db, "users", job.student_id, "alerts"), {
              type: "error",
              message: `Side Hustle "${job.side_hustle_title}" returned: ${reason}`,
              read: false,
              createdAt: serverTimestamp()
          });
      } catch (error) {
          console.error("Error returning side hustle:", error);
          alert("Error returning side hustle.");
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
          const payload = {
              ...shopForm,
              price: Number(shopForm.price) || 0,
              stock: Number(shopForm.stock) || 0,
              xpBoostPercent: shopForm.effectType === "xp_boost" ? Number(shopForm.xpBoostPercent) || 10 : null,
              xpBoostDays: shopForm.effectType === "xp_boost" ? Number(shopForm.xpBoostDays) || 14 : null,
              effectType: shopForm.effectType || "none"
          };

          if (editingItem) {
              await updateDoc(doc(db, "shop_items", editingItem.id), payload);
          } else {
              await addDoc(collection(db, "shop_items"), {
                  ...payload,
                  createdAt: serverTimestamp()
              });
          }
          closeShopForm();
      } catch (error) { 
          console.error("Error saving item:", error);
          alert("Error saving item"); 
      }
  };

  const deleteItem = async (id) => {
      if(!confirm("Delete this item?")) return;
      await deleteDoc(doc(db, "shop_items", id));
  };

  const startEdit = (item) => {
      setEditingItem(item);
      setShopForm({ 
          title: item.title, desc: item.desc, price: item.original_price || item.price, // Always edit the REAL price
          stock: item.stock, 
          iconName: item.iconName,
          effectType: item.effectType || "none",
          xpBoostPercent: item.xpBoostPercent || 10,
          xpBoostDays: item.xpBoostDays || 14
      });
      setIsShopFormOpen(true);
  };

  const closeShopForm = () => {
      setIsShopFormOpen(false);
      setEditingItem(null);
      setShopForm({ 
          title: "", 
          desc: "", 
          price: Number(shopForm.price) || 0,
          stock: Number(shopForm.stock) || 0, 
          iconName: "briefcase",
          effectType: "none",
          xpBoostPercent: 10,
          xpBoostDays: 14
      });
  };

  // --- FILTERING ---
  const sideHustleLookup = sideHustles.reduce((acc, hustle) => {
      acc[hustle.id] = hustle;
      return acc;
  }, {});

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
    <AdminShell>
      <div className="max-w-6xl mx-auto">
        
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

        {/* ==================== TAB 1: APPROVALS ==================== */}
        {activeTab === "approvals" && (
        <div className="space-y-8">

                {/* TOP ROW: STATS + MISSION LOG */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 lg:col-span-1">
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

                        {/* SIDE HUSTLES CONTROL */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase">Side Hustles</p>
                                    <p className="text-slate-500 text-xs">Always-on promo projects with repeatable rewards.</p>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] font-bold uppercase text-slate-400">
                                        <span>{sideHustles.length} live</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{sideHustleSubmissions.length} pending</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSideHustleEditor(true)}
                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition"
                                >
                                    Open Manager
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col lg:col-span-2">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-700 text-sm uppercase">Mission Log</h3>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {activeMissions.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowDailyMissions(true)}
                                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition"
                            >
                                Open Mission Control
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto">
                            {activeMissions.length === 0 ? (
                                <div className="text-slate-400 text-sm italic p-4 border border-dashed rounded-lg text-center">
                                    No active orders for today or the future.
                                </div>
                            ) : (
                                activeMissions.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 transition group">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center bg-slate-100 px-3 py-1 rounded-lg min-w-[80px]">
                                                <div className="text-xs font-bold text-slate-400 uppercase">
                                                    {new Date(m.active_date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short'})}
                                                </div>
                                                <div className="text-sm font-black text-slate-700">
                                                    {m.active_date.slice(5)}
                                                </div>
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                                        {m.class_id}
                                                    </span>
                                                    <h4 className="font-bold text-slate-700 truncate">{m.title}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate max-w-md">
                                                    {m.instruction} 
                                                </p>
                                            </div>
                                        </div>

                                        <button onClick={() => handleDeleteMission(m.id)} className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* APPROVAL QUEUE */}
                <div>
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

                {/* SIDE HUSTLE QUEUE */}
                <div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Rocket className="text-indigo-600" size={20} />
                                Side Hustle Queue
                            </h2>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {sideHustleSubmissions.length}
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {sideHustleSubmissions.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No side hustle submissions waiting.</p>
                                </div>
                            ) : (
                                sideHustleSubmissions.map(job => {
                                    const hustle = sideHustleLookup[job.side_hustle_id];
                                    const displayLink = job.submission_link || job.submissionLink || job.submission_url;
                                    const levelLabel = job.last_submitted_level || job.current_level || 1;

                                    return (
                                        <div key={job.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-slate-50 transition">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-slate-900 truncate text-lg">
                                                        {job.side_hustle_title || hustle?.title || "Side Hustle"}
                                                    </h3>
                                                    {displayLink ? (
                                                        <a
                                                            href={displayLink.startsWith('http') ? displayLink : `https://${displayLink}`}
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
                                                    <span className="font-bold text-slate-700">{job.student_name}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                                        {hustle?.class_id || "All Classes"}
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        Level {levelLabel}
                                                    </span>
                                                    {job.submitted_at?.seconds && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <span>
                                                                {new Date(job.submitted_at.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                {job.status_message && (
                                                    <p className="text-xs text-amber-600 mt-2">{job.status_message}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <button
                                                    onClick={() => returnSideHustleSubmission(job)}
                                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition text-sm flex items-center gap-2"
                                                >
                                                    <AlertTriangle size={16}/> Return
                                                </button>
                                                <button
                                                    onClick={() => approveSideHustleSubmission(job, hustle)}
                                                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg transition text-sm flex items-center gap-2"
                                                >
                                                    <CheckCircle size={16}/> Approve
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
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
                    {/* CLASS CREATION */}
                    <div className="p-6 rounded-xl border shadow-sm bg-white border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="text-indigo-600" size={18} />
                            <h3 className="font-bold text-slate-800">Create Class</h3>
                        </div>
                        <form onSubmit={handleCreateClass} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Class Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    placeholder="e.g. 7th Grade CS"
                                    value={classForm.name}
                                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                                />
                            </div>
                                <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Class ID</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                                        placeholder="e.g. 7th_cs"
                                        value={classForm.id}
                                        onChange={(e) => setClassForm({ ...classForm, id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Join Code</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                                        placeholder="e.g. CS7"
                                        value={classForm.code}
                                        onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Division</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        value={classForm.division}
                                        onChange={(e) => setClassForm({ ...classForm, division: e.target.value })}
                                    >
                                        <option value="LS">LS</option>
                                        <option value="MS">MS</option>
                                        <option value="US">US</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Theme</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        value={classForm.theme_id}
                                        onChange={(e) => setClassForm({ ...classForm, theme_id: e.target.value })}
                                    >
                                        {THEME_OPTIONS.map((themeOption) => (
                                            <option key={themeOption.id} value={themeOption.id}>
                                                {themeOption.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Department (optional)</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    placeholder="e.g. Computer Science"
                                    value={classForm.department}
                                    onChange={(e) => setClassForm({ ...classForm, department: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition"
                                disabled={isSavingClass}
                            >
                                {isSavingClass ? "Creating..." : "Create Class"}
                            </button>
                        </form>
                    </div>
                    
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
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Effect</label>
                                <select
                                    className="w-full p-2 border rounded mt-1 bg-white text-sm"
                                    value={shopForm.effectType}
                                    onChange={e => setShopForm({...shopForm, effectType: e.target.value})}
                                >
                                    <option value="none">Standard item</option>
                                    <option value="xp_boost">XP Multiplier</option>
                                </select>
                            </div>

                            {shopForm.effectType === "xp_boost" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Boost %</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded mt-1 text-sm"
                                            value={shopForm.xpBoostPercent}
                                            onChange={e => setShopForm({...shopForm, xpBoostPercent: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Duration (days)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded mt-1 text-sm"
                                            value={shopForm.xpBoostDays}
                                            onChange={e => setShopForm({...shopForm, xpBoostDays: parseInt(e.target.value)})}
                                        />
                                    </div>
                                </div>
                            )}

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

      {/* --- SIDE HUSTLE MANAGER MODAL --- */}
      {showSideHustleEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                        <Rocket className="text-indigo-600"/> SIDE HUSTLE MANAGER
                    </h2>
                    <button 
                        onClick={() => setShowSideHustleEditor(false)} 
                        className="p-2 hover:bg-slate-200 rounded-full transition"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* CONTENT GRID */}
                <div className="p-6 overflow-y-auto bg-slate-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* LEFT: FORM */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    {editingSideHustleId ? (
                                        <><Pencil size={18} className="text-indigo-600"/> Edit Side Hustle</>
                                    ) : (
                                        <><Plus size={18} className="text-indigo-600"/> New Side Hustle</>
                                    )}
                                </h3>
                                {editingSideHustleId && (
                                    <button 
                                        type="button"
                                        onClick={resetSideHustleForm}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 underline"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSaveSideHustle} className="space-y-4 text-sm">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Title</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={sideHustleForm.title}
                                        onChange={(e) => setSideHustleForm({ ...sideHustleForm, title: e.target.value })}
                                        placeholder="e.g. Flash Promo: AI Poster"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Tagline</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                            value={sideHustleForm.tagline}
                                            onChange={(e) => setSideHustleForm({ ...sideHustleForm, tagline: e.target.value })}
                                            placeholder="ALWAYS ON"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Class</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                                            value={sideHustleForm.class_id}
                                            onChange={(e) => setSideHustleForm({ ...sideHustleForm, class_id: e.target.value })}
                                        >
                                            <option value="all">All Classes</option>
                                            {Object.values(CLASS_CODES).map((cls) => (
                                                <option key={cls.id} value={cls.id}>
                                                    {cls.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Status</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        value={sideHustleForm.status || "live"}
                                        onChange={(e) => setSideHustleForm({ ...sideHustleForm, status: e.target.value })}
                                    >
                                        <option value="live">Live</option>
                                        <option value="scheduled">Scheduled Drop</option>
                                    </select>
                                </div>

                                {sideHustleForm.status === "scheduled" && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Drop Date</label>
                                        <input
                                            type="date"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                            value={sideHustleForm.scheduled_date || ""}
                                            onChange={(e) => setSideHustleForm({ ...sideHustleForm, scheduled_date: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Card Summary</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={sideHustleForm.summary}
                                        onChange={(e) => setSideHustleForm({ ...sideHustleForm, summary: e.target.value })}
                                        placeholder="Short teaser for the card"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Image URL</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={sideHustleForm.image_url}
                                        onChange={(e) => {
                                            const nextUrl = e.target.value;
                                            setSideHustleForm({ ...sideHustleForm, image_url: nextUrl });
                                            setSideHustlePreview(nextUrl);
                                        }}
                                        placeholder="/side.png or hosted URL"
                                    />

                                    <div className="mt-3 space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500">Upload Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSideHustleImageChange}
                                            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold hover:file:bg-slate-200"
                                        />
                                        {(sideHustleForm.image_url || sideHustleImagePreview) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSideHustleForm({ ...sideHustleForm, image_url: "" });
                                                    setSideHustlePreview("");
                                                }}
                                                className="text-xs font-bold text-red-500 hover:text-red-700"
                                            >
                                                Clear Image
                                            </button>
                                        )}
                                        {sideHustleImagePreview && (
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <img
                                                    src={sideHustleImagePreview}
                                                    alt="Side hustle preview"
                                                    className="w-full h-32 object-cover"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Main Briefing</label>
                                    <textarea
                                        rows="3"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={sideHustleForm.details}
                                        onChange={(e) => setSideHustleForm({ ...sideHustleForm, details: e.target.value })}
                                        placeholder="Describe the side hustle..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Default Cash ($)</label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                            value={sideHustleForm.reward_cash}
                                            onChange={(e) => setSideHustleForm({ ...sideHustleForm, reward_cash: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Default XP</label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                            value={sideHustleForm.reward_xp}
                                            onChange={(e) => setSideHustleForm({ ...sideHustleForm, reward_xp: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <details className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                    <summary className="text-xs font-bold uppercase text-slate-500 cursor-pointer">
                                        Levels (Rewards Per Level)
                                    </summary>
                                    <div className="space-y-2 mt-3">
                                        {sideHustleLevels.map((level, index) => (
                                            <div key={index} className="grid grid-cols-[1fr,2fr,auto] gap-2 items-start">
                                                <div className="space-y-2">
                                                    <input
                                                        className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full"
                                                        value={level.title}
                                                        onChange={(e) => handleSideHustleLevelChange(index, "title", e.target.value)}
                                                        placeholder={`Level ${index + 1}`}
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input
                                                            type="number"
                                                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full"
                                                            value={level.reward_cash ?? ""}
                                                            onChange={(e) => handleSideHustleLevelChange(index, "reward_cash", Number(e.target.value))}
                                                            placeholder="Cash"
                                                        />
                                                        <input
                                                            type="number"
                                                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full"
                                                            value={level.reward_xp ?? ""}
                                                            onChange={(e) => handleSideHustleLevelChange(index, "reward_xp", Number(e.target.value))}
                                                            placeholder="XP"
                                                        />
                                                    </div>
                                                </div>
                                                <input
                                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs h-full"
                                                    value={level.req}
                                                    onChange={(e) => handleSideHustleLevelChange(index, "req", e.target.value)}
                                                    placeholder="Requirement"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSideHustleLevel(index)}
                                                    className="text-slate-400 hover:text-red-500 px-2"
                                                    title="Remove level"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addSideHustleLevel}
                                        className="mt-3 w-full border border-dashed border-slate-300 text-slate-500 text-xs font-bold py-2 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition"
                                    >
                                        + Add Level
                                    </button>
                                </details>

                                <button
                                    type="submit"
                                    className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg hover:bg-indigo-600 transition"
                                >
                                    {editingSideHustleId ? "Save Changes" : "Publish Side Hustle"}
                                </button>
                            </form>
                        </div>

                        {/* RIGHT: LIVE LIST */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase text-slate-400">All Hustles</h3>
                                <span className="text-xs text-slate-400">{sideHustles.length} total</span>
                            </div>
                            {sideHustles.length === 0 ? (
                                <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                    No side hustles yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sideHustles.map((hustle) => (
                                        <div key={hustle.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{hustle.title}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase">{hustle.class_id || "all"}</p>
                                                    </div>
                                            <div className="text-xs font-bold text-slate-500 text-right">
                                                        ${hustle.reward_cash} • {hustle.reward_xp} XP
                                                        <div className="text-[10px] uppercase text-slate-400 mt-1">
                                                            {formatSideHustleStatus(hustle.status, hustle.scheduled_date)}
                                                        </div>
                                                    </div>
                                                </div>
                                                {hustle.summary && (
                                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{hustle.summary}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between mt-4">
                                                <span className="text-[10px] text-slate-400">
                                                    {Array.isArray(hustle.levels) ? hustle.levels.length : 0} levels
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {hustle.status === "archived" ? (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await updateDoc(doc(db, "side_hustles", hustle.id), { status: "live" });
                                                                } catch (error) {
                                                                    console.error("Failed to restore side hustle:", error);
                                                                }
                                                            }}
                                                            className="text-slate-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition text-xs font-bold"
                                                            title="Restore"
                                                        >
                                                            Restore
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await updateDoc(doc(db, "side_hustles", hustle.id), { status: "archived" });
                                                                } catch (error) {
                                                                    console.error("Failed to archive side hustle:", error);
                                                                }
                                                            }}
                                                            className="text-slate-400 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition text-xs font-bold"
                                                            title="Archive"
                                                        >
                                                            Archive
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditSideHustle(hustle)}
                                                        className="text-slate-400 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSideHustle(hustle.id)}
                                                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
                    
                    {/* LEFT: FORM (Inputs Restored!) */}
                    <div className="lg:col-span-1 bg-slate-50 p-6 rounded-xl border border-slate-200 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                {editingMissionId ? (
                                    <><Pencil size={18} className="text-indigo-600"/> Edit Order</>
                                ) : (
                                    <><Plus size={18} className="text-indigo-600"/> New Order</>
                                )}
                            </h3>
                            
                            {/* CANCEL BUTTON */}
                            {editingMissionId && (
                                <button 
                                    onClick={handleCancelEdit}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 underline"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        {/* FORM START */}
                        <form onSubmit={editingMissionId ? handleUpdateMission : handleCreateMission} className="space-y-4">
                            
                            {/* 1. Target Class & Date */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Target Class</label>
                                    <select 
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                                        value={newMission.class_id}
                                        onChange={e => setNewMission({...newMission, class_id: e.target.value})}
                                    >
                                        {/* Dynamic Options from GameConfig */}
                                        {Object.values(CLASS_CODES).map((cls) => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Active Date</label>
                                    <input 
                                        type="date"
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                                        value={newMission.active_date}
                                        onChange={e => setNewMission({...newMission, active_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* 2. Mission Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mission Title</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Operation: Deep Freeze"
                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 outline-none"
                                    value={newMission.title}
                                    onChange={e => setNewMission({...newMission, title: e.target.value})}
                                />
                            </div>

                            {/* 3. Instructions */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Briefing / Instructions</label>
                                <textarea 
                                    rows="3"
                                    placeholder="Describe the objective..."
                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm text-slate-600 placeholder:text-slate-300 focus:border-indigo-500 outline-none resize-none"
                                    value={newMission.instruction}
                                    onChange={e => setNewMission({...newMission, instruction: e.target.value})}
                                />
                            </div>

                            {/* 4. Code Word */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Secret Code (Optional)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="LEAVE BLANK FOR NONE"
                                        className="w-full pl-9 p-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-indigo-600 placeholder:text-slate-300 focus:border-indigo-500 outline-none uppercase"
                                        value={newMission.code_word}
                                        onChange={e => setNewMission({...newMission, code_word: e.target.value})}
                                    />
                                    <div className="absolute left-3 top-2.5 text-slate-400">#</div>
                                </div>
                            </div>

                            {/* 5. Rewards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cash ($)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                                        value={newMission.reward_cash}
                                        onChange={e => setNewMission({...newMission, reward_cash: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">XP</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                                        value={newMission.reward_xp}
                                        onChange={e => setNewMission({...newMission, reward_xp: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <button 
                                type="submit"
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition flex items-center justify-center gap-2 ${
                                    editingMissionId 
                                    ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200" 
                                    : "bg-slate-800 hover:bg-slate-900 shadow-slate-300"
                                }`}
                            >
                                {editingMissionId ? (
                                    <><Pencil size={18} /> Save Changes</>
                                ) : (
                                    <><Rocket size={18} /> Deploy Mission</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT: MISSION LOG (The List) */}
                    <div className="lg:col-span-2 flex flex-col h-full">
                        
                        {/* HEADER & TOGGLE */}
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                                {viewArchive ? "Mission Archives" : "Active Orders"}
                            </h3>
                            
                            <button 
                                onClick={() => setViewArchive(!viewArchive)}
                                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition"
                            >
                                {viewArchive ? (
                                    <>View Active ({activeMissions.length}) <ArrowRight size={14}/></>
                                ) : (
                                    <><History size={14}/> View History</>
                                )}
                            </button>
                        </div>

                        {/* THE LIST */}
                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                            
                            {/* EMPTY STATE */}
                            {(viewArchive ? archivedMissions : activeMissions).length === 0 && (
                                <div className="text-slate-400 text-sm italic p-8 border-2 border-dashed rounded-xl text-center bg-slate-50">
                                    {viewArchive 
                                        ? "No past missions found." 
                                        : "No active orders. Deploy one to start the day!"}
                                </div>
                            )}

                            {/* MAPPING THE MISSIONS */}
                            {(viewArchive ? archivedMissions : activeMissions).map(m => (
                                <div key={m.id} className={`flex items-start gap-4 p-4 border rounded-xl shadow-sm transition group ${viewArchive ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                                    
                                    {/* Date Badge */}
                                    <div className={`text-center px-3 py-2 rounded-lg min-w-[70px] shrink-0 border ${viewArchive ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                                            {new Date(m.active_date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short'})}
                                        </div>
                                        <div className="text-lg font-black leading-none mt-1">
                                            {m.active_date.slice(5)}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                                                {m.class_id}
                                            </span>
                                            <h4 className="font-bold text-slate-800 truncate">{m.title}</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">
                                            {m.instruction} 
                                        </p>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                            <span className="flex items-center gap-1"><Zap size={12}/> {m.reward_xp}</span>
                                            <span className="flex items-center gap-1"><DollarSign size={12}/> ${m.reward_cash}</span>
                                            {m.code_word && <span className="text-indigo-400 bg-indigo-50 px-1 rounded border border-indigo-100">PASS: {m.code_word}</span>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        
                                        {/* EDIT BUTTON */}
                                        <button 
                                            onClick={() => handleEditClick(m)} 
                                            className="text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition"
                                            title="Edit Mission"
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        {/* Recycle Button (Only in Archive) */}
                                        {viewArchive && (
                                            <button 
                                                onClick={() => handleRedeploy(m)} 
                                                className="text-indigo-400 hover:text-white hover:bg-indigo-500 p-2 rounded-lg transition"
                                                title="Redeploy to Today"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                        )}
                                        
                                        {/* Delete Button */}
                                        <button 
                                            onClick={() => handleDeleteMission(m.id)} 
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>

            </div>
        </div>
      )}
    </AdminShell>
  );
}
