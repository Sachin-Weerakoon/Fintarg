import { AlertTriangle, PiggyBank, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { describeGoalAffordability } from "@/lib/goal-affordability";
import type { Cents } from "@/lib/money";

/**
 * D6 display line: what is left after funding every savings goal this month.
 *
 * Deliberately its own card and deliberately *not* folded into the net position
 * figure. An unfundable goal is flagged, not budgeted (BR-5), so this must never
 * look like it is part of the money already spent.
 */
export function GoalAffordabilityLine({
  incomeCents,
  goalsRequiredCents,
  goalCount,
  heading = "If you saved for every goal",
}: {
  incomeCents: Cents;
  goalsRequiredCents: Cents;
  goalCount: number;
  heading?: string;
}) {
  const result = describeGoalAffordability({ incomeCents, goalsRequiredCents, goalCount });

  if (goalCount === 0 || goalsRequiredCents === 0) return null;

  const toneClasses = {
    positive: "border-positive/40 bg-positive-soft/40",
    warning: "border-warning/40 bg-warning-soft/40",
    danger: "border-danger/40 bg-danger-soft/40",
  } as const;

  const Icon = result.tone === "positive" ? PiggyBank : result.tone === "warning" ? Info : AlertTriangle;
  const IconTone = {
    positive: "text-positive",
    warning: "text-warning",
    danger: "text-danger",
  } as const;

  return (
    <Card className={`border ${toneClasses[result.tone]}`}>
      <CardHeader title={heading} />
      <div className="flex items-start gap-2">
        <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${IconTone[result.tone]}`} />
        <div>
          {/* The number is in the words, so the meaning survives without colour. */}
          <p className="text-small font-medium text-text">{result.headline}</p>
          <p className="mt-1 text-caption text-text-muted">{result.detail}</p>
        </div>
      </div>
    </Card>
  );
}