# AI Health Coach + Health Profile: Technical Spec

> **Status:** In progress. Day 1 steps 1–4 done (see section 0).
> **Timeline:** 23–24 Nov build, 25–26 Nov testing. Deadline 26 Nov 2026.
> **PM plan:** [ai-coach-backend-plan.docx](ai-coach-backend-plan.docx)
> **Earlier plan:** [health-profile-plan.md](health-profile-plan.md). Where it differs, this doc wins (see section 1).

## 0. Progress (start here)

### Done (22 Nov)

| Step | Files | Tests |
| --- | --- | --- |
| 1. Confirm write points | section 6 (updated line numbers) | n/a |
| 2. Models | `server/modules/health-profile/models/HealthProfile.js`, `ProfileHistory.js` | validated offline |
| 3. Mapper | `server/modules/health-profile/services/profileMapper.js` | `tests/healthProfileMapper.test.js` (12) |
| 4. Write service | `services/profileWriteService.js`, `services/profileRepo.js` | `tests/healthProfileWriteService.test.js` (15), uses `tests/helpers/memoryProfileRepo.js` |

Run: `cd server && node --test tests/healthProfileMapper.test.js tests/healthProfileWriteService.test.js` (27 pass, no DB needed).

### Next

1. **4b. Staging smoke test** for `profileRepo.js` (real Mongo transaction): create a temp user, run every operation, delete user + profile + history. Run with `USE_STAGING_DB=true`.
2. **5. Move write points** (section 6) to `ProfileWriteService`. Signup: wrap `User.create` + `createFromOnboarding` in one session.
3. **6. Migration script** `server/scripts/migrateHealthProfile.js` using `ensureProfile` per user (idempotent). Refuse to run unless `USE_STAGING_DB=true` or `--prod` is passed.
4. **7. APIs + ProfileContextService** (section 8).

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

### Known issues (not caused by this work)

- `npm test` hangs: `tests/wearableScoreDedup.staging.test.js` runs against real staging when `.env` has `USE_STAGING_DB=true`. Use `USE_STAGING_DB=false npm test` for normal runs.
- `tests/vault.test.js`: 4 tests expect a 10MB free vault base, config now gives 50MB. Owner of the vault change should update the test.

## 1. Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Keep **Claude** (Sonnet 4.6 for answers, Haiku 4.5 for classify/extract). No OpenAI | Already integrated (streaming, prompt caching, UsageLog). Switching adds cost and risk |
| 2 | Keep **QStash + node-cron**. No BullMQ | Redis is Upstash; BullMQ polling burns Upstash quota. QStash already works |
| 3 | **LangGraph** for the coach flow | Conditional routing, parallel specialists, pause/resume for follow-up questions |
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

| File | Line | What |
| --- | --- | --- |
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
| GET | `/api/health-profile` | protect, consent |
| PATCH | `/api/health-profile/:section` | protect, consent |
| POST | `/api/health-profile/:section/items` | protect, consent |
| PATCH / DELETE | `/api/health-profile/:section/items/:id` | protect, consent |
| GET | `/api/health-profile/completeness` | protect, consent |
| GET | `/api/health-profile/history?field=` | protect, consent |
| POST | `/api/health-profile/undo/:historyId` | protect, consent |
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
- [ ] Staging smoke test for the Mongo repo
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
