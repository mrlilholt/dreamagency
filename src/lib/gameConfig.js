export const CLASS_CODES = {
  "DREAM7": {
    id: "7th_dream_lab",
    name: "7th Grade DREAM Lab",
    theme: "Maker",
    division: "MS",
    department: "DREAM Lab"
  },
  "CS7": {
    id: "7th_cs",
    name: "7th Grade Comp Sci",
    theme: "Cyber",
    division: "MS",
    department: "Computer Science"
  },
  "DREAM8": {
    id: "8th_dream_elective",
    name: "8th Grade DREAM Elective",
    theme: "Agency",
    division: "MS",
    department: "DREAM Elective"
  },
  "ID": {
    id: "Interdisciplinary_design",
    name: "8th Grade Interdisciplinary Design",
    theme: "Agency",
    division: "MS",
    department: "Interdisciplinary Design"
  },
  // You can add a "Teacher Code" so you get Admin powers automatically
  "CEO2024": {
    id: "admin_staff",
    name: "Agency Administration",
    role: "admin" 
  }
};

export const INITIAL_STATS = {
  xp: 0,
  currency: 50, // Signing bonus
  level: 1,
  reputation: 100
};
export const BADGES = {
  first_contract: {
    id: "first_contract",
    title: "Rookie No More",
    description: "Completed your first contract.",
    icon: "🚀",
    color: "bg-blue-500"
  },
  rich_list: {
    id: "rich_list",
    title: "Capitalist",
    description: "Accumulated over $5,000 in agency funds.",
    icon: "💰",
    color: "bg-green-500"
  },
  stage_master: {
    id: "stage_master",
    title: "Reliable",
    description: "Reached Stage 5 on any contract.",
    icon: "⭐",
    color: "bg-indigo-500"
  }
  // Add more as you invent them!
};
