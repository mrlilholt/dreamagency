import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const FEEDBACK_PATH = path.join(ROOT_DIR, "data", "daily-mission-generator", "feedback-log.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "generated", "daily-missions");

const args = parseArgs(process.argv.slice(2));
const date = args.date || getLocalDateString();
const classId = args.class;
const option = Number(args.option);
const sentiment = args.sentiment || "liked";
const notes = args.notes || "";
const tags = typeof args.tags === "string"
  ? args.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
  : [];

if (!classId) {
  throw new Error("--class is required.");
}

if (!Number.isInteger(option) || option < 1) {
  throw new Error("--option must be a 1-based mission number.");
}

if (!["loved", "liked", "pass", "avoid"].includes(sentiment)) {
  throw new Error("--sentiment must be one of: loved, liked, pass, avoid.");
}

const fileMap = {
  computer_science_quarter_4: "computer-science.json",
  "8th_dream_elective": "dream-elective.json",
  Interdisciplinary_design: "interdisciplinary-design.json"
};

const missionFileName = fileMap[classId];
if (!missionFileName) {
  throw new Error(`Unknown class id: ${classId}`);
}

const missionFilePath = path.join(OUTPUT_DIR, date, missionFileName);
const missions = JSON.parse(fs.readFileSync(missionFilePath, "utf8"));
const mission = missions[option - 1];

if (!mission) {
  throw new Error(`Option ${option} was not found in ${path.relative(ROOT_DIR, missionFilePath)}.`);
}

const feedbackLog = JSON.parse(fs.readFileSync(FEEDBACK_PATH, "utf8"));
const entries = Array.isArray(feedbackLog.entries) ? feedbackLog.entries : [];

entries.push({
  created_at: new Date().toISOString(),
  date,
  class_id: classId,
  option,
  sentiment,
  notes,
  tags,
  title: mission.title,
  trend: extractTrend(mission.title),
  archetype: extractArchetype(mission.title),
  mission
});

fs.writeFileSync(FEEDBACK_PATH, `${JSON.stringify({ entries }, null, 2)}\n`);
console.log(`Saved feedback for ${classId} option ${option} on ${date}`);

function extractTrend(title) {
  const withoutVariant = title.replace(/\s+[AB]$/, "");
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
  if (title.includes("Study Mode Remix")) return "interface remix";
  if (title.includes("Student Power-Up")) return "feature launch";
  if (title.includes("Safe Sharing Check")) return "student safety flow";
  if (title.includes("Better Picks Engine")) return "recommendation system";
  if (title.includes("Creator Dashboard Sprint")) return "creator dashboard";
  if (title.includes("Object Remix")) return "physical product remix";
  if (title.includes("Pop-Up Experience")) return "club pop-up";
  if (title.includes("IRL Experience Build")) return "experience design";
  if (title.includes("Merch Drop Concept")) return "merch drop";
  if (title.includes("Space Makeover")) return "space makeover";
  if (title.includes("Campaign Sprint")) return "campaign concept";
  if (title.includes("Problem Solver")) return "community challenge";
  if (title.includes("Service Redesign")) return "service design";
  if (title.includes("School Fix Challenge")) return "school system fix";
  if (title.includes("Awareness Launch")) return "awareness launch";
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

function getLocalDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}
