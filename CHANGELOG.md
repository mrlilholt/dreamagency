# Changelog

All notable changes to this project should be documented in this file.

## Format

- Use reverse-chronological order (newest first).
- Use explicit dates (`YYYY-MM-DD`).
- Keep entries short and operational: what changed, where, and why.
- For larger features, include key file paths.

## [Unreleased]

### Added
- Added a reusable Daily Work Log system with admin-managed templates, exact-date scheduling, duplicate-by-class actions, student blocking popup submission, reward payouts, dashboard history, analytics drill-down visibility, shared work-log helpers, and matching Firestore rules (`src/pages/dashboard/AdminDashboard.jsx`, `src/pages/dashboard/StudentDashboard.jsx`, `src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`, `src/lib/workLogs.js`, `firestore.rules`).
- Added a fallback onboarding class for `CS-ACCESS` that creates the `Computer Science Quarter 4` class record on first use so new users can join and the class behaves like the existing roster/classes setup (`src/lib/gameConfig.js`, `src/pages/Onboarding.jsx`).
- Added an admin analytics student-work drill-down with class -> student selection, backfilled contract/mission/side-hustle reporting, printable reports, CSV export, and per-class productivity overrides (`src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`).
- Added admin-only analytics override storage in `admin_student_metrics/{metricId}` with matching Firestore rules (`firestore.rules`).
- Created `AGENTS.md` as the shared operations map for architecture, route ownership, data contracts, and conventions.
- Created this `CHANGELOG.md` with maintenance rules so updates remain easy to reference.
- Added a new admin-managed egg engine for future easter eggs with anchor-based placement, trigger policies, fixed rewards, badge auto-create, and hint controls (`src/pages/admin/AdminEggs.jsx`, `src/context/EggContext.jsx`, `src/components/EggAnchor.jsx`, `src/lib/eggAnchors.js`, `src/lib/eggEngine.js`).
- Added `/admin/eggs` route and admin-route protection updates in `src/App.jsx`, plus admin nav wiring in `src/components/AdminShell.jsx`.
- Added new egg collections/contracts and partial security hardening in `firestore.rules` (`eggs`, `egg_anchor_locks`, `users/{uid}/egg_progress`, `users/{uid}/egg_claims`, self-or-admin user writes).
- Added hidden anchor insertion points on public and student pages without changing legacy hardcoded eggs (`src/pages/LandingPage.jsx`, `src/pages/ProcessPage.jsx`, `src/pages/ClientsPage.jsx`, `src/pages/CaseStudyDetail.jsx`, `src/pages/dashboard/StudentDashboard.jsx`, `src/pages/dashboard/RewardShop.jsx`, `src/pages/AgentProfile.jsx`).
- Added hint-token support path by extending admin shop effect type options (`src/pages/dashboard/AdminDashboard.jsx`).

### Fixed
- Fixed `CS-ACCESS` onboarding so that code now always maps to the canonical `computer_science_quarter_4` class and re-syncs its class document to the Agency theme instead of inheriting an older Cyber-themed class entry (`src/pages/Onboarding.jsx`).
- Fixed analytics class matching so admin drill-down uses all known student class fields (`class_id`, `active_class_id`, `class_ids`, `enrolled_classes`) instead of only the legacy primary class field (`src/pages/admin/AdminAnalytics.jsx`, `src/lib/adminAnalytics.js`).
- Updated egg rules to allow student claim transactions to increment only egg claim counters (`claimedCount`, `claimedClassIds`, `updatedAt`) while keeping all other egg writes admin-only (`firestore.rules`).
- Relaxed egg counter rule matching to use `affectedKeys()` and removed strict `updatedAt == request.time` comparison to avoid false permission-denied on transformed transaction updates (`firestore.rules`).
- Updated egg runtime so claimed eggs remain clickable and show an explicit “already claimed” state, while unclaimed eggs remain retryable until a claim is actually saved in Firebase (`src/context/EggContext.jsx`).

### Added
- Added hard delete support for admin-managed eggs in the Egg Engine UI, including automatic anchor lock release (`src/pages/admin/AdminEggs.jsx`).

## 2026-02-26

### Fixed
- Fixed student contract visibility so global contracts are included for all classes by normalizing class IDs and allowing global aliases in contract filtering/listeners (`src/pages/dashboard/StudentDashboard.jsx`).
- Normalized edit-contract fallback class assignment from `"Global"` to `"all"` to keep new/edited contracts consistent with global audience semantics (`src/pages/admin/EditContract.jsx`).

## 2026-02-21

### Added
- Baseline project documentation established (`AGENTS.md`, `CHANGELOG.md`) to support faster, safer future updates.
