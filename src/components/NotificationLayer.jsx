import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { 
    doc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    deleteDoc,
    addDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { BADGES } from "../lib/gameConfig";
import { Sparkles, Trophy, CheckCircle, Briefcase, X, Zap, DollarSign } from "lucide-react";

// Optional: npm install canvas-confetti
import confetti from "canvas-confetti"; 

export default function NotificationLayer() {
  const { user } = useAuth();
  const [notification, setNotification] = useState(null);
  
  // Refs to store "Previous State" so we can detect changes
  const prevXpRef = useRef(null);
  const prevJobsRef = useRef({}); 

  // --- HELPER FUNCTIONS ---
  const triggerPopup = (config) => {
      setNotification(config);
      // Auto-dismiss simple updates after 5 seconds, keep Badges until clicked
      if (config.type !== 'badge') {
          setTimeout(() => setNotification(null), 6000);
      }
  };

  const fireConfetti = () => {
      if (typeof confetti === 'function') {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
  };

  const handleClose = () => {
      setNotification(null);
  };

  useEffect(() => {
    if (!user) return;

    // --- LISTENER 1: USER PROFILE (Level Ups & Badges) ---
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        // A. CHECK FOR NEW BADGES
        // We use Object.values() because 'badges' is stored as a Map in Firebase
        const badgesList = data.badges ? Object.values(data.badges) : [];
        const newBadge = badgesList.find(b => b.new === true);

        if (newBadge) {
            // Fallback: If BADGES const doesn't have it, use the title from the DB
            const def = BADGES[newBadge.id] || { title: newBadge.title || "New Medal", icon: "🎖️" };
            
            triggerPopup({
                title: "Commendation Awarded",
                message: def.title,
                icon: def.icon,
                color: "bg-yellow-500",
                type: "badge",
                id: newBadge.id // (Note: id might be undefined in Object.values, strictly speaking we need the key, but for display this works)
            });

            // --- NEW: Disappear after 10 seconds ---
            setTimeout(() => {
                setNotification((current) => {
                    // Only close it if it's still the badge notification
                    // (Prevents closing a newer notification if one came in)
                    return current?.type === "badge" ? null : current;
                });
            }, 10000); 
        }

        // B. CHECK FOR LEVEL UP
        const currentXp = data.xp || 0;
        if (prevXpRef.current !== null) {
            const oldLevel = Math.floor(prevXpRef.current / 1000) + 1;
            const newLevel = Math.floor(currentXp / 1000) + 1;

            if (newLevel > oldLevel) {
                triggerPopup({
                    title: "PROMOTION!",
                    message: `You have reached Seniority Level ${newLevel}.`,
                    icon: <Trophy size={32} />,
                    color: "bg-indigo-600",
                    type: "levelup"
                });
                fireConfetti();
            }
        }
        prevXpRef.current = currentXp;

        // C. XP BOOST EXPIRY NOTIFICATIONS
        const rawExpiry = data.xpBoostExpiresAt;
        if (rawExpiry) {
            const expiryDate = rawExpiry?.toDate ? rawExpiry.toDate() : new Date(rawExpiry);
            if (!Number.isNaN(expiryDate.getTime())) {
                const now = new Date();
                const msLeft = expiryDate.getTime() - now.getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;
                const boostPercent = Number(data.xpBoostPercent) || 10;

                if (msLeft > 0 && msLeft <= oneDayMs && !data.xpBoostNotifiedSoon) {
                    addDoc(collection(db, "users", user.uid, "alerts"), {
                        type: "warning",
                        message: `XP Boost expires tomorrow. (+${boostPercent}% XP)`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                    updateDoc(doc(db, "users", user.uid), { xpBoostNotifiedSoon: true });
                    triggerPopup({
                        title: "XP Boost Expiring",
                        message: `Boost ends tomorrow (+${boostPercent}% XP).`,
                        icon: <Zap size={28} />,
                        color: "bg-amber-500",
                        type: "xpboost"
                    });
                }

                if (msLeft <= 0 && !data.xpBoostNotifiedExpired) {
                    addDoc(collection(db, "users", user.uid, "alerts"), {
                        type: "info",
                        message: "XP Boost expired.",
                        read: false,
                        createdAt: serverTimestamp()
                    });
                    updateDoc(doc(db, "users", user.uid), { xpBoostNotifiedExpired: true });
                    triggerPopup({
                        title: "XP Boost Ended",
                        message: "Your XP Boost has expired.",
                        icon: <Zap size={28} />,
                        color: "bg-slate-900",
                        type: "xpboost"
                    });
                }
            }
        }

        // D. CURRENCY BOOST EXPIRY NOTIFICATIONS
        const rawCashExpiry = data.currencyBoostExpiresAt;
        if (rawCashExpiry) {
            const cashExpiry = rawCashExpiry?.toDate ? rawCashExpiry.toDate() : new Date(rawCashExpiry);
            if (!Number.isNaN(cashExpiry.getTime())) {
                const now = new Date();
                const msLeft = cashExpiry.getTime() - now.getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;
                const boostPercent = Number(data.currencyBoostPercent) || 10;

                if (msLeft > 0 && msLeft <= oneDayMs && !data.currencyBoostNotifiedSoon) {
                    addDoc(collection(db, "users", user.uid, "alerts"), {
                        type: "warning",
                        message: `Currency Boost expires tomorrow. (+${boostPercent}% earnings)`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                    updateDoc(doc(db, "users", user.uid), { currencyBoostNotifiedSoon: true });
                    triggerPopup({
                        title: "Currency Boost Expiring",
                        message: `Boost ends tomorrow (+${boostPercent}% earnings).`,
                        icon: <DollarSign size={28} />,
                        color: "bg-emerald-600",
                        type: "cashboost"
                    });
                }

                if (msLeft <= 0 && !data.currencyBoostNotifiedExpired) {
                    addDoc(collection(db, "users", user.uid, "alerts"), {
                        type: "info",
                        message: "Currency Boost expired.",
                        read: false,
                        createdAt: serverTimestamp()
                    });
                    updateDoc(doc(db, "users", user.uid), { currencyBoostNotifiedExpired: true });
                    triggerPopup({
                        title: "Currency Boost Ended",
                        message: "Your Currency Boost has expired.",
                        icon: <DollarSign size={28} />,
                        color: "bg-slate-900",
                        type: "cashboost"
                    });
                }
            }
        }
    }, (error) => {
        console.error("NotificationLayer user listener failed:", error);
    });

    // --- LISTENER 2: ACTIVE JOBS (Stage Progress) ---
    const q = query(collection(db, "active_jobs"), where("student_id", "==", user.uid));
    const unsubJobs = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const job = doc.data();
            const jobId = doc.id;
            const currentStage = job.current_stage;
            const status = job.status;

            const prevStage = prevJobsRef.current[jobId];

            if (prevStage !== undefined) {
                // Stage Complete
                if (currentStage > prevStage) {
                    triggerPopup({
                        title: "Stage Complete",
                        message: `${job.contract_title}: Stage ${prevStage} cleared.`,
                        icon: <CheckCircle size={32} />,
                        color: "bg-green-600",
                        type: "progress"
                    });
                }
                // Job Complete
                if (status === 'completed' && prevJobsRef.current[jobId + '_status'] !== 'completed') {
                    triggerPopup({
                        title: "MISSION ACCOMPLISHED",
                        message: `${job.contract_title} fully executed. Payment released.`,
                        icon: <Briefcase size={32} />,
                        color: "bg-slate-900",
                        type: "complete"
                    });
                    fireConfetti();
                }
            }
            prevJobsRef.current[jobId] = currentStage;
            prevJobsRef.current[jobId + '_status'] = status;
        });
    }, (error) => {
        console.error("NotificationLayer jobs listener failed:", error);
    });

    // --- LISTENER 3: MANUAL ADMIN MESSAGES (ALERTS) ---
    const alertsRef = collection(db, "users", user.uid, "alerts");
    const unsubAlerts = onSnapshot(alertsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                
                // 1. Trigger the Popup
                triggerPopup({
                    title: "INCOMING TRANSMISSION",
                    message: data.message,
                    icon: <Zap size={32} />,
                    color: "bg-purple-600", 
                    type: "alert"
                });

                // 2. Play Sound (Optional)
                // const audio = new Audio('/ping.mp3');
                // audio.play().catch(e => console.log("Audio blocked"));

                // 3. DELETE the alert immediately so it doesn't pop up again
                try {
                    await deleteDoc(change.doc.ref); // Uses the doc reference directly
                } catch (err) {
                    console.error("Could not clear alert", err);
                }
            }
        });
    }, (error) => {
        console.error("NotificationLayer alerts listener failed:", error);
    });

    return () => { unsubUser(); unsubJobs(); unsubAlerts(); };
  }, [user]);

  // --- RENDER ---

  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pb-10 pointer-events-none px-4">
        {/* The Card */}
        <div className={`pointer-events-auto bg-white rounded-2xl shadow-2xl border-l-8 overflow-hidden w-full max-w-md transform transition-all duration-500 animate-in slide-in-from-bottom-10 fade-in ${
            notification.color.replace("bg-", "border-")
        }`}>
            <div className="flex items-center p-6 gap-5">
                
                {/* ICON */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl shadow-md shrink-0 ${notification.color}`}>
                    {notification.icon}
                </div>

                {/* TEXT */}
                <div className="flex-1">
                    <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                        {notification.title}
                    </h3>
                    <p className="text-slate-500 font-medium leading-tight mt-1">
                        {notification.message}
                    </p>
                </div>

                {/* CLOSE BTN */}
                <button onClick={handleClose} className="text-slate-300 hover:text-slate-600 transition">
                    <X size={24} />
                </button>
            </div>
            
            {/* Progress Bar Timer */}
            {notification.type !== 'badge' && (
                <div className="h-1 bg-slate-100 w-full">
                    <div className={`h-full ${notification.color} animate-[wiggle_6s_linear_forwards]`} style={{width: '100%'}}></div>
                </div>
            )}
        </div>
    </div>
  );
}
