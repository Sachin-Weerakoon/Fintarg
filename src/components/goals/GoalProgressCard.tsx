import { CalendarClock, Plus } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import type { GoalFeasibility } from "@/lib/finance/analysis";
import { daysUntil, formatDate, relativeDayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/**
 * One goal on the goals list (FR-6). Progress is shown as money first and
 * percentage second, and the month check against free cash is stated in words,
 * never as colour alone.
 */
export function GoalProgressCard({
  goal,
  savedCents,
  feasibility,
  csrfToken,
  deleteAction,
}: {
  goal: {
    id: string;
    name: string;
    targetAmountCents: number;
    dailyAmountCents: number;
    monthlyTargetCents: number;
    endDate: Date | null;
    note: string | null;
  };
  savedCents: number;
  feasibility: GoalFeasibility | undefined;
  csrfToken: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const remaining = Math.max(0, goal.targetAmountCents - savedCents);
  const tone = remaining === 0 ? "positive" : "accent";
  const countdown = goal.endDate ? daysUntil(goal.endDate) : null;
  const overdue = countdown !== null && countdown < 0;

  return (
    <article className="card p-card">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-h2 font-medium text-text">{goal.name}</h2>
        {feasibility ? (
          <p className="tabular text-caption text-text-muted">
            <span className="sr-only">Still to go: </span>
            {remaining === 0 ? "Goal reached" : `${formatMoney(remaining)} still to go`}
          </p>
        ) : null}
      </div>

      {goal.note ? <p className="mt-1 text-small text-text-muted">{goal.note}</p> : null}

      <div className="mt-3">
        <ProgressBar
          savedCents={savedCents}
          targetCents={goal.targetAmountCents}
          label={`${goal.name}: ${formatMoney(savedCents)} saved of ${formatMoney(goal.targetAmountCents)}`}
          tone={tone}
        />
      </div>

      <p className="tabular mt-2 text-small text-text-muted">
        {formatMoney(goal.dailyAmountCents)} a day &middot; {formatMoney(goal.monthlyTargetCents)} this month
      </p>

      {goal.endDate ? (
        <p className="mt-1 flex items-center gap-1.5 text-caption text-text-muted">
          <CalendarClock aria-hidden className="h-4 w-4 shrink-0" />
          <span>
            <span className="tabular">{formatDate(goal.endDate)}</span>
            {countdown !== null ? (
              <>
                {" "}
                &middot;{" "}
                {overdue ? (
                  <span className="font-medium text-warning">
                    {Math.abs(countdown)} days past the end date
                  </span>
                ) : (
                  relativeDayLabel(goal.endDate)
                )}
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      {feasibility && feasibility.reason === "already_saved" ? (
        <AlertBanner
          level="success"
          title="Goal reached"
          message={feasibility.message}
          className="mt-3"
        />
      ) : null}

      {feasibility && !feasibility.achievable && feasibility.reason !== "already_saved" ? (
        <AlertBanner
          level="warning"
          title="Not possible this month"
          message={feasibility.message}
          className="mt-3"
        />
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ButtonLink href={`/goals/${goal.id}`} size="sm" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Add savings
        </ButtonLink>
        <ConfirmDelete
          action={deleteAction}
          hiddenFields={{ id: goal.id, _csrf: csrfToken }}
          label="Delete goal"
          title={`Delete "${goal.name}"?`}
          description="The goal and its savings history are removed from your account."
        />
      </div>
    </article>
  );
}
