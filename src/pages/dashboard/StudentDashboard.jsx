import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import {    collection, 
            query, 
            where, 
            onSnapshot, 
            doc, 
            getDoc,
            getDocs, 
            updateDoc, 
            increment, 
            arrayUnion,
            addDoc,
            serverTimestamp,
            setDoc } from "firebase/firestore"; 
import { 
  Briefcase, 
  DollarSign, 
  Zap, 
  Clock, 
  CheckCircle, 
  Loader, 
  AlertCircle, 
  ArrowRight, 
  Trophy,     
  PlayCircle,
  Lock,
  FileText, 
  Unlock, 
  Star, 
  X,
  Key,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { THEME_OPTIONS } from "../../lib/themeConfig";
import { useTheme } from "../../context/ThemeContext";
import { 
  getActiveEventsForClass,
  getActiveEventsForClasses,
  applyEventRewards,
  formatEventBonusMessage,
  getOneTimeEvents,
  filterEventsByClaims
} from "../../lib/eventUtils";

export default function StudentDashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const labels = theme.labels;
  const [classThemeId, setClassThemeId] = useState("agency");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [liveUserData, setLiveUserData] = useState(null);
  
  const [contracts, setContracts] = useState([]);
  const [activeJobs, setActiveJobs] = useState({}); 
  const [sideHustles, setSideHustles] = useState([]);
  const [sideHustleJobs, setSideHustleJobs] = useState({});
// --- NEW: DAILY MISSION STATE ---
  const [dailyMission, setDailyMission] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [missionCode, setMissionCode] = useState("");
  const [missionError, setMissionError] = useState("");

  // --- LIVE WALLET STATE ---
  const [stats, setStats] = useState({ 
    currency: userData?.currency || 0, 
    xp: userData?.xp || 0,
    completed_missions: [] 
  });

  // --- STATE FOR CLASSES (New) ---
  const [allowedClasses, setAllowedClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [eggClaiming, setEggClaiming] = useState(false);
  const [eggError, setEggError] = useState("");
  const [jackpotActive, setJackpotActive] = useState(false);
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [showJackpotModal, setShowJackpotModal] = useState(false);
  const jackpotIntervalRef = useRef(null);
  const jackpotReachedRef = useRef(false);
  const DEFAULT_EVENT_BG = "/event-modal-default.gif";
  const boostExpiryRaw = liveUserData?.xpBoostExpiresAt;
  const boostExpiryDate = boostExpiryRaw?.toDate ? boostExpiryRaw.toDate() : boostExpiryRaw ? new Date(boostExpiryRaw) : null;
  const boostActive = boostExpiryDate && boostExpiryDate > new Date();
  const boostPercent = Number(liveUserData?.xpBoostPercent) || 10;
  const cashBoostExpiryRaw = liveUserData?.currencyBoostExpiresAt;
  const cashBoostExpiryDate = cashBoostExpiryRaw?.toDate ? cashBoostExpiryRaw.toDate() : cashBoostExpiryRaw ? new Date(cashBoostExpiryRaw) : null;
  const cashBoostActive = cashBoostExpiryDate && cashBoostExpiryDate > new Date();
  const cashBoostPercent = Number(liveUserData?.currencyBoostPercent) || 10;

  const EGG_BADGE_ID = "egg_hunter_3";
  const EGG_BADGE_TITLE = "Egg Hunter III";
  const EGG_BADGE_DESCRIPTION = "Found the hidden dashboard key.";
  const EGG_REWARD_CURRENCY = 1000;
  const JACKPOT_TARGET = 100000000;

  const sparkleSeeds = useMemo(() => (
    Array.from({ length: 14 }, (_, index) => ({
      id: index,
      left: `${8 + (index * 13) % 85}%`,
      top: `${10 + (index * 17) % 75}%`,
      size: `${10 + (index % 4) * 4}px`,
      delay: `${(index % 6) * 0.4}s`,
      duration: `${2.8 + (index % 5) * 0.6}s`,
      symbol: index % 2 === 0 ? "*" : "+"
    }))
  ), []);

  const jackpotSparkles = useMemo(() => (
    Array.from({ length: 16 }, (_, index) => ({
      id: index,
      left: `${5 + (index * 11) % 90}%`,
      top: `${12 + (index * 19) % 70}%`,
      size: `${10 + (index % 5) * 3}px`,
      delay: `${(index % 8) * 0.2}s`,
      duration: `${1.6 + (index % 4) * 0.4}s`,
      symbol: index % 2 === 0 ? "✦" : "✧"
    }))
  ), []);

  const jackpotBills = useMemo(() => (
    Array.from({ length: 12 }, (_, index) => ({
      id: index,
      left: `${10 + (index * 14) % 80}%`,
      delay: `${(index % 6) * 0.25}s`,
      duration: `${1.8 + (index % 5) * 0.3}s`,
      size: `${12 + (index % 3) * 4}px`
    }))
  ), []);

  const resolveEventClaims = async (activeEvents, userId) => {
      const oneTimeEvents = getOneTimeEvents(activeEvents);
      if (!oneTimeEvents.length) {
          return { usableEvents: activeEvents, claimedIds: new Set() };
      }
      const claimSnaps = await Promise.all(
          oneTimeEvents.map((event) =>
              getDoc(doc(db, "users", userId, "event_claims", event.id))
          )
      );
      const claimedIds = new Set();
      claimSnaps.forEach((snap, index) => {
          if (snap.exists()) claimedIds.add(oneTimeEvents[index].id);
      });
      return {
          usableEvents: filterEventsByClaims(activeEvents, claimedIds),
          claimedIds
      };
  };

  const hasEggBadge = !!liveUserData?.badges?.[EGG_BADGE_ID];

  const handleEggKeyClick = () => {
    if (hasEggBadge) return;
    setEggError("");
    setShowEggModal(true);
  };

  const handleClaimEggReward = async () => {
    if (eggClaiming || hasEggBadge || !user?.uid) return;
    setEggClaiming(true);
    try {
      const badgeRef = doc(db, "badges", EGG_BADGE_ID);
      const badgeSnap = await getDoc(badgeRef);
      if (!badgeSnap.exists()) {
        await setDoc(badgeRef, {
          title: EGG_BADGE_TITLE,
          description: EGG_BADGE_DESCRIPTION,
          xpReward: 0,
          currencyReward: EGG_REWARD_CURRENCY,
          iconName: "trophy",
          createdAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        [`badges.${EGG_BADGE_ID}`]: {
          earnedAt: new Date().toISOString(),
          title: EGG_BADGE_TITLE
        },
        currency: increment(EGG_REWARD_CURRENCY)
      });

      await addDoc(collection(db, "users", user.uid, "alerts"), {
        type: "success",
        message: `Egg secured! +$${EGG_REWARD_CURRENCY} and "${EGG_BADGE_TITLE}" unlocked.`,
        read: false,
        createdAt: serverTimestamp()
      });

      setShowEggModal(false);
      setEggError("");
    } catch (error) {
      console.error("Egg reward failed:", error);
      setEggError("Reward drop failed. Try again.");
    } finally {
      setEggClaiming(false);
    }
  };

  const displayCurrency = jackpotActive ? jackpotAmount : stats.currency;

  const startJackpotSpin = () => {
    if (jackpotActive || showJackpotModal) return;
    jackpotReachedRef.current = false;
    setJackpotAmount(stats.currency || 0);
    setJackpotActive(true);

    if (jackpotIntervalRef.current) {
      clearInterval(jackpotIntervalRef.current);
    }

    jackpotIntervalRef.current = setInterval(() => {
      setJackpotAmount((prev) => {
        if (jackpotReachedRef.current) return prev;
        const remaining = JACKPOT_TARGET - prev;
        const stepBase = Math.max(50000, Math.floor(remaining / 6));
        const jitter = Math.floor(Math.random() * 50000);
        let next = prev + stepBase + jitter;
        if (next >= JACKPOT_TARGET) {
          next = JACKPOT_TARGET;
          jackpotReachedRef.current = true;
          if (jackpotIntervalRef.current) {
            clearInterval(jackpotIntervalRef.current);
            jackpotIntervalRef.current = null;
          }
          setTimeout(() => setShowJackpotModal(true), 500);
        }
        return next;
      });
    }, 60);
  };

  const closeJackpotModal = () => {
    setShowJackpotModal(false);
    setJackpotActive(false);
    jackpotReachedRef.current = false;
    setJackpotAmount(stats.currency || 0);
  };

  useEffect(() => {
    return () => {
      if (jackpotIntervalRef.current) {
        clearInterval(jackpotIntervalRef.current);
      }
    };
  }, []);

  // 1. LIVE LISTENER: User Profile (XP, Money, AND Classes)
  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribe = onSnapshot(
        doc(db, "users", user.uid),
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLiveUserData(data);
                
                // A. Update Stats
                setStats({
                    currency: data.currency || 0,
                    xp: data.xp || 0,
                    completed_missions: data.completed_missions || []
                });
                // B. Update Class List
                // If the array exists, use it. If not, use the single class_id.
                if (data.enrolled_classes && data.enrolled_classes.length > 0) {
                    setAllowedClasses(data.enrolled_classes);
                } else if (data.class_id) {
                    setAllowedClasses([data.class_id]);
                }
            }
        },
        (error) => {
            console.error("StudentDashboard user listener failed:", error);
        }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!liveUserData?.class_id) return;
    const unsub = onSnapshot(
      doc(db, "classes", liveUserData.class_id),
      (snap) => {
        if (!snap.exists()) return;
        setClassThemeId(snap.data()?.theme_id || "agency");
      },
      (error) => {
        console.error("StudentDashboard class listener failed:", error);
      }
    );
    return () => unsub();
  }, [liveUserData?.class_id]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        const liveEvents = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setEvents(liveEvents);
      },
      (error) => {
        console.error("StudentDashboard events listener failed:", error);
      }
    );

    return () => unsub();
  }, []);

  const activeEvents = useMemo(() => {
    const classList = allowedClasses.length > 0
      ? allowedClasses
      : liveUserData?.class_id
        ? [liveUserData.class_id]
        : [];
    return getActiveEventsForClasses(events, classList, liveUserData?.orgId);
  }, [events, allowedClasses, liveUserData?.class_id, liveUserData?.orgId]);

  const marqueeText = useMemo(() => {
    if (!activeEvents.length) return "";
    return activeEvents
      .map((event) => {
        const title = event.title || "Special Event";
        const marquee = event.marqueeText || "";
        return marquee ? `${title} — ${marquee}` : title;
      })
      .filter(Boolean)
      .join(" • ");
  }, [activeEvents]);

  const marqueeDollars = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => ({
      left: (index * 8 + 10) % 100,
      top: (index * 17 + 20) % 100,
      delay: (index % 6) * 0.6,
      size: 12 + (index % 4) * 5,
      duration: 2.6 + (index % 5) * 0.4
    }));
  }, []);

  useEffect(() => {
    if (activeEvents.length > 0) {
      setShowEventModal(true);
    }
  }, [activeEvents.length]);

  // 2. CHECK FOR DAILY MISSIONS (The Intercept)
  useEffect(() => {
      // Wait until we know the student's classes
      if (allowedClasses.length === 0) return;

      const checkMissions = async () => {
          const today = new Date().toISOString().split('T')[0];
          
          // Query: Is there a mission for TODAY?
          const q = query(
              collection(db, "daily_missions"), 
              where("active_date", "==", today)
          );

          const snap = await getDocs(q);
          const missions = snap.docs.map(d => ({id: d.id, ...d.data()}));

          // Filter: Is there a mission for MY class?
          // (Checks if the mission's class_id matches ANY of the student's allowed classes)
          const validMission = missions.find(m => allowedClasses.includes(m.class_id));

          if (validMission) {
              // Check if I already did it
              const alreadyDone = stats.completed_missions.includes(validMission.id);
              
              if (!alreadyDone) {
                  setDailyMission(validMission);
                  setShowMissionModal(true); // <--- TRIGGER THE POPUP
              }
          }
      };

      checkMissions();
  }, [allowedClasses, stats.completed_missions]); // Re-run if classes load or if we finish a mission

  // 2. LIVE LISTENER: Contracts (Depends on allowedClasses)
  useEffect(() => {
    // Wait until we have a class list so we don't query empty
    if (allowedClasses.length === 0) return;

    // Query Firestore for ANY class in the list
    const q = query(
        collection(db, "contracts"),
        where("class_id", "in", allowedClasses)
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const liveContracts = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }));

            setContracts(liveContracts);
        },
        (error) => {
            console.error("StudentDashboard contracts listener failed:", error);
        }
    );

    return () => unsubscribe();
  }, [allowedClasses]); 

  // 2b. LIVE LISTENER: Side Hustles (Always-on promos)
  useEffect(() => {
    if (allowedClasses.length === 0) return;

    const unsubscribe = onSnapshot(
      collection(db, "side_hustles"),
      (snapshot) => {
        const liveHustles = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(hustle => hustle.class_id === "all" || allowedClasses.includes(hustle.class_id));

        setSideHustles(liveHustles);
      },
      (error) => {
        console.error("StudentDashboard side hustle listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [allowedClasses]);

  // 3. LIVE LISTENER: Active Jobs (Student Progress)
  useEffect(() => {
    if (!user?.uid) return;

    // This query finds jobs the student has ACCEPTED (active_jobs collection)
    const q = query(
        collection(db, "active_jobs"),
        where("student_id", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const mapping = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                mapping[data.contract_id] = data;
            });
            setActiveJobs(mapping);
        },
        (error) => {
            console.error("StudentDashboard active jobs listener failed:", error);
        }
    );
    return () => unsubscribe();
  }, [user]);// <--- dependency ensures it updates if user data changes

  // 3b. LIVE LISTENER: Side Hustle Jobs (Student Progress)
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "side_hustle_jobs"),
      where("student_id", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapping = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          mapping[data.side_hustle_id] = { id: doc.id, ...data };
        });
        setSideHustleJobs(mapping);
      },
      (error) => {
        console.error("StudentDashboard side hustle jobs listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleClaimMission = async (e) => {
      e.preventDefault();
      setMissionError("");

      // 1. Check Password (If mission has one)
      if (dailyMission.code_word) {
          if (missionCode.toUpperCase().trim() !== dailyMission.code_word.toUpperCase()) {
              setMissionError("INCORRECT PASSCODE.");
              return;
          }
      }

      try {
          // 2. Reward the Student
          const userRef = doc(db, "users", user.uid);
          const rawExpiry = liveUserData?.xpBoostExpiresAt;
          const expiryDate = rawExpiry?.toDate ? rawExpiry.toDate() : rawExpiry ? new Date(rawExpiry) : null;
          const boostActive = expiryDate && expiryDate > new Date();
          const boostPercent = Number(liveUserData?.xpBoostPercent) || 10;
          const boostedXp = boostActive
              ? Math.ceil(Number(dailyMission.reward_xp || 0) * (1 + boostPercent / 100))
              : Number(dailyMission.reward_xp || 0);
          const rawCashExpiry = liveUserData?.currencyBoostExpiresAt;
          const cashExpiry = rawCashExpiry?.toDate ? rawCashExpiry.toDate() : rawCashExpiry ? new Date(rawCashExpiry) : null;
          const cashBoostActive = cashExpiry && cashExpiry > new Date();
          const cashBoostPercent = Number(liveUserData?.currencyBoostPercent) || 10;
          const boostedCash = cashBoostActive
              ? Math.ceil(Number(dailyMission.reward_cash || 0) * (1 + cashBoostPercent / 100))
              : Number(dailyMission.reward_cash || 0);
          const activeMissionEvents = getActiveEventsForClass(
              events,
              dailyMission.class_id,
              liveUserData?.orgId
          );
          const { usableEvents } = await resolveEventClaims(activeMissionEvents, user.uid);
          const eventAdjusted = applyEventRewards({
              baseXp: boostedXp,
              baseCurrency: boostedCash,
              events: usableEvents,
              eventType: "mission"
          });
          const eventBonusMessage = formatEventBonusMessage({
              bonus: eventAdjusted.bonus,
              events: eventAdjusted.appliedEvents
          });

          await updateDoc(userRef, {
              currency: increment(eventAdjusted.currency),
              xp: increment(eventAdjusted.xp),
              completed_missions: arrayUnion(dailyMission.id) // Mark done so popup never comes back
          });
          const appliedOneTimeEvents = eventAdjusted.appliedEvents.filter((event) => event.oneTimePerUser);
          if (appliedOneTimeEvents.length) {
              await Promise.all(
                  appliedOneTimeEvents.map((event) =>
                      setDoc(
                          doc(db, "users", user.uid, "event_claims", event.id),
                          {
                              eventId: event.id,
                              title: event.title || "",
                              eventType: "mission",
                              claimedAt: serverTimestamp()
                          },
                          { merge: true }
                      )
                  )
              );
          }
          if (eventBonusMessage) {
              await addDoc(collection(db, "users", user.uid, "alerts"), {
                  type: "event_bonus",
                  message: eventBonusMessage,
                  read: false,
                  createdAt: serverTimestamp()
              });
          }

          // 3. Success Animation
          setShowMissionModal(false);
          setMissionCode("");
          alert(`MISSION COMPLETE.\n+${eventAdjusted.xp} XP\n+$${eventAdjusted.currency}`);
          
      } catch (err) {
          console.error("Error claiming mission:", err);
          setMissionError("Connection failed. Try again.");
      }
  };

  const normalizeContractStatus = (status) => {
    if (!status || status === "open") return "live";
    return status;
  };

  const isContractLiveForStudents = (contract) => {
    const status = normalizeContractStatus(contract?.status);
    if (status === "archived") return false;
    if (status === "scheduled") {
      if (!contract?.scheduled_date) return false;
      const launchDate = new Date(`${contract.scheduled_date}T12:00:00`);
      if (Number.isNaN(launchDate.getTime())) return false;
      return launchDate <= new Date();
    }
    return true;
  };

  // --- 🛡️ THE GATEKEEPER LOGIC 🛡️ ---
  // This filters the raw "contracts" list before we map over it
  const visibleContracts = contracts.filter(contract => {
    // 1. Admins see EVERYTHING
    if (userData?.role === 'admin') return true;

    // 2. Students see contracts if they are in the 'allowedClasses' list
    // (We use the state we built earlier, rather than the single userData.class_id)
    if (!allowedClasses.includes(contract.class_id)) return false;

    // 3. Students only see live contracts (scheduled launches stay hidden)
    return isContractLiveForStudents(contract);
  });

  // --- LEVEL CALCULATIONS ---
  const currentLevel = Math.floor((stats.xp || 0) / 1000) + 1;
  const nextLevelXp = currentLevel * 1000;
  const progress = ((stats.xp % 1000) / 1000) * 100;
  
  const visibleSideHustles = sideHustles.filter(hustle =>
    (hustle.class_id === "all" || allowedClasses.includes(hustle.class_id)) &&
    hustle.status !== "archived"
  );

  const getSideHustleStatusLabel = (status, scheduledDate) => {
    if (status === "scheduled") {
      if (!scheduledDate) return "Dropping Soon";
      const today = new Date();
      const dropDate = new Date(`${scheduledDate}T12:00:00`);
      const diffDays = Math.floor((dropDate - today) / (1000 * 60 * 60 * 24));
      if (dropDate <= today) return "Side Hustle";
      if (diffDays >= 0 && diffDays <= 6) {
        return `Dropping on ${dropDate.toLocaleDateString(undefined, { weekday: "long" })}`;
      }
      return "Dropping Soon";
    }
    if (status === "archived") return "Archived";
    return "Side Hustle";
  };

  return (
    <div className="min-h-screen theme-bg pb-20">
      <style>{`
        @keyframes dashboard-egg-sparkle {
          0%, 100% { opacity: 0; transform: translateY(6px) scale(0.6); }
          40% { opacity: 0.95; transform: translateY(-6px) scale(1); }
          70% { opacity: 0.4; transform: translateY(-12px) scale(0.8); }
        }
        .dashboard-egg-sparkle {
          animation-name: dashboard-egg-sparkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        @keyframes jackpot-sparkle {
          0%, 100% { opacity: 0; transform: translateY(4px) scale(0.6); }
          35% { opacity: 0.95; transform: translateY(-8px) scale(1); }
          60% { opacity: 0.5; transform: translateY(-14px) scale(0.8); }
        }
        @keyframes jackpot-bill {
          0% { opacity: 0; transform: translateY(10px) rotate(0deg) scale(0.9); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-80px) rotate(12deg) scale(1.2); }
        }
        .jackpot-sparkle {
          animation-name: jackpot-sparkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        .jackpot-bill {
          animation-name: jackpot-bill;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
        }
      `}</style>
      <Navbar />
      {activeEvents.length > 0 && (
        <div className="event-marquee border-b border-indigo-100">
          <div className="event-marquee-dollars">
            {marqueeDollars.map((dollar, index) => (
              <span
                key={`dollar-${index}`}
                className="event-marquee-dollar"
                style={{
                  left: `${dollar.left}%`,
                  top: `${dollar.top}%`,
                  fontSize: `${dollar.size}px`,
                  animationDelay: `${dollar.delay}s`,
                  animationDuration: `${dollar.duration}s`
                }}
              >
                $
              </span>
            ))}
          </div>
          <div className="event-marquee-track">
            <span className="event-marquee-text">{marqueeText}</span>
            <span className="event-marquee-text" aria-hidden="true">{marqueeText}</span>
          </div>
        </div>
      )}

      {showEventModal && activeEvents.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div
            className="w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            style={{
              backgroundImage: `url(${activeEvents[0]?.modalBackgroundUrl || DEFAULT_EVENT_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 backdrop-blur-md px-5 py-4 border border-white/80 shadow-sm">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-indigo-600 uppercase">Special Event Live</p>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">
                    {activeEvents[0]?.title || "Bonus Event"}
                  </h2>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-white transition"
                >
                  Dismiss
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {activeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-white/80 bg-white/75 backdrop-blur-md p-4 shadow-sm"
                  >
                    <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                    )}
                    <p className="text-sm font-semibold text-slate-700 mt-3">
                      {event.rewardHint || "Complete approvals during the event to earn the bonus."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    
      <div className="max-w-6xl mx-auto p-8">
        
        {/* WELCOME SECTION */}
        <div className="mb-8">
            <h1 className="text-3xl font-extrabold theme-text">
                Welcome back, {user?.displayName?.split(' ')[0]}.
            </h1>
            <p className="theme-muted">
                Class Clearance: <span className="font-bold theme-accent uppercase">{liveUserData?.class_id || "Unassigned"}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
                {boostActive && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                        <Zap size={12} /> XP Boost +{boostPercent}% • Expires {boostExpiryDate.toLocaleDateString()}
                    </div>
                )}
                {cashBoostActive && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        <DollarSign size={12} /> {labels.currency} Boost +{cashBoostPercent}% • Expires {cashBoostExpiryDate.toLocaleDateString()}
                    </div>
                )}
            </div>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            
            {/* CARD 1: BANK ACCOUNT */}
            <div className="theme-surface p-6 rounded-2xl shadow-sm border theme-border flex items-center justify-between relative overflow-hidden group">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        startJackpotSpin();
                    }}
                    className="absolute top-3 right-3 z-20 opacity-10 hover:opacity-70 text-amber-400 transition"
                    title="Lucky Dollar"
                >
                    <DollarSign size={18} />
                </button>
                {jackpotActive && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {jackpotSparkles.map((sparkle) => (
                            <span
                                key={`sparkle-${sparkle.id}`}
                                className="jackpot-sparkle absolute text-amber-300"
                                style={{
                                    left: sparkle.left,
                                    top: sparkle.top,
                                    fontSize: sparkle.size,
                                    animationDelay: sparkle.delay,
                                    animationDuration: sparkle.duration
                                }}
                            >
                                {sparkle.symbol}
                            </span>
                        ))}
                        {jackpotBills.map((bill) => (
                            <span
                                key={`bill-${bill.id}`}
                                className="jackpot-bill absolute text-emerald-300 font-black"
                                style={{
                                    left: bill.left,
                                    bottom: "8px",
                                    fontSize: bill.size,
                                    animationDelay: bill.delay,
                                    animationDuration: bill.duration
                                }}
                            >
                                $
                            </span>
                        ))}
                    </div>
                )}
                <div className="relative z-10">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider mb-1">{labels.currency} Earned</p>
                    <h2 className={`text-4xl font-black theme-text ${jackpotActive ? "font-mono tracking-wider" : ""}`}>
                        ${Number(displayCurrency || 0).toLocaleString()}
                    </h2>
                    <button 
                        onClick={() => navigate('/shop')} 
                        className="theme-accent text-sm font-bold mt-2 hover:underline flex items-center gap-1"
                    >
                        Visit {labels.shop} <ArrowRight size={14}/>
                    </button>
                </div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 z-10">
                    <DollarSign size={32} />
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>

            {/* CARD 2: XP & LEVEL */}
            <div className="theme-surface p-6 rounded-2xl shadow-sm border theme-border flex items-center justify-between relative overflow-hidden group">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleEggKeyClick();
                    }}
                    className="absolute top-3 right-3 z-20 opacity-10 hover:opacity-70 text-amber-400 transition"
                    title="Arcane Key"
                >
                    <Key size={18} />
                </button>
                <div className="relative z-10 w-full mr-4">
                    <div className="flex justify-between items-end mb-1">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">{labels.xp} Progress</p>
                        <span className="theme-accent font-bold text-xs">{stats.xp} / {nextLevelXp} {labels.xp}</span>
                    </div>
                    <h2 className="text-4xl font-black theme-text mb-3">Level {currentLevel}</h2>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 z-10 shrink-0">
                    <Trophy size={32} />
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition duration-500"></div>
            </div>
            
        </div>

        {/* SIDE HUSTLES */}
        <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold theme-text flex items-center gap-2">
                    <PlayCircle className="text-slate-400" size={20}/> Side Hustles
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Always On
                </span>
            </div>

            {visibleSideHustles.length === 0 ? (
                <div className="p-6 text-center theme-muted border-2 border-dashed theme-border rounded-xl theme-card">
                    No side hustles active for your class yet.
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                    {visibleSideHustles.map(hustle => {
                        const job = sideHustleJobs[hustle.id];
                        const isPending = job?.status === "pending_review";
                        const currentLevel = job?.current_level || 1;
                        const levels = Array.isArray(hustle.levels) ? hustle.levels : [];
                        const levelData = levels[currentLevel - 1];
                        const levelLabel = levelData?.title || `Level ${currentLevel}`;
                        const levelCash = levelData?.reward_cash ?? hustle.reward_cash ?? 0;
                        const levelXp = levelData?.reward_xp ?? hustle.reward_xp ?? 0;
                        const cardImage = hustle.image_url || "/side.png";
                        const status = hustle.status || "live";
                        const statusLabel = getSideHustleStatusLabel(status, hustle.scheduled_date);

                        return (
                            <button
                                key={hustle.id}
                                onClick={() => navigate(`/side-hustle/${hustle.id}`)}
                                className="relative min-w-[260px] sm:min-w-[320px] h-40 rounded-2xl overflow-hidden border theme-border shadow-sm hover:shadow-md transition group text-left"
                            >
                                <div
                                    className="absolute inset-0 bg-slate-900 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${cardImage})` }}
                                ></div>
                                <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/20 to-black/10"></div>

                                <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${
                                            status === "live" ? "bg-black/40 text-white" : "bg-amber-300 text-amber-900"
                                        }`}>
                                            {statusLabel}
                                        </span>
                                        {isPending ? (
                                            <span className="text-[10px] uppercase font-bold tracking-wider bg-yellow-300 text-yellow-900 px-2 py-1 rounded flex items-center gap-1">
                                                <Clock size={12}/> Review
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase font-bold tracking-wider bg-white/80 text-slate-900 px-2 py-1 rounded">
                                                {levelLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs uppercase tracking-widest text-white/80 font-bold">
                                            {hustle.tagline || "Always On"}
                                        </p>
                                        <h3 className="text-lg font-black text-white leading-tight">
                                            {hustle.title}
                                        </h3>
                                        {hustle.summary && (
                                            <p className="text-xs text-white/80 mt-1 line-clamp-1">
                                                {hustle.summary}
                                            </p>
                                        )}
                                        <div className="mt-2 flex justify-end gap-2 text-xs font-bold">
                                            <span className="bg-emerald-500/90 text-white px-2 py-1 rounded flex items-center gap-1">
                                                <DollarSign size={12}/> {levelCash}
                                            </span>
                                            <span className="bg-indigo-500/90 text-white px-2 py-1 rounded flex items-center gap-1">
                                                <Zap size={12}/> {levelXp} {labels.xp}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>

        <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
            <Briefcase className="text-slate-400" size={20}/> Available {labels.assignments}
        </h2>
        
        {/* WE NOW USE visibleContracts INSTEAD OF contracts */}
        {visibleContracts.length === 0 ? (
            <div className="p-12 text-center theme-muted border-2 border-dashed theme-border rounded-xl theme-card">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <Lock className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold theme-text">Restricted Access</h3>
                <p className="max-w-md mx-auto mt-2">
                    No active {labels.assignments.toLowerCase()} found for the <span className="font-mono text-slate-600 font-bold">{userData?.class_id}</span> division.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleContracts.map(contract => {
                    const myJob = activeJobs[contract.id];

                    let badgeClass = "bg-indigo-100 text-indigo-700";
                    let borderClass = "bg-white border-slate-200 hover:shadow-md";
                    let buttonClass = "bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white";
                    let buttonText = "View Brief";

                    if (myJob) {
                        buttonText = "Continue Mission";
                        buttonClass = "bg-indigo-600 text-white hover:bg-indigo-700";
                        borderClass = "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100";
                        
                        if (myJob.status === 'pending_review') {
                            badgeClass = "bg-yellow-100 text-yellow-700";
                        } else if (myJob.status === 'completed') {
                            badgeClass = "bg-green-100 text-green-700";
                            buttonText = "Completed";
                            buttonClass = "bg-green-600 text-white";
                        } else if (myJob.status === 'returned') {
                            badgeClass = "bg-red-100 text-red-700 animate-pulse";
                            borderClass = "bg-red-50 border-red-200 ring-1 ring-red-100";
                            buttonText = "Fix Issues";
                            buttonClass = "bg-red-600 text-white hover:bg-red-700";
                        }
                    }

                    return (
                        <div key={contract.id} className={`rounded-xl overflow-hidden shadow-sm border transition flex flex-col h-full ${borderClass} theme-border`}>
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider">
                                        {contract.class_id?.replace(/_/g, " ")}
                                    </span>
                                    
                                    {/* STATUS BADGE */}
                                    {myJob && (
                                        <span className={`text-xs px-2 py-1 rounded uppercase font-bold tracking-wider flex items-center gap-1 ${badgeClass}`}>
                                            {myJob.status === 'completed' ? <CheckCircle size={12}/> :
                                             myJob.status === 'pending_review' ? <Clock size={12}/> :
                                             myJob.status === 'returned' ? <AlertCircle size={12}/> :
                                             <Loader size={12}/>
                                            }
                                            {myJob.status === 'completed' ? 'Done' : 
                                             myJob.status === 'pending_review' ? 'Reviewing' : 
                                             myJob.status === 'returned' ? 'Action Required' :
                                             `Stage ${myJob.current_stage}`}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold theme-text mb-2">
                                    {contract.title}
                                </h3>
                                <p className="theme-muted text-sm line-clamp-3 mb-4">
                                    {contract.description}
                                </p>
                                
                                <div className="flex items-center gap-4 text-sm font-medium mt-auto">
                                    <span className="flex items-center text-green-600"><DollarSign size={14}/> {contract.bounty}</span>
                                    <span className="flex items-center text-indigo-600"><Zap size={14}/> {contract.xp_reward} {labels.xp}</span>
                                </div>
                            </div>
                            <div className="px-6 py-3 border-t border-black/5 mt-auto">
                                <button 
                                    onClick={() => navigate(`/contract/${contract.id}`)}
                                    className={`w-full font-medium py-2 rounded-lg transition ${buttonClass}`}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
      {["teacher", "admin", "super_admin", "department_admin", "teacher_admin", "chair"].includes(userData?.role) && userData?.class_id && (
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Class Theme</h3>
                <p className="text-slate-600 text-sm">Set the experience theme for your current class.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-700 bg-white"
                  value={classThemeId}
                  onChange={(e) => setClassThemeId(e.target.value)}
                >
                  {THEME_OPTIONS.map((themeOption) => (
                    <option key={themeOption.id} value={themeOption.id}>
                      {themeOption.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    setIsSavingTheme(true);
                    try {
                      await updateDoc(doc(db, "classes", userData.class_id), {
                        theme_id: classThemeId,
                        updatedAt: new Date().toISOString()
                      });
                    } catch (err) {
                      console.error("Theme update failed", err);
                      alert("Failed to update theme.");
                    } finally {
                      setIsSavingTheme(false);
                    }
                  }}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-600 transition"
                  disabled={isSavingTheme}
                >
                  {isSavingTheme ? "Saving..." : "Update Theme"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* --- TOP SECRET MISSION POPUP --- */}
      {showMissionModal && dailyMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            
            {/* MANILA FOLDER UI */}
            <div className="bg-[#fdf6e3] w-full max-w-lg rounded-sm shadow-2xl overflow-hidden relative rotate-1 border border-[#d1c7ad]">
                
                {/* Folder Tab */}
                <div className="absolute top-0 left-0 bg-[#e6dcc3] w-1/3 h-8 rounded-br-xl border-r border-b border-[#d1c7ad] flex items-center justify-center">
                    <span className="text-[10px] font-black tracking-widest text-slate-500/50 uppercase">Confidential</span>
                </div>

                {/* "Classified" Stamp */}
                <div className="absolute top-6 right-6 border-4 border-red-600/20 text-red-600/20 font-black text-4xl uppercase -rotate-12 px-4 py-2 pointer-events-none select-none">
                    Classified
                </div>

                {/* Close Button (In case they want to ignore it) */}
                <button 
                    onClick={() => setShowMissionModal(false)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 z-20"
                >
                    <X size={20} />
                </button>

                <div className="p-8 pt-12">
                    
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-2">
                            <Zap size={12} className="text-yellow-400"/> Priority Message
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase leading-none mb-1">
                            {dailyMission.title}
                        </h2>
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                            Target: {dailyMission.class_id} // {dailyMission.active_date}
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-white p-6 border-2 border-slate-200 border-dashed rounded-xl mb-6 font-mono text-sm text-slate-700 leading-relaxed shadow-inner">
                        {dailyMission.instruction}
                    </div>

                    {/* Rewards */}
                    <div className="flex justify-center gap-4 mb-6">
                        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-green-200">
                            <DollarSign size={18} /> ${dailyMission.reward_cash}
                        </div>
                        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-indigo-200">
                            <Star size={18} /> {dailyMission.reward_xp} XP
                        </div>
                    </div>

                    {/* Interaction Area */}
                    <form onSubmit={handleClaimMission}>
                        {dailyMission.code_word && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 text-center">
                                    Input Security Code
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="ENTER CODE WORD..."
                                    className="w-full bg-slate-800 text-green-400 font-mono text-center p-3 rounded-lg border-2 border-slate-700 focus:border-green-500 outline-none uppercase tracking-widest placeholder:text-slate-600 transition-colors"
                                    value={missionCode}
                                    onChange={e => setMissionCode(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        )}

                        {missionError && (
                            <p className="text-center text-red-600 font-bold text-sm mb-4 animate-pulse">
                                ⚠️ {missionError}
                            </p>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition flex items-center justify-center gap-2"
                        >
                            <Unlock size={18} /> CLAIM REWARD
                        </button>
                    </form>

                </div>
            </div>
        </div>
      )}

      {showEggModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="absolute inset-0 pointer-events-none">
              {sparkleSeeds.map((sparkle) => (
                <span
                  key={sparkle.id}
                  className="dashboard-egg-sparkle absolute text-amber-300"
                  style={{
                    left: sparkle.left,
                    top: sparkle.top,
                    fontSize: sparkle.size,
                    animationDelay: sparkle.delay,
                    animationDuration: sparkle.duration
                  }}
                >
                  {sparkle.symbol}
                </span>
              ))}
            </div>
            <div className="relative z-10">
              <div className="bg-slate-100/90 p-4 flex items-center justify-between border-b border-slate-200">
                <h3 className="font-black text-slate-700 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  Vault of Curiosities
                </h3>
                <button
                  onClick={() => {
                    setShowEggModal(false);
                    setEggError("");
                  }}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {hasEggBadge ? (
                  <div className="text-sm text-slate-600">
                    You already claimed this drop. Keep hunting for the next egg.
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      The hidden key unlocks a shimmering prize. Want it?
                    </p>
                    {eggError && (
                      <p className="text-xs font-bold text-red-500">{eggError}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleClaimEggReward}
                      disabled={eggClaiming}
                      className="w-full py-2 rounded-lg font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {eggClaiming ? "Unlocking Reward..." : `Claim $${EGG_REWARD_CURRENCY} + ${EGG_BADGE_TITLE}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showJackpotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="absolute inset-0 pointer-events-none">
              {jackpotSparkles.map((sparkle) => (
                <span
                  key={`jackpot-modal-${sparkle.id}`}
                  className="jackpot-sparkle absolute text-amber-300"
                  style={{
                    left: sparkle.left,
                    top: sparkle.top,
                    fontSize: sparkle.size,
                    animationDelay: sparkle.delay,
                    animationDuration: sparkle.duration
                  }}
                >
                  {sparkle.symbol}
                </span>
              ))}
            </div>
            <div className="relative z-10">
              <div className="bg-slate-100/90 p-4 flex items-center justify-between border-b border-slate-200">
                <h3 className="font-black text-slate-700 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  Jackpot?
                </h3>
                <button
                  onClick={closeJackpotModal}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Mr. Lilholt loves funny money... just kidding — no bonus cash, but nice egg find!
                </p>
                <button
                  type="button"
                  onClick={closeJackpotModal}
                  className="w-full py-2 rounded-lg font-bold text-sm text-white bg-slate-900 hover:bg-indigo-600 transition"
                >
                  Back to reality
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
