# Implementation audit & migration map

Phase 1 of the master implementation prompt. Read-only audit of the existing
repository, completed before any migration code was written. This document is
the map referred to in §2 of the prompt.

Every claim below was verified against the source, not inferred from the README.
Where the README and the code disagree, the code wins and the disagreement is
called out.

---

## 1. Current architecture

| Layer | Reality |
| --- | --- |
| Framework | Next.js 15.5.26 App Router, React 19.0.0 (both pinned, no caret) |
| Language | TypeScript 5.7, `strict: true`, no `any` escapes found |
| Styling | Tailwind 3.4.17, custom token layer over CSS variables |
| ORM | Prisma 6.19.3 |
| Database | **SQLite** — and only SQLite. See §8 |
| Tests | Vitest 3.0.2, 9 files, 152 cases, all pure unit tests |
| CI | **None.** No `.github/workflows`, no GitLab CI, no pre-commit |
| Deployment | `vercel.json` with two cron entries and nothing else |

`src/lib/` is unusually disciplined for its size. The finance engine imports
exactly three things (`date-fns`, `dates.ts`, `money.ts`) — no Prisma, no React,
no `next/*`. That purity is the single most valuable asset in the repo and §43
correctly says not to rewrite it.

## 2. Existing entities

25 models, 24 user-owned, one global (`PlanFeature`). Ownership is expressed
purely as a `userId` foreign key with `onDelete: Cascade`; there is no tenancy
column, no row-level security and no scoping middleware.

Money is `Int` cents everywhere — 16 columns confirmed. Two `Float` columns
exist (`Loan.interestRatePct`, `PawnedItem.interestRatePct`) and both are rates,
not amounts.

## 3. Existing routes

~45 routes. The `(app)` group holds the authenticated shell: dashboard, analysis,
financial (6 sub-sections), goals, letters, medical, vault, reminders, advanced,
settings, admin.

**Top-level navigation today** (`src/lib/navigation.ts`), 11 items:

```
Home  Financial  Analysis  Goals  Letters  Medical  Advanced  Documents  Settings  Reminders  Admin
```

The new catalog specifies seven. Letters, Medical, Advanced and Reminders are
top-level now and must be reorganised.

## 4. Existing security controls

Sound, and worth preserving exactly as-is:

- scrypt password hashing, 16-byte per-user salt, 64-byte key, `timingSafeEqual`.
- Session tokens generated at 32 bytes, **only the SHA-256 hash is stored**, so a
  database dump cannot be replayed as a login.
- Cookies `httpOnly` + `SameSite=Lax` + `secure` in production.
- CSRF double-submit cookie issued in middleware, asserted as the first statement
  of every one of the 40 server actions.
- Login lockout is **persisted in the database** (8 failures / 15 min), not
  process memory, so it survives a restart.
- Generic failure messages for both login and password reset — no account
  enumeration, and timing equalisation on the missing-account path.
- Password reset runs in a transaction that also evicts every session.
- Cron routes **fail closed** without `CRON_SECRET`.
- The billing webhook fails closed and reads the plan from the stored
  `Subscription` row, never from the request body.

## 5. Existing finance calculations

`src/lib/finance/analysis.ts`, 857 lines, pure. Free cash:

```
income − (living expenses + finance payments + loan interest + pawn interest + personal outflow)
```

Then savings, then `netPosition`. Shortfall is `netPosition < 0`. D6
(`leftAfterGoals`) deliberately uses gross `requiredThisMonthCents` while BR-1
uses the free-cash-capped `plannedCents`, so the two legitimately disagree.

Every division and multiplication lands in `Math.round`/`Math.ceil` before
touching a `Cents` field. The integer invariant holds in the arithmetic.

**It is unenforced at the boundaries**, which is where §4 needs work:

- `Cents` is a bare `type Cents = number` alias, not a branded type.
- `parseAmountToCents("1.005")` → `100`, not `101`. `Math.round(rupees * 100)`
  is not exact decimal scaling, so any amount landing just below `.5` loses a
  paisa. Same for `"0.145"`.
- `formatRupees` takes **rupees** while `formatMoney` takes **cents** — two
  same-purpose functions with different units in one file. A caller that mixes
  them is off by 100×.
- SQLite has dynamic typing, so a non-integral REAL can be stored in an
  `INTEGER`-affinity column. Postgres will not allow this, which is a free
  integrity improvement from the §7 migration.

## 6. Existing UI components

13 primitives in `src/components/ui/`, all fully token-based. Colour is never
hardcoded except where it must be (theme-color meta, user-chosen accent).

Design system quality is high: 44px touch targets, `role="alert"` error
summaries, `aria-invalid` + `aria-describedby` on every field, `prefers-reduced-motion`,
visible focus rings, `.skip-link`, native `<dialog>` for delete confirmation
(a free focus trap).

## 7. Existing tests

152 cases, 9 files, entirely hermetic — no test imports Prisma, `next/headers`,
`node:fs` or performs a `fetch`. Analysis (43), plans (17), billing (18),
i18n (18), charts (16), identity (14), money (8), goal-affordability (7),
theme (remainder).

This is a good position to migrate from: the pure-logic surface is well covered
before the domain changes, which is exactly what §44 asks for.

## 8. Deployment assumptions — the real gap

- `provider = "sqlite"`, `DATABASE_URL="file:./dev.db"`.
- **`prisma/migrations/` does not exist.** There is no `migration_lock.toml` and
  no `prisma migrate` script anywhere. The schema has only ever been applied with
  `db push`, and `docs/CHANGES.md` records `db push --accept-data-loss`. §30
  requires `migrate deploy` in production, so **there is no migration history to
  convert** — the PostgreSQL schema will be the first migration.
- No Postgres driver, no `@prisma/adapter-*` in the lockfile. Prisma's bundled
  engine handles Postgres without extra packages, so this is not itself a blocker.
- No `engines` field, no `.nvmrc`, no Dockerfile. The only Node constraint is
  Prisma's `>=18.18`.
- `vercel.json` is Vercel-specific (§50 wants it removed in favour of a
  platform-neutral scheduler).

## 9. Gaps against the new requirements

### Business domain — almost entirely absent

`Company` (letterhead + agreement attachment) is the only business entity. There
is **no** model, route or form anywhere for: branches, sales revenue, operating
costs, business payments, business loans, or business targets. Verified by
grepping `src/` and `prisma/` for every related term — the only hits for
"branch" are the words "Branch Manager" inside bank letter prose.

`Income.kind` accepts `"business"`, but that is a label on a *personal* income
row, not a sales ledger.

So `/advanced` is a letterhead and contract register. §8–§11 are net-new work,
not a refactor.

### Owner draw (§12) — nothing exists

No entity, no concept in the engine, no way to express "business cash → personal
money" as a transfer. The engine has no personal/business context axis at all:
`buildMonthlyAnalysis` takes one flat set of records.

### Mode (§5, §6) — nothing exists

"Salary mode" appears nowhere. The only axis is the `basic | business` edition
string, which §6 explicitly forbids treating as the mode.

The encouraging part: `edition` is already only consulted in a handful of
places. `src/lib/navigation.ts:152-160` is the single source of truth for menus,
so reorganising navigation is one file. There is no `companyId` in the analysis
engine, and no `edition` branching in the dashboard at all.

### Storage (§25) — filesystem only

`src/lib/storage.ts`, 144 lines, calls `node:fs/promises` directly at 9 sites.
There is no abstraction seam. AES-256-GCM with a per-file 12-byte IV and a
verified auth tag is correct, and §26 says not to downgrade it — but the key is
`sha256("fintarg-vault-v1:" + AUTH_SECRET)`, one global key, and
`.env.example` instructs operators to rotate `AUTH_SECRET`. **Rotating it makes
every stored document permanently undecryptable**, with no key version and no
envelope encryption. This must be fixed as part of the S3 work, not after.

### Cross-cutting defects found during the audit

| Severity | Finding | Location |
| --- | --- | --- |
| **HIGH** | **IDOR — fixed.** `companyId` from the agreement form was persisted without an ownership check, letting a Business user attach another tenant's `Company` and read its name, address, phone, email and registration number. | `advanced/actions.ts:126` |
| HIGH | FR-12.5 re-authentication is dead code — `touchReauth`/`currentReauthAt` have no call sites and `Session.reauthAt` is never written, so restricted-document downloads have no freshness check. | `auth/session.ts:131-151` |
| MED | Account deletion is irreversible and requires only the literal string `DELETE` — no password, no re-auth. | `settings/actions.ts:329-362` |
| MED | Email change needs no password, no re-verification, and does not clear `emailVerifiedAt`. | `settings/actions.ts:85-95` |
| MED | Half-configured mail/SMS **silently falls back to logging**, so password-reset links are never delivered and nothing errors. | `mailer.ts:38-41` |
| MED | In-process rate limiter, and the IP key comes from a client-controllable `X-Forwarded-For`. | `rate-limit.ts:11` |
| MED | No `Strict-Transport-Security` and no `Content-Security-Policy` on an app holding NIC, medical and bank documents. | `next.config.ts` |
| MED | No environment validation module. A missing `APP_ORIGIN` silently mails localhost reset links. | all `process.env` reads |
| LOW | Seed is not idempotent — the Agreement is re-inserted on every run with its error swallowed. | `prisma/seed.ts:138-149` |
| LOW | `scripts/dev-session.ts` has no `NODE_ENV` guard; it will mint a live session against production. | `scripts/dev-session.ts` |
| LOW | Log transports print full message bodies, putting reset links and money dates into log aggregation. | `mailer.ts:28` |

---

## 10. Decisions taken, and why

Recorded here because §64 requires documenting judgement calls rather than
inventing behaviour.

- **Fix the IDOR before starting the migration.** It is a live cross-tenant data
  leak, it is a two-line fix using a pattern already in the codebase, and
  §56 makes it in scope regardless of what the catalog says.
- **The PostgreSQL schema will be the first migration.** There is no history to
  preserve, so `migrate deploy` has nothing to replay. This is simpler than §28
  implies, not harder — but it must be stated plainly in `DEPLOY.md` rather than
  implied.
- **`prisma/dev.db` is treated as disposable.** Confirmed: 44 rows, all seeded
  demo data, gitignored. The `basic → salary` mapping in §32 is still implemented
  and tested against an empty table, so the logic is exercised even though no
  data depends on it.
- **Native enums for closed sets only.** §7 says not to convert every string.
  `UserMode` is a clear enum. `Loan.method` and `Reminder.status` are closed and
  currently cast unsafely in `load.ts` (`as LoanInput["method"]`), so a bad value
  silently falls through to the `reducing` branch. Those are worth converting
  because they are load-bearing casts. Open-ended ones stay strings.

## 11. Blockers

Two inputs are outstanding and both stop real work:

1. **`Updated UI's.pdf`** — the Priority 1 authority for §14–§24 and §39.
   Without it, the navigation, the three Home screens and the Financial tabs
   would have to be invented, which §64 forbids. Not present in the repository;
   `UIUX Fintarg.docx` on the Desktop is 0 bytes.
2. **Neon connection string** — neither Docker nor `psql` is installed, so there
   is no way to verify the §7 migration, run `migrate deploy`, or exercise the
   `§61` PostgreSQL verification list.