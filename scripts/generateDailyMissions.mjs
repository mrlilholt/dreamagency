import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data", "daily-mission-generator");
const OUTPUT_DIR = path.join(ROOT_DIR, "generated", "daily-missions");
const PREFERENCES_PATH = path.join(DATA_DIR, "preferences.json");
const FEEDBACK_PATH = path.join(DATA_DIR, "feedback-log.json");
const DIRECTIVES_PATH = path.join(DATA_DIR, "auto-directives.json");

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
const autoDirectives = readJsonOptional(DIRECTIVES_PATH, {});
const styleRules = normalizeStyleRules(autoDirectives.rules || {});

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
const usedTrendsGlobal = new Set();

for (const [classId, classConfig] of Object.entries(preferences.classes || {})) {
  const missions = buildClassMissions({
    classId,
    classConfig,
    preferences,
    targetDate,
    optionsPerClass,
    trendScores,
    classFeedback: classFeedback.get(classId) || defaultClassFeedback(),
    styleRules,
    usedTrendsGlobal
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
  classFeedback,
  styleRules,
  usedTrendsGlobal
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
  const availableTrendPool = trendPool.filter((trend) => !usedTrendsGlobal.has(trend));
  const selectionTrendPool = availableTrendPool.length > 0 ? availableTrendPool : trendPool;
  const missions = [];
  const trendStep = styleRules.highNoveltyMode ? 3 : 1;
  const archetypeStep = styleRules.highNoveltyMode ? 2 : 1;

  for (let index = 0; index < optionsPerClass; index += 1) {
    const trend = pickFromPool(selectionTrendPool, index, trendStep) || "Student Design Challenge";
    const archetype = pickFromPool(archetypePool, index, archetypeStep) || "feature launch";
    const variant = index % 2 === 0 ? "A" : "B";
    const difficulty = inferDifficulty(archetype, index);

    missions.push(
      createMission({
        classId,
        classConfig,
        targetDate,
        trend,
        archetype,
        variant,
        rewardDefaults: preferences.rewardDefaults || {},
        rewardByDifficulty: preferences.rewardByDifficulty || {},
        difficulty,
        styleRules
      })
    );
    usedTrendsGlobal.add(trend);
  }

  return missions;
}

function createMission({
  classId,
  classConfig,
  targetDate,
  trend,
  archetype,
  variant,
  rewardDefaults,
  rewardByDifficulty,
  difficulty,
  styleRules
}) {
  const missionDetails = buildMissionDetails(classConfig, trend, archetype, variant, styleRules);
  const rewardProfile = rewardByDifficulty[difficulty] || rewardDefaults;
  return {
    title: missionDetails.title,
    instruction: missionDetails.instruction,
    trend,
    archetype,
    difficulty,
    code_word: buildCodeWord(trend, archetype),
    reward_cash: Number(rewardProfile.reward_cash) || 400,
    reward_xp: Number(rewardProfile.reward_xp) || 400,
    class_id: classId,
    active_date: targetDate
  };
}

function buildMissionDetails(classConfig, trend, archetype, variant, styleRules) {
  if (classConfig.fileKey === "computer-science") {
    return buildComputerScienceMission(trend, archetype, variant, styleRules);
  }

  if (classConfig.fileKey === "dream-elective") {
    return buildDreamMission(trend, archetype, variant, styleRules);
  }

  return buildInterdisciplinaryMission(trend, archetype, variant, styleRules);
}

function buildComputerScienceMission(trend, archetype, variant, styleRules) {
  const titleMap = {
    "creative ui overhaul": `${trend} UI Overhaul`,
    "code debugging sprint": `${trend} Debug Sprint`,
    "cybersecurity osint challenge": `${trend} OSINT Safety Challenge`,
    "game system design": `${trend} Game System Challenge`,
    "ai feature reasoning": `${trend} AI Feature Reasoning`,
    "interface remix": `${trend} Study Mode Remix`,
    "feature launch": `${trend} Student Power-Up`,
    "student safety flow": `${trend} Safe Sharing Check`,
    "recommendation system": `${trend} Better Picks Engine`,
    "creator dashboard": `${trend} Creator Dashboard Sprint`
  };

  const instructionMap = {
    "creative ui overhaul": `Redesign one clunky student-facing app flow inspired by ${trend}. Sketch two connected screens with labeled UI states and show the key interaction that improves clarity for the user.`,
    "code debugging sprint": `Open a teacher-provided broken CodePen snippet and debug it. Sketch the expected interface state before and after the fix, and annotate the exact bug you corrected and why it failed.`,
    "cybersecurity osint challenge": `Run a school-safe OSINT challenge inspired by ${trend}: identify what profile details should stay private, what can be public, and design a safer account setup flow. Sketch the safety checklist screen and warning state.`,
    "game system design": `Design a game system inspired by ${trend} that balances fun and fairness for middle-school players. Sketch the core loop diagram and one UI panel showing how players make decisions.`,
    "ai feature reasoning": `Design an AI helper feature inspired by ${trend}. Sketch the prompt input, response panel, and one trust/safety control that helps a middle-school user use AI responsibly.`,
    "interface remix": `Sketch one mobile screen and one small interaction that redesign ${trend} for students who need less distraction during homework time. Label the main button, the most important info, and one feature that makes the flow feel calmer.`,
    "feature launch": `Sketch a new ${trend} feature that would make middle school students say, "I would actually use that." Show the main screen, one tap path, and the moment the feature feels different from what exists now.`,
    "student safety flow": `Design a quick safety or privacy check inside ${trend}. Sketch the step where a student is about to post, share, or subscribe, then show how the app helps them make a smarter choice without being annoying.`,
    "recommendation system": `Create a sketched concept for how ${trend} could recommend something better for a student user. Show the input, the recommendation card, and one reason the recommendation feels more personal.`,
    "creator dashboard": `Sketch a lightweight creator dashboard for ${trend}. Show what a student creator would most want to track, and include one visual element that helps them improve faster.`
  };

  return {
    title: formatMissionTitle(titleMap[archetype] || `${trend} Design Challenge`, variant, styleRules),
    instruction: withMissionFormat(
      instructionMap[archetype] || `Sketch a new ${trend} experience with a clear user flow, one key screen, and one improvement that helps middle school users.`,
      { includeUiFlowRequirement: true, styleRules, trend, archetype, classProfile: "computer-science" }
    )
  };
}

function buildDreamMission(trend, archetype, variant, styleRules) {
  const titleMap = {
    "digital design concept": `${trend} Digital Concept Sprint`,
    "engineering space layout": `${trend} Space Layout Challenge`,
    "school solution concept": `${trend} School Solution Studio`,
    "object design remix": `${trend} Object Remix`,
    "experience branding sprint": `${trend} Experience Branding Sprint`,
    "physical product remix": `${trend} Object Remix`,
    "club pop-up": `${trend} Pop-Up Experience`,
    "experience design": `${trend} IRL Experience Build`,
    "merch drop": `${trend} Merch Drop Concept`,
    "space makeover": `${trend} Space Makeover`
  };

  const instructionMap = {
    "digital design concept": `Sketch a new app/tool concept inspired by ${trend} that a middle-school student would actually use. Show the key interface and one moment of delight.`,
    "engineering space layout": `Sketch a spatial/architectural layout inspired by ${trend} (classroom corner, studio, event setup, or mini-campus zone). Label pathways, focal points, and how people move through it.`,
    "school solution concept": `Design a school-based solution inspired by ${trend}. Sketch the concept and show how it improves one real student experience.`,
    "object design remix": `Sketch a physical object inspired by ${trend} with at least two views and labels for materials or moving parts.`,
    "experience branding sprint": `Design a branded experience inspired by ${trend}. Sketch the environment/object touchpoints and the visual identity elements students would notice first.`,
    "physical product remix": `Sketch a physical object inspired by ${trend} that students would want to use, carry, or collect at school. Show the object from two angles and label the feature that makes it feel special.`,
    "club pop-up": `Design a one-day school pop-up inspired by ${trend}. Sketch the setup, the main attraction, and one interactive detail that would make students stop and participate.`,
    "experience design": `Invent an in-person experience based on ${trend}. Your sketch should show what students see first, what they do next, and one surprise moment that makes the experience memorable.`,
    "merch drop": `Sketch a mini merch drop connected to ${trend}. Include at least two items, the packaging or display idea, and one detail that makes the collection feel exclusive.`,
    "space makeover": `Reimagine one corner of school using the energy of ${trend}. Sketch the space, the focal object, and one feature that changes how people behave there.`
  };

  return {
    title: formatMissionTitle(titleMap[archetype] || `${trend} Dream Challenge`, variant, styleRules),
    instruction: withMissionFormat(
      instructionMap[archetype] || `Sketch a bold object, environment, or experience inspired by ${trend}, with labels showing what students would notice first.`,
      { includeUiFlowRequirement: false, styleRules, trend, archetype, classProfile: "dream-elective" }
    )
  };
}

function buildInterdisciplinaryMission(trend, archetype, variant, styleRules) {
  const titleMap = {
    "systems thinking challenge": `${trend} Systems Thinking Sprint`,
    "social media solution": `${trend} Social Solution Challenge`,
    "travel solution": `${trend} Travel Solution Lab`,
    "futuristic tech concept": `${trend} Future Tech Concept`,
    "personal utility concept": `${trend} Personal Utility Design`,
    "campaign concept": `${trend} Campaign Sprint`,
    "community challenge": `${trend} Problem Solver`,
    "service design": `${trend} Service Redesign`,
    "school system fix": `${trend} School Fix Challenge`,
    "awareness launch": `${trend} Awareness Launch`
  };

  const instructionMap = {
    "systems thinking challenge": `Map and sketch a system inspired by ${trend} with at least three connected parts (people, tools, and process). Show where the biggest friction happens and your redesign.`,
    "social media solution": `Design a school-appropriate social-media-related solution inspired by ${trend}. Sketch the core interaction and how it protects wellbeing/safety.`,
    "travel solution": `Create a student travel solution inspired by ${trend}. Sketch the user journey and one key service touchpoint that removes stress.`,
    "futuristic tech concept": `Propose a near-future tech concept inspired by ${trend}. Sketch how it works in daily student life and one safeguard for responsible use.`,
    "personal utility concept": `Design a practical solution a student could personally use every week, inspired by ${trend}. Sketch the setup and the moment it becomes useful.`,
    "campaign concept": `Create a sketched campaign inspired by ${trend} that helps solve a real student problem. Show the main visual, the message, and one physical or digital touchpoint students would interact with.`,
    "community challenge": `Use ${trend} as inspiration for a solution to a middle school problem. Sketch the idea and label how it helps people, what students would do with it, and why it would actually get attention.`,
    "service design": `Redesign a school service using lessons from ${trend}. Sketch the front-facing experience, one behind-the-scenes support feature, and one reason the system would feel more fair or easier to use.`,
    "school system fix": `Pick one annoying school routine and redesign it with the energy of ${trend}. Sketch the new flow and label the moment where the student experience becomes faster, clearer, or more fun.`,
    "awareness launch": `Create a sketchable awareness launch tied to ${trend}. Show the visual hook, one way students join in, and one artifact people would remember after seeing it.`
  };

  return {
    title: formatMissionTitle(titleMap[archetype] || `${trend} Design Challenge`, variant, styleRules),
    instruction: withMissionFormat(
      instructionMap[archetype] || `Sketch a system, campaign, or service inspired by ${trend} that solves a real school problem and can be explained quickly from the drawing.`,
      { includeUiFlowRequirement: false, styleRules, trend, archetype, classProfile: "interdisciplinary-design" }
    )
  };
}

function withMissionFormat(baseInstruction, {
  includeUiFlowRequirement = false,
  styleRules,
  trend,
  archetype = "",
  classProfile = "general"
} = {}) {
  const cleanedBaseInstruction = styleRules.avoidClassNameOpener
    ? sanitizeClassLead(baseInstruction)
    : baseInstruction;
  const contextLine = buildContextLine({ trend, archetype, classProfile, styleRules });
  const pieces = [
    contextLine,
    cleanedBaseInstruction,
    "10-15 minute design sprint.",
    `Target user: ${styleRules.targetUserPhrase}.`,
    "Include in your sketch: (1) one-sentence user/problem statement, (2) at least two constraints, (3) a labeled diagram showing how your solution works."
  ];
  if (classProfile === "computer-science") {
    pieces.push("Keep the solution CS-focused: digital workflow, app behavior, or code-level fix.");
  }
  if (classProfile === "interdisciplinary-design") {
    pieces.push("Use at least two disciplines together (for example: design + engineering, policy + UX, or media + technology).");
  }
  if (classProfile === "dream-elective") {
    pieces.push("Push creativity: blend one real-world need with one near-future idea.");
  }
  if (styleRules.requireExplicitProblemStatement) {
    pieces.push("Start by naming the exact problem in plain language (who is struggling, what is going wrong, and where).");
  }
  if (styleRules.requireContextDefinition) {
    pieces.push(`If "${trend}" could be unclear, define it in one short sentence before sketching.`);
  }
  if (includeUiFlowRequirement) {
    pieces.push("For UI-flow prompts, include two connected screens and labeled interaction steps.");
  }
  pieces.push("Keep writing minimal: quick labels and brief notes only.");
  return pieces.join(" ");
}

function sanitizeClassLead(text) {
  return String(text || "").replace(/^For [^,]+,\s*/i, "");
}

function buildContextLine({ trend, archetype, classProfile, styleRules }) {
  const contextPools = {
    "computer-science": [
      `Context: a student product team is pitching a ${trend}-inspired digital feature for real school use.`,
      `Context: your class is acting as a rapid-response dev squad solving a ${trend} challenge for students.`,
      `Context: a real app used by teens needs a safer, smarter ${trend} workflow.`
    ],
    "dream-elective": [
      `Context: a youth-facing creative studio wants a bold ${trend} concept that feels current and useful.`,
      `Context: imagine your school launches a mini innovation expo and needs a standout ${trend} concept.`,
      `Context: a future-school design lab asks for a fresh ${trend} idea with visual wow-factor.`
    ],
    "interdisciplinary-design": [
      `Context: a school-community problem connected to ${trend} needs a cross-discipline solution.`,
      `Context: a city + school partnership is tackling ${trend} and needs systems-level redesign ideas.`,
      `Context: a student advisory board is solving a ${trend} issue that touches people, process, and technology.`
    ],
    general: [
      `Context: build a practical design response inspired by ${trend}.`
    ]
  };
  const pool = contextPools[classProfile] || contextPools.general;
  const index = styleRules.highNoveltyMode ? computeOffset(`${trend}:${archetype}:${classProfile}`) % pool.length : 0;
  return pool[index];
}

function pickFromPool(pool, index, step = 1) {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const normalizedStep = Math.max(1, Number(step) || 1);
  return pool[(index * normalizedStep) % pool.length];
}

function formatMissionTitle(baseTitle, variant, styleRules) {
  if (styleRules.stripOptionSuffixFromTitles) {
    return baseTitle;
  }
  return `${baseTitle} ${variant}`;
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

function inferDifficulty(archetype, index = 0) {
  const normalized = String(archetype || "").toLowerCase();
  if (
    normalized.includes("debug")
    || normalized.includes("osint")
    || normalized.includes("cyber")
    || normalized.includes("systems")
  ) {
    return "hard";
  }
  if (
    normalized.includes("ai")
    || normalized.includes("engineering")
    || normalized.includes("futuristic")
    || normalized.includes("game")
  ) {
    return "medium";
  }
  return index % 2 === 0 ? "easy" : "medium";
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

function readJsonOptional(filePath, fallbackValue = {}) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeStyleRules(rawRules = {}) {
  return {
    stripOptionSuffixFromTitles: rawRules.strip_option_suffix_from_titles !== false,
    targetUserPhrase:
      String(rawRules.target_user_phrase || "").trim() || "a middle-school student in a school context",
    avoidClassNameOpener: rawRules.avoid_class_name_opener !== false,
    highNoveltyMode: rawRules.high_novelty_mode !== false,
    requireExplicitProblemStatement: Boolean(rawRules.require_explicit_problem_statement),
    requireContextDefinition: Boolean(rawRules.require_context_definition)
  };
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
