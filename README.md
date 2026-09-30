# Fintarg

Personal finance and life management for people in Sri Lanka. One number first:
**net position this month** — the money left after everything, or the shortfall,
in plain language.

Built mobile-first (360 px) with Next.js 15 App Router, TypeScript, Tailwind CSS,
Prisma and SQLite for local development.

---

## Running it

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET to a long random string
npm run db:push               # create the local SQLite database
npm run db:seed               # optional: two demo accounts
npm run dev
```

Seeded sign-ins (password `fintarg123` for both):

| Account                | Edition  | What it shows                        |
| ---------------------- | -------- | ------------------------------------ |
| `basic@fintarg.lk`     | Basic    | The specification's worked example   |
| `business@fintarg.lk`  | Business | Companies, agreements, company letters |

Quality gates:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest - analysis engine, theme contrast, money formatting
npm run build       # production build (24 routes, ~103 kB shared JS)
```

### Scheduled jobs

Two route handlers do the recurring work. Both are guarded by
`Authorization: Bearer $CRON_SECRET` (open in development only, and hard 401 in
production when the secret is missing).

| Route | What it does |
| --- | --- |
| `GET /api/cron/reminders` | Materialises reminder rows for every account from their live finance records, then emails the ones inside the lead window. Idempotent: a stable `dedupeKey` plus a `sentAt` stamp mean a rerun neither duplicates a reminder nor resends an email. |
| `GET /api/cron/maintenance` | Prunes expired sessions, hard-deletes any account whose 30-day deletion window has closed (unlinking its encrypted vault files first), and clears vault blobs that no longer belong to any document row. |

`vercel.json` wires both to a daily schedule:

```json
{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 6 * * *" },
            { "path": "/api/cron/maintenance", "schedule": "30 6 * * *" }] }
```

Email is provider-agnostic: with `MAIL_PROVIDER` unset, messages go to the
server log so the pipeline can be exercised end to end. Implement the one
function in `src/lib/mailer.ts` to send for real. Users control reminders from
Settings, and the job honours that preference.

A dev helper mints a session cookie for an existing account, which is handy for
inspecting the app without signing in each time:

```bash
npx tsx scripts/dev-session.ts basic@fintarg.lk
```

---

## The one thing to read first

`src/lib/finance/analysis.ts` is the heart of the product. It is a pure function
from records to a `MonthlyAnalysis`, with no database access, so the dashboard,
the next-month projection, the PDF export and the unit tests all use the same
arithmetic.

The specification's worked example is a test in that file:

```
income            50,000
finance payments  25,000
living expenses   30,000
                  --------
total outflow     55,000   ->  shortfall 5,000
savings goal      30,000   ->  flagged "not possible this month"
```

### Business rules and where they live

| Rule | Behaviour | Code |
| --- | --- | --- |
| BR-1 | Outflow = living expenses + finance payments + loan interest + planned personal + savings | `buildMonthlyAnalysis` |
| BR-2 | Shortfall = outflow − income, shown with a warning | `buildMonthlyAnalysis`, `NetPositionCard` |
| BR-3 | A shortfall can be recorded as a loan; its interest then reduces later months | `loanFromShortfall`, `recordShortfallAsLoanAction` |
| BR-4 | Daily target × days in month = monthly target | `deriveGoalAmounts`, `requiredThisMonth` |
| BR-5 | A goal is flagged unachievable when free cash is below what it needs | `evaluateGoal` |
| BR-6 | Next-month projection includes known obligations | `MonthlyAnalysis.projection` |
| BR-7 | Basic users cannot reach Business features | `src/lib/plans.ts` + `requireFeature` in `src/lib/guard.ts` |
| BR-8 | A user only ever sees their own records | every query is filtered by `userId`; enforced per page and per action |

Two decisions worth calling out:

**A goal that cannot be funded is flagged, not budgeted.** If free cash is
negative, the goal's monthly requirement is reported as a warning and excluded
from planned outflow. Budgeting an impossible saving would hide the very
shortfall the user needs to see.

**Money is integer cents.** Every amount is an `Int` number of LKR cents
(`amountCents`), so no floating-point error can ever reach a total. Use
`parseAmountToCents` to read a form value and `formatMoney` to display it.

---

## Layout

```
src/
  app/
    (auth)/                 login, register, server actions
    (app)/                  authenticated shell: sidebar + bottom nav
      page.tsx              dashboard - the net position card
      analysis/             full analysis, PDF export, shortfall -> loan
      financial/            income, expenses, payments, loans, pawned, personal plan
      goals/  letters/  medical/  vault/  advanced/  settings/
  components/
    ui/                     design system primitives (the only styled atoms)
    forms/                  RecordForm + the auth and appearance forms
    layout/                 navigation, page header, month switcher
  lib/
    finance/analysis.ts     the engine
    finance/load.ts         database -> engine
    plans.ts                editions, plans, feature flags
    theme.ts                contrast checking and accent normalisation
    money.ts  dates.ts      formatting helpers
    auth/                   scrypt hashing, sessions, CSRF, rate limiting
    storage.ts              AES-256-GCM encrypted document vault
    pdf/analysis.ts         PDF export
prisma/schema.prisma       every entity, all owned by exactly one user
```

## Design system (UIX-001)

Tokens live in `src/app/globals.css` and `tailwind.config.ts`; screens never use
raw colours. Spacing is 4/8/12/16/24/32/48, cards are 12 px, inputs 8 px,
buttons and chips are fully rounded, and the shadow is
`0 2px 8px rgba(20,40,75,0.08)`.

**Theme colours are checked, not trusted.** A custom accent is passed through
`ensureReadableOnWhite`, which darkens it until white text reaches 4.5:1. The
settings screen shows the contrast ratio and says in words when a colour was
adjusted. Layout never changes with the theme — only colour does.

**Colour never travels alone.** Every status pairs colour with a word and an
icon ("Shortfall" + warning triangle, "Not possible this month" + badge).

Typography is self-hosted Poppins (400/500/600/700) with
`'Noto Sans Sinhala', 'Noto Sans Tamil', system-ui` fallbacks, so there is no
third-party request at runtime. Font size and layout density are user settings
applied through `data-font-scale` and `data-density`.

## Security and privacy

- Passwords: scrypt with a per-user salt, stored as `scrypt$N$r$p$salt$hash`.
- Sessions: random 32-byte token in an httpOnly, SameSite=Lax cookie; only its
  SHA-256 hash is stored, so a database leak cannot be replayed as a login.
- CSRF: a double-submit token on every mutating form, plus Next.js's own origin
  check on Server Actions.
- Rate limiting on register and sign-in, with a generic failure message so the
  form cannot be used to discover which emails exist.
- Document vault: files are encrypted with AES-256-GCM outside the web root under
  random opaque names; the real file name never touches the filesystem.
  Maximum 10 MB, PDF/JPG/PNG/DOCX only.
- Account deletion is honoured within 30 days, per Sri Lanka's Personal Data
  Protection Act No. 9 of 2022.

## Phase status

- **Phase 1 (shipped):** accounts, income, expenses, finance payments, loans,
  pawned items, monthly analysis, savings goals, planned personal spending,
  reminders, settings and theme, document vault, personal letters, financial
  section.
- **Phase 2 (shipped behind flags):** company profiles, company-branded letters,
  the Advanced section with agreements, and category-based access control. The
  nav item and the route both consult `can(edition, "business.advanced")`.
- **Phase 3 (not built):** Sinhala/Tamil UI, SMS reminders, charts, richer PDF
  exports, subscription billing.

## Known gaps

- The email transport is a log stub until `MAIL_PROVIDER` is implemented in
  `src/lib/mailer.ts`; SMS reminders (Phase 3) have no provider at all.
- Storage writes to the local filesystem; swapping in a private S3-compatible
  bucket only requires reimplementing the four functions in `src/lib/storage.ts`.
- Rate limiting is per process, which is correct for a single instance only.
- Automated daily backups and the staging environment are deployment concerns,
  not code.
- Phase 3 remains unbuilt: Sinhala/Tamil UI, charts, richer PDF exports and
  subscription billing.
