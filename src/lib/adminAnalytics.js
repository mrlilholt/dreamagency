import { getUserClassIds } from "./eggEngine";

const ADMIN_ROLES = new Set([
  "admin",
  "teacher",
  "super_admin",
  "department_admin"
]);

const GLOBAL_CLASS_IDS = new Set(["all", "global", "all_classes", "all_class"]);

const STATUS_PRIORITY = {
  pending_review: 0,
  active: 1,
  in_progress: 1,
  returned: 2,
  rejected: 2,
  completed: 3,
  scheduled: 4,
  not_started: 5
};

const normalizeWorkStatus = (status) => {
  if (!status || status === "open") return "live";
  return `${status}`.trim().toLowerCase();
};

export const normalizeClassId = (value) => {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  return "";
};

export const isGlobalClassId = (value) => GLOBAL_CLASS_IDS.has(normalizeClassId(value));

export const isAdminUser = (userData) => {
  const role = `${userData?.role || ""}`.trim().toLowerCase();
  return ADMIN_ROLES.has(role);
};

export const getStudentName = (userData = {}) =>
  userData.displayName || userData.name || userData.email || "Unknown Agent";

export const getStudentXp = (userData = {}) =>
  Number(userData.xp ?? userData.experience ?? 0);

export const getStudentCurrency = (userData = {}) =>
  Number(userData.currency ?? userData.balance ?? 0);

export const studentMatchesClass = (student, classId) => {
  const targetClassId = normalizeClassId(classId);
  if (!targetClassId) return false;
  return getUserClassIds(student).some(
    (candidate) => normalizeClassId(candidate) === targetClassId
  );
};

export const itemMatchesClass = (item, classId) => {
  const targetClassId = normalizeClassId(classId);
  const itemClassId = normalizeClassId(item?.class_id ?? item?.classId);
  if (!targetClassId || !itemClassId) return false;
  return itemClassId === targetClassId || isGlobalClassId(itemClassId);
};

export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

export const formatDateLabel = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

export const formatDateTimeLabel = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

export const getSubmissionLinks = (job) => {
  const stages = job?.stages || {};
  return Object.entries(stages)
    .map(([stageNumber, stage]) => {
      const link =
        stage?.submission_content
        || stage?.submission_link
        || stage?.link
        || stage?.url;
      if (!link) return null;
      return {
        stageNumber,
        stageName: stage?.name || `Stage ${stageNumber}`,
        status: stage?.status || "submitted",
        link
      };
    })
    .filter(Boolean);
};

const getStageEntries = (job) => {
  if (!job?.stages || typeof job.stages !== "object") return [];
  return Object.entries(job.stages)
    .map(([stageNumber, stage]) => ({
      stageNumber: Number(stageNumber) || 0,
      name: stage?.name || `Stage ${stageNumber}`,
      status: stage?.status || "locked",
      submittedAt: toDate(stage?.submitted_at),
      completedAt: toDate(stage?.completedAt),
      data: stage
    }))
    .sort((a, b) => a.stageNumber - b.stageNumber);
};

const getStatusPriority = (status) => {
  const key = `${status || "not_started"}`.trim().toLowerCase();
  return STATUS_PRIORITY[key] ?? STATUS_PRIORITY.not_started;
};

export const getContractProgress = (job) => {
  const stages = getStageEntries(job);
  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const returnedStages = stages.filter((stage) =>
    stage.status === "returned" || stage.status === "rejected"
  ).length;
  const pendingStages = stages.filter((stage) => stage.status === "pending_review").length;
  const activeStage =
    stages.find((stage) => stage.stageNumber === Number(job?.current_stage))
    || stages.find((stage) => stage.status === "active" || stage.status === "pending_review")
    || stages[0]
    || null;

  const submittedDates = stages
    .map((stage) => stage.submittedAt)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  const completedDates = stages
    .map((stage) => stage.completedAt)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    totalStages: stages.length,
    completedStages,
    returnedStages,
    pendingStages,
    progressPercent: stages.length
      ? Math.round((completedStages / stages.length) * 100)
      : 0,
    currentStageLabel: activeStage
      ? `Stage ${activeStage.stageNumber}: ${activeStage.name}`
      : "Not started",
    lastSubmittedAt: submittedDates[0] || null,
    lastCompletedAt: completedDates[0] || null
  };
};

const getContractStatusLabel = (job) => {
  if (!job) return "Not started";
  if (job.status === "completed") return "Completed";
  if (job.status === "pending_review") return "Pending review";
  if (job.status === "returned") return "Returned";
  if (job.status === "active" || job.status === "in_progress") return "In progress";
  return job.status || "In progress";
};

const isFutureScheduledItem = (item) => {
  const normalizedStatus = normalizeWorkStatus(item?.status);
  if (normalizedStatus !== "scheduled") return false;
  const scheduledDate = item?.scheduled_date
    ? toDate(`${item.scheduled_date}T12:00:00`)
    : null;
  if (!scheduledDate) return true;
  return scheduledDate > new Date();
};

const getMissionStatusLabel = (mission, completed) => {
  if (completed) return "Completed";
  const missionDate = mission?.active_date
    ? toDate(`${mission.active_date}T12:00:00`)
    : null;
  if (missionDate && missionDate > new Date()) return "Scheduled";
  return "Not completed";
};

const getSideHustleStatusLabel = (job, completed) => {
  if (!job) return "Not started";
  if (completed) return "Completed";
  if (job.status === "pending_review") return "Pending review";
  if (`${job.status_message || ""}`.toLowerCase().startsWith("returned")) {
    return "Returned";
  }
  if (job.status === "active") return "In progress";
  return job.status || "In progress";
};

const sortByStatusThenTitle = (rows) =>
  [...rows].sort((left, right) => {
    const statusDiff = getStatusPriority(left.statusKey) - getStatusPriority(right.statusKey);
    if (statusDiff !== 0) return statusDiff;
    return `${left.title || ""}`.localeCompare(`${right.title || ""}`);
  });

export const buildStudentWorkReport = ({
  student,
  classId,
  contracts = [],
  missions = [],
  sideHustles = [],
  studentJobs = [],
  studentSideHustleJobs = [],
  studentWorkLogs = []
}) => {
  const completedMissionIds = new Set(
    Array.isArray(student?.completed_missions) ? student.completed_missions : []
  );

  const contractJobsById = {};
  studentJobs.forEach((job) => {
    if (job?.contract_id) {
      contractJobsById[job.contract_id] = job;
    }
  });

  const sideHustleJobsById = {};
  studentSideHustleJobs.forEach((job) => {
    if (job?.side_hustle_id) {
      sideHustleJobsById[job.side_hustle_id] = job;
    }
  });

  const contractRows = sortByStatusThenTitle(
    contracts
      .filter((contract) => itemMatchesClass(contract, classId))
      .map((contract) => {
        const job = contractJobsById[contract.id];
        const progress = getContractProgress(job);
        const completed = job?.status === "completed";
        const definedStageCount = Array.isArray(contract?.stages)
          ? contract.stages.length
          : contract?.stages && typeof contract.stages === "object"
            ? Object.keys(contract.stages).length
            : 0;
        const scheduled = !job && isFutureScheduledItem(contract);
        return {
          id: contract.id,
          title: contract.title || "Untitled Contract",
          job,
          started: Boolean(job),
          completed,
          statusKey: scheduled ? "scheduled" : job?.status || "not_started",
          statusLabel: scheduled ? "Scheduled" : getContractStatusLabel(job),
          progressLabel: job
            ? `${progress.completedStages}/${progress.totalStages || 0} stages`
            : `0/${definedStageCount} stages`,
          currentStageLabel: job ? progress.currentStageLabel : "Not started",
          startedAt: toDate(job?.started_at),
          lastSubmittedAt: progress.lastSubmittedAt,
          completedAt: toDate(job?.completedAt) || progress.lastCompletedAt,
          submissionLinks: getSubmissionLinks(job),
          progressPercent: progress.progressPercent,
          countsTowardProductivity: !scheduled
        };
      })
  );

  const missionRows = missions
    .filter((mission) => itemMatchesClass(mission, classId))
    .map((mission) => {
      const completed = completedMissionIds.has(mission.id);
      const missionDate = mission?.active_date
        ? toDate(`${mission.active_date}T12:00:00`)
        : null;
      const scheduled = Boolean(missionDate && missionDate > new Date());
      const statusKey = completed
        ? "completed"
        : scheduled
          ? "scheduled"
          : "not_started";
      return {
        id: mission.id,
        title: mission.title || "Untitled Mission",
        completed,
        statusKey,
        statusLabel: getMissionStatusLabel(mission, completed),
        activeDate: mission.active_date || "",
        rewardXp: Number(mission.reward_xp || 0),
        rewardCash: Number(mission.reward_cash || 0),
        countsTowardProductivity: !scheduled
      };
    })
    .sort((left, right) => `${right.activeDate || ""}`.localeCompare(`${left.activeDate || ""}`));

  const sideHustleRows = sortByStatusThenTitle(
    sideHustles
      .filter((sideHustle) => itemMatchesClass(sideHustle, classId))
      .map((sideHustle) => {
        const job = sideHustleJobsById[sideHustle.id];
        const completed =
          Number(job?.completed_count || 0) > 0 || Boolean(toDate(job?.last_approved_at));
        const scheduled = !job && isFutureScheduledItem(sideHustle);
        return {
          id: sideHustle.id,
          title: sideHustle.title || "Untitled Side Hustle",
          job,
          completed,
          statusKey: completed
            ? "completed"
            : scheduled
              ? "scheduled"
              : job?.status || "not_started",
          statusLabel: scheduled ? "Scheduled" : getSideHustleStatusLabel(job, completed),
          progressLabel: completed ? "1/1 complete" : "0/1 complete",
          currentLevel: Number(job?.current_level || 1),
          completedCount: Number(job?.completed_count || 0),
          lastSubmittedAt: toDate(job?.submitted_at),
          lastApprovedAt: toDate(job?.last_approved_at),
          countsTowardProductivity: !scheduled
        };
      })
  );

  const workLogRows = studentWorkLogs
    .filter((entry) => itemMatchesClass(entry, classId))
    .map((entry) => ({
      id: entry.id,
      title: entry.title || "Daily Work Log",
      logDate: entry.log_date || entry.prompt_date || "",
      promptTime: entry.prompt_time || "",
      submittedAt: toDate(entry.submittedAt),
      rewardXp: Number(entry.reward_xp || 0),
      rewardCash: Number(entry.reward_cash || 0),
      entries: Array.isArray(entry.entries) ? entry.entries : [],
      entryCount: Array.isArray(entry.entries) ? entry.entries.length : 0
    }))
    .sort((left, right) => `${right.logDate || ""}`.localeCompare(`${left.logDate || ""}`));

  const contractCompletedCount = contractRows.filter((row) => row.completed).length;
  const missionCompletedCount = missionRows.filter((row) => row.completed).length;
  const sideHustleCompletedCount = sideHustleRows.filter((row) => row.completed).length;

  const completedWorkCount =
    contractRows.filter((row) => row.completed && row.countsTowardProductivity).length
    + missionRows.filter((row) => row.completed && row.countsTowardProductivity).length
    + sideHustleRows.filter((row) => row.completed && row.countsTowardProductivity).length;
  const availableWorkCount =
    contractRows.filter((row) => row.countsTowardProductivity).length
    + missionRows.filter((row) => row.countsTowardProductivity).length
    + sideHustleRows.filter((row) => row.countsTowardProductivity).length;
  const autoProductivityScore = availableWorkCount
    ? Math.round((completedWorkCount / availableWorkCount) * 100)
    : 0;

  return {
    contractRows,
    missionRows,
    sideHustleRows,
    workLogRows,
    contractCompletedCount,
    missionCompletedCount,
    sideHustleCompletedCount,
    completedWorkCount,
    availableWorkCount,
    autoProductivityScore
  };
};
