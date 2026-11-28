<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orbis Backend, Search APIs & Free-Tier Rules (Read Before Editing)

Orbis is a **100% free-tier ($0/month)** global study-abroad platform covering **35 countries** (`src/lib/countries.ts`). Any new agent working on this codebase **MUST** follow these exact APIs, search workflows, and safety limits.

### 1. Accurate Course Search, Suggestion & Verification API Map

| Feature | Endpoint / Module | How It Works |
|---|---|---|
| **Paginated Course Search & Catalogue** | `GET /api/courses` (`src/app/api/courses/route.ts`) | Searches Supabase (`courses` + `universities` + `eligibility_rules`) with synonym expansion (`src/lib/search-synonyms.ts`), pins Admin Priority universities first (`src/lib/university-classification.ts`), applies Public/Private filters, merges the 35-country curated catalogue (`src/lib/country-curated-fallback.ts`), enforces global diversity (`src/lib/course-diversity.ts`), applies live stay-back overrides (`src/lib/live-policy-store.ts`), and overlays 180-day verified URLs & grounded tuition fees (`verified_meta`). |
| **Personalized AI Course Suggestion** | `POST /api/ai-recommend` (`src/app/api/ai-recommend/route.ts`) | 1. Builds candidate pool from Supabase + Admin Priority Partners + Curated Catalogue.<br>2. Scores deterministically via `calculateMatchScore` (`src/lib/match-calculator.ts`): **65% academic** (Masters/PG checks Degree % only; Bachelor/UG checks +2/12th % only) + **35% English** (IELTS, auto-converted PTE, or MOI/Waived) plus Priority (+25), title/level/budget/intake bonuses and backlog/gap penalties.<br>3. Sends top 24 candidates + 2026 visa baseline to Groq/Gemini AI Counselor (`src/lib/groq-client.ts`) to select & explain the best 12.<br>4. Deterministically falls back to top 12 scored DB/curated candidates if AI is unavailable. |
| **Low-Result AI Expansion** | `POST /api/ai-discover-courses` (`src/app/api/ai-discover-courses/route.ts`) | Triggered automatically when a filter returns `< 6` courses; grounds results first against free `sitemap.xml` catalogues (up to 14 paginated sub-sitemaps) + Finland Studyinfo.fi, injects the 35-country counselor rulebook (`src/lib/expert-country-rules.ts`), and supplements cleanly without cross-level pollution. |
| **Zero-404 Link Shield (0 Credits)** | `POST /api/course-link-check` (`src/app/api/course-link-check/route.ts`) + `src/lib/sitemap-course-matcher.ts` | Checks `course_url` via HTTP HEAD/GET. If 404/broken/generic/department-subpage, searches the university's free `sitemap.xml` to locate the live direct course URL and self-heals Supabase `courses.course_url`. |
| **Full-Page Live Fee & Eligibility Verification** | `POST /api/ai-course-check` (`src/app/api/ai-course-check/route.ts`) + `src/lib/live-course-verifier.ts` | Checks 180-day cache first (`src/lib/course-verification-cache.ts`, `CURRENT_EXTRACTOR_VERSION = 4`, auto-invalidates department/institute `/teaching/` sub-pages). On cache miss: discovers official URL via **free `sitemap.xml` (up to 14 sub-sitemaps)** → **0-credit Canonical Degree-Link Follower** → **1-credit domain-locked Tavily `basic` search** → optional free **Serper Google Search (`SERPER_API_KEY`)** / **Brave Search (`BRAVE_SEARCH_API_KEY`)** (`src/lib/external-search-agents.ts`) → Gemini Google Search Grounding → reads up to **45,000 chars** via Jina Reader / direct HTML → injects 35-country 20-year counselor rules (`src/lib/expert-country-rules.ts`) & runs **2-AI parallel extraction (Groq + Gemini)** + optional **OpenAI Judge** → verifies printed fee via `numberAppearsInPageText` (or statutory public Non-EU fee where mandated by law, e.g. Austria €1,454/yr, Germany €0 outside BW/TUM) → converts via live ECB FX (`src/lib/live-fx.ts`) → caches for 180 days & self-heals Supabase. |
| **Daily Auto-Update Cron** | `GET/POST /api/cron/auto-update` (`src/app/api/cron/auto-update/route.ts`) | Runs daily via `vercel.json`: scans 5 countries/day (Google News RSS + quota-guarded Tavily official policy scan + Gemini Grounding), refreshes 30 Germany DAAD courses/day at 0 credits, and repairs up to 3 broken/generic DB course URLs/fees. |
| **FX & Policy & Excel Admin Feeds** | `/api/fx-rates`, `/api/live-policy`, `POST /api/ingest-excel/commit` | Live ECB currency rates, live country policy overrides/news, and deduplicated admin batch Excel ingestion into Supabase. |

### 2. Non-Negotiable Free-Tier ($0/Month) & Tavily Safety Limits

- **NEVER call `https://api.tavily.com` outside `src/lib/live-course-verifier.ts`.**
- **NEVER bypass or raise the unified monthly credit caps** in `src/lib/course-verification-cache.ts`:
  - `AUTO_TAVILY_MONTHLY_LIMIT = 700` (auto-verification stops at 700/1,000)
  - `CRON_POLICY_TAVILY_MONTHLY_LIMIT = 850` (daily cron policy scans stop at 850/1,000)
  - `HARD_TAVILY_MONTHLY_LIMIT = 900` (manual admin checks stop at 900/1,000, preserving a 100-credit safety buffer below Tavily's 1,000 free monthly cap)
- Keep `search_depth: 'basic'` (1 credit/search, never `'advanced'`), keep the **180-day verification cache**, keep the **8 req/hr per-IP rate limit** in `/api/ai-course-check`, and always fall back cleanly with **zero errors/crashes** when quotas are exhausted.

### 3. Global Data Accuracy Rules (All 35 Countries)

- **International Tuition Only:** Always extract **International / Non-EU / Non-EEA / Overseas / Out-of-State / Foreign** annual tuition fees across every country (never Home/UK/Domestic/EU fees unless explicitly 0/same for Non-EU too). Always format fees using native local billing currencies (`getCountryBillingCurrency` in `src/lib/student-guides.ts`) with Local / EUR / INR switching.
- **Honest Verification Badges (`src/app/(public)/courses/page.tsx`):** Show green `Fee & Link Verified` (or `2-AI Fee & Link Verified`) **only** when `feeVerified === true` (grounded fee printed on page). When only the official link is verified and no fee was printed, show blue `Link Verified · Confirm Fee`.
- **Stay-Back Rules:** Never hardcode stale visa durations; resolve stay-back via `resolveStayBackWithOverride` / `resolveOfficialStayBackYears` (`src/lib/country-visa-intel.ts` + `src/lib/live-policy-types.ts`).

### 4. Next.js 16 & Security Guardrails

- `next.config.ts` enables `cacheComponents: true` — **never** use `export const revalidate` or uncached `Date.now()` directly inside prerendered pages (`/study-in/[slug]` uses `'use cache'` + `cacheLife('hours')`).
- Use valid configured AI models (`gemini-2.5-flash` / `gemini-2.0-flash`, Groq `llama-3.3-70b-versatile`).
- Never stage, commit, log, or print `.env.local` or secret keys.
- Run `npm.cmd run build` before pushing any changes to `main`.
