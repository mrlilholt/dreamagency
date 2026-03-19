# Dream Agency Operator Guide

This file is the shared operations map for humans and coding agents working in this repo.
Update it whenever architecture, data contracts, routes, conventions, or ownership changes.

## 1) Project Snapshot

- App type: single-tenant classroom "agency" game platform (students + admin teachers).
- Frontend: React 19 + Vite 7 + React Router 7 + Tailwind 4.
- Backend services: Firebase Auth (Google), Firestore, Firestore security rules.
- Runtime model: direct client-side Firestore reads/writes (no server API layer in repo).
- PWA support: service worker + web manifest + install banner.

Entry points:
- `src/main.jsx`
- `src/App.jsx`
- `src/context/AuthContext.jsx`
- `src/context/ThemeContext.jsx`
- `firestore.rules`

## 2) High-Level Architecture

### Auth + onboarding flow

1. User signs in with Google via `AuthContext.login`.
2. `AuthContext` subscribes to auth state and reads `users/{uid}`.
3. If no user profile doc exists, app redirects to `/onboarding`.
4. Onboarding validates class code from `classes` collection first, then falls back to `CLASS_CODES` in `src/lib/gameConfig.js`.
5. Onboarding writes profile to `users/{uid}` with role, class, and starter stats.

Primary files:
- `src/context/AuthContext.jsx`
- `src/pages/Login.jsx`
- `src/pages/Onboarding.jsx`
- `src/lib/gameConfig.js`

### Route guard + role switch

`PrivateRoute` in `src/App.jsx` enforces:
- authenticated user
- onboarding redirect when authenticated profile is missing

`Dashboard` role switch in `src/pages/Dashboard.jsx`:
- `role === "admin"` -> `src/pages/dashboard/AdminDashboard.jsx`
- everyone else -> `src/pages/dashboard/StudentDashboard.jsx`

### Theme resolution flow

1. `ThemeProvider` checks user-level theme (`theme_id` or `theme`).
2. If absent, it listens to the active `classes/{class_id}` doc.
3. It resolves aliases through `resolveThemeId` and applies `data-theme` on `<html>`.
4. UI consumes labels/palette via `useTheme()`.

Primary files:
- `src/context/ThemeContext.jsx`
- `src/lib/themeConfig.js`
- `src/index.css`

## 3) Route Map (Operational)

Public:
- `/` marketing landing
- `/process`
- `/clients`
- `/work/:id`
- `/login`
- `/onboarding`

Student (private):
- `/dashboard`
- `/contract/:id`
- `/side-hustle/:id`
- `/shop`
- `/leaderboard`
- `/profile`

Admin (private + admin role required):
- `/admin/create`
- `/admin/contracts`
- `/admin/edit/:id`
- `/admin/roster`
- `/admin/analytics`
- `/admin/events`
- `/admin/eggs`

## 4) Firestore Data Contract

### Root collections used by app

- `users/{uid}`
- `users/{uid}/alerts/{alertId}`
- `users/{uid}/event_claims/{eventId}`
- `users/{uid}/egg_progress/{eggId}`
- `users/{uid}/egg_claims/{eggId}`
- `users/{uid}/work_logs/{promptId}`
- `active_jobs/{uid}_{contractId}`
- `contracts/{contractId}`
- `events/{eventId}`
- `eggs/{eggId}`
- `eggs/{eggId}/claims/{uid}`
- `eggs/{eggId}/class_claims/{classId}`
- `egg_anchor_locks/{anchorId}`
- `system/{docId}` (market crash flags and global state)
- `shop_items/{itemId}`
- `badges/{badgeId}`
- `suggestions/{suggestionId}`
- `daily_missions/{missionId}`
- `daily_work_log_templates/{templateId}`
- `daily_work_log_prompts/{promptId}`
- `classes/{classId}`
- `admin_student_metrics/{metricId}`
- `side_hustles/{sideHustleId}`
- `side_hustle_jobs/{uid}_{sideHustleId}`

`daily_missions/{missionId}` currently supports optional `format_type` values:
- `mission` (default when missing)
- `incoming_email`

### Security model to remember

Source: `firestore.rules`.

- Most collections allow read/write for any authenticated user.
- Egg system collections are admin-write and user-claim scoped in rules.
- `users/{uid}` writes are now self-or-admin.
- `admin_student_metrics/{metricId}` is admin-only and stores per-class manual productivity overrides for analytics reports.
- Daily work log templates/prompts are admin-managed; student submissions live under `users/{uid}/work_logs/{promptId}` and are self-or-admin in rules.
- Daily mission docs may omit `format_type`; treat missing values as the legacy/default `mission` format.
- Some legacy collections remain permissive for current velocity.
- If a feature should become admin-only, update both UI checks and `firestore.rules`.

## 5) Naming + Field Conventions

This codebase intentionally mixes legacy and newer field conventions. Preserve compatibility.

1. Keep both snake_case and camelCase reads where they already exist.
2. New gameplay entities generally use snake_case:
- `class_id`, `active_date`, `scheduled_date`, `xp_reward`, `reward_cash`, `reward_xp`, `current_stage`, `current_level`
3. Some newer/admin fields are camelCase:
- `createdAt`, `updatedAt`, `classIds`, `appliesToTypes`, `flatCurrencyBonus`
- `classId`, `studentId`, `productivityMode`, `manualScore`
4. Do not remove old aliases (`open` vs `live`, `name` vs `displayName`) without a migration pass.

Important enums in active logic:
- Roles: `associate`, `admin` (some UI checks include future roles like `teacher`, `super_admin`, `department_admin`)
- Contract status: `live`, `scheduled`, `archived` (legacy `open` maps to `live`)
- Active job status: `in_progress`, `active`, `pending_review`, `completed`, `returned`
- Stage status: `locked`, `active`, `pending_review`, `completed`, `returned` (some analytics code also checks `rejected`)
- Side hustle status: `live`, `scheduled`, `archived`

## 6) Feature Ownership Map (Where to Edit)

### Auth, login, onboarding

- `src/context/AuthContext.jsx`
- `src/pages/Login.jsx`
- `src/pages/Onboarding.jsx`
- `src/App.jsx`

### Student dashboard feed + class filtering + mission claims

- `src/pages/dashboard/StudentDashboard.jsx`
- `src/lib/eventUtils.js`
- `src/lib/dailyMissions.js`

### Daily mission / incoming email launcher

- `src/pages/dashboard/AdminDashboard.jsx`
- `src/pages/dashboard/StudentDashboard.jsx`
- `src/lib/dailyMissions.js`

### Daily work log templates, prompt scheduling, student submissions, analytics view

- `src/pages/dashboard/AdminDashboard.jsx`
- `src/pages/dashboard/StudentDashboard.jsx`
- `src/pages/admin/AdminAnalytics.jsx`
- `src/lib/adminAnalytics.js`
- `src/lib/workLogs.js`
- `firestore.rules`

### Standalone daily mission generation

- `scripts/generateDailyMissions.mjs`
- `scripts/recordMissionFeedback.mjs`
- `data/daily-mission-generator/preferences.json`
- `data/daily-mission-generator/feedback-log.json`
- `docs/daily-mission-generator.md`

### Contract lifecycle (create/edit/list/student detail)

- `src/pages/admin/CreateContract.jsx`
- `src/pages/admin/EditContract.jsx`
- `src/pages/admin/AllContracts.jsx`
- `src/pages/ContractDetails.jsx`

### Side hustle lifecycle (admin ops + student detail)

- `src/pages/dashboard/AdminDashboard.jsx`
- `src/pages/SideHustleDetails.jsx`

### Approval + payout engine (contracts, side hustles, mission rewards)

- `src/pages/dashboard/AdminDashboard.jsx`
- `src/pages/dashboard/StudentDashboard.jsx`
- `src/pages/admin/AdminRoster.jsx`
- `src/lib/eventUtils.js`

### Event system (admin config + reward modifiers)

- `src/pages/admin/AdminEvents.jsx`
- `src/lib/eventUtils.js`
- `src/pages/dashboard/StudentDashboard.jsx`

### Shop + boosts + market crash

- Student purchase flow: `src/pages/dashboard/RewardShop.jsx`
- Admin shop management + discounting: `src/pages/dashboard/AdminDashboard.jsx`
- Notifications for boost expiry: `src/components/NotificationLayer.jsx`

### Badges, profile, suggestions

- Badge CRUD: `src/pages/admin/AllContracts.jsx`
- Badge grants and bulk actions: `src/pages/admin/AdminRoster.jsx`
- Student profile + suggestions + easter eggs: `src/pages/AgentProfile.jsx`

### Easter egg engine (new system for future eggs)

- Admin egg control center: `src/pages/admin/AdminEggs.jsx`
- Runtime provider + claim/hint flow: `src/context/EggContext.jsx`
- Anchor renderer: `src/components/EggAnchor.jsx`
- Anchor registry: `src/lib/eggAnchors.js`
- Trigger/state helpers: `src/lib/eggEngine.js`
- App routing + guard wiring: `src/App.jsx`

### Roster + analytics + leaderboard

- Roster operations: `src/pages/admin/AdminRoster.jsx`
- Analytics + student work drill-down: `src/pages/admin/AdminAnalytics.jsx`
- Analytics data shaping/backfill helpers: `src/lib/adminAnalytics.js`
- Leaderboard: `src/pages/Leaderboard.jsx`

### Shared shell + nav + alerts

- Admin frame: `src/components/AdminShell.jsx`
- Student nav: `src/components/Navbar.jsx`
- Alert/achievement popups: `src/components/NotificationLayer.jsx`
- PWA install CTA: `src/components/InstallBanner.jsx`

### Theme + visual system

- Theme context: `src/context/ThemeContext.jsx`
- Theme definitions/labels: `src/lib/themeConfig.js`
- CSS variables + themed utilities: `src/index.css`

### Public marketing pages

- `src/pages/LandingPage.jsx`
- `src/pages/ProcessPage.jsx`
- `src/pages/ClientsPage.jsx`
- `src/pages/CaseStudyDetail.jsx`

## 7) UI Conventions

### Admin interface pattern

- Use `AdminShell` for admin pages to keep left rail + sticky command header.
- Keep card styling consistent: rounded surfaces, light borders, dense data cards, bold headings.

### Theme pattern

- Prefer `theme-*` utility classes (`theme-bg`, `theme-surface`, `theme-text`, `theme-muted`, `theme-border`) for in-app pages.
- Use `theme.labels` for terminology (`assignment`, `currency`, `shop`, etc.) instead of hardcoded nouns where practical.

### Firestore media payload limits

- Contract images in create/edit flows enforce ~200KB max.
- Event modal backgrounds enforce ~500KB max.
- Side hustle images enforce ~350KB max.
- These are stored as Data URLs in Firestore docs, so keep them small.

## 8) Troubleshooting Quick Map

If this breaks, check these files first:

- Login loop / onboarding redirect:
  `src/context/AuthContext.jsx`, `src/App.jsx`, `src/pages/Onboarding.jsx`
- Data not loading due auth/rules:
  `firestore.rules`, any listener in page component
- Contract not visible to student:
  `src/pages/dashboard/StudentDashboard.jsx` (`allowedClasses`, status filtering)
- Approval payout wrong:
  `src/pages/dashboard/AdminDashboard.jsx`, `src/lib/eventUtils.js`
- Event bonus not applied:
  `src/lib/eventUtils.js`, `src/pages/admin/AdminEvents.jsx`
- Boost expiry alerts not firing:
  `src/components/NotificationLayer.jsx`, `src/pages/dashboard/RewardShop.jsx`
- Theme appears wrong:
  `src/context/ThemeContext.jsx`, `src/lib/themeConfig.js`, `src/index.css`
- Student report / productivity score looks wrong:
  `src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`, `firestore.rules`
- Daily work log popup/history missing or scheduling wrong:
  `src/pages/dashboard/AdminDashboard.jsx`, `src/pages/dashboard/StudentDashboard.jsx`, `src/lib/workLogs.js`, `firestore.rules`
- Standalone mission generator outputs feel stale or off-target:
  `data/daily-mission-generator/preferences.json`, `data/daily-mission-generator/feedback-log.json`, `scripts/generateDailyMissions.mjs`
- PWA install behavior/cache issues:
  `src/components/InstallBanner.jsx`, `public/service-worker.js`, `public/manifest.webmanifest`
- Egg not appearing / wrong trigger / claim issue:
  `src/pages/admin/AdminEggs.jsx`, `src/context/EggContext.jsx`, `src/lib/eggAnchors.js`, `src/lib/eggEngine.js`, `firestore.rules`

## 9) Update Workflow For Future Changes

When implementing a feature or refactor:

1. Update route map if URLs changed.
2. Update Firestore contract if collections/fields/status enums changed.
3. Update feature ownership map with exact files affected.
4. Add/adjust naming convention notes when introducing new field patterns.
5. Add a dated entry to `CHANGELOG.md` (do not skip this).
6. If architecture materially changed, add a concise note in this file too.

Keep this file practical. Prefer exact file paths over abstract descriptions.

## 10) Keyword Index

Use these keywords in tickets/prompts for fast navigation:

- `AUTH_FLOW` -> `src/context/AuthContext.jsx`, `src/pages/Login.jsx`, `src/pages/Onboarding.jsx`
- `PRIVATE_ROUTE` -> `src/App.jsx`
- `STUDENT_DASHBOARD` -> `src/pages/dashboard/StudentDashboard.jsx`
- `ADMIN_DASHBOARD` -> `src/pages/dashboard/AdminDashboard.jsx`
- `EVENTS_ENGINE` -> `src/pages/admin/AdminEvents.jsx`, `src/lib/eventUtils.js`
- `EVENT_PAYOUTS` -> `src/lib/eventUtils.js`, `src/pages/dashboard/AdminDashboard.jsx`, `src/pages/admin/AdminRoster.jsx`
- `CONTRACT_PIPELINE` -> `src/pages/admin/CreateContract.jsx`, `src/pages/admin/EditContract.jsx`, `src/pages/admin/AllContracts.jsx`, `src/pages/ContractDetails.jsx`
- `SIDE_HUSTLES` -> `src/pages/dashboard/AdminDashboard.jsx`, `src/pages/SideHustleDetails.jsx`
- `SHOP_BOOSTS` -> `src/pages/dashboard/RewardShop.jsx`, `src/pages/dashboard/AdminDashboard.jsx`, `src/components/NotificationLayer.jsx`
- `ROSTER_OPS` -> `src/pages/admin/AdminRoster.jsx`
- `ANALYTICS` -> `src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`
- `PRODUCTIVITY_REPORTS` -> `src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`, `firestore.rules`
- `DAILY_WORK_LOGS` -> `src/pages/dashboard/AdminDashboard.jsx`, `src/pages/dashboard/StudentDashboard.jsx`, `src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`, `src/lib/workLogs.js`, `firestore.rules`
- `DAILY_MISSION_GENERATOR` -> `scripts/generateDailyMissions.mjs`, `scripts/recordMissionFeedback.mjs`, `data/daily-mission-generator/preferences.json`, `data/daily-mission-generator/feedback-log.json`
- `LEADERBOARD` -> `src/pages/Leaderboard.jsx`
- `THEME_SYSTEM` -> `src/context/ThemeContext.jsx`, `src/lib/themeConfig.js`, `src/index.css`
- `PWA` -> `src/main.jsx`, `src/components/InstallBanner.jsx`, `public/service-worker.js`, `public/manifest.webmanifest`
- `FIRESTORE_RULES` -> `firestore.rules`
- `EGG_ENGINE` -> `src/pages/admin/AdminEggs.jsx`, `src/context/EggContext.jsx`, `src/components/EggAnchor.jsx`, `src/lib/eggAnchors.js`, `src/lib/eggEngine.js`

## Changelog Link

- Canonical project history lives in `CHANGELOG.md`.
- Update it for every meaningful code change so it stays usable as a shared memory log.
