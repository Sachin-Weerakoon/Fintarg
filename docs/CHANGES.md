# Change log

One heading per work package: files changed, schema changes, new env vars,
deviations, and anything left unfinished.

> **Commit-message deviation (WP1).** The prompt requires one commit per work
> package named `WPn: <title>`. The WP1 source changes were committed manually by
> the repository owner mid-task as `c82208f "Corrections Vol.1"` and pushed to
> `origin/main` before this log was finished. It contains exactly the 13 WP1 files
> and nothing else, so the work itself is intact and complete; only the message
> deviates. I did not rewrite history or force-push to correct it. The follow-up
> commit carries the `WP1:` prefix and adds this log. Future WPs use the required
> naming.

---

## WP1 — Calculation correctness (B1–B7, D1/D2/D3/D6)

### Files changed

- `src/lib/finance/analysis.ts` — engine
- `src/lib/finance/load.ts` — mapping and the recurring-income query
- `src/lib/finance/analysis.test.ts` — tests
- `src/lib/validation.ts` — added `"compound"` to `loanSchema.method`
- `src/lib/reminders.ts` — payment term respected when scheduling reminders
- `src/lib/reminders/schedule.ts` — passes `startDate` through
- `src/app/(app)/financial/loans/page.tsx` — compound option, month-aware interest
- `src/app/(app)/analysis/shortfall/page.tsx` — compound option
- `src/app/(app)/financial/income/page.tsx` — recurring defaults to on
- `src/app/(app)/financial/finance-payments/page.tsx` — "N payments left" from today
- `prisma/seed.ts` — one expense amount adjusted (see below)
- `README.md` — BR-1 and BR-3 rows amended for pawn interest (D1) and interest methods (D3)

### Schema changes

None. `Loan.startDate` and `FinancePayment.startDate` already existed; WP1 only
starts using them in the engine instead of ignoring them.

### New env vars

None.

### What changed, bug by bug

| Ref | Fix |
| --- | --- |
| B1/B2 (D2) | `livingExpensesCents` is now non-personal expenses only, so personal spending is no longer counted twice. The personal line is `max(planned, actual)` and is used in `outflowTotal`, `freeCash` and the breakdown. Added `totalSpentCents` (all expenses) for the daily strip and month-to-date. |
| B3/B4 (D3) | `loanMonthlyInterestCents(loan, month)` now takes the month. Interest is 0 before the start month and after the due month. `simple`/`flat` use `principalCents`; `reducing` uses `remainingBalanceCents`; new `compound` = `P·((1+r/12)^n − (1+r/12)^(n−1))` with `n` whole months since the start month, rounded once at the end. |
| B5 | A finance payment counts in a month only while `startMonth ≤ m < startMonth + monthsRemaining` (`paymentCountsInMonth`). Applied to the current month, the projection and reminders. The finance-payments page shows the count remaining *from today*, not the figure originally typed. |
| B6 | `loadAnalysis` loads `(recurring = true AND date ≤ end) OR (date within month)` instead of a 3-month window, so a salary entered 8 months ago still counts. `isRecurringIncome` treats `frequency = "monthly"` as recurring even when the box was unticked. The income form's checkbox now starts ticked. |
| B7 (D1) | Pawn interest is a real outflow term, landing in the month containing `nextInterestDueDate` (or every month when there is no due date). Added to `outflowTotal` and `freeCash`. The projection lists pawn separately, so it is not added twice. |
| D6 | Added `leftAfterGoalsCents = incomeTotal − Σ goal.requiredThisMonthCents`. Display only; it is deliberately not part of BR-1. |

The breakdown now reconciles to `outflow.totalCents` exactly, and there is a test
asserting that so a future term cannot be added without a matching line.

### Deviations

1. **`loanMonthlyInterestCents` signature changed** from `(loan)` to `(loan, month)`.
   The month is required for the start/due gating the specification asks for, so it
   is not optional. Callers were updated.

2. **Manual interest is checked before the date gate.** The specification lists
   "manual monthly amount wins; return 0 before the start month or after the due
   month" in that order, so a manually recorded figure is returned for any month.
   Arguably a loan should not charge before it starts, but I followed the stated
   ordering rather than reinterpret it. Flagging in case the order was unintended.

3. **`personalPlanStatus` is `over` at exactly 100 %** (`actual >= planned`), reading
   "`over` when actual ≥ 100 % of plan". Previously it needed to strictly exceed.

4. **Projection baseline uses non-personal spending only.** The next-month living
   baseline is derived from non-personal daily spend and the personal line is added
   once as `personalOutflow`. Averaging over all expenses would have re-introduced the
   B1 double-count inside the projection.

5. **Two existing tests changed expectations.** `BR-1 total outflow composition`
   asserted living expenses of Rs. 23,000 (which counted the Rs. 3,000 personal
   expense *and then* added the Rs. 3,000 plan again) and omitted pawn interest
   entirely — i.e. it encoded the B1/B2 and B7 bugs. Its expected total moved from
   Rs. 49,000 to Rs. 51,000. The specification's worked example (Rs. 50,000 income,
   Rs. 25,000 finance, Rs. 30,000 living → Rs. 55,000 outflow → Rs. 5,000 shortfall,
   goal flagged) is unchanged and still passes verbatim, as required.

6. **"Repeat every month" is ticked by default unconditionally** rather than
   conditionally on `kind = salary`. `RecordForm` takes a static `FieldSpec` array
   with no reactive re-defaulting, and the `kind` select already defaults to
   `salary`, so the visible behaviour matches the requirement. The engine-side rule
   (`monthly` implies recurring) is the real guarantee and is tested.

### Acceptance check

On a freshly seeded database, `basic@fintarg.lk` for the current month reports:

```
income        Rs. 53,000
living        Rs. 28,000
finance       Rs. 25,000
personal line Rs.  5,000
TOTAL OUTFLOW Rs. 58,000
NET POSITION  Rs. -5,000   -> Shortfall Rs. 5,000
Emergency fund -> free_cash_short  ("not possible this month")
breakdown lines sum == total: true
```

### Seed data change

The B1/B2 fix legitimately moved the demo's shortfall: before WP1 the Basic account
read Rs. 15,000 short because the Rs. 5,000 personal expense was counted inside
"living expenses" *and* again as the personal plan. After the fix it correctly read
Rs. 10,000 short. Neither figure is the documented Rs. 5,000.

To make the demo reproduce the worked example exactly, one seeded expense was
reduced (Food, Rs. 12,000 → Rs. 7,000), giving
`53,000 − 28,000 − 25,000 − 5,000 = 5,000`. This is a deliberate, documented change
to seed data, not a change to any expectation in the worked-example unit test, which
still passes verbatim and untouched.

### Tests

24 new cases across seven new `describe` blocks; suite went from 38 to 62 passing.
Each is its own `it`, covering: personal double-count (3 cases), the four interest
methods with hand-computed values plus pre-start/post-due zeroing, finance payment
term counting, old recurring income, pawn due-month placement and projection
non-duplication, and `leftAfterGoalsCents`.

### Not finished

Nothing in WP1. The D6 display line is computed and available on the model, but the
goal card and Analysis text that render it are added in WP5/WP11 as specified.

## WP2 — Accounts, authentication, administration, feature flags and data export

Covers FR-1 (email or mobile, forgotten password, email verification), FR-1.6
(role), FR-12.5 (re-authentication), FR-14 (plan feature gating), FR-15.1
(admin-settable feature flags) and NFR-7 (data portability).

### Schema

`User.email` is now nullable and unique, so an account can be registered with a
mobile number only (FR-1.1). Added `User.mobile`, `role`, `consentAt`,
`consentVersion`, `failedLogins` and `lockedUntil`, plus `PasswordResetToken`,
`VerificationToken` and `PlanFeature`. `Session.reauthAt` records when a password
or other sensitive value was last confirmed (FR-12.5).

Applied with `prisma db push --skip-generate --accept-data-loss`. No rows were
dropped: the previously non-null `email` became nullable, which only widens.

### Identity

`src/lib/identity.ts` is the single place that understands an account identifier.
`parseIdentifier` decides email versus mobile; `normaliseMobile` rewrites
`+94 77 123 4567`, `94-771234567` and `077 123 4567` to `0771234567` and rejects
anything that is not exactly ten digits. `displayNameFor` never throws on the now
nullable email, so the header cannot render blank.

### Authentication

- Registration takes an email *or* a mobile, and stores consent (`consentAt`,
  `consentVersion`) with the account.
- Sign-in looks the account up by either identifier and returns one generic
  message, so a wrong email and a wrong mobile are indistinguishable.
- Eight consecutive failures lock the account for fifteen minutes. The counter is
  persistent rather than in-memory, and resets on success.
- Forgot/reset password uses a SHA-256 hashed, single-use token expiring in 30
  minutes. Starting a new reset invalidates the previous one, and a successful
  reset deletes *every* session for that user so it genuinely evicts anyone else.
- The link is emailed or texted depending on which identifier was used.
- Email verification is optional and never blocks sign-in. Confirmation requires a
  POST rather than a link click, because mail scanners prefetch links and would
  otherwise consume the token before the user does.

### Sessions and re-authentication

`Session.reauthAt` with `touchReauth`, `currentReauthAt`, `currentSessionToken` and
`deleteOtherSessions`. Changing a password invalidates all other sessions and
writes an audit row.

### Plan gating and admin feature flags

`can()` stays synchronous. The admin-merged list is resolved once per request in
`getCurrentUser` and passed down as `featuresOf(edition, resolvedFeatures)`, which
keeps client components able to call it.

A `PlanFeature` row is a complete override for its (plan, feature) pair: `false`
removes the feature, `true` grants one the matrix did not, and an absent row defers
to `PLAN_MATRIX`. Saving calls `invalidatePlanFeatureCache()`, so an admin change
applies on the next request with no deploy.

Administration acts on *access only*: an admin can change a plan or role, pause an
account, or toggle a feature. An admin cannot read or write anyone's money records
or documents, because those pages scope every query by `userId` and the admin
pages never query them.

### Data export

`POST /settings/export` (CSRF required, so a link prefetcher cannot trigger it)
returns one JSON file holding every record the signed-in user owns, all scoped to
their own `userId`. Vault document *bytes* are deliberately excluded and only
metadata is included, because the files stay encrypted in the vault.

### Deviations and judgement calls

- `POST /verify-email` became `POST /verify-email/confirm`. A page and a route cannot
  both resolve to `/verify-email`, and the production build failed on the collision.
- `savePlanFeaturesAction` is a plain form action, not a `useActionState` action: it
  drives a whole matrix table and returns no field-level state.
- The unverified-email banner is a reminder, not a gate. Nothing is blocked, because
  FR-1.3 treats verification as optional.
- Seed data keeps `admin@fintarg.lk`, per the WP1 seed conventions.

### Tests

31 new cases in two files; the suite went from 62 to 93 passing.

`src/lib/identity.test.ts` (14) covers mobile normalisation and rejection,
identifier classification, the display-name fallback chain including the all-null
case, and that `describeIdentifier` masks a mobile number so audit rows do not
become a list of phone numbers.

`src/lib/plans.test.ts` (17) covers plan mapping, Basic/Business separation, and
`mergeFeatures`: an empty override list returns the code default, a `false` row
removes a feature, a `true` row grants an unlisted one, an unknown feature name is
ignored, `PLAN_MATRIX` is never mutated, and a repeated feature lets the last row
win.

### Not finished

Nothing in WP2. The seeded `admin@fintarg.lk` account carries `role = "admin"`; an
existing account can be promoted with the admin role action.

## Phase 3 — closing the "not built" list

Five items the README listed as unbuilt, plus four defects found while building them.
Suite went from 93 to 152 tests.

### Defects fixed

1. **The reminder lead time did nothing.** Settings let you choose 0–30 days and
   confirmed it back to you, but the cron called `dueReminders({ now })` and the
   function fell back to a hardcoded 3. The setting was a promise the app never kept.
   `dueReminders` now queries the widest window anyone could ask for and then filters
   each row against *that account's* `profile.reminderLeadDays`, so the lead time is
   genuinely per-user rather than global.
2. **Mobile-only accounts never heard about a money date.** `sendSms` existed and
   worked, but the only caller was password reset; the cron dropped every reminder
   with no email into `skippedNoChannel`. The cron now picks email or SMS per account
   and records which channel was used on the row.
3. **Cron routes opened themselves when `CRON_SECRET` was unset.** `/api/cron/maintenance`
   hard-deletes accounts, so a deployment that forgot one variable would let anyone who
   guessed the path purge user data. `isAuthorised` now fails closed; opening the routes
   needs an explicit `CRON_ALLOW_OPEN=true`.
4. **The reminder email linked to `https://fintarg.app/` unconditionally**, ignoring
   `APP_ORIGIN`, so a staging or local run emailed production URLs.
5. **`admin@fintarg.lk` was never seeded.** The WP2 notes claimed it was; it was not.
   Without it `requireAdmin` could never succeed and the entire admin section was
   unreachable. The seed now creates it and sets `role` on every run, so an existing
   database gains the admin once the seed is re-run.

### D6 display line (owed from WP1)

WP1 computed `leftAfterGoalsCents` and tested it, but no screen ever rendered it. It
now appears on the goals screen, on the analysis screen and in the analysis PDF, via
one pure helper (`describeGoalAffordability`) so all three say the same words about the
same numbers.

Placed once above the goal list rather than on each card: D6 is a whole-month figure, so
repeating it on every card would be wrong. The goals PDF labels it "not part of the total
above" for the same reason.

### Reminders centre

New `/reminders` screen. The list is computed live from the user's own records rather
than read from the `Reminder` table, so it is correct the moment a loan or goal is added
instead of only after the nightly job. The gathering logic lived inline on the dashboard;
it is now `loadUpcomingItems`, shared by both, so the two cannot disagree.

Only medical reminders have a persisted row, so only those can be ticked off. A derived
date from a finance payment is not honestly "done" from a list, and the screen says so
rather than offering a button that would do nothing.

### Money trend chart

Hand-written SVG, no charting dependency. Money in against money out over six months,
with signed bars from a break-even line so a shortfall is visibly *below* zero. The
scale always includes zero and extends below it.

Accessibility is handled three ways, because a bare `<svg>` is useless to some screen
readers: `role="img"` with a sentence-long label built from the data, a real `sr-only`
`<table>` of the same figures, and a legend that names both series in words. The existing
`BarList` and `DailySpendStrip` were left alone — they are excellent for their job, and
replacing accessible bars with a chart would be a downgrade.

Verified against the seeded data: the single plotted month reads 53,000 in / 58,000 out /
5,000 short, matching the documented worked example.

### Sinhala and Tamil

There was no i18n at all. Added: locale config, three typed catalogues, a cookie-based
locale, `POST /api/locale`, a `LanguageSwitcher` on the settings screen, a real
`<html lang>`, and translations for the navigation, login and registration screens.

Deliberately **no locale prefix in the URL**. The app has ~45 screens that link to each
other; prefixing means a redirect matrix, a rewrite rule and a second copy of every
`href`. The locale rides in a cookie instead, so every existing link, bookmark and email
keeps working and switching language never changes the page you are on.

`en` is the source of truth and every other catalogue must match its type, so a missing
Sinhala string is a compile error rather than an English word leaking onto a page
claiming to be Sinhala. 18 tests cover key-set equality, placeholder survival, and the
rule that no catalogue may still contain the English text.

Coverage is **partial and deliberate**: navigation, auth and shared money vocabulary are
translated; the long-form prose on the finance screens is not. Half-translating a finance
screen is worse than leaving it English, so the remaining copy needs a native reviewer
rather than more machine translation.

### Richer PDF exports

`src/lib/pdf/parts.ts` holds the shared layout primitives, extracted so every document
draws the same way. The analysis PDF now uses them too.

Two new documents:

- **Savings goals report** — progress and target per goal, with each one honestly marked
  "Not possible this month" where that is true.
- **Money statement** — every transaction recorded in a month, in date order.

The statement's totals are the **plain sums of the listed rows**, not the BR-1 analysis
totals, so the document always adds up when a reader checks it. Verified against the seed:
the recorded lines net +20,000 while the analysis reports −5,000, because the difference
is the Rs. 25,000 of finance payments due — real obligations with no `Expense` row. Both
figures are printed, and the difference is explained on the page rather than one silently
substituted for the other. Silently using the analysis number would have produced a
document that did not add up.

### Subscription billing

The upgrade path previously either granted Business for free or refused with "Payments are
not set up yet". Now: a `Subscription` model, a provider-agnostic `BillingProvider`
interface, `startCheckout`, and `POST /api/billing/webhook`.

**The plan is moved by the webhook, never by the browser.** A user can walk away from
checkout, replay a success URL or edit a query string; none of that may grant a paid plan.
Three defences: the signature is verified with a constant-time compare and an unset
secret *rejects*; the session id must match a `Subscription` row this app created; and
the plan is read from that stored row, never from the request body.

Verified end to end against the real database and a live server:

| Call | Result | Edition after |
| --- | --- | --- |
| Unsigned webhook | 401 | basic |
| Wrong secret | 401 | basic |
| Valid signature, tampered body | 401 | basic |
| Validly signed | 200, 1 audit row | business |
| Replay of the same webhook | 200, `alreadyApplied`, still 1 audit row | business |
| Refund | 200 | basic |
| Validly signed, unknown session | 200, ignored | basic |

`billingProvider()` throws for a named-but-unimplemented provider rather than falling back
to `log`, so configuring Stripe cannot silently behave like "no gateway" and hand out a
paid plan.

### Deviations and judgement calls

- The D6 line is one card above the goal list, not one per goal card, because it is a
  whole-month number. The WP1 note said "the goal card"; that is where the information
  lives, but not at card granularity.
- Loans got a `ReminderChip`; goals did not, because `GoalProgressCard` already renders
  the end date with a countdown and a chip would duplicate it.
- Cron now takes `MAX_LEAD_DAYS` (30) as its query window and filters per user in JS.
  A single SQL window cannot express "a different lead time per account".
- `src/lib/i18n/server.ts` exists only to keep `next/headers` out of the client bundle;
  importing `getLocale` from `@/lib/i18n` breaks the production build.
- Billing prices are a hard-coded constant, not a database table, so no user or admin
  write can influence the amount charged.

### Tests

59 new cases in four files; suite went from 93 to 152.

- `src/lib/goal-affordability.test.ts` (7) — the D6 wording, including that a shortfall is
  named in rupees rather than hidden behind a percentage, and that a fully funded goal set
  never claims a surplus.
- `src/lib/charts/geometry.test.ts` (16) — the scale always includes zero, extends below
  it, rounds the top gridline to a round figure, survives empty data, and never places a
  point outside the plot area.
- `src/lib/i18n/i18n.test.ts` (18) — catalogue completeness, no untranslated strings,
  placeholder survival, `Accept-Language` matching, and that an unset locale cookie
  defaults to English.
- `src/lib/billing/provider.test.ts` (18) — prices are integer cents, an unimplemented
  provider throws, and the five signature cases including the one that matters: an unset
  `BILLING_WEBHOOK_SECRET` must reject.
