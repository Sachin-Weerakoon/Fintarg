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
