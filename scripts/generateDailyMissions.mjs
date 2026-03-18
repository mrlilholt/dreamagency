import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data", "daily-mission-generator");
const OUTPUT_DIR = path.join(ROOT_DIR, "generated", "daily-missions");
const PREFERENCES_PATH = path.join(DATA_DIR, "preferences.json");
const FEEDBACK_PATH = path.join(DATA_DIR, "feedback-log.json");

const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || getLocalDateString();
const optionsPerClass = Number(args.options || 2);

if (!Number.isFinite(optionsPerClass) || optionsPerClass < 1) {
  throw new Error("--options must be a positive number.");
}

maybeSyncFeedbackFromFirestore({ args });

const preferences = readJson(PREFERENCES_PATH);
const feedbackLog = readJson(FEEDBACK_PATH);
const feedbackEntries = Array.isArray(feedbackLog.entries) ? feedbackLog.entries : [];

const trendScores = buildTrendScores(preferences, feedbackEntries);
const classFeedback = buildClassFeedback(feedbackEntries);
const outputDateDir = path.join(OUTPUT_DIR, targetDate);

fs.mkdirSync(outputDateDir, { recursive: true });

const summary = {
  generated_at: new Date().toISOString(),
  active_date: targetDate,
  options_per_class: optionsPerClass,
  files: []
};

for (const [classId, classConfig] of Object.entries(preferences.classes || {})) {
  const missions = buildClassMissions({
    classId,
    classConfig,
    preferences,
    targetDate,
    optionsPerClass,
    trendScores,
    classFeedback: classFeedback.get(classId) || defaultClassFeedback()
  });

  const outputPath = path.join(outputDateDir, `${classConfig.fileKey}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(missions, null, 2)}\n`);
  summary.files.push({
    class_id: classId,
    file: path.relative(ROOT_DIR, outputPath),
    mission_count: missions.length
  });
}

const feedbackTemplate = buildFeedbackTemplate(summary.files, targetDate);
fs.writeFileSync(
  path.join(outputDateDir, "feedback-template.json"),
  `${JSON.stringify(feedbackTemplate, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outputDateDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`
);

console.log(`Generated daily mission options for ${targetDate}`);
for (const fileEntry of summary.files) {
  console.log(`- ${fileEntry.class_id}: ${fileEntry.file}`);
}
console.log(`- feedback template: ${path.relative(ROOT_DIR, path.join(outputDateDir, "feedback-template.json"))}`);
maybePublishSuggestions({ targetDate, args });

function buildClassMissions({
  classId,
  classConfig,
  preferences,
  targetDate,
  optionsPerClass,
  trendScores,
  classFeedback
}) {
  const trendOffset = computeOffset(`${targetDate}:${classId}:trend`);
  const archetypeOffset = computeOffset(`${targetDate}:${classId}:archetype`);
  const trendPool = scoreAndSortTrends({
    baseTrends: preferences.trendPool || [],
    trendScores,
    classLikes: classFeedback.likedTrends,
    classAvoids: classFeedback.avoidedTrends,
    offset: trendOffset
  });

  const archetypePool = scoreAndSortArchetypes(classConfig.archetypes || [], classFeedback, archetypeOffset);
  const missions = [];

  for (let index = 0; index < optionsPerClass; index += 1) {
    const trend = trendPool[index % trendPool.length] || "Spotify";
    const archetype = archetypePool[index % archetypePool.length] || "feature launch";
    const variant = index % 2 === 0 ? "A" : "B";

    missions.push(
      createMission({
        classId,
        classConfig,
        targetDate,
        trend,
        archetype,
        variant,
        rewardDefaults: preferences.rewardDefaults || {}
      })
    );
  }

  return missions;
}

function createMission({ classId, classConfig, targetDate, trend, archetype, variant, rewardDefaults }) {
  const missionDetails = buildMissionDetails(classConfig, trend, archetype, variant);
  return {
    title: missionDetails.title,
    instruction: missionDetails.instruction,
    trend,
    archetype,
    code_word: buildCodeWord(trend, archetype),
    reward_cash: Number(rewardDefaults.reward_cash) || 15,
    reward_xp: Number(rewardDefaults.reward_xp) || 20,
    class_id: classId,
    active_date: targetDate
  };
}

function buildMissionDetails(classConfig, trend, archetype, variant) {
  const className = classConfig.name;

  if (classConfig.fileKey === "computer-science") {
    return buildComputerScienceMission(className, trend, archetype, variant);
  }

  if (classConfig.fileKey === "dream-elective") {
    return buildDreamMission(className, trend, archetype, variant);
  }

  return buildInterdisciplinaryMission(className, trend, archetype, variant);
}

function buildComputerScienceMission(className, trend, archetype, variant) {
  const titleMap = {
    "interface remix": `${trend} Study Mode Remix`,
    "feature launch": `${trend} Student Power-Up`,
    "student safety flow": `${trend} Safe Sharing Check`,
    "recommendation system": `${trend} Better Picks Engine`,
    "creator dashboard": `${trend} Creator Dashboard Sprint`
  };

  const instructionMap = {
    "interface remix": `For ${className}, sketch one mobile screen and one small interaction that redesign ${trend} for students who need less distraction during homework time. Label the main button, the most important info, and one feature that makes the flow feel calmer.`,
    "feature launch": `Sketch a new ${trend} feature that would make middle school students say, "I would actually use that." Show the main screen, one tap path, and the moment the feature feels different from what exists now.`,
    "student safety flow": `Design a quick safety or privacy check inside ${trend}. Sketch the step where a student is about to post, share, or subscribe, then show how the app helps them make a smarter choice without being annoying.`,
    "recommendation system": `Create a sketched concept for how ${trend} could recommend something better for a student user. Show the input, the recommendation card, and one reason the recommendation feels more personal.`,
    "creator dashboard": `Sketch a lightweight creator dashboard for ${trend}. Show what a student creator would most want to track, and include one visual element that helps them improve faster.`
  };

  return {
    title: `${titleMap[archetype] || `${trend} Design Challenge`} ${variant}`,
    instruction: instructionMap[archetype] || `Sketch a new ${trend} experience with a clear user flow, one key screen, and one improvement that helps middle school users.`
  };
}

function buildDreamMission(className, trend, archetype, variant) {
  const titleMap = {
    "physical product remix": `${trend} Object Remix`,
    "club pop-up": `${trend} Pop-Up Experience`,
    "experience design": `${trend} IRL Experience Build`,
    "merch drop": `${trend} Merch Drop Concept`,
    "space makeover": `${trend} Space Makeover`
  };

  const instructionMap = {
    "physical product remix": `For ${className}, sketch a physical object inspired by ${trend} that students would want to use, carry, or collect at school. Show the object from two angles and label the feature that makes it feel special.`,
    "club pop-up": `Design a one-day school pop-up inspired by ${trend}. Sketch the setup, the main attraction, and one interactive detail that would make students stop and participate.`,
    "experience design": `Invent an in-person experience based on ${trend}. Your sketch should show what students see first, what they do next, and one surprise moment that makes the experience memorable.`,
    "merch drop": `Sketch a mini merch drop connected to ${trend}. Include at least two items, the packaging or display idea, and one detail that makes the collection feel exclusive.`,
    "space makeover": `Reimagine one corner of school using the energy of ${trend}. Sketch the space, the focal object, and one feature that changes how people behave there.`
  };

  return {
    title: `${titleMap[archetype] || `${trend} Dream Challenge`} ${variant}`,
    instruction: instructionMap[archetype] || `Sketch a bold object, environment, or experience inspired by ${trend}, with labels showing what students would notice first.`
  };
}

function buildInterdisciplinaryMission(className, trend, archetype, variant) {
  const titleMap = {
    "campaign concept": `${trend} Campaign Sprint`,
    "community challenge": `${trend} Problem Solver`,
    "service design": `${trend} Service Redesign`,
    "school system fix": `${trend} School Fix Challenge`,
    "awareness launch": `${trend} Awareness Launch`
  };

  const instructionMap = {
    "campaign concept": `For ${className}, create a sketched campaign inspired by ${trend} that helps solve a real student problem. Show the main visual, the message, and one physical or digital touchpoint students would interact with.`,
    "community challenge": `Use ${trend} as inspiration for a solution to a middle school problem. Sketch the idea and label how it helps people, what students would do with it, and why it would actually get attention.`,
    "service design": `Redesign a school service using lessons from ${trend}. Sketch the front-facing experience, one behind-the-scenes support feature, and one reason the system would feel more fair or easier to use.`,
    "school system fix": `Pick one annoying school routine and redesign it with the energy of ${trend}. Sketch the new flow and label the moment where the student experience becomes faster, clearer, or more fun.`,
    "awareness launch": `Create a sketchable awareness launch tied to ${trend}. Show the visual hook, one way students join in, and one artifact people would remember after seeing it.`
  };

  return {
    title: `${titleMap[archetype] || `${trend} Design Challenge`} ${variant}`,
    instruction: instructionMap[archetype] || `Sketch a system, campaign, or service inspired by ${trend} that solves a real school problem and can be explained quickly from the drawing.`
  };
}

function buildCodeWord(trend, archetype) {
  const raw = `${trend} ${archetype}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return raw.slice(0, 28);
}

function scoreAndSortTrends({ baseTrends, trendScores, classLikes, classAvoids, offset = 0 }) {
  return rotate(
    [...baseTrends]
    .map((trend, index) => {
      const baseScore = 100 - index;
      const feedbackScore = trendScores.get(trend) || 0;
      const likeBoost = classLikes.has(trend) ? 12 : 0;
      const avoidPenalty = classAvoids.has(trend) ? 30 : 0;
      return {
        trend,
        score: baseScore + feedbackScore + likeBoost - avoidPenalty
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((item) => item.trend),
    offset
  );
}

function scoreAndSortArchetypes(archetypes, classFeedback, offset = 0) {
  return rotate(
    [...archetypes]
    .map((archetype, index) => {
      const baseScore = 100 - index;
      const likeBoost = classFeedback.likedArchetypes.has(archetype) ? 15 : 0;
      const avoidPenalty = classFeedback.avoidedArchetypes.has(archetype) ? 35 : 0;
      return {
        archetype,
        score: baseScore + likeBoost - avoidPenalty
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((item) => item.archetype),
    offset
  );
}

function buildTrendScores(preferences, feedbackEntries) {
  const scores = new Map();

  for (const trend of preferences.trendPool || []) {
    scores.set(trend, 0);
  }

  for (const entry of feedbackEntries) {
    const delta = sentimentToScore(entry.sentiment);
    if (!entry.trend || delta === 0) continue;
    scores.set(entry.trend, (scores.get(entry.trend) || 0) + delta);
  }

  return scores;
}

function buildClassFeedback(entries) {
  const feedback = new Map();

  for (const entry of entries) {
    if (!entry.class_id) continue;
    const bucket = feedback.get(entry.class_id) || defaultClassFeedback();

    if (entry.trend) {
      if (isPositive(entry.sentiment)) {
        bucket.likedTrends.add(entry.trend);
      }
      if (isNegative(entry.sentiment)) {
        bucket.avoidedTrends.add(entry.trend);
      }
    }

    if (entry.archetype) {
      if (isPositive(entry.sentiment)) {
        bucket.likedArchetypes.add(entry.archetype);
      }
      if (isNegative(entry.sentiment)) {
        bucket.avoidedArchetypes.add(entry.archetype);
      }
    }

    feedback.set(entry.class_id, bucket);
  }

  return feedback;
}

function buildFeedbackTemplate(files, targetDate) {
  return {
    date: targetDate,
    instructions: [
      "Pick the option you used or liked most.",
      "Run `npm run missions:feedback -- --date YYYY-MM-DD --class <class_id> --option <1-based index> --sentiment loved|liked|pass|avoid --notes \"...\"` to save feedback."
    ],
    classes: files.map((fileEntry) => ({
      class_id: fileEntry.class_id,
      file: fileEntry.file,
      selected_option: null,
      sentiment: "",
      notes: "",
      tags: []
    }))
  };
}

function defaultClassFeedback() {
  return {
    likedTrends: new Set(),
    avoidedTrends: new Set(),
    likedArchetypes: new Set(),
    avoidedArchetypes: new Set()
  };
}

function sentimentToScore(sentiment) {
  switch (sentiment) {
    case "loved":
      return 4;
    case "liked":
      return 2;
    case "pass":
      return -1;
    case "avoid":
      return -3;
    default:
      return 0;
  }
}

function isPositive(sentiment) {
  return sentiment === "liked" || sentiment === "loved";
}

function isNegative(sentiment) {
  return sentiment === "pass" || sentiment === "avoid";
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function computeOffset(value) {
  return [...value].reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
}

function rotate(values, offset) {
  if (!Array.isArray(values) || values.length === 0) return values;
  const start = offset % values.length;
  return values.slice(start).concat(values.slice(0, start));
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


function maybePublishSuggestions({ targetDate, args }) {
  const publishEnabled = args.publish || process.env.MISSIONS_PUBLISH_TO_FIRESTORE === "1";
  if (!publishEnabled || args["no-publish"]) {
    console.log("- Firestore publish: skipped (set MISSIONS_PUBLISH_TO_FIRESTORE=1 or pass --publish)");
    return;
  }

  const publisherScript = path.join(ROOT_DIR, "scripts", "publishMissionSuggestions.mjs");
  const result = spawnSync(process.execPath, [publisherScript, "--date", targetDate], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("Firestore suggestion publish failed. Check Firebase credentials/project env and retry.");
  }
}

function maybeSyncFeedbackFromFirestore({ args }) {
  const syncEnabled =
    args["sync-feedback"] ||
    process.env.MISSIONS_SYNC_FEEDBACK === "1" ||
    (process.env.MISSIONS_PUBLISH_TO_FIRESTORE === "1" && !args["no-sync-feedback"]);

  if (!syncEnabled) {
    return;
  }

  const syncScript = path.join(ROOT_DIR, "scripts", "syncMissionFeedback.mjs");
  const days = args["sync-days"] || "60";
  const result = spawnSync(process.execPath, [syncScript, "--days", String(days)], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.warn("- Feedback sync: skipped due sync error (generation continues)");
  }
}
