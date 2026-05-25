# FitCure / take.health — API Documentation

This folder contains the production-grade OpenAPI 3.0.3 (Swagger) specification for the **FitCure / take.health** backend. Use it as the single source of truth when building the **Flutter mobile app** or any other client.

## Files

| File | Purpose |
| --- | --- |
| `swagger.yaml` | OpenAPI 3.0.3 specification (machine + human readable) — **edit this one** |
| `swagger.bundled.json` | Auto-generated, dereferenced JSON output, ready for tools that prefer JSON |
| `README.md` | This file — how to use the spec, conventions, environments |

> Every endpoint listed in `swagger.yaml` has been **verified against the real web frontend** (`client/src`) and the **live backend implementation** (`server/routes` + `server/controllers`). Dead / unused endpoints have been excluded.

---

## Quick Start

### 1. Open the **live interactive Swagger UI** (recommended)

The backend now serves the docs itself — no install, no copy-paste:

| URL | What you get |
| --- | --- |
| `<base>/api-docs` | **Interactive Swagger UI** — expand any endpoint, click **Authorize** to paste your JWT, fill the form, hit **Try it out → Execute** and see real responses |
| `<base>/api-docs.json` | Raw OpenAPI JSON (for codegen tools) |
| `<base>/api-docs.yaml` | Raw OpenAPI YAML |
| `<base>/` or `<base>/docs` | Redirect to `/api-docs` |

Examples:

- Local: <http://localhost:5001/api-docs>
- Production: `https://<your-prod-host>/api-docs`

The `servers` dropdown at the top of the UI auto-detects the host, so the
**Try it out** button hits the same backend that is serving the page.

**How to authenticate inside the UI**

1. Call `POST /auth/login` from the UI (no auth needed for this one).
2. Copy the `token` from the response.
3. Click the green **Authorize** button (top-right of the page).
4. Paste the token (just the token, *not* `Bearer ...`) → **Authorize** → **Close**.
5. Every subsequent **Try it out** call automatically attaches `Authorization: Bearer <token>`.

The session is remembered across page reloads (`persistAuthorization: true`).

### 2. Preview locally with Redocly (alternative nicer docs site)

```bash
npx @redocly/cli preview-docs docs/swagger.yaml
```

### 3. Generate a Flutter / Dart client

Using `openapi-generator`:

```bash
npm install -g @openapitools/openapi-generator-cli

openapi-generator-cli generate \
  -i docs/swagger.yaml \
  -g dart-dio \
  -o flutter_app/lib/api_client \
  --additional-properties=pubName=fitcure_api,nullableFields=true
```

Other useful generators: `dart`, `dart-dio-next`, `dart2-api`.

### 4. Import into Postman / Insomnia / Bruno

- **Postman:** *Import → Upload Files → `swagger.yaml`* → it auto-creates the collection with examples.
- **Insomnia:** *Create → File → `swagger.yaml`*
- **Bruno:** *Import → OpenAPI V3 → `swagger.yaml`*

---

## Environments

| Environment | API Base URL | Swagger UI |
| --- | --- | --- |
| Local dev | `http://localhost:5001/api` | `http://localhost:5001/api-docs` |
| LAN dev (phone testing) | `http://<your-lan-ip>:5001/api` | `http://<your-lan-ip>:5001/api-docs` |
| Production | `https://<your-vercel-or-railway-domain>/api` | `https://<your-vercel-or-railway-domain>/api-docs` |

The Flutter app should pick this from a build-time config (e.g. `--dart-define=API_BASE_URL=...`).

---

## Authentication

The API uses **JWT Bearer tokens**.

1. Call `POST /auth/login` (or `POST /auth/register` after OTP).
2. Save the returned `token` in secure storage (e.g. `flutter_secure_storage`).
3. For every protected request set:

```http
Authorization: Bearer <token>
```

Tokens expire after **30 days**. A `401 Unauthorized` response means the token is invalid / expired — log the user out and force re-login.

---

## Conventions

### Roles

| Role | Description |
| --- | --- |
| `user` / `patient` | Default mobile app user |
| `doctor` | Verified clinician (must be approved by admin) |
| `admin` / `superadmin` | Web dashboard only |

Most mobile endpoints work for `user` and `patient` interchangeably.

### Response Shapes

The API mixes two response styles for legacy reasons:

1. **Success-wrapped** — `{ "success": true, "data": ... }` or `{ "success": true, "<resourceName>": ... }`
2. **Raw object/array** — directly returns the document(s).

Both are documented per-endpoint in `swagger.yaml`. Do not assume one style globally.

### Errors

All error responses share:

```json
{
  "message": "Human readable error",
  "error":   "Optional debug info (only in dev)"
}
```

Common HTTP codes:

| Code | Meaning |
| --- | --- |
| `400` | Bad request / validation error |
| `401` | Missing or invalid JWT |
| `403` | Authenticated but not allowed (e.g. wrong role) |
| `404` | Resource not found |
| `500` | Server error |
| `503` | Database unavailable — safe to retry |

### Pagination

Endpoints that paginate accept `?page=1&limit=20` and return:

```json
{
  "data": [...],
  "total": 137,
  "page": 1,
  "pages": 7
}
```

### Date & Time

- All dates returned by the API are ISO-8601 UTC strings (e.g. `2026-05-25T08:42:11.123Z`).
- When you send a "day only" value (e.g. weight log date) use `YYYY-MM-DD` and the server treats it as **UTC midnight**.

### File Uploads

Endpoints that accept files use `multipart/form-data`:

| Endpoint | Field name |
| --- | --- |
| `POST /health/upload` | `report` |
| `POST /nutrition/quick-check` | `image` |
| `POST /auth/upload-profile-picture` | `profilePicture` |
| `POST /documents` | `document` |

Max body size: **50 MB**.

---

## Endpoint Groups (tags)

The spec groups endpoints by feature so the Flutter dev can build module-by-module:

- **System** — health-check, ping
- **Auth** — register / login / OTP / password reset
- **User Profile** — profile + food preferences + subscription
- **Health Reports** — upload + AI analysis + history
- **Dashboard** — aggregated dashboard, Health DNA, daily progress
- **Health Metrics** — glucose / HbA1c / weight / BP / heart-rate
- **Nutrition** — food analysis, logging, goals, water/weight logs
- **Quick Food Check** — AI-powered image scan
- **Diet Plan & Supplements** — AI-generated personalised plans
- **Doctors & Appointments** — discovery + booking + history
- **Video Consultation** — start / end / summary / review
- **Doctor Workspace** — `me/*` endpoints for verified doctors
- **Wearable Devices** — connect + sync + dashboard
- **Medical Documents** — secure document vault
- **AI Coach Chat** — context-aware health assistant
- **Notifications**
- **Translation** — Hindi (and others) translation utility
- **Food Safety** — adulteration / safety database
- **Support** — tickets
- **Admin – \*** — web dashboard only (mobile can ignore)

---

## Versioning & Change Process

- The current spec version is in `swagger.yaml → info.version` (semver).
- Bump the **patch** when fixing docs only.
- Bump the **minor** for additive/backwards-compatible changes.
- Bump the **major** for breaking changes (and notify the Flutter team in advance).

When endpoints are added/changed on the backend, **update `swagger.yaml` in the same PR** — treat it like code.

---

## Known Quirks (read before integrating!)

1. `POST /metrics` accepts type values `blood_sugar`, `hba1c`, `weight`, `blood_pressure`, `heart_rate`. Some legacy frontend code maps `glucose → blood_sugar` automatically; the mobile app should send `blood_sugar` directly.
2. The dashboard endpoint (`GET /health/dashboard`) is **heavy** (~1-3 s) and cached server-side for 120 s. Don’t poll it.
3. AI endpoints (`/health/upload`, `/health/ai-chat`, `/nutrition/quick-check`, `/diet-recommendations/*`) may take **30 – 120 s**. Use generous client timeouts (≥ 150 s).
4. `POST /health/upload` returns `202`-ish behaviour: it returns immediately with `backgroundProcessing: true`. Poll `GET /health/reports/{id}/status` until `status === "completed"`.
5. Similarly, diet plan generation kicks off a background job. Poll `GET /diet-recommendations/diet-plan/{planId}/status`.
6. The translate endpoint (`POST /translate`) does **not** require auth.
7. The food safety listing (`GET /food-safety/*`) does **not** require auth.
8. Forgot-password uses a **4-digit numeric code**; registration & email-verification use a **6-digit numeric code**.

---

## Contact

If something in the spec is wrong or missing, ping the backend team and open a PR against `docs/swagger.yaml`.
