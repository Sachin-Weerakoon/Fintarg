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

Seeded sign-ins (password `fintarg123` for all three):

| Account                | Edition  | What it shows                        |
| ---------------------- | -------- | ------------------------------------ |
| `admin@fintarg.lk`     | Business | Admin section: accounts and feature flags. No money records. |
| `basic@fintarg.lk`     | Basic    | The specification's worked example   |
| `business@fintarg.lk`  | Business | Companies, agreements, company letters |

Quality gates:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest - 152 tests: analysis, charts, i18n, billing, money, theme
npm run build       # production build (24 routes, ~103 kB shared JS)
```

### Scheduled jobs

Two route handlers do the recurring work. Both are guarded by
`Authorization: Bearer $CRON_SECRET`. The guard **fails closed**: with no
`CRON_SECRET` set they return 401, because `/api/cron/maintenance` permanently
deletes accounts and a forgotten variable must not quietly open that. To exercise
them from a terminal, set `CRON_ALLOW_OPEN=true` and leave `CRON_SECRET` empty.

| Route | What it does |
| --- | --- |
| `GET /api/cron/reminders` | Materialises reminder rows for every account from their live finance records, then sends the ones inside that account's own lead window — by email, or by SMS when the account has no email address. Idempotent: a stable `dedupeKey` plus a `sentAt` stamp mean a rerun neither duplicates a reminder nor resends it. |
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
| BR-1 | Outflow = living expenses (non-personal, medical included) + finance payments due this month + loan interest + pawn interest (D1: in the month it falls due) + `max(planned personal, actual personal)` (D2) + savings | `buildMonthlyAnalysis` |
| BR-2 | Shortfall = outflow − income, shown with a warning | `buildMonthlyAnalysis`, `NetPositionCard` |
| BR-3 | A shortfall can be recorded as a loan; its interest then reduces later months. Interest accrues only from the loan's start month through its due month (D3: `reducing` on the balance, `simple`/`flat` on the original principal, `compound` compounded monthly) | `loanFromShortfall`, `loanMonthlyInterestCents` |
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
      analysis/             full analysis, PDF export, statement, shortfall -> loan
      financial/            income, expenses, payments, loans, pawned, personal plan
      goals/  letters/  medical/  vault/  advanced/  reminders/  settings/  admin/
    api/
      cron/                 reminders, maintenance (CRON_SECRET, fail closed)
      billing/              signature-verified payment webhook
      locale/               sets the language cookie
  components/
    ui/                     design system primitives (the only styled atoms)
    forms/                  RecordForm + the auth and appearance forms
    layout/                 navigation, page header, month switcher
    charts/                 hand-written SVG money trend chart
  lib/
    finance/analysis.ts     the engine
    finance/load.ts         database -> engine
    charts/geometry.ts      pure chart geometry, unit tested
    i18n/                   locale config + typed en/si/ta catalogues
    billing/                provider interface, checkout, webhook rules
    plans.ts                editions, plans, feature flags
    theme.ts                contrast checking and accent normalisation
    money.ts  dates.ts      formatting helpers
    auth/                   scrypt hashing, sessions, CSRF, rate limiting
    storage.ts              AES-256-GCM encrypted document vault
    pdf/                    shared parts, analysis, goals, letters, statement
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
- **Phase 3 (shipped):** a six-month money trend chart (hand-written SVG), two more
  PDF exports (savings goals report, month statement), Sinhala and Tamil for the
  navigation, authentication and shared money vocabulary, SMS as a reminder
  channel, and the subscription billing path.

### Phase 3 notes

**Charts.** `MoneyTrendChart` draws money in against money out with signed bars
from a break-even line, so a shortfall is visibly below zero. No charting library:
the geometry is ~120 pure functions in `src/lib/charts/geometry.ts`, unit tested. The
existing `BarList` and `DailySpendStrip` are kept, because a bar list with a value
and a share on every row is more accessible than a chart, not less.

**Language.** The locale lives in a cookie rather than the URL, so every link,
bookmark and email keeps working and switching language never changes the page you
are on. `en` is the source of truth and the Sinhala and Tamil catalogues must match
its type, so a missing translation is a build error. **Coverage is partial**: the
navigation, login, registration and shared money vocabulary are translated; the
long-form finance copy is not. The remainder needs a native reviewer.

**Billing.** `BILLING_PROVIDER` accepts `log` (no gateway) or a provider you
implement in `src/lib/billing/provider.ts` — three methods, no SDK. Naming a
provider that is not implemented is an error on purpose, so it cannot silently
behave like `log` and hand out a paid plan. The plan is moved **only** by the
signature-verified webhook at `POST /api/billing/webhook`; returning from checkout
proves nothing. See `.env.example` for the three billing variables.

## Known gaps

- The email transport is a log stub until `MAIL_PROVIDER` is implemented in
  `src/lib/mailer.ts`; SMS is the same shape in `src/lib/auth/sms.ts` and becomes
  real with `SMS_PROVIDER=http`.
- **No payment gateway is implemented.** The billing path is complete and tested
  — including the signature check, replay idempotency and refunds — but
  `BILLING_PROVIDER=log` means the Business upgrade is still free. Wiring a real
  gateway is one `BillingProvider` implementation away.
- The Sinhala and Tamil catalogues cover the app shell only; see above.
- Storage writes to the local filesystem; swapping in a private S3-compatible
  bucket only requires reimplementing the four functions in `src/lib/storage.ts`.
- Reminder lead time is honoured per account; a new money date is emailed on the
  next daily run that falls inside the window.
- Automated daily backups and the staging environment are deployment concerns,
  not code.
