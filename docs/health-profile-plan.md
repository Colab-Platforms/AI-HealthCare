# Health Profile: Plan

> **Status:** Planning only. Nothing in this doc is built yet.
> **Scope:** `server/` (existing backend).
> **Management version:** [Take.Health: Health Profile Proposal](https://claude.ai/artifact/Xr4pj1EBLSp9aD2iuDwifz)

## 1. Goal

One `HealthProfile` per user that holds every health fact, small or big. Every feature (AI chat, diet, supplements, exercise, food check, insights) reads from it, so responses fit the user.

- **Profile** = who the user is (slow-changing: conditions, allergies, height).
- **Device data + scores** = how the user is doing now (daily). Stays in its existing models; only summaries go into the profile.

## 2. Problem today

- Profile data is scattered: `User.profile`, `foodPreferences`, `diabetesProfile`, `lifestyle`, `healthMetrics`.
- Lab values live inside `HealthReport` and are not reused.
- Each AI service builds its own context, so answers differ and often miss conditions, medicines and allergies.
- Self-reported values (e.g. `activityLevel`) are trusted over device data.

## 3. Market reference

- Google Health (May 2026), Perplexity Health (Mar 2026), ChatGPT Health (Jan 2026), Hundred Health: records + labs + wearables in one profile, AI on top. US-focused.
- ABHA / ABDM (India): consent-based records, 90 crore+ accounts, no daily AI guidance.
- FHIR (HL7) splits a profile into resources: `Patient`, `Observation`, `Condition`, `AllergyIntolerance`, `MedicationStatement`, `FamilyMemberHistory`, `Consent`, `AuditEvent`. Our sections follow the same split.

## 4. Profile sections

| Section | Fields |
| --- | --- |
| basic | dob, gender, bloodGroup, city, state, language |
| body | height, weight, waist, bodyFat, bmi (derived) |
| conditions[] | name, status (`active` / `controlled` / `resolved`), diagnosedYear |
| medications[] | name, dose, frequency, since, active |
| allergies[] | allergen, type (`food` / `drug` / `other`), severity, reaction |
| surgeries[] | name, year, bodyPart |
| familyHistory[] | relation, condition |
| lifestyle | smoking (`never` / `former` / `current`), alcohol, sleepHours, stressLevel, profession, activityLevel, screenTime |
| diet | type, region, likes, dislikes, intolerances, mealTimings |
| fitness | experience, preferredExercise, equipment, limitations |
| womensHealth (optional, encrypted) | cycle, pcos, pregnancy, menopause |
| mentalHealth (optional, encrypted) | mood, anxiety, sleepIssues |
| goals | primary, targetWeight, timeline |
| derived (system only) | 7d / 30d averages (sleep, steps, restingHr, hrv, activeMinutes), latest scores + trend |

Rules:

- Every value stores `source` (`manual` / `device` / `report` / `chat` / `derived`) and `updatedAt`.
- A list that is known to be empty is stored as `none`, which is different from missing, so we don't ask again.
- On a device vs manual conflict, device wins; the user can override.

## 5. Models

| Model | New / existing | Purpose |
| --- | --- | --- |
| `HealthProfile` | New | One doc per user, all sections above |
| `ProfileHistory` | New | Append-only change log: field, old, new, source, at. Used for trends and audit |
| `ProfileSuggestion` | New | Values from reports / chat / devices waiting for user confirm |
| `HealthMetric` | Existing, extend | Lab values: add types (vitD, B12, lipid, TSH...), `source`, `reportId` |
| `HealthReport` / Vault | Existing | Source for report extraction |
| `ConsentLog` | Existing | Consent for doctor share |
| `ChatHistory` | Existing, extend | `pendingQuestion` + saved-value refs for Undo |

`User.profile` health fields move into `HealthProfile`. After migration there is **one write path** (`HealthProfile`) plus a temporary compatibility getter until all services switch.

## 6. APIs

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health-profile` | Full profile |
| PATCH | `/api/health-profile/:section` | Update a section |
| POST | `/api/health-profile/:section/items` | Add medication / allergy / condition etc. |
| PATCH / DELETE | `/api/health-profile/:section/items/:id` | Edit / remove item |
| GET | `/api/health-profile/completeness` | % + missing fields in priority order |
| GET | `/api/health-profile/history?field=weight` | Trend for a field |
| GET | `/api/health-profile/suggestions` | Pending auto-fill values |
| POST | `/api/health-profile/suggestions/:id/accept` | Save suggestion |
| POST | `/api/health-profile/suggestions/:id/reject` | Drop suggestion |

Internal service (no route): `getProfileContext(userId)`. Returns a compact summary of profile + derived + latest scores, Redis-cached, cleared on any profile change.

## 7. Flow: user action vs backend

| # | User does | Backend does |
| --- | --- | --- |
| 1 | Signs up | Creates account, logs consent |
| 2 | Fills onboarding (unchanged screens) | Creates `HealthProfile`, completeness ~30%, calculates calorie goal |
| 3 | Sees "Profile 30%" home card | Returns completeness + missing fields |
| 4 | Adds allergy / medicine from card | Saves item, writes history, updates completeness, clears context cache |
| 5 | Connects watch / phone | Existing wearable pipeline ingests; nightly cron writes 30d averages to `derived` |
| 6 | Uploads report to Vault | AI extracts values, creates `ProfileSuggestion` (not saved) |
| 7 | Accepts suggestion | Saves to profile + `HealthMetric`, history, cache clear |
| 8 | Mentions a fact in chat | Reply goes out immediately; extraction runs in background (see section 9) |
| 9 | Opens diet / chat / supplements / exercise | `getProfileContext` goes into the AI call |
| 10 | Opens a feature with a key field missing | Gap engine flags it, app / chat asks one question |
| 11 | Edits a value (e.g. weight) | Old value kept in history, new saved, goal recalculated |
| 12 | Inactive, profile < 70% | At most one nudge every 3 to 4 days |

**Existing users:** an idempotent migration copies `User.profile`, `foodPreferences`, `diabetesProfile`, `lifestyle` into `HealthProfile` and turns old Vault reports into suggestions. Run on staging first. On next open, the user sees "Your Health Profile is ready" and only confirms or edits.

## 8. Device data

- No new ingestion. Data already arrives through `wearableIngestService` and the sync services into daily summary models (`SleepSession`, `DailyActivityMetric`, `HeartRateDailySummary`, `RecoveryDailySummary`, `StressDailySummary`, `BodyCompositionSample`).
- No recalculation on raw samples. A nightly QStash cron (Vercel) reads about 30 daily rows per metric per user and writes averages + trend to `derived`.
- Uses:
  - `activityLevel` comes from real steps, not the signup answer, so calorie targets are accurate.
  - A smart scale reading becomes a weight suggestion.
  - Score baselines adjust for age and conditions.
  - Profile + device alerts, e.g. BP condition + resting HR rising 3 days, or diabetic + falling recovery + poor sleep.
- Users without devices: `derived` stays empty and self-reported values are used.

> Exact wearable flow to be verified in code before build; this section is based on service and model names.

## 9. AI chat as personal health assistant

On every message the AI gets three things:

1. Profile summary (`getProfileContext`)
2. Missing fields important for the current topic (from the gap engine)
3. Tools to update the profile

**Example:**

1. User: "weight loss diet do"
2. Gap engine (intent = diet): allergies and diet type missing
3. AI: "Pehle bata do, koi food allergy hai?" (one question only)
4. User: "haan peanut se"
5. AI calls `add_item(allergies, {allergen: "peanut"})`
6. Backend validates (zod), saves with `source: chat`, writes history, clears cache
7. Chat shows: "Saved: Peanut allergy · Undo"
8. AI continues with a peanut-free diet

**Parts:**

| Part | Job |
| --- | --- |
| Gap engine (code rules, not AI) | Missing fields by topic, in priority order |
| Tools | `update_profile`, `add_item`, `mark_none` |
| Validator | Enum and range checks on every AI tool call |
| `pendingQuestion` in chat session | Remembers what was asked, so "nahi" maps to `none` |

**Topic to required fields:**

- Diet: allergies, diet type, conditions, goal
- Exercise: injuries, BP / heart conditions, fitness level
- Supplements: current medicines, lab values
- General: age, height, weight

**Save rules:**

| Situation | Action |
| --- | --- |
| AI asked, user answered directly | Save directly + Undo |
| User volunteered a fact | Confirm card first |
| Sensitive (mental health, periods, pregnancy) | Always confirm |
| About someone else ("mummy ko diabetes") | Family history, confirm |
| Question or guess ("kya mujhe diabetes hai?") | Save nothing |

**Behaviour rules:**

- Max one question per reply.
- If the user skips a question, don't ask for that field again for 7 days.
- Emergency or distress messages: no profile questions, only help and doctor advice.
- Answer first and ask after, unless the field is needed for safety (allergy before a diet plan).
- Unprompted extraction runs only after a cheap keyword filter (medicine, allergy, mg, report, weight...) and on a small model with JSON output.

> Check that the OpenRouter model used by `aiService` / `openrouterAI` supports tool calling.

## 10. Where the profile is used

| Feature | Change | Impact |
| --- | --- | --- |
| AI chat | Knows conditions, medicines, allergies, recent data | High |
| Diet plans (`dietRecommendationAI`, `nutritionAI`) | Allergy, diabetes, region, labs | High |
| Calorie targets (`nutritionGoalCalculator`, `dietTargets`) | Single input source | High |
| Supplements (`SupplementRecommendation`, `DeficiencyRule`) | Lab-based + medicine interaction check | High |
| Food check (`foodSafety`, `QuickFoodCheck`) | Allergy / condition warnings | Medium-High |
| Exercise (`exerciseGuidanceService`) | Skip unsafe moves | Medium-High |
| Vault | Reports auto-fill profile | Medium-High |
| Insights / health score | Personal baselines, combined alerts | Medium |
| Nudges / notifications | Risk and missing-field reminders | Medium |
| Doctor consults | Profile share with consent | Medium |

## 11. Privacy and safety

- Nothing from AI, reports or devices is saved without user confirm, except direct answers to an AI question (with Undo).
- Users can view, edit and delete every value.
- `womensHealth` and `mentalHealth` are encrypted at rest.
- `ProfileHistory` is the audit log; doctor share goes through `ConsentLog`.
- The app does not diagnose; serious alerts point to a doctor. DPDP Act applies.

## 12. One-week timeline (backend)

| Day | Work |
| --- | --- |
| 1 | `HealthProfile`, `ProfileHistory`, `ProfileSuggestion` models + `HealthMetric` extension |
| 2 | Migration script (idempotent), run on staging |
| 3 | CRUD APIs + completeness |
| 4 | `getProfileContext` + Redis cache + invalidation events + nightly derived cron |
| 5 | Switch diet, chat, supplements, exercise to the context builder |
| 6 | Suggestions: Vault extraction + chat assistant tools and gap engine |
| 7 | Testing, fixes, staging release |

If anything slips, chat extraction (day 6) moves to week 2. App screens are built by the app team in parallel.

## 13. Open questions

- Do mental health and women's health go in v1?
- What are the final nudge frequency and the completeness threshold?
- Which OpenRouter model does chat use, and does it support tool calling?
- When do we remove `User.profile` fields after all services switch?
