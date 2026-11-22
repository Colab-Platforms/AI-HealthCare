# AI Health Coach + Health Profile: Technical Spec

> **Status:** Approved for build. Nothing is built yet.
> **Timeline:** 23–24 Nov build, 25–26 Nov testing. Deadline 26 Nov 2026.
> **PM plan:** [ai-coach-backend-plan.docx](ai-coach-backend-plan.docx)
> **Earlier plan:** [health-profile-plan.md](health-profile-plan.md). Where it differs, this doc wins (see section 1).

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
- Mirror is rebuilt fully from HealthProfile on every write (never patched), so it cannot drift.
- Mirror example: `medications[{name:'Metformin', dose:'500mg', active:true}]` → `medicalHistory.currentMedications: ['Metformin 500mg']` (active only).

## 6. Write points to move to ProfileWriteService (Day 1)

| File | Line | What |
| --- | --- | --- |
| `controllers/authController.js` | 630 (`register`, `User.create({ profile })`) | Onboarding |
| `controllers/authController.js` | 1600 (`updateProfile`) | Profile edit |
| `controllers/nutritionController.js` | 950–952, 1101–1103 | age/height/weight from health goal |
| `controllers/nutritionController.js` | 1285–1286 | weight update |
| `services/wearableIngestService.js` | 274 | weight from smart scale (already uses a session) |

- `nutritionController.js:1529` (`waterGlassSizeMl`) is an app setting, stays on User.
- `activityController.js` and `privacyController.js` matches are read queries, not writes.
- Day 1: re-run a wider grep (`$set` with a `profile` object, `findByIdAndUpdate(..., { profile })`, `scripts/`) before closing this list.
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
- [ ] Wider grep to confirm all write points (section 6)
- [ ] `HealthProfile`, `ProfileHistory` models + indexes
- [ ] `profileMapper` (both directions) + unit tests
- [ ] `ProfileWriteService` with transaction + mirror + history + tests
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
