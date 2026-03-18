import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT_DIR = process.cwd();
const FEEDBACK_PATH = path.join(ROOT_DIR, "data", "daily-mission-generator", "feedback-log.json");
const args = parseArgs(process.argv.slice(2));
const lookbackDays = Number(args.days || 45);

if (!Number.isFinite(lookbackDays) || lookbackDays < 1) {
  throw new Error("--days must be a positive number.");
}

initializeFirebase();
const db = getFirestore();
const snap = await db.collection("mission_suggestion_feedback").get();

const existing = readJsonSafe(FEEDBACK_PATH);
const existingEntries = Array.isArray(existing.entries) ? existing.entries : [];
const seenIds = new Set(existingEntries.map((entry) => entry.feedback_doc_id).filter(Boolean));
const cutoffMs = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);

let imported = 0;

for (const docSnap of snap.docs) {
  if (seenIds.has(docSnap.id)) continue;
  const data = docSnap.data() || {};

  const createdAtMs = toTimeMs(data.createdAt);
  if (createdAtMs && createdAtMs < cutoffMs) continue;

  const sentiment = normalizeSentiment(data.sentiment, data.sentiment_label);
  if (!sentiment) continue;

  const classId = data.class_id || "";
  if (!classId) continue;

  const title = data.title || "Untitled suggestion";
  const trend = data.trend || extractTrend(title);
  const archetype = data.archetype || extractArchetype(title);

  existingEntries.push({
    feedback_doc_id: docSnap.id,
    created_at: toIso(data.createdAt),
    date: data.source_date || getDateFromMillis(createdAtMs),
    class_id: classId,
    option: Number.isInteger(Number(data.option)) ? Number(data.option) : null,
    sentiment,
    notes: String(data.notes || "").trim(),
    tags: ["firestore_feedback"],
    title,
    trend,
    archetype
  });
  imported += 1;
}

existingEntries.sort((a, b) => {
  const aTime = new Date(a.created_at || 0).getTime();
  const bTime = new Date(b.created_at || 0).getTime();
  return aTime - bTime;
});

const payload = {
  ...existing,
  entries: existingEntries
};

fs.writeFileSync(FEEDBACK_PATH, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Synced mission feedback from Firestore: imported ${imported}, total ${existingEntries.length}`);

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
    credential: hasServiceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault()
  };
  if (projectId) appConfig.projectId = projectId;

  initializeApp(appConfig);
}

function normalizeSentiment(sentiment, label) {
  const raw = String(label || sentiment || "").toLowerCase().trim();
  if (["loved", "liked", "pass", "avoid"].includes(raw)) return raw;
  if (raw === "up") return "liked";
  if (raw === "down") return "avoid";
  return "";
}

function toIso(timestampValue) {
  if (!timestampValue) return new Date().toISOString();
  if (typeof timestampValue?.toDate === "function") return timestampValue.toDate().toISOString();
  const parsed = new Date(timestampValue);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toTimeMs(timestampValue) {
  if (!timestampValue) return 0;
  if (typeof timestampValue?.toMillis === "function") return timestampValue.toMillis();
  if (typeof timestampValue?.toDate === "function") return timestampValue.toDate().getTime();
  const parsed = new Date(timestampValue);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getDateFromMillis(ms) {
  if (!ms) return getLocalDateString();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date(ms));
}

function extractTrend(title) {
  const withoutVariant = String(title || "").replace(/\s+[AB]$/, "");
  const patterns = [
    "Study Mode Remix",
    "Student Power-Up",
    "Safe Sharing Check",
    "Better Picks Engine",
    "Creator Dashboard Sprint",
    "Object Remix",
    "Pop-Up Experience",
    "IRL Experience Build",
    "Merch Drop Concept",
    "Space Makeover",
    "Campaign Sprint",
    "Problem Solver",
    "Service Redesign",
    "School Fix Challenge",
    "Awareness Launch"
  ];

  for (const pattern of patterns) {
    if (withoutVariant.endsWith(pattern)) {
      return withoutVariant.slice(0, -pattern.length).trim();
    }
  }

  return withoutVariant;
}

function extractArchetype(title) {
  const value = String(title || "");
  if (value.includes("Study Mode Remix")) return "interface remix";
  if (value.includes("Student Power-Up")) return "feature launch";
  if (value.includes("Safe Sharing Check")) return "student safety flow";
  if (value.includes("Better Picks Engine")) return "recommendation system";
  if (value.includes("Creator Dashboard Sprint")) return "creator dashboard";
  if (value.includes("Object Remix")) return "physical product remix";
  if (value.includes("Pop-Up Experience")) return "club pop-up";
  if (value.includes("IRL Experience Build")) return "experience design";
  if (value.includes("Merch Drop Concept")) return "merch drop";
  if (value.includes("Space Makeover")) return "space makeover";
  if (value.includes("Campaign Sprint")) return "campaign concept";
  if (value.includes("Problem Solver")) return "community challenge";
  if (value.includes("Service Redesign")) return "service design";
  if (value.includes("School Fix Challenge")) return "school system fix";
  if (value.includes("Awareness Launch")) return "awareness launch";
  return "unknown";
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

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return { entries: [] };
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
