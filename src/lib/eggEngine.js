export const EGG_SCOPE = {
  GLOBAL: "global",
  CLASS: "class_specific"
};

export const EGG_STATUS = {
  DRAFT: "draft",
  LIVE: "live",
  ARCHIVED: "archived"
};

export const CLAIM_POLICY = {
  PER_STUDENT_ONCE: "per_student_once",
  PER_CLASS_ONCE: "per_class_once",
  FIRST_N_GLOBAL: "first_n_global",
  ALL_STUDENTS_IN_SCOPE: "all_students_in_scope"
};

export const TRIGGER_TYPE = {
  SINGLE_CLICK: "single_click",
  MULTI_CLICK: "multi_click",
  ORDERED_SEQUENCE: "ordered_sequence",
  TIMED_SEQUENCE: "timed_sequence",
  TEXT_ANSWER: "text_answer"
};

export const parseEggDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeAnswer = (value, caseSensitive = false) => {
  const raw = `${value || ""}`.trim();
  return caseSensitive ? raw : raw.toLowerCase();
};

export const hashAnswer = async (value, salt = "") => {
  const source = `${salt}::${value}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(source);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const buildDefaultEggProgress = () => ({
  stageIndex: 0,
  state: {},
  unlockedHintIds: [],
  completed: false
});

const cleanList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

export const getEggStages = (egg) => {
  const stages = Array.isArray(egg?.stages) ? egg.stages.filter(Boolean) : [];
  if (stages.length > 0) return stages;

  // Compatibility fallback for early docs with a top-level trigger.
  if (egg?.trigger && egg.trigger.type) {
    return [{ ...egg.trigger }];
  }

  return [];
};

export const getEggAnchorIds = (egg) => {
  const topLevelAnchorIds = cleanList(egg?.anchorIds);
  const stages = getEggStages(egg);
  const fromStages = stages.flatMap((stage) => {
    if (stage.type === TRIGGER_TYPE.ORDERED_SEQUENCE || stage.type === TRIGGER_TYPE.TIMED_SEQUENCE) {
      return cleanList(stage.sequence);
    }
    return cleanList(stage.anchorId);
  });
  return Array.from(new Set([...topLevelAnchorIds, ...fromStages]));
};

export const getUserClassIds = (userData) => {
  if (!userData) return [];
  const values = [
    userData.class_id,
    userData.classId,
    userData.active_class_id,
    ...(Array.isArray(userData.class_ids) ? userData.class_ids : []),
    ...(Array.isArray(userData.classIds) ? userData.classIds : []),
    ...(Array.isArray(userData.enrolled_classes) ? userData.enrolled_classes : []),
    ...(Array.isArray(userData.enrolledClasses) ? userData.enrolledClasses : [])
  ];
  return Array.from(new Set(values.map((value) => `${value || ""}`.trim()).filter(Boolean)));
};

export const getMatchingClassId = (egg, userData) => {
  if (!egg || !userData) return null;
  if (egg.scope !== EGG_SCOPE.CLASS) return null;
  const classIds = cleanList(egg.classIds);
  const userClasses = getUserClassIds(userData);
  return userClasses.find((classId) => classIds.includes(classId)) || null;
};

export const eggAppliesToUser = (egg, userData) => {
  if (!egg) return false;
  if (!userData) return false;

  const role = userData.role || "associate";
  const allowedRoles = cleanList(egg.allowedRoles);
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return false;
  }

  if (egg.scope === EGG_SCOPE.CLASS) {
    const match = getMatchingClassId(egg, userData);
    return !!match;
  }

  return true;
};

export const isEggActiveNow = (egg, now = new Date()) => {
  if (!egg) return false;
  if (egg.enabled === false) return false;
  const status = egg.status || EGG_STATUS.LIVE;
  if (status === EGG_STATUS.ARCHIVED) return false;
  if (status === EGG_STATUS.DRAFT) return false;

  const startAt = parseEggDate(egg.startAt || egg.startsAt);
  const endAt = parseEggDate(egg.endAt || egg.endsAt);

  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;

  return true;
};

export const isEggCurrentlyLockingAnchors = (egg, now = new Date()) => {
  if (!egg) return false;
  if (egg.enabled === false) return false;
  const status = egg.status || EGG_STATUS.LIVE;
  if (status === EGG_STATUS.ARCHIVED) return false;
  if (status === EGG_STATUS.DRAFT) return false;

  const startAt = parseEggDate(egg.startAt || egg.startsAt);
  const endAt = parseEggDate(egg.endAt || egg.endsAt);

  if (endAt && endAt < now) return false;
  if (startAt && startAt > now) {
    // Future scheduled eggs still reserve anchors to prevent duplicate drops.
    return true;
  }

  return true;
};

const completeCurrentStage = ({ stages, stageIndex }) => {
  const nextStageIndex = stageIndex + 1;
  if (nextStageIndex >= stages.length) {
    return {
      stageIndex: nextStageIndex,
      state: {},
      completed: true,
      status: "ready_to_claim"
    };
  }

  return {
    stageIndex: nextStageIndex,
    state: {},
    completed: false,
    status: "stage_advanced"
  };
};

export const applyAnchorInteraction = ({ egg, progress, anchorId, now = new Date() }) => {
  const stages = getEggStages(egg);
  const safeProgress = progress || buildDefaultEggProgress();
  const stageIndex = Number(safeProgress.stageIndex || 0);

  if (stages.length === 0) {
    return {
      updatedProgress: { ...safeProgress, completed: true },
      status: "ready_to_claim",
      changed: true
    };
  }

  if (stageIndex >= stages.length || safeProgress.completed) {
    return {
      updatedProgress: { ...safeProgress, completed: true },
      status: "ready_to_claim",
      changed: false
    };
  }

  const stage = stages[stageIndex];
  const state = { ...(safeProgress.state || {}) };
  const nowMs = now.getTime();

  if (!anchorId) {
    return {
      updatedProgress: safeProgress,
      status: "noop",
      changed: false
    };
  }

  if (stage.type === TRIGGER_TYPE.SINGLE_CLICK) {
    if (stage.anchorId !== anchorId) {
      return { updatedProgress: safeProgress, status: "noop", changed: false };
    }
    const completion = completeCurrentStage({ stages, stageIndex });
    return {
      updatedProgress: {
        ...safeProgress,
        stageIndex: completion.stageIndex,
        state: completion.state,
        completed: completion.completed
      },
      status: completion.status,
      changed: true
    };
  }

  if (stage.type === TRIGGER_TYPE.MULTI_CLICK) {
    if (stage.anchorId !== anchorId) {
      return { updatedProgress: safeProgress, status: "noop", changed: false };
    }

    const requiredClicks = Math.max(2, Number(stage.clickCount || 5));
    const windowMs = Math.max(300, Number(stage.windowMs || 1200));
    const existingCount = Number(state.clickCount || 0);
    const existingStartedAt = Number(state.windowStartedAtMs || 0);
    const expired = !existingStartedAt || nowMs - existingStartedAt > windowMs;

    const clickCount = expired ? 1 : existingCount + 1;
    const windowStartedAtMs = expired ? nowMs : existingStartedAt;

    if (clickCount >= requiredClicks) {
      const completion = completeCurrentStage({ stages, stageIndex });
      return {
        updatedProgress: {
          ...safeProgress,
          stageIndex: completion.stageIndex,
          state: completion.state,
          completed: completion.completed
        },
        status: completion.status,
        changed: true
      };
    }

    return {
      updatedProgress: {
        ...safeProgress,
        state: {
          ...state,
          clickCount,
          windowStartedAtMs
        }
      },
      status: "progress_updated",
      changed: true
    };
  }

  if (stage.type === TRIGGER_TYPE.ORDERED_SEQUENCE || stage.type === TRIGGER_TYPE.TIMED_SEQUENCE) {
    const sequence = cleanList(stage.sequence);
    if (sequence.length === 0) {
      return { updatedProgress: safeProgress, status: "noop", changed: false };
    }

    const currentIndex = Number(state.sequenceIndex || 0);
    const expectedAnchor = sequence[currentIndex] || sequence[0];
    const timeLimitMs = Math.max(1000, Number(stage.timeLimitMs || 12000));
    const startedAtMs = Number(state.sequenceStartedAtMs || 0);

    let nextIndex = currentIndex;
    let nextStartedAtMs = startedAtMs;

    if (stage.type === TRIGGER_TYPE.TIMED_SEQUENCE) {
      const hasStarted = currentIndex > 0;
      if (hasStarted && startedAtMs && nowMs - startedAtMs > timeLimitMs) {
        nextIndex = 0;
        nextStartedAtMs = 0;
      }
    }

    const expectedAfterReset = sequence[nextIndex] || sequence[0];

    if (anchorId === expectedAfterReset) {
      if (nextIndex === 0) {
        nextStartedAtMs = nowMs;
      }
      nextIndex += 1;

      if (nextIndex >= sequence.length) {
        const completion = completeCurrentStage({ stages, stageIndex });
        return {
          updatedProgress: {
            ...safeProgress,
            stageIndex: completion.stageIndex,
            state: completion.state,
            completed: completion.completed
          },
          status: completion.status,
          changed: true
        };
      }

      return {
        updatedProgress: {
          ...safeProgress,
          state: {
            ...state,
            sequenceIndex: nextIndex,
            sequenceStartedAtMs: nextStartedAtMs
          }
        },
        status: "progress_updated",
        changed: true
      };
    }

    // Wrong click: allow restarting if they hit the first anchor.
    if (anchorId === sequence[0]) {
      return {
        updatedProgress: {
          ...safeProgress,
          state: {
            ...state,
            sequenceIndex: 1,
            sequenceStartedAtMs: nowMs
          }
        },
        status: "progress_updated",
        changed: true
      };
    }

    return {
      updatedProgress: {
        ...safeProgress,
        state: {
          ...state,
          sequenceIndex: 0,
          sequenceStartedAtMs: 0
        }
      },
      status: "progress_reset",
      changed: true
    };
  }

  if (stage.type === TRIGGER_TYPE.TEXT_ANSWER) {
    if (stage.anchorId !== anchorId) {
      return { updatedProgress: safeProgress, status: "noop", changed: false };
    }

    return {
      updatedProgress: {
        ...safeProgress,
        state: {
          ...state,
          awaitingAnswer: true
        }
      },
      status: "awaiting_answer",
      changed: true
    };
  }

  return {
    updatedProgress: safeProgress,
    status: "noop",
    changed: false
  };
};

export const applyAnswerInteraction = async ({ egg, progress, answer, now = new Date() }) => {
  const stages = getEggStages(egg);
  const safeProgress = progress || buildDefaultEggProgress();
  const stageIndex = Number(safeProgress.stageIndex || 0);

  if (stages.length === 0 || stageIndex >= stages.length) {
    return {
      updatedProgress: { ...safeProgress, completed: true },
      status: "ready_to_claim",
      changed: false
    };
  }

  const stage = stages[stageIndex];
  if (stage.type !== TRIGGER_TYPE.TEXT_ANSWER) {
    return {
      updatedProgress: safeProgress,
      status: "noop",
      changed: false
    };
  }

  const state = { ...(safeProgress.state || {}) };
  const normalizedInput = normalizeAnswer(answer, !!stage.caseSensitive);
  const salt = stage.answerSalt || "";
  const inputHash = await hashAnswer(normalizedInput, salt);
  const expectedHash = `${stage.answerHash || ""}`;

  if (!expectedHash || inputHash !== expectedHash) {
    return {
      updatedProgress: {
        ...safeProgress,
        state: {
          ...state,
          awaitingAnswer: true
        }
      },
      status: "incorrect_answer",
      changed: false
    };
  }

  const completion = completeCurrentStage({ stages, stageIndex });
  return {
    updatedProgress: {
      ...safeProgress,
      stageIndex: completion.stageIndex,
      state: completion.state,
      completed: completion.completed
    },
    status: completion.status,
    changed: true
  };
};

export const getVisibleHints = ({ egg, progress, now = new Date() }) => {
  const hints = egg?.hints || {};
  if (!hints.enabled) {
    return {
      visibleHints: [],
      nextPurchasableHint: null,
      canUnlockMore: false
    };
  }

  const unlockedSet = new Set(Array.isArray(progress?.unlockedHintIds) ? progress.unlockedHintIds : []);

  const scheduled = cleanList(hints.scheduled)
    .map((hint) => ({ ...hint, kind: "scheduled" }))
    .filter((hint) => {
      const revealAt = parseEggDate(hint.revealAt);
      return revealAt ? now >= revealAt : false;
    });

  const manual = cleanList(hints.manual)
    .map((hint) => ({ ...hint, kind: "manual" }))
    .filter((hint) => hint.enabled === true);

  const purchasableAll = cleanList(hints.purchasable).map((hint) => ({ ...hint, kind: "purchasable" }));
  const purchased = purchasableAll.filter((hint) => unlockedSet.has(hint.id));
  const nextPurchasableHint = purchasableAll.find((hint) => !unlockedSet.has(hint.id)) || null;

  return {
    visibleHints: [...scheduled, ...manual, ...purchased],
    nextPurchasableHint,
    canUnlockMore: !!nextPurchasableHint
  };
};
