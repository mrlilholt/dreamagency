# Daily Mission Generator

This is a standalone local workflow for generating daily mission options before any app integration.

## Commands

- `npm run missions:generate`
- `npm run missions:generate -- --date 2026-03-18`
- `npm run missions:feedback -- --date 2026-03-18 --class computer_science_quarter_4 --option 1 --sentiment loved --notes "Students liked the app flow angle" --tags app-screens,clear-flow`
- `npm run missions:publish -- --date 2026-03-18`
- `MISSIONS_PUBLISH_TO_FIRESTORE=1 npm run missions:generate -- --date 2026-03-18`

## Output

The generator creates dated JSON files in `generated/daily-missions/YYYY-MM-DD/`:

- `computer-science.json`
- `dream-elective.json`
- `interdisciplinary-design.json`
- `feedback-template.json`
- `summary.json`

Each class JSON file contains two import-ready mission objects with:

- `title`
- `instruction`
- `code_word`
- `reward_cash`
- `reward_xp`
- `class_id`
- `active_date`

## Feedback loop

Saved feedback is appended to `data/daily-mission-generator/feedback-log.json`.
Future generations score trends and mission archetypes using that log so the outputs drift toward what you keep using and away from what you reject.

## Local tuning

Edit `data/daily-mission-generator/preferences.json` to:

- change reward defaults
- swap in new trend references
- change per-class mission archetypes
- add likes/avoid guidance


## Firestore publish

To populate the admin `Generate With AI` feed, publish generated options into `mission_suggestions`:

- one-off publish: `npm run missions:publish -- --date YYYY-MM-DD`
- auto-publish right after generation: `MISSIONS_PUBLISH_TO_FIRESTORE=1 npm run missions:generate`

Required env (one setup path):

- `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON string) **or** `GOOGLE_APPLICATION_CREDENTIALS` (path to service account file)
- `FIREBASE_PROJECT_ID` (recommended; required in some environments)

If you want local generation without Firestore writes, keep `MISSIONS_PUBLISH_TO_FIRESTORE` unset (default) or pass `--no-publish`.

## GitHub Actions (safe rollout)

A non-blocking CI workflow is available at `.github/workflows/daily-mission-generator.yml`.

- Scheduled runs are **dry-run by default** (generate JSON + upload artifact, no Firestore writes).
- Manual runs (`workflow_dispatch`) can optionally publish by setting `publish=true`.
- Netlify deploy settings are untouched; this workflow is isolated from the frontend build/deploy path.

### Required secret (only for publish mode)

- `FIREBASE_SERVICE_ACCOUNT_JSON` - Firebase Admin service account JSON string for `dreamlabos`.

### Recommended rollout

1. Let 1-2 scheduled dry-runs complete and review artifacts.
2. Run one manual dispatch with `publish=true`.
3. If needed, disable workflow to rollback instantly without touching Netlify.
