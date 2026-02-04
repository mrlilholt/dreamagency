import { CLASS_CODES } from "./gameConfig";

export const THEME_CONFIG = {
  agency: {
    id: "agency",
    name: "XP Labs",
    fonts: {
      body: "\"Sora\", system-ui, sans-serif",
      accent: "\"Sora\", system-ui, sans-serif"
    },
    palette: {
      bg: "#f8fafc",
      surface: "#ffffff",
      card: "#f8fafc",
      text: "#0f172a",
      muted: "#64748b",
      accent: "#4f46e5",
      border: "#e2e8f0"
    },
    labels: {
      teacher: "Director",
      student: "Agent",
      assignment: "Contract",
      assignments: "Contracts",
      currency: "Bounty",
      xp: "XP",
      shop: "Agency Store"
    },
    ui: {
      background: "bg-slate-50",
      accent: "text-indigo-600"
    }
  },
  museum: {
    id: "museum",
    name: "Museum of Antiquities",
    fonts: {
      body: "\"Crimson Pro\", serif",
      accent: "\"Crimson Pro\", serif"
    },
    palette: {
      bg: "#fffbeb",
      surface: "#fff7ed",
      card: "#fffaf0",
      text: "#3f1d0b",
      muted: "#92400e",
      accent: "#7f1d1d",
      border: "#fed7aa"
    },
    labels: {
      teacher: "Head Curator",
      student: "Archivist",
      assignment: "Expedition",
      assignments: "Expeditions",
      currency: "Artifacts",
      xp: "Discovery Points",
      shop: "Gift Shop"
    },
    ui: {
      background: "bg-amber-50",
      accent: "text-red-900"
    }
  },
  orbital: {
    id: "orbital",
    name: "Orbital Command Station",
    fonts: {
      body: "\"Space Grotesk\", system-ui, sans-serif",
      accent: "\"Space Grotesk\", system-ui, sans-serif"
    },
    palette: {
      bg: "#0f172a",
      surface: "#111827",
      card: "#0b1220",
      text: "#e2e8f0",
      muted: "#94a3b8",
      accent: "#22d3ee",
      border: "#1e293b"
    },
    labels: {
      teacher: "Commander",
      student: "Cadet",
      assignment: "Mission",
      assignments: "Missions",
      currency: "Credits",
      xp: "Rank",
      shop: "Quartermaster"
    },
    ui: {
      background: "bg-slate-900",
      accent: "text-cyan-400"
    }
  },
  guild: {
    id: "guild",
    name: "Adventurer's Guild",
    fonts: {
      body: "\"Unbounded\", system-ui, sans-serif",
      accent: "\"Unbounded\", system-ui, sans-serif"
    },
    palette: {
      bg: "#052e16",
      surface: "#064e3b",
      card: "#05351f",
      text: "#ecfdf5",
      muted: "#a7f3d0",
      accent: "#facc15",
      border: "#065f46"
    },
    labels: {
      teacher: "Guildmaster",
      student: "Apprentice",
      assignment: "Quest",
      assignments: "Quests",
      currency: "Gold Pieces (GP)",
      xp: "Renown",
      shop: "Blacksmith"
    },
    ui: {
      background: "bg-emerald-900",
      accent: "text-emerald-200"
    }
  },
  newsroom: {
    id: "newsroom",
    name: "The Newsroom",
    fonts: {
      body: "\"Sora\", system-ui, sans-serif",
      accent: "\"Sora\", system-ui, sans-serif"
    },
    palette: {
      bg: "#ffffff",
      surface: "#f8fafc",
      card: "#ffffff",
      text: "#020617",
      muted: "#64748b",
      accent: "#dc2626",
      border: "#e2e8f0"
    },
    labels: {
      teacher: "Editor-in-Chief",
      student: "Reporter",
      assignment: "Scoop",
      assignments: "Scoops",
      currency: "Press Passes",
      xp: "Credibility",
      shop: "Press Bar"
    },
    ui: {
      background: "bg-white",
      accent: "text-red-600"
    }
  },
  cyber: {
    id: "cyber",
    name: "Cyber Security Division",
    fonts: {
      body: "\"IBM Plex Mono\", ui-monospace, SFMono-Regular, Menlo, monospace",
      accent: "\"IBM Plex Mono\", ui-monospace, SFMono-Regular, Menlo, monospace"
    },
    palette: {
      bg: "#000000",
      surface: "#0b0f0d",
      card: "#0b0f0d",
      text: "#d1fae5",
      muted: "#6ee7b7",
      accent: "#22c55e",
      border: "#064e3b"
    },
    labels: {
      teacher: "SysAdmin",
      student: "White Hat",
      assignment: "Protocol",
      assignments: "Protocols",
      currency: "Crypto",
      xp: "Bandwidth",
      shop: "Dark Web"
    },
    ui: {
      background: "bg-black",
      accent: "text-green-500"
    }
  }
  ,
  hospital: {
    id: "hospital",
    name: "Teaching Hospital",
    fonts: {
      body: "\"Sora\", system-ui, sans-serif",
      accent: "\"Sora\", system-ui, sans-serif"
    },
    palette: {
      bg: "#f8fafc",
      surface: "#ffffff",
      card: "#f1f5f9",
      text: "#0f172a",
      muted: "#64748b",
      accent: "#0d9488",
      border: "#e2e8f0"
    },
    labels: {
      teacher: "Chief of Staff",
      student: "Resident",
      assignment: "Patient Case",
      assignments: "Patient Cases",
      currency: "Grant Funding",
      xp: "Board Certification",
      shop: "Pharmacy"
    },
    ui: {
      background: "bg-slate-50",
      accent: "text-teal-600"
    }
  },
  court: {
    id: "court",
    name: "High Court",
    fonts: {
      body: "\"Crimson Pro\", serif",
      accent: "\"Crimson Pro\", serif"
    },
    palette: {
      bg: "#291611",
      surface: "#3b1f18",
      card: "#2a1712",
      text: "#f8fafc",
      muted: "#f1d7c9",
      accent: "#facc15",
      border: "#4b2a22"
    },
    labels: {
      teacher: "Chief Justice",
      student: "Associate Justice",
      assignment: "Legal Brief",
      assignments: "Legal Briefs",
      currency: "Billable Hours",
      xp: "Precedent",
      shop: "Evidence Room"
    },
    ui: {
      background: "bg-amber-950",
      accent: "text-stone-100"
    }
  },
  exchange: {
    id: "exchange",
    name: "Stock Exchange",
    fonts: {
      body: "\"Space Grotesk\", system-ui, sans-serif",
      accent: "\"Space Grotesk\", system-ui, sans-serif"
    },
    palette: {
      bg: "#0f172a",
      surface: "#111827",
      card: "#0b1220",
      text: "#e2e8f0",
      muted: "#94a3b8",
      accent: "#22c55e",
      border: "#1e293b"
    },
    labels: {
      teacher: "Chairman",
      student: "Analyst",
      assignment: "Forecast",
      assignments: "Forecasts",
      currency: "Capital",
      xp: "Equity",
      shop: "Assets"
    },
    ui: {
      background: "bg-gray-900",
      accent: "text-green-500"
    }
  },
  construction: {
    id: "construction",
    name: "Construction Site",
    fonts: {
      body: "\"Space Grotesk\", system-ui, sans-serif",
      accent: "\"Space Grotesk\", system-ui, sans-serif"
    },
    palette: {
      bg: "#0f2b5b",
      surface: "#163872",
      card: "#112b58",
      text: "#f8fafc",
      muted: "#cbd5f5",
      accent: "#f97316",
      border: "#1e3a8a"
    },
    labels: {
      teacher: "Site Foreman",
      student: "Architect",
      assignment: "Blueprint",
      assignments: "Blueprints",
      currency: "Materials Budget",
      xp: "Structural Integrity",
      shop: "Hardware Store"
    },
    ui: {
      background: "bg-blue-900",
      accent: "text-orange-500"
    }
  },
  detective: {
    id: "detective",
    name: "Detective Agency",
    fonts: {
      body: "\"Special Elite\", ui-monospace, serif",
      accent: "\"Special Elite\", ui-monospace, serif"
    },
    palette: {
      bg: "#292524",
      surface: "#1c1917",
      card: "#1f1b1a",
      text: "#f5f5f4",
      muted: "#d6d3d1",
      accent: "#f59e0b",
      border: "#44403c"
    },
    labels: {
      teacher: "Lead Detective",
      student: "Private Investigator",
      assignment: "Case File",
      assignments: "Case Files",
      currency: "Retainer Fees",
      xp: "Leads Solved",
      shop: "Forensics Lab"
    },
    ui: {
      background: "bg-stone-800",
      accent: "text-amber-400"
    }
  },
  culinary: {
    id: "culinary",
    name: "Culinary Kitchen",
    fonts: {
      body: "\"Sora\", system-ui, sans-serif",
      accent: "\"Sora\", system-ui, sans-serif"
    },
    palette: {
      bg: "#e5e7eb",
      surface: "#ffffff",
      card: "#f8fafc",
      text: "#1f2937",
      muted: "#6b7280",
      accent: "#f97316",
      border: "#d1d5db"
    },
    labels: {
      teacher: "Executive Chef",
      student: "Sous Chef",
      assignment: "Ticket",
      assignments: "Tickets",
      currency: "Tips",
      xp: "Michelin Stars",
      shop: "The Pantry"
    },
    ui: {
      background: "bg-gray-200",
      accent: "text-orange-600"
    }
  }
};

const THEME_ALIASES = {
  Agency: "agency",
  Maker: "agency",
  Cyber: "cyber",
  Museum: "museum",
  Orbital: "orbital",
  Guild: "guild",
  Newsroom: "newsroom",
  Hospital: "hospital",
  Court: "court",
  Exchange: "exchange",
  Construction: "construction",
  Detective: "detective",
  Culinary: "culinary"
};

export const resolveThemeId = (value) => {
  if (!value) return "agency";
  const normalized = String(value).trim();
  const lower = normalized.toLowerCase();
  if (THEME_CONFIG[lower]) return lower;
  if (THEME_ALIASES[normalized]) return THEME_ALIASES[normalized];
  return "agency";
};

export const THEME_OPTIONS = Object.values(THEME_CONFIG).map((theme) => ({
  id: theme.id,
  name: theme.name
}));

export const getThemeForUser = (userData) => {
  if (!userData) return THEME_CONFIG.agency;

  const directTheme = userData.theme_id || userData.theme;
  if (directTheme) {
    return THEME_CONFIG[resolveThemeId(directTheme)];
  }

  const classId = userData.class_id;
  if (classId) {
    const classEntry = Object.values(CLASS_CODES).find((cls) => cls.id === classId);
    if (classEntry?.theme_id || classEntry?.theme) {
      return THEME_CONFIG[resolveThemeId(classEntry.theme_id || classEntry.theme)];
    }
  }

  return THEME_CONFIG.agency;
};
