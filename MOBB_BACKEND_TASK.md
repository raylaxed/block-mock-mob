# Task: Create "MobbBase" Backend

**Goal**: Build a separate SvelteKit application to serve as the backend database and API for the "Block-Mock-Mobb" browser extension. This project will handle community recommendations and serve the global blacklist/mock dictionary.

## 1. Project Setup
- **Framework**: SvelteKit (TypeScript).
- **Hosting**: Vercel.
- **Database**: Vercel Postgres (recommended) or Supabase.

## 2. Core Features & API Endpoints

### A. Recommendation Endpoint (`POST /api/recommend`)
- **Purpose**: Allow extension users to submit new words/mocks.
- **Input**: JSON `{ "word": "string", "mock": "string" }`
- **Logic**:
  - Sanitize input.
  - Check if the pair already exists.
  - If existing, increment a `popularity` or `vote_count` field.
  - If new, insert into the `recommendations` table with status `pending`.
- **Response**: 200 OK.

### B. Dictionary Endpoint (`GET /api/dictionary`)
- **Purpose**: Provide the "Community Mobb" list to the extension.
- **Output**: JSON object `{ "bad": "good", "evil": "saintly", ... }`
- **Logic**:
  - Fetch all records from `recommendations` where `status` is `approved`.
  - Cache this response heavily (e.g., Vercel Edge Caching) as it will be read frequently by extensions.

## 3. Database Schema (Draft)

Table: `recommendations`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID/Int | Primary Key |
| `word` | String | Lowercase, Unique Index |
| `mock` | String | The suggested replacement |
| `status` | Enum | `pending`, `approved`, `rejected` |
| `votes` | Integer | Count of how many users recommended this |
| `created_at` | Timestamp | |

## 4. Admin UI (Optional / Phase 2)
- A simple Svelte page (protected by Basic Auth or Password) to view `pending` recommendations and click "Approve" or "Reject".
- "Approve" sets status to `approved` (making it visible in the GET API).

## 5. Implementation Steps
1. Initialize SvelteKit app (`npm create svelte@latest mobb-base`).
2. Set up Vercel Postgres storage.
3. Create the Database Schema.
4. Implement the `POST` and `GET` API routes in `src/routes/api/...`.
5. Deploy to Vercel.
