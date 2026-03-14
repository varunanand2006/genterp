# GenTerp — Claude Code Instructions

## What This Project Is
AI-powered UMD GenEd and elective course discovery and schedule planner. Single-page app with boolean GenEd search, department/level filtering, AI review summaries, and a weekly calendar. Shows all UMD courses — not just GenEd — with GenEd tags as an optional filter layer.

## Tech Stack
- Next.js 16 (App Router) — NO src/ directory, everything at project root (app/, lib/, components/)
- Supabase (PostgreSQL) with GIN + JSONB indexes
- Tailwind CSS 4 + shadcn/ui
- Zustand + localStorage for state (no user accounts)
- TypeScript strict mode
- pnpm as package manager
- Deployed on Vercel with cron jobs for data sync

## Project Structure Convention
- `app/` — Next.js App Router pages and API routes
- `lib/` — Shared utilities (supabase clients, parsers, AI helpers)
- `components/` — React components (search/, calendar/, shared/, ui/)
- `store/` — Zustand stores
- `types/` — Shared TypeScript interfaces
- `scripts/` — Admin-only scripts (AI summary generation)

## Key Architecture Decisions
- gen_ed from umd.io is a nested string[][] (array of arrays). We store BOTH:
  - `gen_ed_raw JSONB` — original nested structure for precise AND queries
  - `gen_ed_tags TEXT[]` — flattened for GIN-indexed fast lookups
- Meeting times from umd.io are strings like "10:45am" — we parse to military integers (1045)
- umd.io fields `seats`, `open_seats`, `waitlist`, `credits` are strings — always parseInt()
- umd.io uses `name` for course title (not `title`), `course` for course_id in sections
- `instructors` is always an array, never a single string
- Conflict detection runs client-side in TypeScript
- AI summaries are pre-computed via admin script, stored in ai_summary JSONB column
- No user accounts — all personalization via Zustand + localStorage

## Database Tables (Supabase)
- `courses` — course_id (PK), title, dept_id, department, credits, description, gen_ed_raw, gen_ed_tags, avg_gpa, professors, ai_summary, relationships, last_synced
- `sections` — (section_id, semester) composite PK, course_id (FK), instructors, seats_total, seats_open, waitlist_count, meetings (JSONB), semester, last_synced
- `grades` — id, course_id (FK), professor, semester, section, a_plus…f, w, other — per-section grade distributions from PlanetTerp
- `sync_log` — id, sync_type, started_at, finished_at, status, records_synced, error_message

## External APIs
- umd.io: https://api.umd.io/v1 (courses, sections, semesters) — no auth, 200ms delay between requests
- PlanetTerp: https://planetterp.com/api/v1 (GPA, reviews, professors) — no auth, 500ms delay, max 2 concurrent via p-limit

## Code Style
- Use TypeScript strictly — no `any` types
- Parameterized SQL only — never concatenate user input into queries
- All API routes return typed JSON responses
- Use shadcn/ui components for UI elements
- Search inputs submit on Enter or icon click — no auto-search on keystroke
- Dept filter supports comma-separated values and level patterns (e.g. CMSC4XX)