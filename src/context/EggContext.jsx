import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { Sparkles, X, Lock, Lightbulb, KeyRound } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import {
  applyAnchorInteraction,
  applyAnswerInteraction,
  buildDefaultEggProgress,
  CLAIM_POLICY,
  eggAppliesToUser,
  getEggAnchorIds,
  getEggStages,
  getMatchingClassId,
  getVisibleHints,
  isEggActiveNow,
  parseEggDate
} from "../lib/eggEngine";
import { getAnchorById } from "../lib/eggAnchors";

const EggContext = createContext(null);

const toMillis = (value) => {
  const parsed = parseEggDate(value);
  return parsed ? parsed.getTime() : 0;
};

const sortEggs = (eggs) => {
  return [...eggs].sort((a, b) => {
    const priorityA = Number(a.priority || 0);
    const priorityB = Number(b.priority || 0);
    if (priorityA !== priorityB) return priorityB - priorityA;
    const createdA = toMillis(a.createdAt);
    const createdB = toMillis(b.createdAt);
    return createdB - createdA;
  });
};

const formatHintTokenLabel = (egg) => {
  const hintTokenName = egg?.hints?.tokenItemName;
  if (hintTokenName) return hintTokenName;
  return "Hint Token";
};

export function EggProvider({ children }) {
  const { user } = useAuth();

  const [userProfile, setUserProfile] = useState(null);
  const [eggDocs, setEggDocs] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [claimMap, setClaimMap] = useState({});
  const [modalState, setModalState] = useState({
    open: false,
    eggId: null,
    mode: "claim",
    error: "",
    answer: "",
    busy: false
  });

  useEffect(() => {
    if (!user?.uid) {
      setUserProfile(null);
      setEggDocs([]);
      setProgressMap({});
      setClaimMap({});
      setModalState({ open: false, eggId: null, mode: "claim", error: "", answer: "", busy: false });
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setUserProfile(null);
          return;
        }
        setUserProfile({ id: snap.id, ...snap.data() });
      },
      (error) => {
        console.error("EggProvider user listener failed:", error);
      }
    );

    const eggsQuery = query(collection(db, "eggs"), where("enabled", "==", true));
    const unsubEggs = onSnapshot(
      eggsQuery,
      (snap) => {
        setEggDocs(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        console.error("EggProvider eggs listener failed:", error);
      }
    );

    const progressRef = collection(db, "users", user.uid, "egg_progress");
    const unsubProgress = onSnapshot(
      progressRef,
      (snap) => {
        const next = {};
        snap.docs.forEach((docSnap) => {
          next[docSnap.id] = docSnap.data();
        });
        setProgressMap(next);
      },
      (error) => {
        console.error("EggProvider progress listener failed:", error);
      }
    );

    const claimsRef = collection(db, "users", user.uid, "egg_claims");
    const unsubClaims = onSnapshot(
      claimsRef,
      (snap) => {
        const next = {};
        snap.docs.forEach((docSnap) => {
          next[docSnap.id] = docSnap.data();
        });
        setClaimMap(next);
      },
      (error) => {
        console.error("EggProvider claims listener failed:", error);
      }
    );

    return () => {
      unsubUser();
      unsubEggs();
      unsubProgress();
      unsubClaims();
    };
  }, [user?.uid]);

  const activeEggs = useMemo(() => {
    if (!user || !userProfile) return [];
    const now = new Date();

    const filtered = eggDocs.filter((egg) => {
      if (!isEggActiveNow(egg, now)) return false;
      if (!eggAppliesToUser(egg, userProfile)) return false;

      const policy = egg.claimPolicy || CLAIM_POLICY.PER_STUDENT_ONCE;
      const userClaimed = !!claimMap[egg.id];

      if (policy === CLAIM_POLICY.FIRST_N_GLOBAL) {
        const maxClaims = Math.max(1, Number(egg.maxClaims || 1));
        const claimCount = Math.max(0, Number(egg.claimedCount || 0));
        if (!userClaimed && claimCount >= maxClaims) return false;
      }

      if (policy === CLAIM_POLICY.PER_CLASS_ONCE) {
        const classId = getMatchingClassId(egg, userProfile);
        const claimedClassIds = Array.isArray(egg.claimedClassIds) ? egg.claimedClassIds : [];
        if (!userClaimed && classId && claimedClassIds.includes(classId)) return false;
      }

      return true;
    });

    return sortEggs(filtered);
  }, [user, userProfile, eggDocs, claimMap]);

  const eggsById = useMemo(() => {
    return activeEggs.reduce((acc, egg) => {
      acc[egg.id] = egg;
      return acc;
    }, {});
  }, [activeEggs]);

  const anchorMap = useMemo(() => {
    const next = {};
    activeEggs.forEach((egg) => {
      const anchorIds = getEggAnchorIds(egg);
      anchorIds.forEach((anchorId) => {
        if (!next[anchorId]) {
          next[anchorId] = [];
        }
        next[anchorId].push(egg.id);
      });
    });
    return next;
  }, [activeEggs]);

  const persistProgress = async (eggId, progress) => {
    if (!user?.uid || !eggId) return;
    const progressRef = doc(db, "users", user.uid, "egg_progress", eggId);
    await setDoc(
      progressRef,
      {
        ...progress,
        eggId,
        updatedAt: serverTimestamp(),
        createdAt: progressMap[eggId]?.createdAt || serverTimestamp()
      },
      { merge: true }
    );
  };

  const openModal = (eggId, mode) => {
    setModalState({
      open: true,
      eggId,
      mode,
      error: "",
      answer: "",
      busy: false
    });
  };

  const closeModal = () => {
    setModalState({
      open: false,
      eggId: null,
      mode: "claim",
      error: "",
      answer: "",
      busy: false
    });
  };

  const getProgressForEgg = (eggId) => {
    const current = progressMap[eggId];
    if (!current) return buildDefaultEggProgress();
    return {
      ...buildDefaultEggProgress(),
      ...current,
      state: {
        ...(buildDefaultEggProgress().state || {}),
        ...(current.state || {})
      }
    };
  };

  const handleAnchorClick = async (anchorId) => {
    if (!user?.uid || !userProfile || !anchorId) return;

    const candidateEggIds = anchorMap[anchorId] || [];
    if (candidateEggIds.length === 0) return;

    for (const eggId of candidateEggIds) {
      const egg = eggsById[eggId];
      if (!egg) continue;
      if (claimMap[eggId]) {
        openModal(eggId, "claimed");
        return;
      }

      const currentProgress = getProgressForEgg(eggId);
      const result = applyAnchorInteraction({
        egg,
        progress: currentProgress,
        anchorId,
        now: new Date()
      });

      if (!result.changed) {
        continue;
      }

      await persistProgress(eggId, result.updatedProgress);

      if (result.status === "awaiting_answer") {
        openModal(eggId, "answer");
      }

      if (result.status === "ready_to_claim") {
        openModal(eggId, "claim");
      }

      // Only process one egg per anchor click.
      return;
    }
  };

  const submitAnswer = async () => {
    const egg = eggsById[modalState.eggId];
    if (!egg || modalState.mode !== "answer") return;

    setModalState((prev) => ({ ...prev, busy: true, error: "" }));

    try {
      const currentProgress = getProgressForEgg(egg.id);
      const result = await applyAnswerInteraction({
        egg,
        progress: currentProgress,
        answer: modalState.answer,
        now: new Date()
      });

      if (result.status === "incorrect_answer") {
        setModalState((prev) => ({
          ...prev,
          busy: false,
          error: "That code did not unlock the vault."
        }));
        return;
      }

      if (result.changed) {
        await persistProgress(egg.id, result.updatedProgress);
      }

      if (result.status === "ready_to_claim") {
        setModalState((prev) => ({
          ...prev,
          busy: false,
          mode: "claim",
          error: "",
          answer: ""
        }));
        return;
      }

      setModalState((prev) => ({ ...prev, busy: false, error: "" }));
      closeModal();
    } catch (error) {
      console.error("Egg answer submit failed:", error);
      setModalState((prev) => ({
        ...prev,
        busy: false,
        error: "Unlock failed. Try again."
      }));
    }
  };

  const claimEgg = async () => {
    const eggId = modalState.eggId;
    const egg = eggsById[eggId];
    if (!egg || !user?.uid || !userProfile) return;

    const progress = getProgressForEgg(eggId);
    if (!progress.completed) {
      setModalState((prev) => ({
        ...prev,
        error: "Complete all discovery stages first."
      }));
      return;
    }

    setModalState((prev) => ({ ...prev, busy: true, error: "" }));

    const eggRef = doc(db, "eggs", eggId);
    const userRef = doc(db, "users", user.uid);
    const claimRef = doc(db, "eggs", eggId, "claims", user.uid);
    const userClaimRef = doc(db, "users", user.uid, "egg_claims", eggId);
    const progressRef = doc(db, "users", user.uid, "egg_progress", eggId);

    try {
      await runTransaction(db, async (transaction) => {
        const [eggSnap, userSnap, claimSnap] = await Promise.all([
          transaction.get(eggRef),
          transaction.get(userRef),
          transaction.get(claimRef)
        ]);

        if (!eggSnap.exists()) {
          throw new Error("Egg is no longer available.");
        }

        const liveEgg = { id: eggSnap.id, ...eggSnap.data() };
        if (!isEggActiveNow(liveEgg, new Date())) {
          throw new Error("This egg is not active.");
        }

        if (!userSnap.exists()) {
          throw new Error("User profile missing.");
        }

        const liveUser = userSnap.data();
        if (!eggAppliesToUser(liveEgg, liveUser)) {
          throw new Error("You are not in scope for this egg.");
        }

        const policy = liveEgg.claimPolicy || CLAIM_POLICY.PER_STUDENT_ONCE;
        if (claimSnap.exists()) {
          throw new Error("Reward already claimed.");
        }

        let classClaimRef = null;
        let classClaimId = null;
        if (policy === CLAIM_POLICY.PER_CLASS_ONCE) {
          const classId = getMatchingClassId(liveEgg, liveUser);
          if (!classId) {
            throw new Error("Class claim validation failed.");
          }
          classClaimId = classId;
          classClaimRef = doc(db, "eggs", eggId, "class_claims", classId);
          const classClaimSnap = await transaction.get(classClaimRef);
          if (classClaimSnap.exists()) {
            throw new Error("This class already claimed this egg.");
          }
        }

        if (policy === CLAIM_POLICY.FIRST_N_GLOBAL) {
          const maxClaims = Math.max(1, Number(liveEgg.maxClaims || 1));
          const currentCount = Math.max(0, Number(liveEgg.claimedCount || 0));
          if (currentCount >= maxClaims) {
            throw new Error("All claim slots were used.");
          }
        }

        const rewardXp = Math.max(0, Number(liveEgg?.rewards?.xp || 0));
        const rewardCurrency = Math.max(0, Number(liveEgg?.rewards?.currency || 0));

        const currentXp = Math.max(0, Number(liveUser.xp || 0));
        const currentCurrency = Math.max(0, Number(liveUser.currency || 0));

        const badgeConfig = liveEgg.badge || {};
        const badgeEnabled = !!badgeConfig.enabled && !!badgeConfig.id;
        const existingBadges = liveUser.badges || {};
        const nextBadges = badgeEnabled
          ? {
              ...existingBadges,
              [badgeConfig.id]: {
                earnedAt: new Date().toISOString(),
                title: badgeConfig.title || "Egg Hunter"
              }
            }
          : existingBadges;

        transaction.update(userRef, {
          xp: currentXp + rewardXp,
          currency: currentCurrency + rewardCurrency,
          badges: nextBadges
        });

        const nextClaimCount = Math.max(0, Number(liveEgg.claimedCount || 0)) + 1;
        const nextClaimedClassIds = (() => {
          const existing = Array.isArray(liveEgg.claimedClassIds) ? liveEgg.claimedClassIds : [];
          if (!classClaimId) return existing;
          if (existing.includes(classClaimId)) return existing;
          return [...existing, classClaimId];
        })();
        transaction.update(eggRef, {
          claimedCount: nextClaimCount,
          claimedClassIds: nextClaimedClassIds,
          updatedAt: serverTimestamp()
        });

        transaction.set(claimRef, {
          uid: user.uid,
          eggId,
          classId: getMatchingClassId(liveEgg, liveUser) || null,
          claimedAt: serverTimestamp(),
          rewards: {
            xp: rewardXp,
            currency: rewardCurrency
          }
        });

        transaction.set(userClaimRef, {
          eggId,
          claimedAt: serverTimestamp(),
          rewards: {
            xp: rewardXp,
            currency: rewardCurrency
          }
        });

        transaction.set(
          progressRef,
          {
            completed: true,
            claimed: true,
            stageIndex: getEggStages(liveEgg).length,
            state: {},
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );

        if (classClaimRef) {
          transaction.set(classClaimRef, {
            classId: getMatchingClassId(liveEgg, liveUser),
            eggId,
            claimedBy: user.uid,
            claimedAt: serverTimestamp()
          });
        }
      });

      const rewardXp = Math.max(0, Number(egg?.rewards?.xp || 0));
      const rewardCurrency = Math.max(0, Number(egg?.rewards?.currency || 0));
      const badgeTitle = egg?.badge?.enabled ? egg?.badge?.title : null;
      const rewardBits = [
        rewardCurrency > 0 ? `+$${rewardCurrency}` : null,
        rewardXp > 0 ? `+${rewardXp} XP` : null,
        badgeTitle ? `Badge unlocked: ${badgeTitle}` : null
      ].filter(Boolean);

      await addDoc(collection(db, "users", user.uid, "alerts"), {
        type: "success",
        message: rewardBits.length > 0 ? `Egg secured! ${rewardBits.join(" | ")}` : "Egg secured!",
        read: false,
        createdAt: serverTimestamp()
      });

      closeModal();
    } catch (error) {
      console.error("Egg claim failed:", error);
      setModalState((prev) => ({
        ...prev,
        busy: false,
        error: error?.message || "Claim failed. Try again."
      }));
    }
  };

  const unlockNextHint = async () => {
    const egg = eggsById[modalState.eggId];
    if (!egg || !user?.uid) return;

    const currentProgress = getProgressForEgg(egg.id);
    const { nextPurchasableHint } = getVisibleHints({
      egg,
      progress: currentProgress,
      now: new Date()
    });

    if (!nextPurchasableHint) {
      setModalState((prev) => ({ ...prev, error: "No more purchasable hints for this egg." }));
      return;
    }

    const tokenItemId = egg?.hints?.tokenItemId || null;
    setModalState((prev) => ({ ...prev, busy: true, error: "" }));

    try {
      const userRef = doc(db, "users", user.uid);
      const progressRef = doc(db, "users", user.uid, "egg_progress", egg.id);

      await runTransaction(db, async (transaction) => {
        const [userSnap, progressSnap, eggSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(progressRef),
          transaction.get(doc(db, "eggs", egg.id))
        ]);

        if (!userSnap.exists()) {
          throw new Error("User profile missing.");
        }

        if (!eggSnap.exists()) {
          throw new Error("Egg not found.");
        }

        const liveEgg = { id: eggSnap.id, ...eggSnap.data() };
        const liveProgress = progressSnap.exists()
          ? { ...buildDefaultEggProgress(), ...progressSnap.data() }
          : buildDefaultEggProgress();

        const hints = liveEgg?.hints || {};
        if (!hints.enabled) {
          throw new Error("Hints are disabled for this egg.");
        }

        const purchasable = Array.isArray(hints.purchasable) ? hints.purchasable : [];
        const unlocked = new Set(Array.isArray(liveProgress.unlockedHintIds) ? liveProgress.unlockedHintIds : []);
        const targetHint = purchasable.find((hint) => !unlocked.has(hint.id));

        if (!targetHint) {
          throw new Error("No additional hints remain.");
        }

        const liveUser = userSnap.data();
        const inventory = Array.isArray(liveUser.inventory) ? [...liveUser.inventory] : [];

        const tokenIndex = inventory.findIndex((item) => {
          if (!item || item.redeemed === true) return false;
          if (tokenItemId && item.itemId === tokenItemId) return true;
          if (item.effectType === "hint_token") return true;
          const name = `${item.name || ""}`.trim().toLowerCase();
          return name === "hint token";
        });

        if (tokenIndex < 0) {
          throw new Error(`No ${formatHintTokenLabel(liveEgg)} found in inventory.`);
        }

        inventory.splice(tokenIndex, 1);

        const nextUnlocked = [...unlocked, targetHint.id];

        transaction.update(userRef, { inventory });
        transaction.set(
          progressRef,
          {
            unlockedHintIds: nextUnlocked,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      });

      setModalState((prev) => ({ ...prev, busy: false, error: "" }));
    } catch (error) {
      console.error("Hint unlock failed:", error);
      setModalState((prev) => ({
        ...prev,
        busy: false,
        error: error?.message || "Could not unlock hint."
      }));
    }
  };

  const hasActiveEggForAnchor = (anchorId) => {
    if (!anchorId) return false;
    return !!(anchorMap[anchorId] && anchorMap[anchorId].length > 0);
  };

  const getAnchorDisplay = (anchorId) => {
    const anchor = getAnchorById(anchorId);
    const eggIds = anchorMap[anchorId] || [];
    const egg = eggIds.length > 0 ? eggsById[eggIds[0]] : null;

    return {
      symbol: egg?.visual?.iconSymbol || anchor?.iconSymbol || "*",
      title: egg?.visual?.iconTitle || egg?.name || "Hidden Anchor"
    };
  };

  const activeEgg = modalState.eggId ? eggsById[modalState.eggId] : null;
  const activeProgress = activeEgg ? getProgressForEgg(activeEgg.id) : buildDefaultEggProgress();
  const visibleHintsState = activeEgg
    ? getVisibleHints({ egg: activeEgg, progress: activeProgress, now: new Date() })
    : { visibleHints: [], nextPurchasableHint: null, canUnlockMore: false };

  const contextValue = {
    activeEggs,
    hasActiveEggForAnchor,
    getAnchorDisplay,
    handleAnchorClick,
    modalState,
    setModalState,
    submitAnswer,
    claimEgg,
    closeModal,
    unlockNextHint,
    visibleHintsState
  };

  return (
    <EggContext.Provider value={contextValue}>
      {children}

      {modalState.open && activeEgg && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="absolute inset-0 pointer-events-none">
              {(activeEgg?.effects?.symbols || ["*", "+", "$"]).slice(0, 18).map((symbol, index) => (
                <span
                  key={`${symbol}-${index}`}
                  className="absolute text-amber-300 animate-pulse"
                  style={{
                    left: `${8 + (index * 13) % 85}%`,
                    top: `${10 + (index * 17) % 75}%`,
                    fontSize: `${10 + (index % 4) * 4}px`,
                    opacity: 0.5
                  }}
                >
                  {symbol}
                </span>
              ))}
            </div>

            <div className="relative z-10">
              <div className="bg-slate-100/90 p-4 flex items-center justify-between border-b border-slate-200">
                <h3 className="font-black text-slate-700 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  {activeEgg?.prompt?.title || activeEgg?.name || "Hidden Drop"}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600 transition"
                  disabled={modalState.busy}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  {activeEgg?.prompt?.body || "You found an active hidden challenge."}
                </p>

                {modalState.mode === "answer" && (
                  <>
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                      {activeEgg?.stages?.[activeProgress.stageIndex]?.prompt || "Enter unlock code"}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        value={modalState.answer}
                        onChange={(event) => {
                          const value = event.target.value;
                          setModalState((prev) => ({ ...prev, answer: value, error: "" }));
                        }}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700"
                        placeholder="Enter code"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={submitAnswer}
                        disabled={modalState.busy}
                        className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {modalState.busy ? "Checking..." : "Unlock"}
                      </button>
                    </div>
                  </>
                )}

                {modalState.mode === "claim" && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <span className="font-bold text-emerald-700">Currency</span>
                        <div className="text-emerald-800 font-black text-lg">+${Number(activeEgg?.rewards?.currency || 0)}</div>
                      </div>
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                        <span className="font-bold text-indigo-700">XP</span>
                        <div className="text-indigo-800 font-black text-lg">+{Number(activeEgg?.rewards?.xp || 0)}</div>
                      </div>
                    </div>

                    {activeEgg?.badge?.enabled && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Badge Unlock: <span className="font-bold">{activeEgg?.badge?.title || "Egg Hunter"}</span>
                      </div>
                    )}

                    {visibleHintsState.visibleHints.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                          <Lightbulb size={14} /> Active Hints
                        </div>
                        {visibleHintsState.visibleHints.map((hint) => (
                          <p key={hint.id} className="text-sm text-slate-700 leading-snug">
                            {hint.text}
                          </p>
                        ))}
                      </div>
                    )}

                    {visibleHintsState.canUnlockMore && activeEgg?.hints?.enabled && (
                      <button
                        type="button"
                        onClick={unlockNextHint}
                        disabled={modalState.busy}
                        className="w-full py-2 rounded-lg font-bold text-sm text-slate-900 bg-amber-100 border border-amber-200 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                      >
                        <KeyRound size={16} />
                        {modalState.busy
                          ? "Unlocking Hint..."
                          : `Use ${formatHintTokenLabel(activeEgg)} to Unlock Next Hint`}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={claimEgg}
                      disabled={modalState.busy}
                      className="w-full py-2 rounded-lg font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {modalState.busy ? "Claiming..." : activeEgg?.prompt?.claimLabel || "Claim Reward"}
                    </button>
                  </>
                )}

                {modalState.mode === "claimed" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 font-semibold">
                      You already claimed this egg. Keep hunting for the next one.
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full py-2 rounded-lg font-bold text-sm text-white bg-slate-900 hover:bg-indigo-600 transition"
                    >
                      Back to Hunt
                    </button>
                  </div>
                )}

                {modalState.error && (
                  <div className="text-xs font-bold text-red-500 flex items-center gap-2">
                    <Lock size={14} />
                    {modalState.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </EggContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEggEngine() {
  return useContext(EggContext);
}
