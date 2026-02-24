export const EGG_ANCHORS = [
  {
    id: "public.landing.nav_brand",
    page: "Landing Page",
    route: "/",
    label: "Landing Nav Brand",
    description: "XP Labs logo/wordmark in the landing navbar.",
    iconSymbol: "✦"
  },
  {
    id: "public.landing.hero_badge",
    page: "Landing Page",
    route: "/",
    label: "Landing Hero Badge",
    description: "The EST. badge at the top of the landing hero.",
    iconSymbol: "✶"
  },
  {
    id: "public.process.hero_title",
    page: "Process Page",
    route: "/process",
    label: "Process Hero Title",
    description: "THE PROTOCOL hero title area.",
    iconSymbol: "✸"
  },
  {
    id: "public.clients.header",
    page: "Clients Page",
    route: "/clients",
    label: "Clients Header",
    description: "CLIENT DOSSIERS headline area.",
    iconSymbol: "$"
  },
  {
    id: "public.case_study.lab_note",
    page: "Case Study",
    route: "/work/:id",
    label: "Case Study Lab Note",
    description: "Lab Note card in case study detail.",
    iconSymbol: "✧"
  },
  {
    id: "student.dashboard.wallet_card",
    page: "Student Dashboard",
    route: "/dashboard",
    label: "Dashboard Wallet Card",
    description: "Currency card in the student dashboard stats grid.",
    iconSymbol: "$"
  },
  {
    id: "student.dashboard.xp_card",
    page: "Student Dashboard",
    route: "/dashboard",
    label: "Dashboard XP Card",
    description: "XP card in the student dashboard stats grid.",
    iconSymbol: "🔑"
  },
  {
    id: "student.shop.header",
    page: "Reward Shop",
    route: "/shop",
    label: "Shop Header",
    description: "Reward shop title/header area.",
    iconSymbol: "✶"
  },
  {
    id: "student.profile.bankroll",
    page: "Agent Profile",
    route: "/profile",
    label: "Profile Bankroll Stat",
    description: "Bankroll stat card on profile.",
    iconSymbol: "$"
  },
  {
    id: "student.profile.mission",
    page: "Agent Profile",
    route: "/profile",
    label: "Profile Mission Stat",
    description: "Mission stat card on profile.",
    iconSymbol: "✦"
  },
  {
    id: "student.profile.honors",
    page: "Agent Profile",
    route: "/profile",
    label: "Profile Honors Stat",
    description: "Honors stat card on profile.",
    iconSymbol: "🏅"
  }
];

export const EGG_ANCHOR_MAP = EGG_ANCHORS.reduce((acc, anchor) => {
  acc[anchor.id] = anchor;
  return acc;
}, {});

export const getAnchorById = (anchorId) => EGG_ANCHOR_MAP[anchorId] || null;
