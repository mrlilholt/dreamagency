import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "generated", "daily-missions");

const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || getLocalDateString();

const dateDir = path.join(OUTPUT_DIR, targetDate);
const summaryPath = path.join(dateDir, "summary.json");

if (!fs.existsSync(summaryPath)) {
  throw new Error(`Missing summary file for ${targetDate}: ${path.relative(ROOT_DIR, summaryPath)}`);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const files = Array.isArray(summary.files) ? summary.files : [];

if (files.length === 0) {
  console.log(`No mission files listed in summary for ${targetDate}; skipping publish.`);
  process.exit(0);
}

initializeFirebase();

const db = getFirestore();
let publishedCount = 0;
let staleDeletedCount = 0;

for (const fileEntry of files) {
  const filePath = path.join(ROOT_DIR, fileEntry.file);
  if (!fs.existsSync(filePath)) continue;

  const missions = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const classId = fileEntry.class_id || "";
  const keepDocIds = new Set();

  for (let index = 0; index < missions.length; index += 1) {
    const mission = missions[index] || {};
    const option = index + 1;
    const docId = buildSuggestionId({ date: targetDate, classId, option });
    keepDocIds.add(docId);

    const suggestionRef = db.collection("mission_suggestions").doc(docId);
    const existingSnap = await suggestionRef.get();

    const payload = {
      class_id: classId,
      active_date: mission.active_date || targetDate,
      option,
      title: mission.title || "",
      instruction: mission.instruction || "",
      trend: mission.trend || "",
      archetype: mission.archetype || "",
      difficulty: mission.difficulty || "easy",
      code_word: mission.code_word || "",
      reward_cash: Number(mission.reward_cash || 0),
      reward_xp: Number(mission.reward_xp || 0),
      source_file: fileEntry.file,
      source_date: targetDate,
      source: "daily-mission-creator",
      source_generated_at: summary.generated_at || new Date().toISOString(),
      // Reset suggestion-level feedback/import state when content is regenerated
      // so new options do not inherit prior run sentiment.
      score: 0,
      thumbs_up_count: 0,
      thumbs_down_count: 0,
      imported_count: 0,
      imported_mission_ids: [],
      last_feedback_sentiment: null,
      last_feedback_by: null,
      last_feedback_at: null,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (!existingSnap.exists) {
      Object.assign(payload, {
        createdAt: FieldValue.serverTimestamp(),
        published_count: 1
      });
    } else {
      Object.assign(payload, {
        published_count: FieldValue.increment(1)
      });
    }

    await suggestionRef.set(payload, { merge: true });
    publishedCount += 1;
  }

  staleDeletedCount += await cleanupStaleOptions({
    db,
    date: targetDate,
    classId,
    keepDocIds
  });
}

console.log(`Published ${publishedCount} mission suggestions to Firestore for ${targetDate}`);
if (staleDeletedCount > 0) {
  console.log(`Deleted ${staleDeletedCount} stale mission_suggestions docs for ${targetDate}`);
}

function initializeFirebase() {
  if (getApps().length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  const hasServiceAccountJson = Boolean(serviceAccountJson);
  const hasGac = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!hasServiceAccountJson && !hasGac && !projectId) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT_ID."
    );
  }

  const appConfig = {
    credential: hasServiceAccountJson
      ? cert(JSON.parse(serviceAccountJson))
      : applicationDefault()
  };

  if (projectId) {
    appConfig.projectId = projectId;
  }

  initializeApp(appConfig);
}

function buildSuggestionId({ date, classId, option }) {
  const normalizedClass = String(classId || "unassigned").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${date}__${normalizedClass}__${String(option).padStart(2, "0")}`;
}

async function cleanupStaleOptions({ db, date, classId, keepDocIds }) {
  // Remove stale option docs (e.g. __03+) for same date/class.
  const MAX_OPTIONS = 10;
  let deletedCount = 0;
  const batch = db.batch();

  for (let option = 1; option <= MAX_OPTIONS; option += 1) {
    const docId = buildSuggestionId({ date, classId, option });
    if (keepDocIds.has(docId)) continue;
    batch.delete(db.collection("mission_suggestions").doc(docId));
    deletedCount += 1;
  }

  if (deletedCount > 0) {
    await batch.commit();
  }

  return deletedCount;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function getLocalDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}
