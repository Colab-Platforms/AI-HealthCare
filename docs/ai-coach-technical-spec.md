# AI Health Coach + Health Profile: Technical Spec

> **Status:** In progress. Day 1 done (Health Profile, verified on staging). Day 2 Coach V2 built and wired behind `AI_COACH_V2` (offline tests green), **not yet run against the real API**. All committed and pushed to `Staging` on 23 Nov.
> **Timeline:** 23–24 Nov build, 25–26 Nov testing. Deadline 26 Nov 2026.
> **PM plan:** [ai-coach-backend-plan.docx](ai-coach-backend-plan.docx)
> **Earlier plan:** [health-profile-plan.md](health-profile-plan.md). Where it differs, this doc wins (see section 1).

## 0. Progress (start here)

### Resume on another machine (updated 25 Nov)

**Status (25 Nov, uncommitted on top of c187070):** issues 1–7 DONE, fixed "undo" reply DONE, all re-tested on staging (real API) with 4 more fixes from that run (below, "25 Nov staging re-test"). **Next:** commit + push, then step 6 (`AI_COACH_V2=true` on staging + app test with the opener), Day 3 list, production.

1. `git pull origin Staging`, then in `server/`: `npm install` (needed: `@langchain/langgraph`, `@langchain/core`, `zod`; without it the coach tests fail with "Cannot find module").
2. Offline tests: `cd server && node --test "tests/healthProfile*.test.js" "tests/aiCoach*.test.js"` → 249 pass (+4 in coachSeedPersonas.test.js). Full suite: `$env:USE_STAGING_DB="false"; npm test` → 835 tests, 830 pass, only the 4 known vault failures + 1 skipped.
3. **Test users + terminal chat (25 Nov).** Two seeded personas on staging, 6 months of data each (`scripts/lib/coachSeedPersonas.js`, re-seed any time with `--reset`; it prints a new password):
   - **a** = Rahul, 24, male, `coach-test@example.invalid`: muscle gain, vegetarian, peanut allergy, Vit D / B12 low + LDL high (report 5 months old), unanalysed vault file, steps 5k -> 9.5k, 2-week sick break ~2 months ago, short sleep last night + recovery 38, hard leg day yesterday, protein always short, last weigh-in 20 days ago. App targets: 2878 kcal, 7500 steps, 8 h sleep, 60 cardio + 120 strength / week.
   - **b** = Sushila, 67, female, `coach-test-b@example.invalid`: type 2 diabetes (metformin) + hypertension (amlodipine), knee pain (osteoarthritis), eggetarian, weight 88 -> 84.6 kg (last weigh-in 50 days ago), fasting sugar 165 -> 135 (last 9 days ago), HbA1c 8.4 -> 7.6 (two reports), walks + chair yoga, high-carb meals, light sleep. Allergies deliberately not filled (tests the "ask first" gap). App targets: 1625 kcal, 8602 steps, 7.5 h sleep, 150 cardio + 90 strength / week.
   - Seed = app paths where possible: `calculateNutritionGoals` (signup), `HealthGoal.create` (hooks), FoodLog rows + the app's `updateDailySummaryInternal` per day, real report `aiAnalysis.metrics` shape, catalog activity ids (the old seed's `weight_training` was not in the catalog). Rows tagged `test_seed`; `--reset` also clears chat meal logs, summaries, coach state, health profile, the old diet plan; real device rows (apple_watch on user a) are kept. Waits for Redis before clearing caches (a stale diet-plan cache otherwise leaked 2400 kcal into half the summaries). Test: `tests/coachSeedPersonas.test.js`.
   - `node scripts/coachStagingRun.js --chat --persona=b`: interactive chat with history; `/data` (what the model saw), `/details`, `/days N`, `/opener`, `/reset`, `/user a|b`, `exit`. One-line summary under each answer (route, path, first word, question, saves).
   - **App finding (not fixed, app-side):** two calorie goals disagree for persona b: `User.nutritionGoal` (signup calculator, what targets.js / dashboard use) = 1625 kcal, active `HealthGoal.dailyCalorieTarget` (model hook, what daily summaries + the nutrition specialist use) = 1476. Same signup creates both, so real users can have this too; the coach's data block then shows both numbers. Needs one source (decide which).
4. Staging runs (scripted), from `server/`:
   ```
   $env:USE_STAGING_DB="true"
   node scripts/createCoachTestUser.js --reset-coach     # clear coach memory + symptoms (do this before and after --days-later runs)
   node scripts/coachStagingRun.js --verbose "msg 1" "msg 2"   # one conversation; --days-later=N simulates time passing
   node scripts/inspectCoachTestUser.js                  # read-only: seed rows, odd sleep nights, targets, coach state
   ```
5. **Fix these 7 issues** (found in the 24 Nov evening staging test, ~20 messages): ALL DONE (1–6 on 24 Nov night, 7 on 25 Nov):
   1. ~~**Red flags (safety)**~~ **DONE (24 Nov):** `safety/safetyRules.js` now catches "chest/dil mein (tez) dard/dabav", "saans phool rahi" (now, not habitual "phoolti hai"), "saans nahi le pa raha", "dum ghut raha", and a new left-arm rule (left/baaye haath/arm sunn/numb/bhaari/jhunjhuni/dard, "pain down my left arm"). Not flagged: "seene/pait mein jalan" (acidity), negations. **Exercise caution (product decision 24 Nov, option B):** chest pain or breathlessness with an exercise word (gym / workout / run / chest day ...) and NO severe sign (strong pain, left arm / jaw, sweating, dizziness, "aaram karne pe bhi" ...) returns `{ flagged: false, caution }`: the coach answers (data line: no workout today, rest, doctor if it repeats) and a fixed `exerciseCautionLine` (when to call 112 / 108) is appended by code. The classifier's `redFlag` does not override a caution (routeAfterPrepare + reconcile). Tests in `aiCoachCore.test.js` (2 new) and `aiCoachFastPath.test.js` (left arm now gets the safety reply before coaching; the classifier-only test uses a jaw/shoulder + sweating message).
   2. ~~**Junk save**~~ **DONE (24 Nov):** `tools/profileTools.js` `isVague` (yes / haan / unspecified / unknown / bare "injury", "pain", "dawai", "purani injury" ...) for `SPECIFIC_TARGETS` (allergies, medications, conditions, surgeries, familyHistory, fitness.limitations). `triageFacts` returns `vague` (never saved or confirmed). Graph (`profile_actions` → `gap_check`): a vague answer or a bare "yes" to a pending question on those fields asks ONE follow-up (`specifyQuestion`, e.g. "Injury ya dard exactly kahan hai?") with `pendingQuestion.followUp: true`; a second vague answer is dropped. Classifier prompt: no fact for "yes" without a value, never "unspecified". Tests: 3 in `aiCoachGraph.test.js`.
   3. ~~**Language mix**~~ **DONE (24 Nov).** Root cause: two language decisions that disagreed. The fast path used a 15-word regex (`HINGLISH_HINT`: "tired hoon, gym jaun?" = english) to pick the gap question, while Sonnet chose the reply language itself and was told to copy the question verbatim. Fix: `orchestrator/language.js` (`detectLanguage`: Devanagari = hindi, ~150-word Hinglish lexicon without English look-alikes, `neutral` for ok / haan / numbers / emoji; `resolveLanguage`: neutral keeps `CoachState.lastLanguage`, otherwise the classifier, rules only when there is no model answer). Resolved once in `prepare`, used by every node (fixed lines, reconcile, gap questions); `lastLanguage` persisted. Gap and follow-up questions carry both wordings (`questionAlt`) and the prompt says to ask in the reply's language. Tests: `tests/aiCoachLanguage.test.js` (4), 3 in `aiCoachGraph.test.js`.
   - **Bug found while doing #3 (from #2):** `CoachState.pendingQuestion` had no `followUp` field, so Mongo (strict) would have dropped it and the "ask once" guard would loop. Added to the schema. The in-memory coach state repo now stores what Mongo would (schema cast, unknown fields dropped), so this class of bug fails in tests.
   4. ~~**"A ya B?" in symptom check-ins**~~ **DONE (24 Nov).** Cause: gap questions had fixed wording, but symptom and weight check-ins only told the model what to ask, so it wrote its own ("theek hua ya abhi bhi hai?"). `orchestrator/checkIns.js` now has `QUESTIONS` (symptom: "Ab <symptom> kaisa hai?" / "How is your <symptom> now?"; weight: "Abhi aapka weight kitna hai?" / "What is your weight now?") and `askExactly()`: exact question in the reply's language + the other wording + "no options like X ya Y". Check-ins return `question: { en, hi }`. Weight now asks for the number instead of "would you like to update it?" (a bare "yes" cost a turn); the weight `pendingQuestion` uses the same text. Tests: 1 new + 1 updated in `aiCoachCheckIns.test.js`.
   5. ~~**Dropped paused request still answered from history**~~ **DONE (24 Nov).** The code dropped it, but the app's chat history still carries it, so the model answered it anyway. `prepare` now returns `droppedRequest` (the paused text, max 300 chars) and `buildRequest` adds a data line: that request was put on hold and dropped, answer ONLY the latest message, don't mention it. Not added when the request is resumed. Tests: 2 assertions added in `aiCoachRound3.test.js`.
   6. ~~**A question every turn**~~ **DONE (24 Nov).** `orchestrator/checkIns.js`: `askedLog['checkin:last']` (`LAST_ASK_KEY`) is set whenever a non-blocking question goes out (gap, symptom follow-up, weight, sugar, vault, report, meal-plan offer, reconcile's "save to profile?"). Within 30 min of it (`inQuestionCooldown`) no non-blocking question and no meal-plan offer. On a turn where the user reports a symptom (`classification.symptoms`), no unrelated question (other symptom follow-ups, weight, sugar, vault, report); a gap question tied to the request (e.g. injuries before gym advice) is still allowed (refined from the original rule: the injury question was never the complaint). Blocking questions are never held back. Tests: 3 in `aiCoachCheckIns.test.js` (incl. a multi-turn graph run).
   - **NEW (24 Nov, user asked for it before 26 Nov): chat opener.** `POST /api/coach/opener` (`modules/ai-coach/routes.js`, mounted in `server.js`; protect + health consent + `aiHealthCoach` feature; returns `opener: null, reason: 'disabled'` when `AI_COACH_V2` is off; never errors to the app). Logic in `opener/openerService.js`, code only (no model call):
     - text = greeting by IST time + one line on the last 7 complete days (steps avg vs goal and goal-met days, sleep avg vs goal, days with meals logged; from `progressSpecialist`'s new structured `summary`) + at most ONE question (open symptom not asked in 12 h, else a missing fact via the gap engine with topics nutrition / medical_lab / general);
     - once per IST day (`CoachState.lastOpenerAt`), not on a day the user already chatted (`CoachState.lastChatAt`, set by `persist` on every chat turn), nothing to say → `opener: null` (no bare greeting), 30-min question cooldown respected;
     - the question is remembered (`pendingQuestion` for a gap, `markAsked` for a symptom, `askedLog`), so the reply is read as its answer.
     - **App contract:** call it ONLY when the user opens the coach screen (never on app launch, no popup / push); show `opener.text` as the first coach bubble and save it to chat history like any assistant message; `opener: null` → show nothing. Response: `{ success, opener: { text, language, question: { kind: 'symptom' | 'gap', field } | null } | null, reason? }`.
     - Tests: `tests/aiCoachOpener.test.js` (8).
   7. ~~**Coach gender**~~ **DONE (25 Nov):** prompt rule (masculine first-person forms in Hindi / Hinglish); the code-written lines were already masculine. Test scans every ai-coach file for feminine first-person forms. Was: "update kar dungi" vs "kar sakta hoon". Decision: male forms everywhere (quick reply already uses "sakta"); add a prompt rule in `response/responseGenerator.js` (COACH_RULES) + check the code-written Hinglish lines (fixed replies in `mainCoachGraph.js`, `safetyRules.js`, opener) use male forms; add a test.
   - Staging re-run should also check (new since the last run): the language fix on the fast path ("tired hoon, gym jaun?"), "haan" to the injury question (follow-up, nothing saved), exercise caution ("gym ke baad saans phool rahi hai"), the 30-min question cooldown, and `POST /api/coach/opener` (call it with the test user's token; `--reset-coach` clears `lastOpenerAt` / `lastChatAt` too).
   - ~~Optional: fixed reply for "undo"~~ **DONE (25 Nov):** node `action_reply` (was `food_logged_reply`) handles "yes" to a meal and "undo"; `undoText` names what was removed (e.g. "Theek hai, hata diya: injury / limitation: left knee pain."). Staging: 1.42 s, no Sonnet call.
   - **25 Nov staging re-test** (~20 messages, reset-coach before/after; all of issues 1–7 confirmed: Hinglish red flag 0.15 s, vague "haan" -> "Injury ya dard exactly kahan hai?" and nothing saved, exact symptom question, dropped request not answered, cooldown, masculine forms, opener 488 ms with routine + symptom question and `already_today` on the 2nd open). Fixed from it:
     - **Crash (from the 24 Nov language change):** `HINGLISH_HINT` was removed but the meal-"yes" reply still used it: an English chat saying "yes" to a meal would throw. Fixed (uses the resolved language); regression test in `aiCoachFoodLog.test.js`.
     - **Exercise-caution turn asked the injury question**, and the fixed 112 line landed after it. Now no non-blocking question (or meal offer) on a caution turn (`gap_check`).
     - **Sleep label:** data said "the night before last" and then "(last night 114 min less)" (hard-coded), so the model said "last night". Now "that night", plus "No sleep logged for last night yet." when the newest night isn't last night (`specialists/sleep.js`).
     - **English message after a Hinglish chat got a Hinglish reply:** the resolved language was never given to the model. Data block now has "Reply language: ..." (`buildRequest`). Staging re-run: English reply.
     - Test: the "parallel reads" test checks call order instead of a stopwatch (was flaky in the parallel full suite).
     - `coachStagingRun.js --opener`: runs the opener first (same logic as `POST /api/coach/opener`), its text goes into the history.
   - Not fixed, noted: "ok" is read as thanks ("You're welcome!"); a short symptom reply after the opener ("thoda better hai") takes the full path (3.7 s, no rule topic) and could use the fast path; buildRequest's "Today (UTC)" uses the real clock, not `--days-later`.
   - Speed notes: fast path 1.1-2.5 s, full path 2.5-5.5 s (classifier 1.4-3.1 s). A pending question forces the full path even for "hi" (2.5 s).
6. After the fixes: re-run the same staging checks yourself (reset-coach before/after), then `AI_COACH_V2=true` on the staging server(s) and test from the app with the test user. App opt-in for typed events: `"coachEvents": true` in the `/api/chat` body.
7. Later (Day 3 list): CoachRun log, `POST /api/coach/feedback`, post-chat summary (QStash), eval (~50 English + Hinglish questions, old vs new).
8. Production: follow the "Production rollout checklist" below (indexes incl. CoachState + SymptomLog first, then deploy, then migration). `AI_COACH_V2` and `HEALTH_PROFILE_WRITES` must match on Vercel and Render.

Test-user data notes: the test user has real apple_watch rows (created 23 Nov 12:24, someone synced a watch on this account), incl. a 1233-min sleep row on 10 Nov (shown capped at 14 h by the app). Old "74" recovery: probably from that sync, unverified (row gone).

### First real-API staging run (24 Nov) and fixes (committed 24 Nov)

Run: "I'm tired + gym" / "no injuries" / "undo". Worked: classifier on the model, Sonnet 5.5 accepted `between_tools` + `fallbacks`, safe answer with the injury question, cost ~$0.006 then ~$0.002 per message. First word 4.40 s / 2.95 s / 2.35 s (target ≤ 2 s).

| Problem found | Cause (checked, not guessed) | Fix |
| --- | --- | --- |
| Coach memory not saved (`Mongoose maps do not support keys that contain "."`) | `CoachState.askedLog` was a Map; key `fitness.limitations`. Tests used an in-memory repo that didn't apply Mongoose's rule | `askedLog` is now `[{ field, askedAt }]`; the in-memory repo now validates against the real model, so the same class of bug fails in tests |
| Turn 3 "corrected" its own real numbers | No specialists ran for "undo"; the model read the missing data as "I made it up" | Rule: never retract earlier numbers unless the user says so; data block says "none fetched because not needed" |
| Sleep never checked for "tired" | Classifier picked only recovery + fitness | `orchestrator/routingRules.js`: 15 keyword rules (EN + Hinglish) always added to the classifier's choice; 35 real-user phrasings tested |
| Advice could ignore the app's targets | Targets weren't in the prompt | `context/targets.js`: calories / macros (from `nutritionGoal`, as the dashboard), water, steps, sleep, weekly exercise, and what is left today; rule: suggestions must fit them |
| "Yesterday 74" while the seed wrote 38 for that date | **Not settled.** Code: only the seed and `calculateRecoveryScore` write that collection, and the latter deletes (not writes 74) when there is no HRV / RHR. Also the seed's max is 72 | `scripts/inspectCoachTestUser.js` (read-only) shows each row's source and created / updated time; `coachStagingRun.js --verbose` prints the exact data the model saw. Run both before `--reset` |
| Slow first word | Two model calls in a row; Haiku thinking on; specialists waited for the classifier | Haiku `thinking: disabled`; specialists from the rules are prefetched in parallel with the classifier (reused, only additions fetched after); per-step timings recorded |

Also: months-back questions ("last 6 months", "pichle 3 mahine", "since June") → `context/lookback.js` + monthly averages in sleep / recovery / fitness / nutrition, read through `{user, date}` indexes and cached 6 h; 5 s limit for that first read.

Pre-existing bug found, not fixed: `getExerciseGuidance(null)` puts an unknown age in the youth bucket (`null <= 17` is true in JS), so `getStepGoal` and exercise targets give adults 7,000 steps / 420 min cardio. The coach skips the weekly exercise target when age is unknown.

Tests: `tests/aiCoachRouting.test.js` (3), `tests/aiCoachV2Fixes.test.js` (11); all health profile + coach tests 166 pass; full suite 748: 4 known vault failures, 1 skipped.

Next (user runs, staging):
```
node scripts/inspectCoachTestUser.js            # BEFORE reset: where did 74 come from
node scripts/createCoachTestUser.js --reset     # data relative to today
node scripts/coachStagingRun.js --verbose "I'm feeling tired today, and I've to go to the gym today" "no injuries" "undo"
node scripts/coachStagingRun.js --verbose "what should I eat for dinner?" "how was my sleep in the last 6 months?"
```

### Coach V2 round 2 (24 Nov, committed 24 Nov)

Agreed scope before launch (user, 24 Nov): scope guard, chat food logging, SymptomLog + follow-up, meal -> plan preference, week-over-week + goal adherence, activity rule. After launch: vault analysis, report timeline, condition -> food rules (doctor review), chat-summary memory. (Speed step was pulled in before launch, done 24 Nov.)

Done in this round:

| Part | File | Notes |
| --- | --- | --- |
| Scope + injection guard | `safety/scopeGuard.js`, classifier intent `off_topic`, prompt "Scope" rules | injection = regex, no model call; off-topic = fixed friendly reply, no answer-model call; mixed messages answer only the health part |
| Week-over-week + goals | `specialists/progress.js` (new specialist `progress`) | last 4 rolling weeks vs app targets: steps goal-met days, sleep goal-met nights, calories within ±10%, cardio/strength minutes vs weekly target, trend vs last week |
| Symptoms | `models/SymptomLog.js` (`symptom_logs`), `tools/symptomTools.js`, classifier `symptomUpdates` | episode opens on mention; closes ONLY when the user says it's gone; better/same/worse recorded; active ones make advice gentle. DPDPA delete + export |
| Check-ins (one question per reply) | `orchestrator/checkIns.js`, `context/freshness.js` | priority: blocking gap > symptom follow-up (every 2 days until resolved, doctor nudge after 14 days) > gap > stale weight (weight goal + active user, 14 days; else 45) > stale sugar (diabetes, 7 days) > vault file not analysed > old report with out-of-range values (120 days). Each has its own snooze |
| Weight from chat | `services/weightLogService.js` (moved out of `nutritionController.logWeight`, unchanged) | chat weight = the app's weigh-in (HealthMetric, profile + BMI, HealthGoal, nutritionGoal); undo removes a weigh-in the chat created |
| Routing | "activity" word added; "improve / goals / compare" -> `progress` | |

Vault (checked): `VaultReport` stores files only (title, note, date, file); nothing reads their contents, lab values exist only in analysed `HealthReport`. Product decision (24 Nov): vault stays storage; the coach notices a vault upload with no analysed report after it and suggests uploading it under Reports.

Meal plan (checked): the 7-day plan generator (`dietRecommendationAI`) already uses `foodPreferences.mealPreferences` as favourites and avoids the previous plan's dishes, so "add this meal pattern to my plan" = save the pattern there. Temporary needs (upset stomach) must come from active SymptomLog episodes, not mealPreferences.

Then (same day):

| Part | File | Notes |
| --- | --- | --- |
| Related symptom asked FIRST (user decision) | `checkIns.js` (`SYMPTOM_TOPICS`, `isRelated`) | e.g. stomach symptom + food request -> "pait ab kaisa hai?" before any plan; no specialists fetched for that turn; not again within 12 h if skipped |
| Paused request | `CoachState.pendingRequest` | a blocking question (symptom or missing allergy) saves the request; the reply resumes it ("Earlier the user asked ... now answer it"). Before this, the original request was lost after a blocking question (also for the allergy question) |
| Meal -> 7-day plan | `tools/mealPrefTools.js`, `CoachState.pendingMealPref` | offered after meal suggestions; on "haan" a small Haiku call extracts the meal PATTERNS from that reply into `foodPreferences.mealPreferences` (max 6 per slot); never while a stomach-type symptom is active; nothing extracted on "nahi" |
| Food logging from chat | `tools/foodLogTools.js`, `services/foodLogService.js`, classifier `mealLog`, `FoodLog.source: 'chat'` | numbers the user said win; the app's estimator (`nutritionAI.quickFoodCheck`, basic tier) fills the rest, scaled to the user's calories; shown with ~ on estimates; saved only on "yes" via `updateDailySummaryInternal` (same as the app); "left for today" re-read after saving |
| Sleep wording | `specialists/sleep.js` | "last night (woke up today)" instead of "night ending today" (the model had said "aaj raat") |

Follow-up: `logMeal` still has its own copy of item / total normalisation; move it onto `foodLogService` after launch. Food logging adds the estimator call (Gemini via OpenRouter) to that turn; not measured yet.

Speed (24 Nov staging, measured before the fix): Sonnet first token ~0.8 s; Haiku classifier 1.7-4.2 s = most of the 2.2-5.5 s first word.

**Speed step DONE (24 Nov, user said go; not yet measured on staging):**
- Fast path (`mainCoachGraph.js` prepare): if the routing rules matched a topic, the answer starts at once; the classifier runs in parallel (`runCtx.classify`). `timings.path` = fast / full / no_model.
- Goes the slow (full) path: no topic matched (possible off-topic), a meal eaten (food log), a stated health fact (`FACT_HINT_RE`), stomach/pain symptoms (`SYMPTOM_HINT_RE`), a pending coach question, a paused request.
- New `reconcile` node (after respond, fast path only): waits for the classifier, then appends the safety line if it says redFlag, records symptoms, and asks "save to profile?" (`profile_confirm`) for volunteered facts if nothing else was asked.
- Code red-flag rules still run before any answer. Trade-off: a red flag only the classifier catches is added at the end of the same reply.
- Food log turns: the estimator (`runCtx.estimate`) runs in parallel with the classifier.
- `parseSymptomReply` (symptomTools): short replies like "ab thik hai" / "thoda kam" / "theek nahi" update the single open symptom without the classifier (staging miss).
- Prompt: capabilities list (CAN log meals / save facts / weight / meal pattern; CANNOT log water, sleep, workouts, make the plan, set reminders), no invented offers, no "A or B?" questions.
- Staging script: `--days-later=N` time shift (test symptom follow-ups, stale weight), breakdown shows the path + classifier finish time.
- Tests: `tests/aiCoachFastPath.test.js`; full suite 776 pass, 4 known vault failures.

**Staging run after the speed step (24 Nov) and round 3 fixes (committed 24 Nov):**
- Measured: fast path warm first word 1.15 s (was 3-5 s); first message of a process ~2.8 s (prepare ~2 s: memory load, then the other reads).
- `prepare` now starts profile / targets / freshness / prefetch together with the coach-memory load (skipped for short yes/no/undo replies, started after memory if needed).
- Related symptoms ranked (`relevance` in checkIns.js): main topic first (dinner -> stomach burning before fatigue), tie -> most recently mentioned.
- Progress weeks = last 7 complete days (today excluded; sleep dated today = last night, included). Today shown as its own "today so far" line. Fixes "steps down 25%" caused by today's half day, and the clash with fitness's 7-day average.
- "yes" to a meal: fixed reply node `food_logged_reply` (no Sonnet call), Hinglish from the reply or the previous user message.
- Prompt: no follow-up questions of its own (only the one the data gives; a clarifying one only if the message can't be answered), never "X ya Y?", tu / aap by how the user talks.
- `inspectCoachTestUser.js` lists odd sleep nights (>12 h, <1 h, several sessions per date) for the "2 weeks ago avg 14 h" row (not yet checked).
- Tests: `tests/aiCoachRound3.test.js`; full suite 784 pass, 4 known vault failures.

**Round 4 (24 Nov, committed 24 Nov), from the staging re-run:**
- Measured: first message fast path 1.81 s (was 2.85), meal "haan" 1.25 s with no Sonnet call, symptom ranking + progress weeks confirmed on staging.
- Bug: a paused request (blocking symptom question) resumed on ANY next message ("tired, gym?" got the paused dinner plan). Now it resumes only for an answer: a symptom update, or a short reply (<= 6 words). A new request (rule topic + longer message) wins; paused one dropped (`timings.droppedPausedRequest`). Blocking profile questions unchanged.
- `within()` (graph) and `askedWithin()` (checkIns): a date more than 5 min in the future = not within / not asked (time-shifted runs, clock skew).
- "14 h sleep" verified: a 1233-min Apple Watch row (10 Nov) capped by the app's `filterPlausibleSleep` at 840 min. Coach sleep + progress now leave nights at the cap out (`isBrokenNight`) and say so. The app's Sleep screen still shows 14 h (app-side, not changed).
- The test user has real apple_watch rows created 23 Nov 12:24 (someone synced a watch on this account): probable source of the old "74" recovery, unverified (row gone).
- `createCoachTestUser.js --reset-coach`: clears CoachState + SymptomLog only; `--delete` now also removes SymptomLog.
- Tests: 6 more in `aiCoachRound3.test.js`; full suite 790 pass, 4 known vault failures.

Tests: 191 health profile + coach tests pass; full suite 773: 4 known vault failures, 1 skipped. New collection `symptom_logs` has a partial unique index: include `SymptomLog` in `syncIndexes --only=...` at rollout.

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

### Coach V2 progress (23 Nov, committed 24 Nov)

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
2. `node scripts/syncIndexes.js --dry-run --only=HealthProfile,ProfileHistory,CoachState,SymptomLog`, then without `--dry-run`. **Before** deploying the code: without the unique index, two parallel first writes can create two profiles for one user.
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
