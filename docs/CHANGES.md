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