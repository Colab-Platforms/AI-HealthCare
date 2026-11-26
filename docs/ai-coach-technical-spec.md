# AI Health Coach + Health Profile: Technical Spec

> **Status:** In progress. Day 1 done (Health Profile, verified on staging). Day 2 Coach V2 built and wired behind `AI_COACH_V2` (offline tests green), **not yet run against the real API**. All committed and pushed to `Staging` on 23 Nov.
> **Timeline:** 23–24 Nov build, 25–26 Nov testing. Deadline 26 Nov 2026.
> **PM plan:** [ai-coach-backend-plan.docx](ai-coach-backend-plan.docx)
> **Earlier plan:** [health-profile-plan.md](health-profile-plan.md). Where it differs, this doc wins (see section 1).

## 0. Progress (start here)

### Resume on another machine

1. `git pull origin Staging`, then in `server/`: `npm install` (adds `@langchain/langgraph`, `@langchain/core`, `zod`).
2. Offline tests (no DB, no API): `cd server && node --test "tests/healthProfile*.test.js" "tests/aiCoach*.test.js"` → 152 pass. Full suite: `$env:USE_STAGING_DB="false"; npm test` → only the 4 known vault failures.
3. **Next step: first real-API run on staging** (costs a few cents per message):
   ```
   $env:USE_STAGING_DB="true"
   node scripts/createCoachTestUser.js        # prints email + one-time password; --reset for a new one
   node scripts/coachStagingRun.js "I'm feeling tired today, and I've to go to the gym today" "no injuries" "undo"
   ```
   Check in the output: classifier `model` (not `fallback`), specialists `completed`, the injury question, the save + undo events, first-word time (estimate 1.7–2.5 s), and that Sonnet 5.5 accepts `thinking: between_tools` + `fallbacks: "default"` (if it 400s, change `RESPONDER_THINKING` / `RESPONDER_FALLBACK` in `modules/ai-coach/config.js`).
4. Then: `AI_COACH_V2=true` on the staging server(s) and test from the app with the test user (login = email + password). App opt-in for typed events: `"coachEvents": true` in the `/api/chat` body.
5. Day 3 (25 Nov): SymptomLog, CoachRun log, `POST /api/coach/feedback`, post-chat summary (QStash); then the eval (~50 English + Hinglish questions, old vs new).
6. Production: follow the "Production rollout checklist" below (indexes first, then deploy, then migration). `AI_COACH_V2` and `HEALTH_PROFILE_WRITES` must match on Vercel and Render.

### Done (22–23 Nov)

| Step | Files | Tests |
| --- | --- | --- |
| 1. Confirm write points | section 6 (updated line numbers) | n/a |
| 2. Models | `server/modules/health-profile/models/HealthProfile.js`, `ProfileHistory.js` | validated offline |
| 3. Mapper | `server/modules/health-profile/services/profileMapper.js` | `tests/healthProfileMapper.test.js` (12) |
| 4. Write service | `services/profileWriteService.js`, `services/profileRepo.js` | `tests/healthProfileWriteService.test.js` (15), uses `tests/helpers/memoryProfileRepo.js` |
| 4b. Staging smoke (23 Nov) | `scripts/healthProfileStagingSmoke.js` | 20/20 checks pass on `healthcare-ai-staging` (real transactions, version guard, unique index, concurrent writes, undo) |
| 5. Write points moved (23 Nov), except profile edit | `services/profileSync.js` (bridge), `updateSections` in the service; callers: signup, `setHealthGoal`, `updateHealthGoal`, `setCalorieOverride`, `logWeight` (nutritionController), smart scale (`wearableIngestService` + cache clear in `wearableController` OS sync) | `tests/healthProfileSync.test.js` (20), `updateSections` tests (3), `tests/healthProfileDirectWriteGuard.test.js` (2). Staging smoke 27/27 pass (checks 10–14: bridge, kill switch, outer-session commit/abort, bad device reading) |
| 7. APIs + read path (23 Nov) | `modules/health-profile/routes.js` (mounted `/api/health-profile`), `controllers/healthProfileController.js`, `services/profileContextService.js` (`getProfile`, cached `getProfileContext`), `services/completeness.js`, `services/profileSideEffects.js`; `profileWriteLimiter`; DPDPA: deletion cron, admin delete and data export now include HealthProfile + ProfileHistory | `tests/healthProfileApi.test.js` (17), `tests/healthProfileContext.test.js` (11). Staging smoke 37/37 pass (checks 15–21: GET, version 409, real side effects, forged provenance, history paging, undo, completeness) |
| 5b. Old profile edit synced (23 Nov) | `syncFromLegacy` in the service + `profileSync.syncLegacyEdit`, called after `user.save()` in `authController.updateProfile` | `tests/healthProfileLegacySync.test.js` (13). Staging smoke 43/43 pass (checks 22–23: drift heal, no-op on real types, old-app edit keeps item details) |
| 6. Migration script (23 Nov) | `scripts/migrateHealthProfile.js` (dry run by default, `--apply`, `--verify`, `--sample=N`, `--limit=N`, `--user=id`; production needs `--prod` and the unique index), logic in `services/profileMigration.js` | `tests/healthProfileMigration.test.js` (9). Staging: 14 users, 14 created, 0 invalid, `--verify` 0 mismatches |
| Fixes (23 Nov) | admin `deleteUser` deleted `ChatHistory` by `user` (field is `userId`: matched nothing); `scripts/syncIndexes.js` now also loads `modules/*/models` (HealthProfile's unique index was never synced; prod has autoIndex off) | test checks every `deleteMany` field in `deleteUser` exists on its model |

Run: `cd server && node --test tests/healthProfile*.test.js` (104 pass, no DB needed).
Staging: `$env:USE_STAGING_DB="true"; node scripts/healthProfileStagingSmoke.js` (cleans up after itself, `--keep` to inspect).

### Next

1. **Share the API contract** (section 8) with the app team. They move the profile screen to `/api/health-profile`; old app versions keep working through 5b.
2. **Day 2: Coach V2** (section 10), with the 23 Nov decisions below.

### Coach V2 decisions (23 Nov)

- **Models:** Sonnet 5.5 + Haiku 5.5 (section 1, row 1).
- **LangGraph without checkpointer** (row 3). Speed comes from: context load and classify in parallel; Haiku 5.5 at low effort for classify; Sonnet 5.5 at low effort + prompt caching for the answer; specialists in parallel, each with a timeout; greetings skip classify.
- **Gap questions don't block the answer** by default: answer first, ask one question at the end. Block only when advice without the field could be unsafe (e.g. a diet plan with allergies unknown).
- **New SSE events only for apps that opt in:** the client sends a flag saying it understands typed events (e.g. `profile_saved` for "Saved · Undo"). Old apps get only `{ token }` events; a save is mentioned in the reply text and undone by saying so in chat.
- Example flow and latency estimate ("I'm feeling tired today and I have to go to the gym"): auth ~10 ms → context + classify in parallel ~0.5–0.8 s → safety + gap (code) → recovery/sleep/fitness specialists in parallel ~0.2–0.5 s → Sonnet first token ~1 s. Estimated first word 1.7–2.5 s; measure on staging.
- SDK check done: `@anthropic-ai/sdk` 0.100.1 already types `output_config` (effort + `json_schema`) and has `client.beta.messages.stream`. No upgrade needed.

### Coach V2 progress (23 Nov, uncommitted)

Built in `server/modules/ai-coach/` (framework-agnostic; the LangGraph wiring is next):

| Part | File | Notes |
| --- | --- | --- |
| Config | `config.js` | models, effort, timeouts (classifier 4 s, each specialist 2.5 s), `AI_COACH_V2` flag, responder thinking `between_tools`, server-side fallback |
| Safety | `safety/safetyRules.js` | English + Hinglish red flags with negation handling, glucose < 54 / > 400, fixed replies (112 / 108, Tele-MANAS 14416) |
| Classifier | `orchestrator/intentClassifier.js` | one Haiku 5.5 call = classify + profile-fact extraction (structured output); greeting/thanks fast path; keyword fallback on error / timeout / refusal |
| Gap engine | `orchestrator/gapEngine.js` | one question, topic priority (supplements > nutrition > fitness > ...), blocking only for unsafe cases, 7-day snooze. `fitness.limitations` "none" is stored as `['none']` (the array defaults to `[]`) |
| Specialists | `specialists/{recovery,sleep,fitness,nutrition,medicalLab}.js`, `specialists/index.js` | code only, existing analytics services, parallel with per-specialist timeout, missing = missing |
| Chat -> profile | `tools/profileTools.js` | answer to pending question = save + Undo; volunteered = confirm first; question / hypothetical / not-self = nothing; undo only on a short direct message within 30 min |
| Coach memory | `models/CoachState.js` (`coach_states`) | pendingQuestion, askedLog, pendingConfirm, lastSaved. **Changed from spec section 9** (ChatHistory fields): the app syncs ChatHistory itself and could overwrite them. Included in DPDPA delete (cron + admin) and export |
| Answer | `response/responseGenerator.js` | Sonnet 5.5 stream; cached rules + cached profile; per-message data in a final `role: system` message (keeps the cache, never read as user text) |

Also fixed: `addItem` with the same item in another case ("peanut" vs "Peanut") no longer rewrites the stored spelling or adds a history row.

Tests: `tests/aiCoachCore.test.js` (21), `tests/aiCoachProfileTools.test.js` (9), `tests/aiCoachResponse.test.js` (4). All health profile + coach tests: 138 pass.

Then (same day, after `npm install @langchain/langgraph@1.7.5 @langchain/core@1.5.0 zod@4.6.7`):

| Part | File | Notes |
| --- | --- | --- |
| Graph | `orchestrator/mainCoachGraph.js` | `prepare` (coach state, red-flag rules, undo / yes / no detection; then profile context + classify in parallel) → `safety_reply` / `quick_reply` / `profile_actions` → `gap_check` → `run_specialists` (skipped when not needed or gap is blocking) → `respond` → `persist`. Output via the LangGraph "custom" stream. Node names can't equal state keys |
| Coach memory repo | `orchestrator/coachStateRepo.js` | Mongo + in-memory for tests |
| Route glue | `chatHandler.js`, 1 `if` in `routes/chatRoutes.js` | flag off or failure before any text → old chat runs unchanged; client disconnect via `res` close; typed events only with `"coachEvents": true` |
| Usage | `models/UsageLog.js` | features `ai_coach_v2`, `ai_coach_classify`; pricing for `claude-sonnet-5-5`, `claude-haiku-5-5` |
| Staging tools | `scripts/createCoachTestUser.js`, `scripts/coachStagingRun.js` | test user (prints a one-time password) with 14 days of sleep / recovery / steps + workouts; real-API run with timings |

Greetings and thanks get an instant canned reply (no model call). Tests: `tests/aiCoachGraph.test.js` (9 multi-turn flows), `tests/aiCoachChatHandler.test.js` (5). Full suite 731: 726 pass, 4 known vault failures, 1 skipped.

Next: staging run with the real API (measure first-word latency, check Sonnet 5.5 accepts `between_tools` + `fallbacks: "default"`), then `AI_COACH_V2=true` on staging servers; Day 3: SymptomLog, CoachRun, feedback API, post-chat summary.

Staging note: only 14 users, all with clean data, so the "invalid legacy data" path has not met real data yet; read the production dry run's invalid list carefully. Some stored weights carry float noise from old unit conversions (`56.80000000000001`); kept as is, rounded to 1 decimal in the AI context.

### Production rollout checklist (in this order)

1. `HEALTH_PROFILE_WRITES` unset (default on) or `true` on BOTH Vercel and Render.
2. `node scripts/syncIndexes.js --dry-run --only=HealthProfile,ProfileHistory`, then without `--dry-run`. **Before** deploying the code: without the unique index, two parallel first writes can create two profiles for one user.
3. Deploy.
4. `node scripts/migrateHealthProfile.js --prod` (dry run), review invalid users, then `--prod --apply`, then `--prod --verify`.
5. Fix the users listed as invalid (their old data breaks the schema); until then their writes fall back to legacy-only and are logged.
6. Note: the full `syncIndexes.js` run now also covers shop models; use `--dry-run` first and review anything it would drop.

### Decisions made while coding

- **Write service design:** all DB access sits in `profileRepo.js` (`mongoRepo`). The service takes a `repo` so tests use an in-memory repo that behaves like MongoDB transactions (buffered writes, write-conflict retry, rollback).
- **Lazy creation:** any write on a user with no HealthProfile first builds it from `User.profile` (source `migration`). The migration script is a backfill, not a prerequisite.
- **Mirror** touches only the legacy paths of the sections that changed, never app settings. Conditions layout: onboarding-enum names → `healthConditions`, others → `chronicConditions`, `medicalHistory.conditions` cleared, `isDiabetic` derived. Readers union these fields, so no fact is lost.
- **Not mirrored in v1** (own write flows, read in place): `diabetesProfile`, `dietPreferences`, `fitnessProfile`, `foodPreferences` (incl. city/state/region, likes/dislikes).
- `addItem` with an existing key (case-insensitive) updates instead of duplicating.
- `markNone` is refused while items exist. Removing the last item sets state `missing`, not `none`.
- `undo` only works on the latest active change of a field.
- `createFromOnboarding` refuses if a profile exists (409). Inside a caller's session, cache invalidation is the caller's job (new users have no cache).
- Nutrition goal recalculation stays in the existing controllers for now (no behaviour change). The chat path (Day 2) must recalc after body/goals changes.
- Validation uses the Mongoose schema (`validateSync`). `zod` arrives with LangGraph on Day 2.
- **Direction (agreed 23 Nov):** HealthProfile becomes the only copy. `User.profile` health keys are a temporary bridge: (A) all writes through the service (step 5), (B) app profile screen on `/api/health-profile`, (C) the ~20 backend readers read HealthProfile, (D) after old app versions are gone, `$unset` the health keys. App settings (`waterGoalMl`, `stepGoal`, `avatar`, ...) stay on User.
- **Bridge (`profileSync.js`)** is how old write points reach the service:
  - `writeWithUser(userId, facts, userPatch)`: the caller's own User update (nutritionGoal, `healthMetrics.bmi`) + profile facts in ONE transaction; caches cleared after commit.
  - `setDeviceWeight(userId, kg, { session })`: joins the wearable sync transaction; that controller clears caches after its commit.
  - `onSignup`: best effort, never fails signup (changed from "same session as `User.create`": lazy creation rebuilds from the same data, and a broken signup costs more).
- **Untrusted values are dropped, not written:** 0 / NaN / out-of-range age, height, weight are skipped and logged (the health goal path used to write `0`). `logWeight` now returns 400 for weight outside 0–500 kg.
- **Bad legacy data never fails a request:** if a user's old `User.profile` can't build a valid HealthProfile, the legacy write is done alone and an error is logged ("legacy write only"). The migration script must report and fix these users.
- **Kill switch:** `HEALTH_PROFILE_WRITES=false` (set on both Vercel and Render) sends every bridge call down the old legacy-only path. Default on.
- `targetWeight`: `nutritionGoal.targetWeight` is the mirror of `goals.targetWeightKg`, so every flow that rewrites `nutritionGoal` from a HealthGoal (`setHealthGoal`, `updateHealthGoal`, `setCalorieOverride`, `logWeight`) passes it through the bridge too.
- Not changed: a back-dated `logWeight` still overwrites the current profile weight (and `HealthGoal.currentWeight`). Pre-existing; fix both together later.
- **API auth = `protect` only, no `requireHealthConsent`** (changed from section 8, agreed 23 Nov): the profile is the user's own data and DPDPA gives them the right to see and correct it after withdrawing AI consent. The consent gate goes on AI features that call `getProfileContext`.
- **GET creates the profile** for a user who has none (same lazy creation as the first write). Without a stored doc, list items have no stable `_id` the app could edit. Bad legacy data → read-only view (`readOnly: true`), not an error.
- **Clients never set provenance:** `source`, `verified`, `updatedAt`, `_id`, `meta` in a request → 400. Every API write is `source: manual`, `verified: true`.
- **Side effects of API edits** (`profileSideEffects.js`, after commit, best effort): body/basic/goals/lifestyle change → BMI, active HealthGoal (incl. target weight), nutrition targets field by field; diet change → Jain clean-up of food preferences + background regenerate of an active diet plan. Same rules as `updateProfile`.
- `markNone` has its own route (`POST /:section/none`), missing from the original API list.
- **5b sync rules** (`syncFromLegacy`): a field is updated only when its legacy value differs from what the mirror of the current profile would write; list items are matched by their mirrored form ("Metformin 500mg" = {Metformin, 500mg}, "Diabetes" = "Type 2 Diabetes"), so details survive; resolved conditions, stopped medicines and fields with no legacy copy are kept; `[]` never turns `none` into `missing`. Runs after the legacy save (not in its transaction: Mongoose document saves can't be safely retried inside a driver transaction); it is idempotent and heals any earlier missed sync. Known limit: the old endpoint saves the whole `User.profile` it loaded, so a parallel edit from the new API can be overwritten by it (pre-existing read-modify-write, same as before).
- **Migration** skips admin/superadmin, users who already have a profile, and users whose legacy data breaks the schema (listed for manual fix). No cache invalidation per user (nothing is cached for a user without a profile, and a Redis SCAN per user would waste quota).

### Known issues (not caused by this work)

- `npm test` hangs: `tests/wearableScoreDedup.staging.test.js` runs against real staging when `.env` has `USE_STAGING_DB=true`. Use `USE_STAGING_DB=false npm test` for normal runs.
- `tests/vault.test.js`: 4 tests expect a 10MB free vault base, config now gives 50MB. Owner of the vault change should update the test.

## 1. Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Keep **Claude**: **Sonnet 5.5** (`claude-sonnet-5-5`) for answers, **Haiku 5.5** (`claude-haiku-5-5`) for classify/extract (changed 23 Nov from Sonnet 4.6 / Haiku 4.5: newer and cheaper, $2/$10 and $0.10/$0.50 per MTok). No OpenAI. These models reject `temperature` and forced `tool_choice`; depth is set with `output_config.effort` (chat: `low`) | Already integrated (streaming, prompt caching, UsageLog). Switching adds cost and risk |
| 2 | Keep **QStash + node-cron**. No BullMQ | Redis is Upstash; BullMQ polling burns Upstash quota. QStash already works |
| 3 | **LangGraph** for the coach flow, **without a checkpointer in v1** (agreed 23 Nov). Pause/resume for a coach question uses `ChatHistory.pendingQuestion` | Clear graph, parallel specialists, ready for follow-ups / agentic tools later. A checkpointer would add a Mongo write per step (+latency) and store health data that DPDPA delete/export must then cover |
| 4 | **LangChain minimal**: zod tool schemas + (later) Voyage embeddings / Atlas retriever only | LLM calls stay on `@anthropic-ai/sdk`; avoids a wrapper layer that lags new Claude features |
| 5 | Specialists are **code, not LLM agents**. They call existing analytics services and return structured findings | Faster, cheaper, no invented numbers |
| 6 | New **`HealthProfile`** collection, one doc per user, is the **master** | `protect` loads the full User on every request; profile data is scattered in 5 places today |
| 7 | **`ProfileWriteService` is the only write path** | One owner means no drift |
| 8 | **`User.profile` = permanent mirror** (Option B), written only by `ProfileWriteService` in the same transaction | Existing ~20 reader files keep working untouched. No risky removal step |
| 9 | Old features move to `HealthProfile` **only when edited for other reasons** | No big-bang switch |
| 10 | Symptoms go to **`SymptomLog`**, not the profile | Symptoms are episodes (start/end), the profile holds slow-changing facts |
| 11 | Wearable/daily data, food logs, lab values **stay in existing models** | Time-series in one doc hits the 16MB limit and causes write contention |
| 12 | No `derived` block in the profile (changed from health-profile-plan.md) | Read through analytics services + Redis instead; avoids daily history/cache churn |
| 13 | Vector search (Atlas + Voyage `voyage-3.5-lite`) is **next phase**, only for unstructured memory | Structured fields cover v1 |
| 14 | Everything ships behind **`AI_COACH_V2`** | Old `/chat` keeps working; rollback = flag off |

## 2. Architecture

```
POST /api/chat  (same endpoint, same SSE format)
  │ protect → requireHealthConsent → aiLimiter → requireFeature('aiHealthCoach')
  │ AI_COACH_V2 off → existing handler (unchanged)
  ▼
mainCoachGraph (LangGraph)
  loadContext ──► classify (Haiku, JSON) ──► simple? ──► respond (Sonnet stream)
                                        └─► gapCheck ──► missing critical field? ──► ask + PAUSE (checkpoint)
                                                     └─► specialists (parallel) ──► merge ──► safety ──► respond
  after response → QStash /api/coach/internal/post-chat (summary, SymptomLog, CoachRun)

ProfileContextService (read, Redis)    ProfileWriteService (write, zod, transaction)
            │                                      │
            ▼                                      ▼
      HealthProfile ◄──────── master ───────► User.profile (mirror)
      ProfileHistory (append-only)
```

## 3. Folder structure

```
server/modules/
  health-profile/
    models/HealthProfile.js
    models/ProfileHistory.js
    services/profileWriteService.js     # only write path, mirror, transaction
    services/profileContextService.js   # only read path for AI, Redis cache
    services/profileMapper.js           # onboarding/User.profile <-> HealthProfile
    services/completeness.js
    controllers/healthProfileController.js
    routes.js
  ai-coach/
    orchestrator/mainCoachGraph.js
    orchestrator/graphState.js
    orchestrator/intentClassifier.js
    orchestrator/gapEngine.js
    specialists/{recovery,sleep,nutrition,fitness,medical-lab}/index.js
    safety/safetyRules.js
    safety/safetyValidator.js
    response/responseGenerator.js
    tools/profileTools.js               # update_profile, add_item, mark_none
    models/SymptomLog.js
    models/CoachRun.js
    controllers/ + routes.js
server/scripts/migrateHealthProfile.js
server/tests/healthProfile*.test.js, aiCoach*.test.js
```

Same pattern as `server/modules/shop/`.

## 4. HealthProfile schema

Every item or field carries `source` (`manual` / `device` / `report` / `chat`), `verified` (bool), `updatedAt`.
Lists have a `state`: `missing` (never asked) / `none` (user said none) / `has_items`.

| Section | Fields |
| --- | --- |
| basic | dob, gender, bloodGroup, city, state, language |
| body | heightCm, weightKg, waistCm, bodyFat |
| conditions[] | name, status (active/controlled/resolved), diagnosedYear |
| medications[] | name, dose, frequency, since, active |
| allergies[] | allergen, type (food/drug/other/unknown), severity, reaction |
| surgeries[] | name, year, bodyPart |
| familyHistory[] | relation, condition |
| lifestyle | smoking, alcohol, profession, workShift, sleepSchedule, stress, screenTime |
| diet | type, region, likes, dislikes, intolerances, mealTimings |
| fitness | experience, preferredExercise, equipment, limitations |
| goals | primary, targetWeightKg, timeline |
| coachPreferences | language, answerLength, checkinsEnabled |
| meta | `userId` (unique index), `version` (optimistic lock), completeness |

Not in the profile: wearable data, food logs, workouts, lab values, symptoms, chat, app settings (water/step goals, glass size, fcmToken).

## 5. Mapping rules (onboarding / User.profile → HealthProfile)

| Source | Target |
| --- | --- |
| age, dateOfBirth, gender, bloodGroup, state | basic |
| height, weight | body |
| isDiabetic + chronicConditions + healthConditions + medicalHistory.conditions | conditions[] (merge, dedupe) |
| allergies | allergies[] (type/severity = `unknown`, never guessed) |
| medicalHistory.currentMedications / surgeries / familyHistory | medications[] / surgeries[] / familyHistory[] |
| lifestyle.smoker/alcohol/stressLevel/sleepHours, profession | lifestyle (`smoker:false` → `no`, not `never`) |
| dietaryPreference, foodPreferences | diet |
| goals, goalOther, nutritionGoal.targetWeight | goals |

- Empty array `[]` = `missing` (app sends `[]` for both "none" and "not asked"). App team to send `"none"` later.
- Mirror rebuilds the **health keys** of `User.profile` from HealthProfile on every write, so they cannot drift. It must **not** overwrite the whole `User.profile`: app settings live there too (`lifestyle.waterGoalMl`, `waterGlassSizeMl`, `stepGoal`, `sleepGoalHours`, `avatar`).
- Field names in code: user ref is `user` (repo convention), diet type is `diet.preference` (a nested key named `type` confuses Mongoose), lists are `{ state, items[] }`.
- Mirror example: `medications[{name:'Metformin', dose:'500mg', active:true}]` → `medicalHistory.currentMedications: ['Metformin 500mg']` (active only).

## 6. Write points to move to ProfileWriteService (Day 1)

Confirmed with a wider grep on 22 Nov (line numbers after pulling Staging):

| File | Line | What |
| --- | --- | --- |
| `controllers/authController.js` | 748 (`register`, `User.create({ profile })`) | Onboarding |
| `controllers/authController.js` | 1600 (`updateProfile`) | Profile edit |
| `controllers/nutritionController.js` | 972–974, 1123–1125 | age/height/weight from health goal |
| `controllers/nutritionController.js` | 1307–1308 | weight update |
| `services/wearableIngestService.js` | 274 | weight from smart scale (already uses a session) |
| `scripts/migrateJainDiet.js` | 81 | one-off script, ignore |

- `nutritionController.js:1551` (`waterGlassSizeMl`) is an app setting, stays on User.
- `activityController.js` and `privacyController.js` matches are read queries, not writes.
- Legacy readers of condition fields (`utils/medicalContext.js`, `routes/chatRoutes.js`, `services/dietTargets.js`, `controllers/dietRecommendationController.js`) union `healthConditions`, `healthConditionOther`, `chronicConditions`, `medicalHistory.conditions` and `isDiabetic`.
- Add a test that fails on any direct write to `User.profile` health fields outside `ProfileWriteService`.

### ProfileWriteService API

```js
createFromOnboarding(userDoc, onboardingProfile, { session })
updateSection(userId, section, data, { source, expectedVersion })
addItem(userId, section, item, { source })
updateItem / removeItem(userId, section, itemId, { source })
markNone(userId, section, { source })
undo(userId, historyId)
```

Each call: zod validate → transaction (HealthProfile + User.profile mirror + ProfileHistory) → commit → clear Redis `profile:ctx:{userId}:*` → recalc nutrition goals if body/goals changed.

## 7. Coach flow details

### Classifier output (Haiku, JSON)

```json
{ "intent": "health_coaching", "specialists": ["recovery", "sleep"],
  "timeframe": "today", "symptoms": ["fatigue"], "simple": false }
```

Greetings/thanks skip the classifier (regex fast path).

### Gap engine (code)

| Topic | Required fields | Critical (ask first) |
| --- | --- | --- |
| diet / nutrition | allergies, diet.type, conditions, goals | allergies |
| supplements | medications, conditions, allergies | medications |
| exercise | fitness.limitations, conditions (heart/BP) | limitations |
| general | age, height, weight | none |

Max one question per reply. Skipped field not asked again for 7 days. No profile questions during emergency/distress.

### Specialist data plans

| Specialist | Existing services used | Default window |
| --- | --- | --- |
| Recovery | `getRecoveryAnalytics`, `calculateRecoveryScore`, `recoveryBaselineService`, `detectPatterns`, `getStressAnalytics` | today + 7d, 30d baseline |
| Sleep | `getSleepAnalytics`, `getSleepClinicalAnalysis`, `sleepScoreService` | last night + 7d |
| Nutrition | `getNutritionTrends`, `buildNutritionInsight`, `getWaterAnalytics`, `dietTargets`, `PersonalizedDietPlan` | today + 7d |
| Fitness | `getActivityAnalytics`, `getExerciseAdherence`, `FitnessGoal`, `ExerciseLog` | today + 7d/30d |
| Medical Lab | `HealthReport.aiAnalysis.metrics`, `compareReports`, `metricKnowledgeService` | latest + previous report |

Output contract:

```json
{ "specialist": "recovery", "status": "completed",
  "findings": ["Recovery 38, below 30-day baseline"],
  "data_used": ["recovery_score", "hrv"], "missing_data": [],
  "confidence": "moderate", "limitations": [] }
```

All tools take `userId` from `req.user`, never from the LLM.

### Safety (code, always runs)

- Red-flag symptoms (chest pain, breathing trouble, fainting, suicidal thoughts) → emergency/doctor message, skip coaching.
- No diagnosis, no medicine doses, no "X caused Y" claims.
- Diet/exercise advice filtered by allergies, conditions, limitations.
- Missing data is reported as missing, never as 0.

### Chat to profile save rules

| Case | Action |
| --- | --- |
| Coach asked, user answered | Save + "Saved · Undo" |
| User said "none" | `markNone` |
| User volunteered a fact | Confirm first |
| Sensitive or about someone else | Confirm first |
| Question or guess ("do I have diabetes?") | Save nothing |

## 8. APIs

| Method | Route | Auth |
| --- | --- | --- |
| POST | `/api/chat` (flag routes to V2) | protect, consent |
| GET | `/api/health-profile` | protect |
| PATCH | `/api/health-profile/:section` | protect |
| POST | `/api/health-profile/:section/items` | protect |
| PATCH / DELETE | `/api/health-profile/:section/items/:id` | protect |
| POST | `/api/health-profile/:section/none` | protect |
| GET | `/api/health-profile/completeness` | protect |
| GET | `/api/health-profile/history?field=&before=&limit=` | protect |
| POST | `/api/health-profile/undo/:historyId` | protect |

### Health profile API contract (built 23 Nov)

Sections: scalar `basic | body | lifestyle | diet | fitness | goals | coachPreferences`; lists `conditions | medications | allergies | surgeries | familyHistory` (field names: section 4 / `models/HealthProfile.js`).

| Call | Body | Notes |
| --- | --- | --- |
| `GET /` | | `{ profile, version, updatedAt, exists, readOnly }`. Keep `version` for the next write |
| `PATCH /:section` | `{ data: { weightKg: 74 }, version? }` | `null` or `""` clears a field |
| `POST /:section/items` | `{ item: { allergen: "Peanut", severity: "severe" }, version? }` | Same key (case-insensitive) updates the existing item. Returns `itemId` |
| `PATCH /:section/items/:itemId` | `{ data: { severity: "mild" }, version? }` | |
| `DELETE /:section/items/:itemId` | `{ version? }` | Removing the last item sets state `missing` |
| `POST /:section/none` | `{ version? }` | "I have none". 400 while items exist |
| `GET /completeness` | | `{ percent, answered, total, missingCritical, missing: [{ field, priority }] }` |
| `GET /history` | `?field=body.weightKg&limit=20&before=<id>` | Newest first; `nextBefore` for the next page |
| `POST /undo/:historyId` | | Only the latest change of a field can be undone |

Every write returns `{ success, changed, profile, version, updatedAt }` (no second GET needed). Errors: `400` bad input (`PROFILE_INVALID_INPUT`), `404` not found, `409` stale `version` (`PROFILE_VERSION_CONFLICT`: reload, then retry), `429` too many writes (30/min), `500` generic. Never send `source`, `verified`, `updatedAt`, `_id` or `meta`: 400.
| GET / PATCH | `/api/coach/symptoms(/:id)` | protect, consent |
| POST | `/api/coach/feedback` | protect, consent |
| POST | `/api/coach/internal/post-chat` | verifyQStash |

## 9. Other changes

- `ChatHistory`: add `summary`, `pendingQuestion`; cap `messages`.
- `UsageLog`: feature `ai_coach_v2`.
- DPDPA deletion cron (`server.js`): also delete HealthProfile, ProfileHistory, SymptomLog, CoachRun.
- Packages: `@langchain/langgraph`, `@langchain/langgraph-checkpoint-mongodb`, `zod`.
- Env: `AI_COACH_V2=false` by default.

## 10. Day plan checklist

**Day 1 (23 Nov): Health Profile**
- [x] Wider grep to confirm all write points (section 6)
- [x] `HealthProfile`, `ProfileHistory` models + indexes
- [x] `profileMapper` (both directions) + unit tests
- [x] `ProfileWriteService` with transaction + mirror + history + tests
- [x] Staging smoke test for the Mongo repo
- [ ] Move write points in section 6 to the service
- [ ] Direct-write guard test
- [ ] `migrateHealthProfile.js` (idempotent), run on staging, spot-check 10 users
- [ ] Health Profile routes + `ProfileContextService` (Redis)
- [ ] `npm test` passes

**Day 2 (24 Nov): Coach V2**
- [ ] Install packages, `AI_COACH_V2` flag in `chatRoutes.js`
- [ ] Graph skeleton + classifier + simple path (stream)
- [ ] Gap engine + pause/resume (Mongo checkpointer)
- [ ] 5 specialists
- [ ] Merge + safety + response
- [ ] Profile tools + Undo, SymptomLog, CoachRun, feedback, post-chat worker

**Day 3 (25 Nov): Tests**
- [ ] Unit, specialist, routing, data-integrity, chat-to-profile tests (see PM plan section 7)

**Day 4 (26 Nov): Eval + release prep**
- [ ] ~50 real questions (English + Hinglish), old vs new
- [ ] Safety cases, latency/cost on staging
- [ ] Go/no-go report

## 11. Next phase

Follow-up push (CoachFollowUp + FCM), proactive coaching, CoachMemory + vector search, Preventive specialist, report-based profile suggestions, women's/mental health sections, Claude 5.5 model upgrade, LangSmith.
