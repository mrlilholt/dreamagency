export const DEFAULT_WORK_LOG_REWARD = {
  xp: 500,
  cash: 500
};

export const DEFAULT_WORK_LOG_TIME = "15:20";
export const DEFAULT_WORK_LOG_END_TIME = "16:00";

const GLOBAL_CLASS_IDS = new Set(["all", "global", "all_classes", "all_class"]);

export const normalizeClassId = (value) => {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  return "";
};

export const isGlobalClassId = (value) => GLOBAL_CLASS_IDS.has(normalizeClassId(value));

export const sanitizeDocIdPart = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";

export const buildWorkLogPromptId = ({
  templateId,
  classId,
  promptDate,
  time
}) => [
  sanitizeDocIdPart(templateId || "adhoc"),
  sanitizeDocIdPart(classId || "all"),
  sanitizeDocIdPart(promptDate || "date"),
  sanitizeDocIdPart(time || "time")
].join("__");

export const parseScheduledDateList = (value) => {
  if (!value) return [];
  const parsedDates = String(value)
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));

  return Array.from(new Set(parsedDates)).sort();
};

export const normalizeScheduledDates = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry))
    )
  ).sort();

export const combinePromptDateTime = (dateValue, timeValue = DEFAULT_WORK_LOG_TIME) => {
  if (!dateValue) return null;
  const safeTime = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : DEFAULT_WORK_LOG_TIME;
  const candidate = new Date(`${dateValue}T${safeTime}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

export const getLocalDateString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getPromptScheduledAt = (prompt) => {
  if (!prompt) return null;
  if (typeof prompt?.scheduled_for?.toDate === "function") {
    const date = prompt.scheduled_for.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof prompt?.scheduled_for === "string" || typeof prompt?.scheduled_for === "number") {
    const date = new Date(prompt.scheduled_for);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return combinePromptDateTime(prompt.prompt_date, prompt.prompt_time);
};

export const getPromptEndAt = (prompt) => {
  if (!prompt) return null;
  if (typeof prompt?.end_scheduled_for?.toDate === "function") {
    const date = prompt.end_scheduled_for.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof prompt?.end_scheduled_for === "string" || typeof prompt?.end_scheduled_for === "number") {
    const date = new Date(prompt.end_scheduled_for);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (prompt?.prompt_end_time) {
    return combinePromptDateTime(prompt.prompt_date, prompt.prompt_end_time || DEFAULT_WORK_LOG_END_TIME);
  }
  const scheduledAt = getPromptScheduledAt(prompt);
  if (!scheduledAt) return null;
  return new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
};

export const getPromptDateKey = (prompt) => {
  if (prompt?.prompt_date) return String(prompt.prompt_date);
  const scheduledAt = getPromptScheduledAt(prompt);
  return scheduledAt ? getLocalDateString(scheduledAt) : "";
};

export const promptMatchesClasses = (prompt, classIds = []) => {
  const promptClassId = normalizeClassId(prompt?.class_id);
  if (!promptClassId) return false;
  if (isGlobalClassId(promptClassId)) return true;
  return classIds.some((classId) => normalizeClassId(classId) === promptClassId);
};

export const isWorkLogPromptOpen = (prompt, now = new Date()) => {
  if (!prompt || `${prompt.status || "active"}`.toLowerCase() !== "active") {
    return false;
  }
  const scheduledAt = getPromptScheduledAt(prompt);
  const endAt = getPromptEndAt(prompt);
  if (!scheduledAt || !endAt) return false;
  return scheduledAt.getTime() <= now.getTime() && now.getTime() <= endAt.getTime();
};

export const normalizeWorkLogEntries = (entries = []) =>
  entries
    .map((entry) => ({
      title: String(entry?.title || "").trim(),
      notes: String(entry?.notes || "").trim(),
      evidence_link: String(entry?.evidence_link || "").trim()
    }))
    .filter((entry) => entry.notes);
