# GenTerp — Terp GenEd Discovery Engine

## Master Technical Specification v2.1

**Lead Architect:** Varun
**Document Status:** Implementation-Ready (API-Verified)
**Last Updated:** March 13, 2026

---

## Table of Contents

1. [Mission & Product Vision](#1-mission--product-vision)
2. [Architecture Overview](#2-architecture-overview)
3. [Development Environment Setup](#3-development-environment-setup)
4. [Project Structure](#4-project-structure)
5. [Database Schema & Migrations](#5-database-schema--migrations)
6. [External API Contracts & Field Mapping](#6-external-api-contracts--field-mapping)
7. [Data Sync Pipeline (Vercel Cron)](#7-data-sync-pipeline-vercel-cron)
8. [API Route Specifications](#8-api-route-specifications)
9. [Boolean Search Engine](#9-boolean-search-engine)
10. [AI Summary Pipeline](#10-ai-summary-pipeline)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Conflict Detection Engine](#12-conflict-detection-engine)
13. [Error Handling & Edge Cases](#13-error-handling--edge-cases)
14. [Phased Build Plan](#14-phased-build-plan)
15. [Claude Code Workflow Guide](#15-claude-code-workflow-guide)

---

## 1. Mission & Product Vision

### The Problem

UMD students face three compounding friction points when planning semesters:

1. **Boolean Filtering Gap** — UMD GenEd requirements involve specific tag combinations (e.g., a course that is BOTH `DVUP` and `DSHS`). Current tools offer dropdowns, not logical expressions.
2. **Review Scavenger Hunt** — Evaluating a professor requires reading dozens of scattered reviews on PlanetTerp, mentally synthesizing patterns. This takes 30-60 minutes per course.
3. **Schedule Blindness** — Standard planners show class times but don't account for real-life commitments (jobs, gym, commute blocks).

### The Solution

A single-page application that provides:

- Boolean GenEd search with instant PostgreSQL-backed filtering
- AI-generated "Amazon-style" review summaries (powered by Claude)
- A visual weekly calendar with real-time conflict detection
- Manual time blocks for non-academic commitments (Phase 2+)

### Design Principle: Frictionless Intelligence

Zero accounts. Zero passwords. Open the site, search, pin courses, close the tab. Your schedule persists in `localStorage`. Data is served from a central Supabase database. Intelligence is pre-computed and cached.

---

## 2. Architecture Overview

### Tech Stack (Locked)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Latest stable, server components, API routes |
| Database | Supabase (PostgreSQL) | Free tier, real-time, GIN/JSONB indexing |
| AI Provider | Anthropic API (Claude Sonnet) | Simple SDK, strong structured output, cost-effective |
| Styling | Tailwind CSS + shadcn/ui | Modern standard, accessible components |
| State | Zustand + localStorage persist | Lightweight, no account dependency |
| Deployment | Vercel | Native Next.js support, Cron jobs, edge functions |
| Package Manager | pnpm | Fast installs, strict dependency resolution |

### System Diagram

```
[Browser - Zustand + localStorage]
    │
    ├── Search Request ──► [Next.js API Route] ──► [Supabase PostgreSQL]
    │                                                    │
    │                                                    ├── courses (GIN + JSONB indexes)
    │                                                    └── sections (12hr sync)
    │
    ├── Pin/Unpin ──► [Zustand Store] ──► [localStorage]
    │
    └── Calendar Render ──► [Conflict Detection (client-side TypeScript)]

[Vercel Cron - every 12hrs]
    ├── /api/sync/courses ──► [umd.io /courses] ──► [Supabase upsert]
    └── /api/sync/sections ──► [umd.io /courses/sections] ──► [Supabase upsert]
         (chained: courses first, then sections, to avoid Vercel timeout)

[Manual Script - admin only]
    └── generate-summaries.ts ──► [PlanetTerp API] ──► [Anthropic API] ──► [Supabase upsert]
```

---

## 3. Development Environment Setup

### 3.1 Prerequisites (Install These First)

| Tool | Version | Install Command / Notes |
|------|---------|------------------------|
| Node.js | v20+ (LTS) | https://nodejs.org or `nvm install 20` |
| pnpm | v9+ | `npm install -g pnpm` |
| Git | Latest | https://git-scm.com |
| VS Code | Latest | https://code.visualstudio.com |
| Claude Code CLI | Latest | `npm install -g @anthropic-ai/claude-code` |
| Supabase CLI | Latest | `pnpm add -g supabase` |

### 3.2 GitHub Repository Setup

```bash
# 1. Create the repo on GitHub (do this in the browser first)
#    Name: genterp
#    Description: "AI-powered UMD GenEd discovery and schedule planner"
#    Visibility: Public (for portfolio) or Private
#    DO NOT initialize with README (we'll push our own)

# 2. Create the Next.js project locally
pnpm create next-app@latest genterp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 3. Navigate into the project
cd genterp

# 4. Initialize git and link to GitHub
git init
git remote add origin https://github.com/YOUR_USERNAME/genterp.git
git add .
git commit -m "init: Next.js 15 with TypeScript, Tailwind, App Router"
git branch -M main
git push -u origin main
```

### 3.3 Claude Code Setup

```bash
# 1. Install Claude Code globally (if not already done)
npm install -g @anthropic-ai/claude-code

# 2. Authenticate (this opens a browser window)
claude login

# 3. Navigate to your project root and start Claude Code
cd genterp
claude

# Claude Code now has full context of your project.
# You can give it instructions like:
#   "Set up the Supabase client in src/lib/supabase.ts"
#   "Create the course search API route"
```

**Claude Code + GitHub Integration:**
Claude Code works directly in your repo. When you run `claude` inside your project directory, it can read all files, create new ones, edit existing ones, and run terminal commands. Your workflow will be:

1. Open a terminal in your project root
2. Run `claude`
3. Give it a task from the Phase build plan (Section 14)
4. Review the changes it makes
5. `git add . && git commit -m "description"` to commit
6. `git push` to push to GitHub

### 3.4 VS Code Setup

**Required Extensions:**

| Extension | ID | Purpose |
|-----------|-----|---------|
| ESLint | `dbaeumer.vscode-eslint` | Linting |
| Prettier | `esbenp.prettier-vscode` | Code formatting |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind autocomplete |
| GitLens | `eamodio.gitlens` | Git blame, history |
| Error Lens | `usernamehw.errorlens` | Inline error display |
| ES7+ React Snippets | `dsznajder.es7-react-js-snippets` | Component boilerplate |

**VS Code Settings (`.vscode/settings.json`):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"]
  ],
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

### 3.5 Environment Variables

Create a `.env.local` file in the project root (this is gitignored by default):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Anthropic (for AI summaries)
ANTHROPIC_API_KEY=sk-ant-...

# Cron Secret (to protect the sync endpoint)
CRON_SECRET=generate-a-random-string-here
```

**Important:** Add `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `CRON_SECRET` to your Vercel project settings under Environment Variables for production.

---

## 4. Project Structure

```
genterp/
├── .vscode/
│   └── settings.json
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (fonts, providers)
│   │   ├── page.tsx                  # Main single-page app
│   │   ├── globals.css               # Tailwind base + custom CSS vars
│   │   └── api/
│   │       ├── search/
│   │       │   └── route.ts          # GET: Boolean GenEd search
│   │       ├── course/
│   │       │   └── [id]/
│   │       │       └── route.ts      # GET: Single course + sections + AI summary
│   │       └── sync/
│   │           ├── courses/
│   │           │   └── route.ts      # POST: Cron-triggered course sync
│   │           └── sections/
│   │               └── route.ts      # POST: Cron-triggered section sync (chained)
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   ├── search/
│   │   │   ├── search-bar.tsx        # Boolean expression input + filters
│   │   │   ├── course-card.tsx       # Search result card (expandable)
│   │   │   ├── course-list.tsx       # Scrollable results container
│   │   │   └── ai-summary.tsx        # AI summary display component
│   │   ├── calendar/
│   │   │   ├── week-view.tsx         # 5-day calendar grid
│   │   │   ├── time-slot.tsx         # Individual time block renderer
│   │   │   ├── conflict-badge.tsx    # Visual conflict indicator
│   │   │   └── pinned-sidebar.tsx    # List of pinned courses + async courses
│   │   └── shared/
│   │       ├── stale-banner.tsx      # Data freshness warning
│   │       └── loading-skeleton.tsx  # Skeleton loaders
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server-side Supabase client (service role)
│   │   ├── search/
│   │   │   └── parse-boolean.ts      # Boolean expression → SQL translator
│   │   ├── sync/
│   │   │   ├── time-parser.ts        # "10:45am" → 1045 military time converter
│   │   │   └── gen-ed-flattener.ts   # Nested gen_ed arrays → flat tags + JSONB
│   │   ├── ai/
│   │   │   └── summarize.ts          # Anthropic API call wrapper
│   │   └── utils.ts                  # Shared helpers
│   │
│   ├── store/
│   │   └── schedule-store.ts         # Zustand store (pinned courses, manual blocks)
│   │
│   └── types/
│       └── index.ts                  # Shared TypeScript interfaces
│
├── scripts/
│   └── generate-summaries.ts         # Admin-only: batch AI summary generation
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Database schema
│
├── docs/
│   └── api-field-mapping.md          # Quick reference: external API → our schema
│
├── .env.local                        # Local environment variables (gitignored)
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── vercel.json                       # Cron job configuration
└── README.md
```

---

## 5. Database Schema & Migrations

### Design Decision: Handling the GenEd Nested Array Problem

**The Problem:** umd.io returns `gen_ed` as a nested array where the outer layer is OR and the inner layer is AND:
```json
// This course fulfills (FSAR AND FSMA) — one group, both required:
[["FSAR", "FSMA"]]

// This course fulfills DVUP OR SCIS — two groups, either works:
[["DVUP"], ["SCIS"]]

// Conditional: DSNS only if taken with CHEM131:
[["DSNS|CHEM131"]]
```

**The Solution: Dual-column strategy.**

We store TWO representations:

1. `gen_ed_raw JSONB` — The original nested structure from umd.io, stored as-is. Used for precise boolean AND queries ("find courses where a single GenEd group contains BOTH DVUP AND DSHS").

2. `gen_ed_tags TEXT[]` — A flattened, deduplicated array of all GenEd tags (pipe conditions stripped). Used for fast GIN-indexed "has any of these" lookups and for displaying tag badges in the UI.

This gives us the speed of GIN indexes for simple queries AND the precision of JSONB for compound boolean logic.

### File: `supabase/migrations/001_initial_schema.sql`

```sql
-- ============================================
-- GenTerp Database Schema v2.1
-- ============================================

-- =====================
-- Table: courses
-- =====================
-- Global catalog. Updated via sync pipeline. Read-only for clients.
CREATE TABLE courses (
    course_id    TEXT PRIMARY KEY,              -- e.g., 'CMSC330' (from umd.io course_id)
    title        TEXT NOT NULL,                 -- e.g., 'Organization of Programming Languages' (from umd.io "name" field)
    dept_id      TEXT NOT NULL,                 -- e.g., 'CMSC' (from umd.io dept_id)
    department   TEXT,                          -- e.g., 'Computer Science' (from umd.io "department" — full name)
    credits      INT,                          -- Parsed from umd.io string to integer
    description  TEXT,                          -- Full catalog description from umd.io
    gen_ed_raw   JSONB DEFAULT '[]',           -- Original nested array from umd.io (array of arrays)
    gen_ed_tags  TEXT[] DEFAULT '{}',           -- Flattened, deduplicated tags for GIN search
    avg_gpa      NUMERIC(4,3),                 -- From PlanetTerp (e.g., 3.127)
    professors   TEXT[] DEFAULT '{}',           -- From PlanetTerp professors list
    ai_summary   JSONB,                        -- Cached AI-generated summary (see Section 10)
    relationships JSONB,                       -- prereqs, coreqs, restrictions from umd.io
    last_synced  TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index on flattened tags for fast "has any/all of these tags" queries
CREATE INDEX idx_courses_gen_ed_tags ON courses USING GIN (gen_ed_tags);

-- GIN index on raw JSONB for containment queries on nested structure
CREATE INDEX idx_courses_gen_ed_raw ON courses USING GIN (gen_ed_raw);

-- Department filter
CREATE INDEX idx_courses_dept_id ON courses (dept_id);

-- Full-text search on title
CREATE INDEX idx_courses_title_search ON courses USING GIN (to_tsvector('english', title));


-- =====================
-- Table: sections
-- =====================
-- Updated every 12 hours via Vercel Cron.
CREATE TABLE sections (
    section_id     TEXT PRIMARY KEY,             -- e.g., 'CMSC330-0101' (from umd.io section_id)
    course_id      TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    instructors    TEXT[] DEFAULT '{}',           -- Array of instructor names (umd.io returns array)
    seats_total    INT DEFAULT 0,                -- Parsed from umd.io string "seats"
    seats_open     INT DEFAULT 0,                -- Parsed from umd.io string "open_seats"
    waitlist_count INT DEFAULT 0,                -- Parsed from umd.io string "waitlist"
    meetings       JSONB DEFAULT '[]',           -- Normalized meeting objects (see Meeting shape below)
    semester       TEXT,                         -- e.g., '202601' (from umd.io semester)
    last_synced    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sections_course_id ON sections (course_id);


-- =====================
-- Table: sync_log
-- =====================
-- Tracks sync pipeline runs for stale data warnings.
CREATE TABLE sync_log (
    id              SERIAL PRIMARY KEY,
    sync_type       TEXT NOT NULL,                -- 'courses' | 'sections' | 'gpa'
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'failed'
    records_synced  INT DEFAULT 0,
    error_message   TEXT
);
```

### Meeting JSONB Shape (Normalized from umd.io)

umd.io returns meetings with string times like `"10:45am"`. During sync, we normalize to our internal format:

```typescript
// What umd.io returns:
interface UmdIoMeeting {
  days: string;          // "MWF", "TuTh"
  start_time: string;    // "10:45am", "6:30pm"
  end_time: string;      // "11:35am", "7:45pm"
  building: string;      // "IRB"
  room: string;          // "1116"
  classtype: string;     // "Lecture", "Discussion", "Lab"
}

// What we store in our meetings JSONB column:
interface Meeting {
  days: string;           // "MWF", "TuTh" (kept as-is, expanded client-side)
  start: number | null;   // Military time integer: 1045. null = async/TBA.
  end: number | null;     // Military time integer: 1135. null = async/TBA.
  room: string | null;    // Combined: "IRB 1116". null = TBA/online.
  type: string;           // "Lecture" | "Discussion" | "Lab"
}
```

### AI Summary JSONB Shape

```typescript
interface AISummary {
  vibe: string;           // 1-2 sentence workload/feel summary
  prof: string;           // Instructor teaching style summary
  pros: string[];         // Exactly 3 positive consensus points
  cons: string[];         // Exactly 3 negative consensus points
  review_count: number;   // How many reviews were analyzed
  generated_at: string;   // ISO timestamp
  model: string;          // e.g., "claude-sonnet-4-20250514"
}
```

### GenEd Flattening Logic

**File:** `src/lib/sync/gen-ed-flattener.ts`

```typescript
/**
 * Flattens umd.io's nested gen_ed array into a deduplicated tag list.
 *
 * Input from umd.io:
 *   [["FSAR", "FSMA"], ["DSNS|CHEM131"]]
 *
 * Output for gen_ed_tags column:
 *   ["DSNS", "FSAR", "FSMA"]
 *
 * Pipe-separated conditions (e.g., "DSNS|CHEM131") are stripped to just
 * the tag name. The conditional relationship is preserved in gen_ed_raw.
 */
function flattenGenEdTags(genEdRaw: string[][]): string[] {
  const tags = new Set<string>();

  for (const group of genEdRaw) {
    for (const entry of group) {
      // Strip pipe conditions: "DSNS|CHEM131" → "DSNS"
      const tag = entry.split('|')[0].trim();
      if (tag && /^[A-Z]{2,6}$/.test(tag)) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags).sort();
}
```

### Time Parsing Logic

**File:** `src/lib/sync/time-parser.ts`

```typescript
/**
 * Converts umd.io time strings to military time integers.
 *
 * "10:45am"  → 1045
 * "6:30pm"   → 1830
 * "12:00pm"  → 1200
 * "12:30am"  → 0030
 * undefined  → null  (async/TBA)
 */
function parseTimeToMilitary(timeStr: string | undefined | null): number | null {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();

  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return hours * 100 + minutes;
}
```

---

## 6. External API Contracts & Field Mapping

### 6.1 umd.io API

**Base URL:** `https://api.umd.io/v1`
**Auth:** None required.
**Rate Limits:** Not documented — be respectful. Use 200ms delays between paginated requests.
**Pagination:** Default 30 per page, max 100 via `per_page` param. 1-indexed `page` param.

#### Endpoints Used

| Our Use | Endpoint | Method |
|---------|----------|--------|
| Fetch course catalog | `GET /courses` | Paginated, filterable by `dept_id`, `gen_ed`, `semester` |
| Fetch single course | `GET /courses/{course_id}` | Returns single course with sections as IDs |
| Fetch all sections | `GET /courses/sections` | Paginated, filterable by `course_id`, `semester` |
| List semesters | `GET /courses/semesters` | Returns array of semester strings like `["202601"]` |
| List departments | `GET /courses/departments` | Returns array of dept codes like `["CMSC", "MATH"]` |

#### Course Object Field Mapping

| umd.io Field | Type (umd.io) | Our Column | Type (ours) | Transform |
|-------------|---------------|-----------|------------|-----------|
| `course_id` | `string` | `course_id` | `TEXT PK` | Direct copy |
| `name` | `string` | `title` | `TEXT` | **Rename** (umd.io calls it `name`, not `title`) |
| `dept_id` | `string` | `dept_id` | `TEXT` | Direct copy |
| `department` | `string` | `department` | `TEXT` | Direct copy (full department name) |
| `credits` | **`string`** | `credits` | `INT` | **`parseInt(credits, 10)`** — umd.io returns `"4"` not `4` |
| `description` | `string` | `description` | `TEXT` | Direct copy |
| `gen_ed` | **`string[][]`** | `gen_ed_raw` / `gen_ed_tags` | `JSONB` / `TEXT[]` | **Dual write** — see Section 5 flattening logic |
| `relationships` | `object` | `relationships` | `JSONB` | Direct copy (prereqs, coreqs, restrictions, etc.) |
| `sections` | `string[]` | — | — | Not stored; we fetch sections separately via `/courses/sections` |
| `semester` | `number` | — | — | Used as query param to get current semester data |
| `grading_method` | `string[]` | — | — | Not used in MVP |
| `core` | `string[]` | — | — | Not used in MVP (legacy CORE requirements) |

#### Section Object Field Mapping

| umd.io Field | Type (umd.io) | Our Column | Type (ours) | Transform |
|-------------|---------------|-----------|------------|-----------|
| `section_id` | `string` | `section_id` | `TEXT PK` | Direct copy (e.g., `"CMSC330-0101"`) |
| `course` | `string` | `course_id` | `TEXT FK` | **Rename** (umd.io calls it `course`) |
| `instructors` | **`string[]`** | `instructors` | `TEXT[]` | Direct copy — **it's an array**, not a single string |
| `seats` | **`string`** | `seats_total` | `INT` | **`parseInt(seats, 10)`** and **rename** |
| `open_seats` | **`string`** | `seats_open` | `INT` | **`parseInt(open_seats, 10)`** and **rename** |
| `waitlist` | **`string`** | `waitlist_count` | `INT` | **`parseInt(waitlist, 10)`** and **rename** |
| `meetings` | `Meeting[]` | `meetings` | `JSONB` | **Normalize** — parse times, combine building+room |
| `semester` | `number` | `semester` | `TEXT` | Cast to string |
| `number` | `string` | — | — | Not stored separately (embedded in section_id) |

#### Meeting Object Transform

```
umd.io returns:                    We store:
{                                  {
  "days": "MWF",          →         "days": "MWF",
  "start_time": "10:45am", →        "start": 1045,
  "end_time": "11:35am",   →        "end": 1135,
  "building": "IRB",       →        "room": "IRB 1116",
  "room": "1116",          →        "type": "Lecture"
  "classtype": "Lecture"   →
}                                  }
```

**Edge cases in meeting transform:**
- `start_time` or `end_time` is missing/empty → set `start`/`end` to `null` (async)
- `building` or `room` is missing/empty → set `room` to `null` (TBA/online)
- `classtype` is missing → default to `"Lecture"`
- `days` is empty string → class is async, set `days` to `""` and times to `null`

### 6.2 PlanetTerp API

**Base URL:** `https://planetterp.com/api/v1`
**Auth:** None required.
**Rate Limits:** Not formally documented. They ask: "please be respectful and don't hammer it with too many requests without a pause." **Use 500ms delays between requests and limit concurrency to 2 with `p-limit`.**
**Pagination:** `limit` (default 100, max 100) + `offset` params.

#### Endpoints Used

| Our Use | Endpoint | Notes |
|---------|----------|-------|
| Course GPA + professors | `GET /course?name=CMSC330` | Returns `average_gpa`, `professors` array |
| Course reviews (for AI) | `GET /course?name=CMSC330&reviews=true` | Returns reviews nested in the course object |
| Grade data (optional) | `GET /grades?course=CMSC330` | Returns per-section letter grade breakdown |

#### Course Object Field Mapping

| PlanetTerp Field | Type | Our Column | Transform |
|-----------------|------|-----------|-----------|
| `department` | `string` | — | Not used (we have `dept_id` from umd.io) |
| `course_number` | `string` | — | Not used (combined with dept in our `course_id`) |
| `title` | `string` | — | Not used (we use umd.io's `name` field) |
| `description` | `string` | — | Not used (we use umd.io's) |
| `credits` | `integer` | — | Not used (we use umd.io's) |
| `average_gpa` | **`number`** | `avg_gpa` | Direct copy (e.g., `3.127`) |
| `professors` | `string[]` | `professors` | Direct copy (array of professor names) |

**Key insight:** PlanetTerp and umd.io overlap on basic course data, but each has exclusive data:
- **Only umd.io has:** GenEd tags, sections, seats, meeting times, relationships
- **Only PlanetTerp has:** `average_gpa`, student reviews, professor ratings

#### Review Object Shape (Nested in Course Response)

When `reviews=true` is passed, PlanetTerp returns reviews as part of the course object. The review shape (undocumented in the spec but present in responses) is typically:

```typescript
interface PlanetTerpReview {
  professor: string;      // Professor name
  course: string;         // Course code (e.g., "CMSC330")
  review: string;         // Free-text review content
  rating: number;         // 1-5 rating
  expected_grade: string; // e.g., "A", "B+", etc.
  created: string;        // ISO date
}
```

**IMPORTANT:** The exact review shape should be verified during Phase 0 by actually calling the endpoint. The PlanetTerp OpenAPI spec does not formally document the review sub-object schema.

---

## 7. Data Sync Pipeline (Vercel Cron)

### The Timeout Problem and Solution

**Problem:** Vercel Hobby tier has a 10-second function timeout. Syncing thousands of courses + sections will exceed this.

**Solution: Chain-linked cron jobs.** Split the sync into two independent endpoints that run sequentially:

1. `/api/sync/courses` — Syncs course catalog (lighter, fewer records)
2. `/api/sync/sections` — Syncs sections (heavier, more records, paginated)

Each job is idempotent — if it times out, it picks up where it left off on the next run because we use `upsert` (insert or update on conflict).

### Vercel Cron Config (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/sync/courses",
      "schedule": "0 */12 * * *"
    },
    {
      "path": "/api/sync/sections",
      "schedule": "5 */12 * * *"
    }
  ]
}
```

The sections job runs 5 minutes after courses, giving courses time to complete.

### `/api/sync/courses` Logic

```
1. Verify Authorization: Bearer ${CRON_SECRET}
2. Create sync_log entry (type: 'courses', status: 'running')
3. GET /courses/semesters → pick the latest semester code
4. Paginate through GET /courses?semester={latest}&per_page=100
   - For each page:
     a. Map fields per Section 6 mapping table
     b. Flatten gen_ed → gen_ed_tags
     c. Store gen_ed as-is → gen_ed_raw
     d. parseInt on credits
     e. Batch upsert 100 records into courses table (ON CONFLICT course_id DO UPDATE)
   - 200ms delay between pages
5. Update sync_log (status: 'success', records_synced: N)
```

**Error handling:** If any page fails, log the error, skip that page, continue. Update sync_log with status 'partial' if any pages were skipped.

### `/api/sync/sections` Logic

```
1. Verify Authorization: Bearer ${CRON_SECRET}
2. Create sync_log entry (type: 'sections', status: 'running')
3. GET /courses/semesters → pick the latest semester code
4. Paginate through GET /courses/sections?semester={latest}&per_page=100
   - For each page:
     a. Map fields per Section 6 mapping table
     b. Parse meeting times via parseTimeToMilitary()
     c. Combine building + room into single string
     d. parseInt on seats, open_seats, waitlist
     e. Batch upsert into sections table (ON CONFLICT section_id DO UPDATE)
   - 200ms delay between pages
5. Update sync_log (status: 'success', records_synced: N)
```

### GPA Sync (Part of generate-summaries.ts)

PlanetTerp GPA data is synced as part of the AI summary script, not the cron job. When the script queries PlanetTerp for review data, it also grabs `average_gpa` and upserts it into the `courses` table. This keeps the GPA data updated whenever summaries are regenerated, without adding another cron job.

### Stale Data Warning Logic

Frontend fetches the most recent `sync_log` entry where `sync_type = 'sections'`. If `finished_at` is more than 13 hours ago OR `status = 'failed'`:

> ⚠️ Course data was last updated {timeAgo}. Seat counts may be inaccurate.

---

## 8. API Route Specifications

### 8.1 `GET /api/search`

**Purpose:** Boolean GenEd search with optional keyword and department filtering.

**Query Parameters:**

| Param | Type | Required | Example | Description |
|-------|------|----------|---------|-------------|
| `q` | string | No | `"machine learning"` | Keyword search against title (full-text) |
| `gen_eds` | string | No | `"(DVUP AND DSHS) OR SCIS"` | Boolean GenEd expression |
| `dept` | string | No | `"CMSC"` | Filter by `dept_id` |
| `page` | number | No | `1` | Pagination (20 results per page) |

**Response Shape:**

```typescript
interface SearchResponse {
  courses: {
    course_id: string;
    title: string;
    dept_id: string;
    credits: number | null;
    gen_ed_tags: string[];
    avg_gpa: number | null;
    has_ai_summary: boolean;       // Don't send full summary in list view
    sections_count: number;
    open_sections_count: number;   // Sections where seats_open > 0
  }[];
  pagination: {
    page: number;
    total_pages: number;
    total_results: number;
  };
}
```

### 8.2 `GET /api/course/[id]`

**Purpose:** Full course detail including all sections and AI summary.

**Response Shape:**

```typescript
interface CourseDetailResponse {
  course_id: string;
  title: string;
  dept_id: string;
  department: string | null;
  credits: number | null;
  description: string | null;
  gen_ed_tags: string[];
  gen_ed_raw: string[][];         // Original nested structure for UI display
  avg_gpa: number | null;
  professors: string[];
  ai_summary: AISummary | null;
  relationships: {
    prereqs: string | null;
    coreqs: string | null;
    restrictions: string | null;
    credit_granted_for: string | null;
    formerly: string | null;
    also_offered_as: string | null;
    additional_info: string | null;
  } | null;
  sections: {
    section_id: string;
    instructors: string[];
    seats_open: number;
    seats_total: number;
    waitlist_count: number;
    meetings: Meeting[];
    is_async: boolean;             // Derived: true if ALL meetings have null start/end
  }[];
  last_synced: string;             // ISO timestamp
}
```

### 8.3 `POST /api/sync/courses` and `POST /api/sync/sections`

Protected by `CRON_SECRET`. See Section 7 for full logic.

---

## 9. Boolean Search Engine

### The Problem

A student searches: `(DVUP AND DSHS) OR SCIS`

This means: "Find me courses where a single GenEd group contains BOTH DVUP and DSHS, OR any course that has SCIS in any group."

### Two-Layer Query Strategy

**Layer 1: Fast GIN pre-filter on `gen_ed_tags` (flat array).**

This eliminates courses that don't have any of the mentioned tags at all. Fast because GIN indexes on `TEXT[]` are highly optimized.

```sql
-- Pre-filter: course must have at least one of the mentioned tags
WHERE gen_ed_tags && ARRAY['DVUP', 'DSHS', 'SCIS']
```

**Layer 2: Precise JSONB check on `gen_ed_raw` (nested array).**

For AND conditions, we check that at least one inner array contains ALL the required tags. For OR conditions, we check that at least one inner array contains ANY of the required tags.

```sql
-- AND check: some inner array contains both DVUP and DSHS
EXISTS (
  SELECT 1 FROM jsonb_array_elements(gen_ed_raw) AS grp
  WHERE grp @> '["DVUP"]'::jsonb AND grp @> '["DSHS"]'::jsonb
)

-- OR check: any tag array contains SCIS
gen_ed_tags @> ARRAY['SCIS']
```

### Boolean Expression Parser

**File:** `src/lib/search/parse-boolean.ts`

The parser is a **whitelist tokenizer + AST builder**. It NEVER concatenates user input into SQL.

**Tokenization:**

```
Input:  "(DVUP AND DSHS) OR SCIS"

Tokens: [LPAREN, TAG("DVUP"), AND, TAG("DSHS"), RPAREN, OR, TAG("SCIS")]
```

**Validation rules:**
- TAG tokens must match `/^[A-Z]{2,6}$/` (valid GenEd codes only)
- Parentheses must be balanced
- AND/OR cannot be adjacent
- TAG cannot directly follow TAG (must have operator between)

**AST → SQL generation:**

```typescript
// AST node types:
type BooleanAST =
  | { type: 'tag'; value: string }
  | { type: 'and'; left: BooleanAST; right: BooleanAST }
  | { type: 'or'; left: BooleanAST; right: BooleanAST };

// SQL generation (simplified pseudocode):
function astToSQL(node: BooleanAST): { sql: string; params: string[] } {
  switch (node.type) {
    case 'tag':
      // Simple: course has this tag
      return {
        sql: `gen_ed_tags @> ARRAY[$${nextParam}]`,
        params: [node.value]
      };
    case 'and':
      // AND: both tags must exist in the SAME gen_ed group (inner array)
      // Collect all tags in the AND chain, then check gen_ed_raw
      const andTags = collectAndTags(node); // e.g., ["DVUP", "DSHS"]
      return {
        sql: `EXISTS (
          SELECT 1 FROM jsonb_array_elements(gen_ed_raw) AS grp
          WHERE ${andTags.map((_, i) => `grp @> to_jsonb($${nextParam + i}::text)`).join(' AND ')}
        )`,
        params: andTags
      };
    case 'or':
      // OR: either side must match
      const left = astToSQL(node.left);
      const right = astToSQL(node.right);
      return {
        sql: `(${left.sql}) OR (${right.sql})`,
        params: [...left.params, ...right.params]
      };
  }
}
```

**Security:** All tag values are passed as parameterized query parameters (`$1`, `$2`, etc.). No string concatenation of user input into SQL ever occurs.

---

## 10. AI Summary Pipeline

### Overview

AI summaries are generated offline via a manual admin script, not at request time. This controls costs and prevents latency spikes.

### Provider: Anthropic API (Claude Sonnet)

**Why Sonnet over Opus:** Summaries are structured extraction tasks. Sonnet handles these efficiently at lower cost.

### Dependencies (add to `package.json` devDependencies)

```json
{
  "@anthropic-ai/sdk": "latest",
  "p-limit": "^5.0.0",
  "tsx": "latest"
}
```

### Script: `scripts/generate-summaries.ts`

**Execution:**

```bash
# Run from project root
pnpm tsx scripts/generate-summaries.ts

# Optional flags:
#   --course CMSC330        Generate for a single course
#   --department CMSC       Generate for an entire department
#   --force                 Regenerate even if summary exists
#   --dry-run               Fetch reviews but don't call AI or write to DB
```

**Logic:**

```
1. Query Supabase for courses where ai_summary IS NULL (or all if --force)
2. Apply --course or --department filter if provided
3. For each course (concurrency: 2 via p-limit, 500ms delay between batches):
   a. GET PlanetTerp /course?name={course_id}&reviews=true
   b. Also extract average_gpa and professors, upsert into courses table
   c. Skip if fewer than 3 reviews (insufficient data for meaningful summary)
   d. Call Anthropic API with structured prompt (see below)
   e. Validate response is valid JSON matching AISummary schema
   f. Upsert ai_summary JSONB into courses table
   g. Log: "{course_id}: {review_count} reviews → summary generated"
4. Print final stats: N courses processed, M summaries generated, K skipped
```

### Rate Limiting Implementation

```typescript
import pLimit from 'p-limit';

const limit = pLimit(2); // Max 2 concurrent PlanetTerp requests

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

for (const course of courses) {
  await limit(async () => {
    await processCourse(course);
    await delay(500); // 500ms between requests
  });
}
```

### Prompt Template

```typescript
const systemPrompt = `You are an academic course review analyzer. You will receive student reviews for a university course. Your job is to synthesize them into a structured summary.

You MUST respond with valid JSON matching this exact schema:
{
  "vibe": "1-2 sentences describing the overall workload feel and difficulty level",
  "prof": "1-2 sentences summarizing the instructor's teaching style and grading approach",
  "pros": ["positive point 1", "positive point 2", "positive point 3"],
  "cons": ["negative point 1", "negative point 2", "negative point 3"]
}

Rules:
- Be specific and cite patterns across reviews, not individual opinions
- If reviews are mixed, say so honestly
- Keep each pro/con to one concise sentence
- If there aren't 3 clear pros or cons, synthesize broader themes
- Never fabricate claims not supported by the reviews
- Output ONLY the JSON object, no markdown fences, no explanation`;

const userPrompt = `Course: ${courseId} - ${courseTitle}
Number of reviews: ${reviews.length}

Student Reviews:
${reviews.map((r, i) => `[Review ${i + 1}] (Rating: ${r.rating}/5)\n${r.review}`).join('\n\n')}`;
```

### Cost Estimation

Assuming ~500 courses with sufficient reviews, ~10 reviews each averaging 100 words:
- Input: ~500 tokens per course × 500 courses = 250K input tokens
- Output: ~150 tokens per summary × 500 courses = 75K output tokens
- **Estimated cost with Claude Sonnet: ~$1-2 total** (one-time batch run)

---

## 11. Frontend Architecture

### 11.1 Layout (Single Page)

```
┌──────────────────────────────────────────────────────────┐
│  [GenTerp Logo]                    [Stale Data Banner]   │
├────────────────────────┬─────────────────────────────────┤
│                        │                                 │
│   SEARCH PANEL         │   CALENDAR PANEL                │
│   (Left, ~45% width)  │   (Right, ~55% width)           │
│                        │                                 │
│   ┌──────────────────┐ │   ┌───────────────────────────┐ │
│   │ Search Bar       │ │   │  Mon  Tue  Wed  Thu  Fri  │ │
│   │ [DVUP AND DSHS]  │ │   │  ┌───┬───┬───┬───┬───┐   │ │
│   ├──────────────────┤ │   │  │   │   │   │   │   │   │ │
│   │ Dept Filter  GPA │ │   │  │ 8a│   │   │   │   │   │ │
│   ├──────────────────┤ │   │  │   │   │   │   │   │   │ │
│   │                  │ │   │  │   │   │   │   │   │   │ │
│   │ Course Card      │ │   │  │10a│ █████ │   │ █████ │ │
│   │ ┌──────────────┐ │ │   │  │   │CMSC  │   │CMSC  │  │ │
│   │ │ CMSC330      │ │ │   │  │   │330   │   │330   │  │ │
│   │ │ 3 cr | 3.1   │ │ │   │  │12p│      │   │      │  │ │
│   │ │ [DVUP] [DSHS]│ │ │   │  │   │   │   │   │   │   │ │
│   │ │ [Pin] [More] │ │ │   │  │ 2p│   │   │   │   │   │ │
│   │ └──────────────┘ │ │   │  │   │   │   │   │   │   │ │
│   │                  │ │   │  └───┴───┴───┴───┴───┘   │ │
│   │ Course Card      │ │   │                             │
│   │ ...              │ │   │  ┌───────────────────────┐  │
│   │                  │ │   │  │ Pinned (3) | Async (1)│  │
│   │                  │ │   │  │ • CMSC330-0101  [×]   │  │
│   └──────────────────┘ │   │  │ • ENEE245-0201  [×]   │  │
│                        │   │  └───────────────────────┘  │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
```

**Responsive breakpoints:**
- `>= 1024px` — Side by side (search left, calendar right)
- `768px - 1023px` — Stacked (search on top, calendar below)
- `< 768px` — Stacked, calendar becomes a simple list view of pinned courses with times

### 11.2 Zustand Store

**File:** `src/store/schedule-store.ts`

```typescript
interface PinnedCourse {
  courseId: string;
  sectionId: string;
  title: string;
  meetings: Meeting[];       // Our normalized Meeting shape
  instructors: string[];     // Array, not single string
}

interface ManualBlock {       // Phase 2 — defined now, implemented later
  id: string;
  label: string;
  days: string[];
  start: number;
  end: number;
  color: string;
}

interface Conflict {
  blockA: { id: string; label: string };
  blockB: { id: string; label: string };
  day: string;
  overlapStart: number;
  overlapEnd: number;
}

interface ScheduleStore {
  // State
  pinnedCourses: PinnedCourse[];
  manualBlocks: ManualBlock[];         // Phase 2
  conflicts: Conflict[];

  // Actions
  pinCourse: (course: PinnedCourse) => void;
  unpinCourse: (courseId: string) => void;
  changeSection: (courseId: string, newSectionId: string, newMeetings: Meeting[], newInstructors: string[]) => void;
  addManualBlock: (block: ManualBlock) => void;      // Phase 2
  removeManualBlock: (id: string) => void;            // Phase 2

  // Derived
  recalculateConflicts: () => void;
}
```

**Persistence config:**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      // ... implementation
    }),
    {
      name: 'genterp-schedule',
      version: 1,
    }
  )
);
```

### 11.3 Component Specifications

**SearchBar (`search-bar.tsx`):**
- Text input for boolean GenEd expressions
- Real-time syntax validation (red underline + tooltip on invalid expressions)
- Department dropdown (populated from `/courses/departments` or hardcoded list)
- Debounced search (300ms after last keystroke)
- Placeholder: `"Try: DVUP AND DSHS, or search by course name"`

**CourseCard (`course-card.tsx`):**
- **Collapsed:** course_id, title, credits, gen_ed_tags as colored badges, avg_gpa (green > 3.5, yellow 2.5-3.5, red < 2.5), open sections count
- **Expanded (accordion):** full description, prerequisites from relationships, AI summary component, section picker table (columns: section, instructors, days/time, seats, pin button)
- Pin button changes to "Pinned ✓" when active. If pinning creates conflict, show warning toast but allow pinning.

**AISummary (`ai-summary.tsx`):**
- Renders `ai_summary` JSONB in structured layout
- Vibe: styled paragraph with muted background
- Prof: styled paragraph
- Pros: green-accented list items
- Cons: amber-accented list items
- Footer: "Based on {review_count} student reviews"
- Null state: "No AI summary available yet" in muted text

**WeekView (`week-view.tsx`):**
- 5 columns (Mon–Fri), rows from 8:00 AM to 9:00 PM in 30-minute increments
- Pinned courses as absolutely positioned colored blocks
- Block height proportional to duration, top from start time
- Conflicts highlighted with red border or diagonal hatching
- Hover shows: course, section, instructor, room

**PinnedSidebar (`pinned-sidebar.tsx`):**
- Two sections: "Scheduled" (with meeting times) and "Async" (no times)
- Each entry: course_id, section_id, instructor, unpin button (×)
- Total credits counter at bottom

---

## 12. Conflict Detection Engine

### Algorithm (Client-Side TypeScript)

```typescript
interface TimeBlock {
  id: string;            // courseId or manualBlock id
  label: string;         // e.g., "CMSC330" or "Gym"
  day: string;           // "Mon" | "Tue" | "Wed" | "Thu" | "Fri"
  start: number;         // Military time, e.g., 1045
  end: number;           // Military time, e.g., 1135
  type: 'course' | 'manual';
}

function detectConflicts(blocks: TimeBlock[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const byDay = groupBy(blocks, 'day');

  for (const [day, dayBlocks] of Object.entries(byDay)) {
    const sorted = dayBlocks.sort((a, b) => a.start - b.start);

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];

        // Overlap: A.start < B.end AND A.end > B.start
        if (a.start < b.end && a.end > b.start) {
          conflicts.push({
            blockA: { id: a.id, label: a.label },
            blockB: { id: b.id, label: b.label },
            day,
            overlapStart: Math.max(a.start, b.start),
            overlapEnd: Math.min(a.end, b.end),
          });
        }
      }
    }
  }
  return conflicts;
}
```

### Day String Expansion

umd.io returns days as compact strings like `"MWF"` or `"TuTh"`. Must be expanded for conflict detection:

```typescript
function expandDays(daysStr: string): string[] {
  const map: Record<string, string> = {
    'M': 'Mon', 'Tu': 'Tue', 'W': 'Wed', 'Th': 'Thu', 'F': 'Fri',
    'Sa': 'Sat', 'Su': 'Sun'
  };
  const result: string[] = [];
  let i = 0;
  while (i < daysStr.length) {
    if (i + 1 < daysStr.length && map[daysStr.slice(i, i + 2)]) {
      result.push(map[daysStr.slice(i, i + 2)]);
      i += 2;
    } else if (map[daysStr[i]]) {
      result.push(map[daysStr[i]]);
      i += 1;
    } else {
      i += 1;
    }
  }
  return result;
}
```

### Async Course Handling

Courses where ALL meetings have `start === null` and `end === null`:
- Excluded from conflict detection
- Displayed in "Async" section of pinned sidebar
- Not rendered on calendar grid

---

## 13. Error Handling & Edge Cases

### Frontend Error States

| Scenario | Behavior |
|----------|----------|
| Search returns 0 results | "No courses match your filters" with syntax hint |
| Invalid boolean expression | Real-time red underline, tooltip with syntax help |
| API route returns 500 | Toast notification with retry button |
| Course has no sections | Show card but disable pin, note "No sections available" |
| Course has no AI summary | "Summary not available" placeholder |
| All sections are full | Show course normally, seats indicator is red |
| localStorage is full | Catch `QuotaExceededError`, suggest clearing old data |
| Incognito mode | localStorage works per session; show one-time info banner |
| umd.io returns unexpected gen_ed format | Log warning, store raw, flatten what's parseable |

### Backend Error States

| Scenario | Behavior |
|----------|----------|
| umd.io down during sync | Log to sync_log 'failed', keep existing data |
| PlanetTerp down during summary gen | Skip affected courses, log to console |
| Anthropic API returns malformed JSON | Retry once with temperature 0, then skip |
| Supabase connection fails | Return 503 `{ error: "Database unavailable" }` |
| Sync partially completes before timeout | Next run picks up remaining via upsert (idempotent) |
| PlanetTerp rate limits us | Exponential backoff: 1s, 2s, 4s, then skip |

### Boolean Parser Security

The parser is a whitelist tokenizer:
1. Tokenizes into: `TAG`, `AND`, `OR`, `LPAREN`, `RPAREN`
2. Validates TAG tokens match `/^[A-Z]{2,6}$/`
3. Builds structured AST
4. Generates parameterized SQL (`$1`, `$2`, etc.)
5. **NEVER concatenates user input into SQL**

Invalid expressions return 400 with `{ error: "Invalid expression", details: "..." }`.

---

## 14. Phased Build Plan

### Phase 0: Validation Sprint (Days 1-2)

**Goal:** Confirm all external dependencies before writing application code.

```bash
# Validation commands to run manually:
curl "https://api.umd.io/v1/courses/semesters"
curl "https://api.umd.io/v1/courses?semester=LATEST&per_page=2"
curl "https://api.umd.io/v1/courses/CMSC330"
curl "https://api.umd.io/v1/courses/sections?course_id=CMSC330&per_page=2"
curl "https://planetterp.com/api/v1/course?name=CMSC330"
curl "https://planetterp.com/api/v1/course?name=CMSC330&reviews=true"
```

- [ ] Verify umd.io responses match Section 6 field mapping
- [ ] Verify PlanetTerp response shapes (especially review sub-objects)
- [ ] Confirm gen_ed nested array structure matches expected format
- [ ] Check total course/section count (estimate sync time)
- [ ] Create Supabase project, run migration SQL from Section 5
- [ ] Test GIN index with manual INSERT + query
- [ ] Set up Vercel project linked to GitHub repo
- [ ] Create `docs/api-field-mapping.md` documenting any surprises

**Deliverable:** Verified API contracts. If anything differs from this PRD, update before proceeding.

### Phase 1: Data Foundation (Days 3-6)

**Goal:** Database populated and searchable.

- [ ] Install: `pnpm add @supabase/supabase-js`
- [ ] Create `src/lib/supabase/client.ts` and `server.ts`
- [ ] Create `src/lib/sync/time-parser.ts` with unit tests
- [ ] Create `src/lib/sync/gen-ed-flattener.ts` with unit tests
- [ ] Implement `/api/sync/courses` route
- [ ] Implement `/api/sync/sections` route
- [ ] Run first manual sync, verify data in Supabase dashboard
- [ ] Implement `src/lib/search/parse-boolean.ts` with unit tests
- [ ] Implement `/api/search` route
- [ ] Implement `/api/course/[id]` route
- [ ] Test all routes with curl

**Deliverable:** Working API returning real UMD course data with boolean GenEd filtering.

### Phase 2: AI Summaries (Days 7-9)

**Goal:** AI summary pipeline works end-to-end.

- [ ] Install: `pnpm add -D @anthropic-ai/sdk p-limit tsx`
- [ ] Implement `scripts/generate-summaries.ts` with rate limiting
- [ ] Test with `--course CMSC330 --dry-run`
- [ ] Test with 5-10 courses: `--department CMSC`
- [ ] Validate JSON output matches `AISummary` schema
- [ ] Run full batch for all courses with 3+ reviews
- [ ] Verify summaries appear in `/api/course/[id]` response

**Deliverable:** Supabase courses table populated with AI summaries.

### Phase 3: Core UI (Days 10-15)

**Goal:** Functional single-page app with search and course display.

- [ ] Set up shadcn/ui: `pnpm dlx shadcn-ui@latest init`
- [ ] Add components: button, input, badge, accordion, card, select, toast
- [ ] Build root layout with responsive two-panel design
- [ ] Build SearchBar with boolean expression input + validation
- [ ] Build CourseCard with collapsed/expanded states
- [ ] Build AISummary display component
- [ ] Build CourseList with pagination and loading skeletons
- [ ] Connect search to `/api/search` with debounced fetching
- [ ] Connect course expansion to `/api/course/[id]`

**Deliverable:** Users can search courses, view details, and read AI summaries.

### Phase 4: Calendar & Pinning (Days 16-21)

**Goal:** Users can pin courses and see their schedule.

- [ ] Install: `pnpm add zustand`
- [ ] Set up Zustand store with localStorage persistence
- [ ] Implement pin/unpin actions
- [ ] Build WeekView calendar component
- [ ] Implement conflict detection (Section 12)
- [ ] Build PinnedSidebar with scheduled + async sections
- [ ] Build ConflictBadge and conflict toast notifications
- [ ] Build StaleBanner component
- [ ] Wire up Vercel Cron jobs for production

**Deliverable:** Full MVP — search, AI summaries, visual calendar, conflict detection.

### Phase 5: Polish & Deploy (Days 22-28)

**Goal:** Production-ready, portfolio-worthy.

- [ ] Loading skeletons for all async states
- [ ] Mobile responsive pass
- [ ] Error boundary components
- [ ] README with screenshots, architecture diagram, setup instructions
- [ ] Open Graph meta tags for link previews
- [ ] Lighthouse audit (performance, accessibility)
- [ ] Deploy to Vercel, verify cron jobs run
- [ ] Full end-to-end test on production URL

**Deliverable:** Live, deployed application. Portfolio-ready GitHub repo.

---

## 15. Claude Code Workflow Guide

### Starting a Session

```bash
cd genterp
claude
```

### Example Prompts (Copy-Paste Ready)

**Phase 0:**
```
Fetch https://api.umd.io/v1/courses?per_page=2 and show me the response. Then fetch https://api.umd.io/v1/courses/sections?course_id=CMSC330&per_page=2. I need to verify the gen_ed field structure and meeting time format match what's documented in our PRD.
```

**Phase 1 — Supabase setup:**
```
Read supabase/migrations/001_initial_schema.sql then create src/lib/supabase/server.ts using @supabase/supabase-js with the service role key from SUPABASE_SERVICE_ROLE_KEY env var. Also create src/lib/supabase/client.ts for browser-side usage with the anon key.
```

**Phase 1 — Sync routes:**
```
Read the field mapping in the PRD (Section 6), then create src/lib/sync/time-parser.ts and src/lib/sync/gen-ed-flattener.ts with the exact logic from the PRD. Include unit tests. Then implement src/app/api/sync/courses/route.ts that paginates through umd.io, transforms the data using those utilities, and upserts into Supabase.
```

**Phase 1 — Boolean parser:**
```
Create src/lib/search/parse-boolean.ts implementing the boolean expression parser from PRD Section 9. It should tokenize, validate, build an AST, and generate parameterized SQL. Include comprehensive unit tests covering: single tag, AND, OR, parenthesized groups, nested groups, invalid input, and SQL injection attempts.
```

**Phase 2 — AI summaries:**
```
Create scripts/generate-summaries.ts following PRD Section 10 exactly. Use p-limit for concurrency control (max 2) with 500ms delays. Include --course, --department, --force, and --dry-run flags. The script should fetch from PlanetTerp, call the Anthropic API with the prompt template from the PRD, validate the JSON response, and upsert into Supabase.
```

**Phase 3 — UI:**
```
Read src/types/index.ts first, then build src/components/search/course-card.tsx following the PRD spec. It should have collapsed (course_id, title, credits, gen_ed badges, GPA, open seats) and expanded (description, prerequisites, AI summary, section picker table with pin buttons) states using shadcn/ui accordion.
```

### Best Practices

1. **One file or feature per prompt.** Don't say "build the frontend." Say "build the CourseCard component."
2. **Reference the PRD.** Say "follow the spec in PRD Section 10 for the AI summary shape."
3. **Ask it to read before writing.** Say "Read src/types/index.ts and src/lib/supabase/server.ts first, then create the sync route."
4. **Commit after each working feature.**
5. **Use it for testing.** "Write unit tests for parse-boolean.ts covering all edge cases."
6. **Use it for debugging.** Paste error messages and relevant code.

### Git Workflow

```bash
# Feature branch workflow (recommended)
git checkout -b feature/boolean-parser
# ... work with Claude Code ...
git add .
git commit -m "feat: implement boolean GenEd expression parser with tests"
git push origin feature/boolean-parser

# Or simpler (fine for solo):
git add .
git commit -m "feat: implement search API"
git push
```

---

## Appendix A: GenEd Tag Reference (UMD)

| Tag | Full Name | Category |
|-----|-----------|----------|
| FSAW | Academic Writing | Fundamental Studies |
| FSPW | Professional Writing | Fundamental Studies |
| FSMA | Fundamental Studies Math | Fundamental Studies |
| FSOC | Oral Communication | Fundamental Studies |
| FSAR | Analytic Reasoning | Fundamental Studies |
| DVCC | Cultural Competence | Diversity |
| DVUP | Understanding Plural Societies | Diversity |
| DSHS | History and Social Sciences | Distributive Studies |
| DSHU | Humanities | Distributive Studies |
| DSNL | Natural Sciences (with lab) | Distributive Studies |
| DSNS | Natural Sciences | Distributive Studies |
| DSSP | Scholarship in Practice | Distributive Studies |
| SCIS | I-Series | Signature Courses |

## Appendix B: Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | Latest stable, Vercel-native |
| AI Provider | Anthropic (Claude Sonnet) | Simple SDK, 2-4 week timeline, cost-effective |
| Database | Supabase PostgreSQL | Free tier, GIN/JSONB indexing |
| GenEd Storage | Dual: JSONB raw + TEXT[] flat | Speed (GIN) + Precision (JSONB) |
| State Management | Zustand + localStorage | No accounts needed |
| Styling | Tailwind + shadcn/ui | Modern, accessible |
| Deployment | Vercel | Native Next.js, Cron support |
| Package Manager | pnpm | Fast, strict |
| UI Layout | Single page, side-by-side | Search left, calendar right |
| Cross-device | Single device (MVP) | localStorage only |
| AI Trigger | Manual script with p-limit | Cost control + rate limiting |
| Data Sync | Vercel Cron, chain-linked | Avoids 10s timeout on hobby tier |
| Sync Strategy | Upsert (idempotent) | Timeout-resilient, no duplicate risk |
| Time Format | Military int (1045) | Stored normalized, parsed from "10:45am" |

## Appendix C: Changelog from v2.0

| Section | Change | Reason |
|---------|--------|--------|
| Schema | `gen_ed_tags TEXT[]` → dual `gen_ed_raw JSONB` + `gen_ed_tags TEXT[]` | umd.io gen_ed is nested arrays, not flat |
| Schema | `instructor TEXT` → `instructors TEXT[]` | umd.io returns array of instructors |
| Schema | Added `dept_id`, `department`, `professors`, `relationships` columns | Available from APIs, useful for display |
| Schema | Added `semester` to sections | Needed for semester-specific queries |
| Sync | Split into `/sync/courses` + `/sync/sections` | Vercel 10s timeout; chain-linked pattern |
| Sync | Added `time-parser.ts` | umd.io uses "10:45am" strings, not integers |
| Sync | Added `gen-ed-flattener.ts` | Needed for dual-column gen_ed strategy |
| Search | Rewrote boolean engine for JSONB | AND queries need nested array checking |
| AI Pipeline | Added `p-limit` rate limiting (2 concurrent, 500ms delay) | PlanetTerp rate limit protection |
| AI Pipeline | GPA sync moved into summary script | Avoids extra cron job |
| Field Mapping | Added full Section 6 with exact transforms | API specs revealed many type mismatches |
| Cron | `vercel.json` now has two cron entries | Chain-linked sync pattern |
| All | Changed `instructor` → `instructors` everywhere | Plural, array type |
