import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { AlertTriangle, Clock3, Copy, Egg, KeyRound, Lock, Plus, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { EGG_ANCHORS } from "../../lib/eggAnchors";
import {
  CLAIM_POLICY,
  EGG_SCOPE,
  EGG_STATUS,
  hashAnswer,
  isEggCurrentlyLockingAnchors,
  normalizeAnswer,
  parseEggDate,
  TRIGGER_TYPE
} from "../../lib/eggEngine";
import { CLASS_CODES } from "../../lib/gameConfig";

const toDateTimeInput = (value) => {
  const date = parseEggDate(value);
  if (!date) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const CLAIM_POLICY_OPTIONS = [
  { value: CLAIM_POLICY.PER_STUDENT_ONCE, label: "Once per student" },
  { value: CLAIM_POLICY.PER_CLASS_ONCE, label: "Once per class" },
  { value: CLAIM_POLICY.FIRST_N_GLOBAL, label: "First N students globally" },
  { value: CLAIM_POLICY.ALL_STUDENTS_IN_SCOPE, label: "All students in scope" }
];

const TRIGGER_OPTIONS = [
  { value: TRIGGER_TYPE.SINGLE_CLICK, label: "Single Click" },
  { value: TRIGGER_TYPE.MULTI_CLICK, label: "Multi Click" },
  { value: TRIGGER_TYPE.ORDERED_SEQUENCE, label: "Ordered Sequence" },
  { value: TRIGGER_TYPE.TIMED_SEQUENCE, label: "Timed Sequence" },
  { value: TRIGGER_TYPE.TEXT_ANSWER, label: "Text Answer" }
];

const makeHintId = (prefix, index) => `${prefix}_${index + 1}`;

const parseSymbolList = (value) => {
  const list = `${value || ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length ? list : ["*", "+", "$"];
};

const normalizeId = (value) => {
  return `${value || ""}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\- ]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
};

const buildEmptyForm = () => ({
  name: "",
  enabled: true,
  status: EGG_STATUS.LIVE,
  priority: 0,
  scope: EGG_SCOPE.GLOBAL,
  classIds: [],
  startAt: "",
  endAt: "",
  anchorIds: [],
  triggerType: TRIGGER_TYPE.SINGLE_CLICK,
  triggerAnchorId: "",
  triggerClickCount: 5,
  triggerWindowMs: 1200,
  triggerSequence: "",
  triggerTimeLimitMs: 12000,
  triggerPrompt: "",
  triggerAnswer: "",
  triggerCaseSensitive: false,
  triggerAnswerHash: "",
  triggerAnswerSalt: "",
  finalAnswerEnabled: false,
  finalAnswerAnchorId: "",
  finalAnswerPrompt: "",
  finalAnswerText: "",
  finalAnswerHash: "",
  finalAnswerSalt: "",
  promptTitle: "",
  promptBody: "",
  promptClaimLabel: "Claim Reward",
  rewardsXp: 0,
  rewardsCurrency: 0,
  claimPolicy: CLAIM_POLICY.PER_STUDENT_ONCE,
  maxClaims: 10,
  iconSymbol: "*",
  iconTitle: "",
  effectSymbols: "*,+, $",
  badgeEnabled: false,
  badgeId: "",
  badgeTitle: "",
  badgeDescription: "",
  badgeIconName: "trophy",
  hintsEnabled: false,
  hintTokenItemId: "",
  hintTokenItemName: "Hint Token",
  scheduledHints: "",
  manualHints: "",
  purchasableHints: ""
});

const parseScheduledHints = (text) => {
  return `${text || ""}`
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawDate, ...hintParts] = line.split("|");
      const hintText = hintParts.join("|").trim();
      const hintDate = rawDate?.trim();
      if (!hintDate || !hintText) return null;
      const parsed = new Date(hintDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return {
        id: makeHintId("scheduled", index),
        revealAt: Timestamp.fromDate(parsed),
        text: hintText
      };
    })
    .filter(Boolean);
};

const parseManualHints = (text) => {
  return `${text || ""}`
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const enabled = line.startsWith("!");
      const hintText = enabled ? line.slice(1).trim() : line;
      return {
        id: makeHintId("manual", index),
        text: hintText,
        enabled
      };
    })
    .filter((hint) => hint.text);
};

const parsePurchasableHints = (text) => {
  return `${text || ""}`
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: makeHintId("buy", index),
      text: line
    }));
};

const parseSequenceList = (text) => {
  return `${text || ""}`
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const anchorGroups = EGG_ANCHORS.reduce((acc, anchor) => {
  if (!acc[anchor.page]) acc[anchor.page] = [];
  acc[anchor.page].push(anchor);
  return acc;
}, {});

export default function AdminEggs() {
  const { user, userData } = useAuth();

  const [eggs, setEggs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [saving, setSaving] = useState(false);
  const [lockConflicts, setLockConflicts] = useState([]);

  useEffect(() => {
    const unsubEggs = onSnapshot(
      query(collection(db, "eggs")),
      (snap) => {
        setEggs(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        console.error("AdminEggs eggs listener failed:", error);
      }
    );

    const unsubClasses = onSnapshot(
      collection(db, "classes"),
      (snap) => {
        const fromDb = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setClasses(fromDb);
      },
      (error) => {
        console.error("AdminEggs classes listener failed:", error);
      }
    );

    const unsubShop = onSnapshot(
      collection(db, "shop_items"),
      (snap) => {
        setShopItems(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        console.error("AdminEggs shop listener failed:", error);
      }
    );

    return () => {
      unsubEggs();
      unsubClasses();
      unsubShop();
    };
  }, []);

  const classOptions = useMemo(() => {
    const fromDb = classes
      .map((cls) => ({
        id: cls.id || cls.class_id,
        name: cls.name || cls.displayName || cls.id
      }))
      .filter((cls) => cls.id);

    const fallback = Object.values(CLASS_CODES || {})
      .map((cls) => ({ id: cls.id, name: cls.name || cls.id }))
      .filter((cls) => cls.id);

    const mergedMap = {};
    [...fromDb, ...fallback].forEach((entry) => {
      mergedMap[entry.id] = entry;
    });

    return Object.values(mergedMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  const hintTokenOptions = useMemo(() => {
    return shopItems
      .filter((item) => item.effectType === "hint_token" || `${item.title || ""}`.toLowerCase().includes("hint token"))
      .sort((a, b) => `${a.title || ""}`.localeCompare(`${b.title || ""}`));
  }, [shopItems]);

  const activeEggs = useMemo(() => {
    return [...eggs].sort((a, b) => {
      const aCreated = parseEggDate(a.createdAt)?.getTime() || 0;
      const bCreated = parseEggDate(b.createdAt)?.getTime() || 0;
      return bCreated - aCreated;
    });
  }, [eggs]);

  const resetForm = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setLockConflicts([]);
  };

  const hydrateFormFromEgg = (egg) => {
    const stages = Array.isArray(egg.stages) ? egg.stages : [];
    const primaryStage = stages[0] || { type: TRIGGER_TYPE.SINGLE_CLICK };
    const secondaryAnswerStage = stages[1]?.type === TRIGGER_TYPE.TEXT_ANSWER ? stages[1] : null;

    const sequenceValue = Array.isArray(primaryStage.sequence) ? primaryStage.sequence.join("\n") : "";

    const scheduledHintsText = (egg?.hints?.scheduled || [])
      .map((hint) => {
        const revealAt = toDateTimeInput(hint.revealAt);
        return revealAt ? `${revealAt}|${hint.text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const manualHintsText = (egg?.hints?.manual || [])
      .map((hint) => (hint.enabled ? `!${hint.text}` : hint.text))
      .join("\n");

    const purchasableHintsText = (egg?.hints?.purchasable || [])
      .map((hint) => hint.text)
      .join("\n");

    setEditingId(egg.id);
    setForm({
      name: egg.name || "",
      enabled: egg.enabled !== false,
      status: egg.status || EGG_STATUS.LIVE,
      priority: Number(egg.priority || 0),
      scope: egg.scope || EGG_SCOPE.GLOBAL,
      classIds: Array.isArray(egg.classIds) ? egg.classIds : [],
      startAt: toDateTimeInput(egg.startAt),
      endAt: toDateTimeInput(egg.endAt),
      anchorIds: Array.isArray(egg.anchorIds) ? egg.anchorIds : [],
      triggerType: primaryStage.type || TRIGGER_TYPE.SINGLE_CLICK,
      triggerAnchorId: primaryStage.anchorId || "",
      triggerClickCount: Number(primaryStage.clickCount || 5),
      triggerWindowMs: Number(primaryStage.windowMs || 1200),
      triggerSequence: sequenceValue,
      triggerTimeLimitMs: Number(primaryStage.timeLimitMs || 12000),
      triggerPrompt: primaryStage.prompt || "",
      triggerAnswer: "",
      triggerCaseSensitive: !!primaryStage.caseSensitive,
      triggerAnswerHash: primaryStage.answerHash || "",
      triggerAnswerSalt: primaryStage.answerSalt || "",
      finalAnswerEnabled: !!secondaryAnswerStage,
      finalAnswerAnchorId: secondaryAnswerStage?.anchorId || "",
      finalAnswerPrompt: secondaryAnswerStage?.prompt || "",
      finalAnswerText: "",
      finalAnswerHash: secondaryAnswerStage?.answerHash || "",
      finalAnswerSalt: secondaryAnswerStage?.answerSalt || "",
      promptTitle: egg?.prompt?.title || "",
      promptBody: egg?.prompt?.body || "",
      promptClaimLabel: egg?.prompt?.claimLabel || "Claim Reward",
      rewardsXp: Number(egg?.rewards?.xp || 0),
      rewardsCurrency: Number(egg?.rewards?.currency || 0),
      claimPolicy: egg.claimPolicy || CLAIM_POLICY.PER_STUDENT_ONCE,
      maxClaims: Number(egg.maxClaims || 10),
      iconSymbol: egg?.visual?.iconSymbol || "*",
      iconTitle: egg?.visual?.iconTitle || "",
      effectSymbols: Array.isArray(egg?.effects?.symbols) ? egg.effects.symbols.join(",") : "*,+, $",
      badgeEnabled: !!egg?.badge?.enabled,
      badgeId: egg?.badge?.id || "",
      badgeTitle: egg?.badge?.title || "",
      badgeDescription: egg?.badge?.description || "",
      badgeIconName: egg?.badge?.iconName || "trophy",
      hintsEnabled: !!egg?.hints?.enabled,
      hintTokenItemId: egg?.hints?.tokenItemId || "",
      hintTokenItemName: egg?.hints?.tokenItemName || "Hint Token",
      scheduledHints: scheduledHintsText,
      manualHints: manualHintsText,
      purchasableHints: purchasableHintsText
    });
    setLockConflicts([]);
  };

  const toggleAnchor = (anchorId) => {
    setForm((prev) => {
      const exists = prev.anchorIds.includes(anchorId);
      const nextAnchorIds = exists
        ? prev.anchorIds.filter((id) => id !== anchorId)
        : [...prev.anchorIds, anchorId];

      const triggerAnchorId = exists && prev.triggerAnchorId === anchorId
        ? ""
        : prev.triggerAnchorId;

      const finalAnswerAnchorId = exists && prev.finalAnswerAnchorId === anchorId
        ? ""
        : prev.finalAnswerAnchorId;

      return {
        ...prev,
        anchorIds: nextAnchorIds,
        triggerAnchorId,
        finalAnswerAnchorId
      };
    });
  };

  const buildStages = async () => {
    const stages = [];

    const primaryAnchor = form.triggerAnchorId || form.anchorIds[0] || "";

    if (!primaryAnchor && form.triggerType !== TRIGGER_TYPE.ORDERED_SEQUENCE && form.triggerType !== TRIGGER_TYPE.TIMED_SEQUENCE) {
      throw new Error("Select at least one anchor and a trigger anchor.");
    }

    if (form.triggerType === TRIGGER_TYPE.SINGLE_CLICK) {
      stages.push({ type: TRIGGER_TYPE.SINGLE_CLICK, anchorId: primaryAnchor });
    }

    if (form.triggerType === TRIGGER_TYPE.MULTI_CLICK) {
      stages.push({
        type: TRIGGER_TYPE.MULTI_CLICK,
        anchorId: primaryAnchor,
        clickCount: Math.max(2, Number(form.triggerClickCount || 5)),
        windowMs: Math.max(300, Number(form.triggerWindowMs || 1200))
      });
    }

    if (form.triggerType === TRIGGER_TYPE.ORDERED_SEQUENCE) {
      const sequence = parseSequenceList(form.triggerSequence);
      if (sequence.length < 2) {
        throw new Error("Ordered sequence requires at least 2 anchors.");
      }
      stages.push({
        type: TRIGGER_TYPE.ORDERED_SEQUENCE,
        sequence
      });
    }

    if (form.triggerType === TRIGGER_TYPE.TIMED_SEQUENCE) {
      const sequence = parseSequenceList(form.triggerSequence);
      if (sequence.length < 2) {
        throw new Error("Timed sequence requires at least 2 anchors.");
      }
      stages.push({
        type: TRIGGER_TYPE.TIMED_SEQUENCE,
        sequence,
        timeLimitMs: Math.max(1000, Number(form.triggerTimeLimitMs || 12000))
      });
    }

    if (form.triggerType === TRIGGER_TYPE.TEXT_ANSWER) {
      const normalized = normalizeAnswer(form.triggerAnswer, !!form.triggerCaseSensitive);
      const hasExistingHash = !!form.triggerAnswerHash;
      if (!normalized && !hasExistingHash) {
        throw new Error("Text answer trigger requires an answer.");
      }

      let answerHash = form.triggerAnswerHash;
      let answerSalt = form.triggerAnswerSalt;

      if (normalized) {
        answerSalt = `salt_${Date.now()}`;
        answerHash = await hashAnswer(normalized, answerSalt);
      }

      stages.push({
        type: TRIGGER_TYPE.TEXT_ANSWER,
        anchorId: primaryAnchor,
        prompt: form.triggerPrompt.trim(),
        caseSensitive: !!form.triggerCaseSensitive,
        answerSalt,
        answerHash
      });
    }

    if (form.finalAnswerEnabled && form.triggerType !== TRIGGER_TYPE.TEXT_ANSWER) {
      const answerAnchor = form.finalAnswerAnchorId || form.anchorIds[0] || "";
      if (!answerAnchor) {
        throw new Error("Final puzzle layer needs an anchor.");
      }

      const normalized = normalizeAnswer(form.finalAnswerText, false);
      const hasExistingHash = !!form.finalAnswerHash;
      if (!normalized && !hasExistingHash) {
        throw new Error("Final puzzle layer needs an answer.");
      }

      let answerHash = form.finalAnswerHash;
      let answerSalt = form.finalAnswerSalt;

      if (normalized) {
        answerSalt = `salt_${Date.now()}`;
        answerHash = await hashAnswer(normalized, answerSalt);
      }

      stages.push({
        type: TRIGGER_TYPE.TEXT_ANSWER,
        anchorId: answerAnchor,
        prompt: form.finalAnswerPrompt.trim() || "Enter the final code.",
        caseSensitive: false,
        answerSalt,
        answerHash
      });
    }

    return stages;
  };

  const checkAnchorLocks = async (anchorIds, currentEggId = null) => {
    const conflicts = [];

    for (const anchorId of anchorIds) {
      const lockSnap = await getDoc(doc(db, "egg_anchor_locks", anchorId));
      if (!lockSnap.exists()) continue;

      const lock = lockSnap.data();
      if (!lock?.eggId) continue;
      if (lock.eggId === currentEggId) continue;

      const existingEgg = eggs.find((entry) => entry.id === lock.eggId) || null;
      if (!existingEgg) continue;

      if (isEggCurrentlyLockingAnchors(existingEgg, new Date())) {
        conflicts.push({
          anchorId,
          eggId: existingEgg.id,
          eggName: existingEgg.name || existingEgg.id
        });
      }
    }

    setLockConflicts(conflicts);
    return conflicts;
  };

  const syncLocks = async ({ eggId, nextAnchorIds, enabled, startAt, endAt, previousAnchorIds }) => {
    const batch = writeBatch(db);

    const lockPayload = {
      eggId,
      enabled,
      startAt: startAt ? Timestamp.fromDate(startAt) : null,
      endAt: endAt ? Timestamp.fromDate(endAt) : null,
      updatedAt: serverTimestamp()
    };

    if (enabled) {
      nextAnchorIds.forEach((anchorId) => {
        batch.set(doc(db, "egg_anchor_locks", anchorId), {
          ...lockPayload,
          anchorId
        });
      });
    }

    const toRelease = previousAnchorIds.filter((anchorId) => !enabled || !nextAnchorIds.includes(anchorId));
    toRelease.forEach((anchorId) => {
      batch.delete(doc(db, "egg_anchor_locks", anchorId));
    });

    await batch.commit();
  };

  const ensureBadge = async () => {
    if (!form.badgeEnabled) return null;

    const generatedId = normalizeId(form.badgeId || form.badgeTitle || form.name || "egg_badge");
    if (!generatedId) {
      throw new Error("Badge is enabled but badge id/title is missing.");
    }

    const payload = {
      title: form.badgeTitle.trim() || form.name.trim() || "Egg Hunter",
      description: form.badgeDescription.trim() || "Hidden egg badge.",
      xpReward: 0,
      currencyReward: 0,
      iconName: form.badgeIconName || "trophy",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "badges", generatedId), payload, { merge: true });

    return {
      enabled: true,
      id: generatedId,
      title: payload.title,
      description: payload.description,
      iconName: payload.iconName
    };
  };

  const saveEgg = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Egg name is required.");
      return;
    }

    if (form.anchorIds.length === 0) {
      alert("Select at least one anchor.");
      return;
    }

    if (form.scope === EGG_SCOPE.CLASS && form.classIds.length === 0) {
      alert("Class-specific eggs require at least one class.");
      return;
    }

    if (form.claimPolicy === CLAIM_POLICY.FIRST_N_GLOBAL && Number(form.maxClaims || 0) < 1) {
      alert("First N policy requires max claims >= 1.");
      return;
    }
    if (form.claimPolicy === CLAIM_POLICY.PER_CLASS_ONCE && form.scope !== EGG_SCOPE.CLASS) {
      alert("Per-class policy requires class-specific scope.");
      return;
    }

    setSaving(true);

    try {
      const conflicts = await checkAnchorLocks(form.anchorIds, editingId);
      if (conflicts.length > 0) {
        alert("One or more anchors are locked by active eggs. Resolve conflicts first.");
        setSaving(false);
        return;
      }

      const stages = await buildStages();

      const startAt = form.startAt ? new Date(form.startAt) : null;
      const endAt = form.endAt ? new Date(form.endAt) : null;

      if (startAt && Number.isNaN(startAt.getTime())) {
        throw new Error("Start date is invalid.");
      }
      if (endAt && Number.isNaN(endAt.getTime())) {
        throw new Error("End date is invalid.");
      }
      if (startAt && endAt && startAt > endAt) {
        throw new Error("End date must be after start date.");
      }

      const badgeConfig = await ensureBadge();
      const scheduledHints = parseScheduledHints(form.scheduledHints);
      const manualHints = parseManualHints(form.manualHints);
      const purchasableHints = parsePurchasableHints(form.purchasableHints);
      const now = serverTimestamp();

      const payload = {
        name: form.name.trim(),
        enabled: !!form.enabled,
        status: form.enabled ? form.status || EGG_STATUS.LIVE : EGG_STATUS.ARCHIVED,
        priority: Number(form.priority || 0),
        scope: form.scope,
        classIds: form.scope === EGG_SCOPE.CLASS ? form.classIds : [],
        startAt: startAt ? Timestamp.fromDate(startAt) : null,
        endAt: endAt ? Timestamp.fromDate(endAt) : null,
        anchorIds: form.anchorIds,
        stages,
        claimPolicy: form.claimPolicy,
        maxClaims: form.claimPolicy === CLAIM_POLICY.FIRST_N_GLOBAL ? Math.max(1, Number(form.maxClaims || 1)) : null,
        prompt: {
          title: form.promptTitle.trim() || form.name.trim(),
          body: form.promptBody.trim() || "You discovered a hidden drop.",
          claimLabel: form.promptClaimLabel.trim() || "Claim Reward"
        },
        rewards: {
          xp: Math.max(0, Number(form.rewardsXp || 0)),
          currency: Math.max(0, Number(form.rewardsCurrency || 0))
        },
        visual: {
          iconSymbol: form.iconSymbol || "*",
          iconTitle: form.iconTitle.trim() || form.name.trim()
        },
        effects: {
          symbols: parseSymbolList(form.effectSymbols)
        },
        badge: badgeConfig || { enabled: false },
        hints: {
          enabled: !!form.hintsEnabled,
          tokenItemId: form.hintTokenItemId || "",
          tokenItemName: form.hintTokenItemName.trim() || "Hint Token",
          scheduled: scheduledHints,
          manual: manualHints,
          purchasable: purchasableHints
        },
        updatedBy: user?.uid || null,
        updatedAt: now,
        orgId: userData?.orgId || null
      };

      const existingEgg = editingId ? eggs.find((entry) => entry.id === editingId) : null;
      const previousAnchorIds = Array.isArray(existingEgg?.anchorIds) ? existingEgg.anchorIds : [];

      let eggId = editingId;
      if (editingId) {
        await updateDoc(doc(db, "eggs", editingId), payload);
      } else {
        const ref = await addDoc(collection(db, "eggs"), {
          ...payload,
          claimedCount: 0,
          createdBy: user?.uid || null,
          createdAt: now
        });
        eggId = ref.id;
      }

      await syncLocks({
        eggId,
        nextAnchorIds: form.anchorIds,
        enabled: !!form.enabled,
        startAt,
        endAt,
        previousAnchorIds
      });

      resetForm();
      alert(editingId ? "Egg updated." : "Egg created.");
    } catch (error) {
      console.error("Egg save failed:", error);
      alert(error?.message || "Failed to save egg.");
    }

    setSaving(false);
  };

  const archiveEgg = async (egg) => {
    if (!window.confirm(`Archive egg \"${egg.name || egg.id}\"?`)) return;

    try {
      await updateDoc(doc(db, "eggs", egg.id), {
        enabled: false,
        status: EGG_STATUS.ARCHIVED,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null
      });

      const previousAnchorIds = Array.isArray(egg.anchorIds) ? egg.anchorIds : [];
      await syncLocks({
        eggId: egg.id,
        nextAnchorIds: [],
        enabled: false,
        startAt: null,
        endAt: null,
        previousAnchorIds
      });
    } catch (error) {
      console.error("Archive egg failed:", error);
      alert("Could not archive egg.");
    }
  };

  const deleteEgg = async (egg) => {
    const confirmed = window.confirm(
      `Delete egg \"${egg.name || egg.id}\" permanently?\\n\\nThis removes the egg config and releases its anchors.`
    );
    if (!confirmed) return;

    try {
      const previousAnchorIds = Array.isArray(egg.anchorIds) ? egg.anchorIds : [];

      await syncLocks({
        eggId: egg.id,
        nextAnchorIds: [],
        enabled: false,
        startAt: null,
        endAt: null,
        previousAnchorIds
      });

      await deleteDoc(doc(db, "eggs", egg.id));

      if (editingId === egg.id) {
        resetForm();
      }
    } catch (error) {
      console.error("Delete egg failed:", error);
      alert("Could not delete egg.");
    }
  };

  const activateManualHints = async (egg) => {
    const manual = Array.isArray(egg?.hints?.manual) ? egg.hints.manual : [];
    if (manual.length === 0) {
      alert("No manual hints configured for this egg.");
      return;
    }

    try {
      await updateDoc(doc(db, "eggs", egg.id), {
        hints: {
          ...(egg.hints || {}),
          manual: manual.map((hint) => ({ ...hint, enabled: true }))
        },
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null
      });
      alert("Manual hints released.");
    } catch (error) {
      console.error("Activate manual hints failed:", error);
      alert("Failed to release manual hints.");
    }
  };

  const createHintTokenItem = async () => {
    try {
      const existing = shopItems.find((item) => item.effectType === "hint_token" || `${item.title || ""}`.toLowerCase() === "hint token");
      if (existing) {
        setForm((prev) => ({
          ...prev,
          hintTokenItemId: existing.id,
          hintTokenItemName: existing.title || "Hint Token"
        }));
        alert("Hint token already exists in shop. Linked to form.");
        return;
      }

      const ref = await addDoc(collection(db, "shop_items"), {
        title: "Hint Token",
        desc: "Spend one token to unlock a purchasable egg hint.",
        price: 250,
        stock: 999,
        iconName: "lock",
        effectType: "hint_token",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setForm((prev) => ({
        ...prev,
        hintTokenItemId: ref.id,
        hintTokenItemName: "Hint Token"
      }));

      alert("Hint token item created and linked.");
    } catch (error) {
      console.error("Create hint token failed:", error);
      alert("Could not create hint token item.");
    }
  };

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="theme-surface border theme-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-black theme-text flex items-center gap-2">
                <Egg size={22} className="text-amber-500" />
                Egg Engine
              </h2>
              <p className="text-sm theme-muted">
                Configure hidden egg drops with anchor placement, layered triggers, fixed rewards, badge auto-create, and hint controls.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                New Egg
              </button>
            )}
          </div>

          {lockConflicts.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Anchor lock conflict
              </p>
              <ul className="text-xs text-red-700 space-y-1">
                {lockConflicts.map((conflict) => (
                  <li key={`${conflict.anchorId}-${conflict.eggId}`}>
                    {conflict.anchorId} is currently reserved by {conflict.eggName}.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={saveEgg} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">Egg Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Vault Key Drop"
                  required
                />
              </label>

              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">Status</span>
                <select
                  value={form.enabled ? EGG_STATUS.LIVE : EGG_STATUS.ARCHIVED}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      enabled: value !== EGG_STATUS.ARCHIVED,
                      status: value
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value={EGG_STATUS.LIVE}>Live</option>
                  <option value={EGG_STATUS.DRAFT}>Draft</option>
                  <option value={EGG_STATUS.ARCHIVED}>Archived</option>
                </select>
              </label>

              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">Priority</span>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value || 0) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">Scope</span>
                <select
                  value={form.scope}
                  onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value={EGG_SCOPE.GLOBAL}>Global</option>
                  <option value={EGG_SCOPE.CLASS}>Class Specific</option>
                </select>
              </label>

              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">Start At (optional)</span>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-bold theme-text space-y-2">
                <span className="block">End At (optional)</span>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {form.scope === EGG_SCOPE.CLASS && (
              <div>
                <p className="text-sm font-bold theme-text mb-2">Classes in Scope</p>
                <div className="grid md:grid-cols-2 gap-2 max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-3">
                  {classOptions.map((cls) => {
                    const checked = form.classIds.includes(cls.id);
                    return (
                      <label key={cls.id} className="text-sm flex items-center gap-2 theme-text">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setForm((prev) => ({
                              ...prev,
                              classIds: checked
                                ? prev.classIds.filter((id) => id !== cls.id)
                                : [...prev.classIds, cls.id]
                            }));
                          }}
                        />
                        <span>{cls.name}</span>
                        <span className="text-xs theme-muted">({cls.id})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-bold theme-text mb-2">Anchor Placement (locked globally while active/scheduled)</p>
              <div className="space-y-3">
                {Object.entries(anchorGroups).map(([page, anchors]) => (
                  <div key={page} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">{page}</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {anchors.map((anchor) => {
                        const checked = form.anchorIds.includes(anchor.id);
                        return (
                          <label key={anchor.id} className="text-sm flex items-start gap-2 theme-text">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAnchor(anchor.id)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold block">{anchor.label}</span>
                              <span className="text-xs theme-muted block">{anchor.id}</span>
                              <span className="text-xs theme-muted block">{anchor.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider theme-text flex items-center gap-2">
                <Wand2 size={14} className="text-indigo-600" /> Trigger Setup
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <label className="text-sm font-bold theme-text space-y-2">
                  <span className="block">Trigger Type</span>
                  <select
                    value={form.triggerType}
                    onChange={(event) => setForm((prev) => ({ ...prev, triggerType: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {(form.triggerType === TRIGGER_TYPE.SINGLE_CLICK
                  || form.triggerType === TRIGGER_TYPE.MULTI_CLICK
                  || form.triggerType === TRIGGER_TYPE.TEXT_ANSWER) && (
                  <label className="text-sm font-bold theme-text space-y-2">
                    <span className="block">Trigger Anchor</span>
                    <select
                      value={form.triggerAnchorId}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerAnchorId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select anchor</option>
                      {form.anchorIds.map((anchorId) => (
                        <option key={anchorId} value={anchorId}>{anchorId}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="text-sm font-bold theme-text space-y-2">
                  <span className="block">Trigger Prompt (optional)</span>
                  <input
                    value={form.triggerPrompt}
                    onChange={(event) => setForm((prev) => ({ ...prev, triggerPrompt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Enter passphrase"
                  />
                </label>
              </div>

              {form.triggerType === TRIGGER_TYPE.MULTI_CLICK && (
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm font-bold theme-text space-y-2">
                    <span className="block">Click Count</span>
                    <input
                      type="number"
                      min={2}
                      value={form.triggerClickCount}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerClickCount: Number(event.target.value || 2) }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-bold theme-text space-y-2">
                    <span className="block">Window (ms)</span>
                    <input
                      type="number"
                      min={300}
                      value={form.triggerWindowMs}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerWindowMs: Number(event.target.value || 300) }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}

              {(form.triggerType === TRIGGER_TYPE.ORDERED_SEQUENCE || form.triggerType === TRIGGER_TYPE.TIMED_SEQUENCE) && (
                <div className="space-y-3">
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Sequence Anchors (one per line)</span>
                    <textarea
                      value={form.triggerSequence}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerSequence: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-24 font-mono"
                      placeholder={form.anchorIds.join("\n")}
                    />
                  </label>

                  {form.triggerType === TRIGGER_TYPE.TIMED_SEQUENCE && (
                    <label className="text-sm font-bold theme-text space-y-2 block">
                      <span className="block">Time Limit (ms)</span>
                      <input
                        type="number"
                        min={1000}
                        value={form.triggerTimeLimitMs}
                        onChange={(event) => setForm((prev) => ({ ...prev, triggerTimeLimitMs: Number(event.target.value || 1000) }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  )}
                </div>
              )}

              {form.triggerType === TRIGGER_TYPE.TEXT_ANSWER && (
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Answer</span>
                    <input
                      value={form.triggerAnswer}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerAnswer: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder={form.triggerAnswerHash ? "Leave blank to keep current answer" : "Enter answer"}
                    />
                  </label>
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Case Sensitive</span>
                    <input
                      type="checkbox"
                      checked={form.triggerCaseSensitive}
                      onChange={(event) => setForm((prev) => ({ ...prev, triggerCaseSensitive: event.target.checked }))}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              )}

              {form.triggerType !== TRIGGER_TYPE.TEXT_ANSWER && (
                <div className="border border-dashed border-slate-200 rounded-xl p-3 space-y-3">
                  <label className="text-sm flex items-center gap-2 font-bold theme-text">
                    <input
                      type="checkbox"
                      checked={form.finalAnswerEnabled}
                      onChange={(event) => setForm((prev) => ({ ...prev, finalAnswerEnabled: event.target.checked }))}
                    />
                    Add final puzzle layer (multi-stage)
                  </label>

                  {form.finalAnswerEnabled && (
                    <div className="grid md:grid-cols-3 gap-3">
                      <label className="text-sm font-bold theme-text space-y-2 block">
                        <span className="block">Puzzle Anchor</span>
                        <select
                          value={form.finalAnswerAnchorId}
                          onChange={(event) => setForm((prev) => ({ ...prev, finalAnswerAnchorId: event.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select anchor</option>
                          {form.anchorIds.map((anchorId) => (
                            <option key={anchorId} value={anchorId}>{anchorId}</option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-bold theme-text space-y-2 block">
                        <span className="block">Prompt</span>
                        <input
                          value={form.finalAnswerPrompt}
                          onChange={(event) => setForm((prev) => ({ ...prev, finalAnswerPrompt: event.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Enter final code"
                        />
                      </label>

                      <label className="text-sm font-bold theme-text space-y-2 block">
                        <span className="block">Answer</span>
                        <input
                          value={form.finalAnswerText}
                          onChange={(event) => setForm((prev) => ({ ...prev, finalAnswerText: event.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder={form.finalAnswerHash ? "Leave blank to keep current answer" : "Enter answer"}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider theme-text flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" /> Reward + Prompt
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Prompt Title</span>
                  <input
                    value={form.promptTitle}
                    onChange={(event) => setForm((prev) => ({ ...prev, promptTitle: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Claim Button Label</span>
                  <input
                    value={form.promptClaimLabel}
                    onChange={(event) => setForm((prev) => ({ ...prev, promptClaimLabel: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Anchor Icon Symbol</span>
                  <input
                    value={form.iconSymbol}
                    onChange={(event) => setForm((prev) => ({ ...prev, iconSymbol: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="*"
                  />
                </label>
              </div>

              <label className="text-sm font-bold theme-text space-y-2 block">
                <span className="block">Prompt Body</span>
                <textarea
                  value={form.promptBody}
                  onChange={(event) => setForm((prev) => ({ ...prev, promptBody: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-20"
                />
              </label>

              <div className="grid md:grid-cols-3 gap-4">
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Reward XP (fixed)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.rewardsXp}
                    onChange={(event) => setForm((prev) => ({ ...prev, rewardsXp: Number(event.target.value || 0) }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Reward Currency (fixed)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.rewardsCurrency}
                    onChange={(event) => setForm((prev) => ({ ...prev, rewardsCurrency: Number(event.target.value || 0) }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Effect Symbols (comma-separated)</span>
                  <input
                    value={form.effectSymbols}
                    onChange={(event) => setForm((prev) => ({ ...prev, effectSymbols: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="*, +, $"
                  />
                </label>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider theme-text flex items-center gap-2">
                <Lock size={14} className="text-indigo-600" /> Claim Policy
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-bold theme-text space-y-2 block">
                  <span className="block">Claim Policy</span>
                  <select
                    value={form.claimPolicy}
                    onChange={(event) => setForm((prev) => ({ ...prev, claimPolicy: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {CLAIM_POLICY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {form.claimPolicy === CLAIM_POLICY.FIRST_N_GLOBAL && (
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Max Claims</span>
                    <input
                      type="number"
                      min={1}
                      value={form.maxClaims}
                      onChange={(event) => setForm((prev) => ({ ...prev, maxClaims: Number(event.target.value || 1) }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider theme-text flex items-center gap-2">
                <Sparkles size={14} className="text-yellow-500" /> Badge + Hints
              </h3>

              <label className="text-sm font-bold theme-text flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.badgeEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, badgeEnabled: event.target.checked }))}
                />
                Auto-create / attach badge from this egg
              </label>

              {form.badgeEnabled && (
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Badge ID (optional)</span>
                    <input
                      value={form.badgeId}
                      onChange={(event) => setForm((prev) => ({ ...prev, badgeId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Badge Title</span>
                    <input
                      value={form.badgeTitle}
                      onChange={(event) => setForm((prev) => ({ ...prev, badgeTitle: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-bold theme-text space-y-2 block md:col-span-2">
                    <span className="block">Badge Description</span>
                    <input
                      value={form.badgeDescription}
                      onChange={(event) => setForm((prev) => ({ ...prev, badgeDescription: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}

              <label className="text-sm font-bold theme-text flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hintsEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, hintsEnabled: event.target.checked }))}
                />
                Enable hints for this egg
              </label>

              {form.hintsEnabled && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm font-bold theme-text">
                      Hint Token Item
                      <select
                        value={form.hintTokenItemId}
                        onChange={(event) => {
                          const selected = hintTokenOptions.find((item) => item.id === event.target.value);
                          setForm((prev) => ({
                            ...prev,
                            hintTokenItemId: event.target.value,
                            hintTokenItemName: selected?.title || prev.hintTokenItemName
                          }));
                        }}
                        className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Auto-detect any Hint Token</option>
                        {hintTokenOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={createHintTokenItem}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      <KeyRound size={14} /> Create Hint Token Item
                    </button>
                  </div>

                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Scheduled Hints (one per line: YYYY-MM-DDTHH:mm|hint text)</span>
                    <textarea
                      value={form.scheduledHints}
                      onChange={(event) => setForm((prev) => ({ ...prev, scheduledHints: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-24 font-mono"
                    />
                  </label>

                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Manual Hints (one per line, prefix with ! to release immediately)</span>
                    <textarea
                      value={form.manualHints}
                      onChange={(event) => setForm((prev) => ({ ...prev, manualHints: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-20"
                    />
                  </label>

                  <label className="text-sm font-bold theme-text space-y-2 block">
                    <span className="block">Purchasable Hints (one per line)</span>
                    <textarea
                      value={form.purchasableHints}
                      onChange={(event) => setForm((prev) => ({ ...prev, purchasableHints: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-20"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                {saving ? "Saving..." : editingId ? "Save Egg" : "Create Egg"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="theme-surface border theme-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-black theme-text mb-4">Existing Eggs</h3>

          {activeEggs.length === 0 ? (
            <div className="text-sm theme-muted py-6 text-center border border-dashed theme-border rounded-xl">
              No eggs configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activeEggs.map((egg) => {
                const startAt = parseEggDate(egg.startAt);
                const endAt = parseEggDate(egg.endAt);
                const manualHints = Array.isArray(egg?.hints?.manual) ? egg.hints.manual : [];

                return (
                  <div key={egg.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black theme-text flex items-center gap-2">
                          <Egg size={14} className="text-amber-500" />
                          {egg.name || egg.id}
                        </p>
                        <p className="text-xs theme-muted mt-1">{egg.id}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-bold uppercase tracking-wider">
                          <span className={`px-2 py-1 rounded ${egg.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {egg.enabled ? "enabled" : "disabled"}
                          </span>
                          <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700">{egg.claimPolicy || CLAIM_POLICY.PER_STUDENT_ONCE}</span>
                          <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">Claims: {Number(egg.claimedCount || 0)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => hydrateFormFromEgg(egg)}
                          className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        {manualHints.length > 0 && (
                          <button
                            type="button"
                            onClick={() => activateManualHints(egg)}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          >
                            Release Hints
                          </button>
                        )}

                        {egg.enabled && (
                          <button
                            type="button"
                            onClick={() => archiveEgg(egg)}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          >
                            Archive
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteEgg(egg)}
                          className="px-3 py-2 rounded-lg text-xs font-bold border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="font-bold text-slate-600 mb-1">Anchors</p>
                        <p className="text-slate-500 font-mono">{(egg.anchorIds || []).join(", ") || "None"}</p>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="font-bold text-slate-600 mb-1 flex items-center gap-1"><Clock3 size={12} /> Schedule</p>
                        <p className="text-slate-500">
                          {startAt ? startAt.toLocaleString() : "No start"} - {endAt ? endAt.toLocaleString() : "No end"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="font-bold text-slate-600 mb-1">Rewards</p>
                        <p className="text-slate-500">XP {Number(egg?.rewards?.xp || 0)} | ${Number(egg?.rewards?.currency || 0)}</p>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="font-bold text-slate-600 mb-1">Hints</p>
                        <p className="text-slate-500">
                          {egg?.hints?.enabled
                            ? `Scheduled ${egg?.hints?.scheduled?.length || 0}, Manual ${egg?.hints?.manual?.length || 0}, Purchasable ${egg?.hints?.purchasable?.length || 0}`
                            : "Disabled"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="theme-surface border theme-border rounded-2xl p-6 shadow-sm text-sm theme-muted">
          <p className="font-bold mb-2">Operator Notes</p>
          <ul className="space-y-1 list-disc pl-5">
            <li>Anchors are globally locked while an egg is active or scheduled. Archive/disable an egg to release anchors.</li>
            <li>Delete removes the egg config and releases anchors; it does not delete any legacy hardcoded eggs.</li>
            <li>Legacy hardcoded eggs remain untouched; this page controls new system eggs only.</li>
            <li>Use class scope for targeted drops, and choose claim policy to control redundancy.</li>
            <li>For manual hints, use "Release Hints" per egg or prefix a line with "!" to ship it active.</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
