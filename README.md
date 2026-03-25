# GutLog

A personal food & symptom diary that helps you discover what triggers your gut issues. Log meals, symptoms, bowel movements, mood, and more — then let the built-in correlation engine surface patterns you'd never spot manually.

Built as a full-stack TypeScript app running entirely on Cloudflare's edge network.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Backend** | [Hono](https://hono.dev/) (lightweight web framework for edge runtimes) |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Validation** | Zod 4 (shared schemas between frontend & backend) |
| **Auth** | Custom magic-link email auth (via [Resend](https://resend.com/)) + JWT sessions |
| **Hosting** | Cloudflare Workers (API + static site serving) |
| **Build** | Vite 6 |

## Project Structure

```
├── src/
│   ├── api/                    # Hono backend (runs on Cloudflare Workers)
│   │   ├── index.ts            # App entry — middleware, route mounting, SPA fallback
│   │   ├── db/
│   │   │   └── schema.ts       # Drizzle ORM schema (users, entries, correlations, experiments)
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT auth middleware + sign/verify helpers (Web Crypto API)
│   │   └── routes/
│   │       ├── auth.ts         # Magic link send, verify, logout
│   │       ├── entries.ts      # CRUD for diary entries (all 6 types)
│   │       ├── experiments.ts  # Elimination diet experiments
│   │       ├── export.ts       # JSON/CSV export + JSON import
│   │       ├── foods.ts        # Food autocomplete & recent foods
│   │       ├── insights.ts     # Correlation engine (on-demand refresh)
│   │       └── streak.ts       # Consecutive logging streak
│   ├── shared/
│   │   └── validation.ts       # Zod schemas shared between frontend & backend
│   └── web/                    # React SPA
│       ├── App.tsx             # Route definitions
│       ├── main.tsx            # React root + providers
│       ├── index.css           # Tailwind + design tokens (CSS custom properties)
│       ├── lib/
│       │   └── api.ts          # Typed fetch wrapper for all API endpoints
│       ├── components/         # Shared UI components
│       │   ├── AppLayout.tsx   # Shell with nav (bottom bar mobile, side nav desktop)
│       │   ├── BottomSheet.tsx  # Modal sheet for entry forms
│       │   ├── EmojiScale.tsx  # Horizontal emoji picker (1-5 / 1-7 scales)
│       │   ├── ErrorBoundary.tsx
│       │   ├── Skeleton.tsx    # Loading placeholders
│       │   └── Toast.tsx       # Toast notification system
│       ├── components/forms/   # Entry type form components
│       │   ├── MealForm.tsx
│       │   ├── SymptomForm.tsx
│       │   ├── BowelForm.tsx
│       │   ├── MoodForm.tsx
│       │   ├── ImpactForm.tsx
│       │   └── NoteForm.tsx
│       └── pages/              # Route-level page components
│           ├── HomePage.tsx         # Timeline view + quick-log entry
│           ├── InsightsPage.tsx     # Correlation insights
│           ├── ExperimentsPage.tsx  # Elimination experiments list
│           ├── ExperimentDetailPage.tsx
│           ├── SettingsPage.tsx     # User settings + data export
│           └── LoginPage.tsx        # Magic link login
├── migrations/                 # D1 SQL migration files
├── wrangler.toml               # Cloudflare Workers configuration
├── drizzle.config.ts           # Drizzle Kit config (SQLite dialect)
├── vite.config.ts              # Vite config with path aliases + API proxy
├── tailwind.config.js
└── package.json
```

## Features

- **6 diary entry types** — Meals, symptoms, bowel movements (Bristol scale), mood/emotion, daily impact, and free-text notes
- **Emoji-first input** — Tap emoji scales for severity, mood, and meal type instead of dropdowns
- **Correlation engine** — Automatically computes statistical correlations between foods and symptoms using relative risk scoring
- **Elimination experiments** — Track food elimination trials with baseline comparison and violation detection
- **Food autocomplete** — Suggestions from your own history, ranked by frequency and recency
- **Logging streak** — Tracks consecutive days with at least one entry
- **Data export/import** — Full export in JSON or CSV; JSON import with duplicate detection
- **Passwordless auth** — Magic link emails via Resend, JWT session cookies (7-day expiry)
- **Responsive design** — Bottom nav on mobile, side nav on desktop (769px breakpoint)

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler` or use the project-local version)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- A [Resend account](https://resend.com/) for sending magic link emails (free tier: 100 emails/day)

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the D1 database locally

```bash
wrangler d1 migrations apply gutlog-db --local
```

This applies the SQL migrations in the `migrations/` directory to a local SQLite database managed by Wrangler.

### 3. Configure environment variables

Create a `.dev.vars` file in the project root (this file is gitignored):

```env
JWT_SECRET=your-local-dev-secret
RESEND_API_KEY=re_your_resend_api_key
APP_URL=http://localhost:5173
```

> **Note:** The `JWT_SECRET` can be any string for local development. For production, use a strong random secret. `RESEND_API_KEY` is required for magic link emails to work — get one from [resend.com/api-keys](https://resend.com/api-keys).

### 4. Start the development servers

```bash
npm run dev
```

This runs two processes concurrently:
- **Vite dev server** on `http://localhost:5173` (frontend with HMR)
- **Wrangler dev server** on `http://localhost:8787` (Hono API with local D1)

Vite proxies all `/api/*` requests to the Wrangler dev server automatically.

### Other useful commands

| Command | Description |
|---------|-------------|
| `npm run dev:web` | Start only the Vite frontend dev server |
| `npm run dev:api` | Start only the Wrangler API dev server |
| `npm run build` | Build the frontend for production (outputs to `dist/`) |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:generate` | Generate new Drizzle migration files from schema changes |
| `npm run db:migrate` | Apply migrations to local D1 database |
| `npm run db:studio` | Open Drizzle Studio (visual database browser) |

## Database Migrations

GutLog uses [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) to manage database schema migrations.

**When you change the schema** (`src/api/db/schema.ts`):

```bash
# Generate a new migration SQL file
npm run db:generate

# Apply it locally
npm run db:migrate
```

Migration files are stored in the `migrations/` directory and should be committed to version control.

## Deployment

GutLog deploys as a single Cloudflare Worker that serves both the API and the static frontend assets.

### 1. Create the D1 database on Cloudflare

```bash
wrangler d1 create gutlog-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "gutlog-db"
database_id = "your-actual-database-id"   # ← replace this
```

### 2. Apply migrations to production D1

```bash
npm run db:migrate:prod
```

### 3. Set production secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put APP_URL
```

- `JWT_SECRET` — A strong random string (e.g., `openssl rand -hex 32`)
- `RESEND_API_KEY` — Your Resend API key
- `APP_URL` — Your production URL (e.g., `https://gutlog.yourdomain.com`)

### 4. Deploy

```bash
npm run deploy
```

This builds the Vite frontend into `dist/` and deploys everything (Worker + static assets) to Cloudflare.

Your app will be available at the Worker URL shown in the deploy output (e.g., `https://gutlog-api.<your-subdomain>.workers.dev`). You can also configure a [custom domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) in the Cloudflare dashboard.

### Subsequent deploys

After the initial setup, deploying updates is a single command:

```bash
npm run deploy
```

## API Endpoints

All API routes are prefixed with `/api`. Authenticated routes require a valid `session` cookie (set automatically after magic link login).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/send` | No | Send a magic link email |
| `GET` | `/api/auth/verify?token=` | No | Verify magic link, set session cookie, redirect to `/` |
| `POST` | `/api/auth/logout` | No | Clear session cookie |
| `GET` | `/api/entries?date=&type=` | Yes | List entries (filterable by date and type) |
| `GET` | `/api/entries/dates?month=YYYY-MM` | Yes | Get dates with entries for a given month |
| `POST` | `/api/entries` | Yes | Create a new entry |
| `PUT` | `/api/entries/:id` | Yes | Update an entry |
| `DELETE` | `/api/entries/:id` | Yes | Delete an entry |
| `GET` | `/api/insights` | Yes | Get correlations (auto-refreshes if stale) |
| `GET` | `/api/experiments` | Yes | List experiments |
| `GET` | `/api/experiments/:id` | Yes | Get experiment details + violations |
| `POST` | `/api/experiments` | Yes | Create a new elimination experiment |
| `PUT` | `/api/experiments/:id` | Yes | Update experiment status/result |
| `GET` | `/api/foods/autocomplete?q=` | Yes | Food name suggestions from history |
| `GET` | `/api/foods/recent` | Yes | Top 3 most-logged foods (last 7 days) |
| `GET` | `/api/streak` | Yes | Current consecutive logging streak |
| `GET` | `/api/export?format=json\|csv` | Yes | Export all user data |
| `POST` | `/api/export` | Yes | Import entries from JSON |

## Entry Types

GutLog uses a single-table inheritance model for diary entries. All 6 types share common fields (`id`, `userId`, `timestamp`, `type`, `notes`) with type-specific fields:

| Type | Key Fields |
|------|-----------|
| **meal** | `mealType` (breakfast/lunch/dinner/supper/snack), `foods` (array), `portionSize` |
| **symptom** | `symptomType` (bloating/pain/nausea/gas/cramps/fatigue/other), `severity` (1-5), `location`, `duration` |
| **bowel** | `bristolType` (1-7 Bristol scale), `urgency`, `blood`, `mucus` |
| **emotion** | `mood` (1-5), `stressLevel`, `sleepQuality`, `anxietyLevel` |
| **impact** | `impactSeverity` (none/mild/moderate/severe), `affectedActivities`, `description` |
| **note** | `notes` (free text) |

## License

Private project — not licensed for distribution.
