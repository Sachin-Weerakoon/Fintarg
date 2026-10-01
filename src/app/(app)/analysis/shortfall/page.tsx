import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { loadAnalysis } from "@/lib/finance/load";
import { currentMonthKey, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { recordShortfallAsLoanAction } from "@/app/(app)/analysis/actions";

export const metadata: Metadata = { title: "Record a shortfall as a loan" };
export const dynamic = "force-dynamic";

export default async function ShortfallPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const month = params.month ?? currentMonthKey();
  const { analysis } = await loadAnalysis(user.id, month, { today: new Date() });
  const csrfToken = await ensureCsrfToken();

  const shortfallCents = Math.abs(Math.min(0, analysis.netPositionCents));
  const prefill = params.amount ? `${(Number(params.amount) || 0).toFixed(2)}` : (shortfallCents / 100).toFixed(2);

  const fields: FieldSpec[] = [
    {
      name: "amount",
      label: "Amount you need to cover",
      type: "amount",
      required: true,
      defaultValue: prefill,
      span: 2,
      hint: "This is the shortfall from your monthly analysis.",
    },
    {
      name: "lender",
      label: "Who are you borrowing from",
      type: "text",
      required: true,
      placeholder: "Bank, moneylender, relative, society",
      span: 2,
    },
    {
      name: "interestRatePct",
      label: "Annual interest rate",
      type: "number",
      hint: "As a percentage, e.g. 18. Leave empty if there is no interest.",
      min: "0",
      max: "100",
    },
    {
      name: "method",
      label: "How interest is calculated",
      type: "select",
      defaultValue: "reducing",
      options: [
        { value: "reducing", label: "Reducing balance (normal bank method)" },
        { value: "flat", label: "Flat rate" },
        { value: "simple", label: "Simple interest" },
        { value: "compound", label: "Compound monthly" },
      ],
    },
    {
      name: "startDate",
      label: "Start date",
      type: "date",
      required: true,
      defaultValue: toDateInputValue(new Date()),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1 font-semibold text-text">Record this shortfall as a loan</h1>
        <p className="mt-1 text-small text-text-muted">
          Borrowing to cover a gap is a real loan. Recording it here means Fintarg will keep showing the interest
          every month, so the gap does not quietly grow.
        </p>
      </div>

      {shortfallCents > 0 ? (
        <AlertBanner
          level="danger"
          title={`You are ${formatMoney(shortfallCents)} short this month`}
          message="That is the difference between your income and everything you have already planned for this month."
        />
      ) : (
        <AlertBanner
          level="info"
          title="You are not short this month"
          message="You can still record a loan here if you borrowed money for another reason."
        />
      )}

      <Card>
        <CardHeader
          title="Loan details"
          subtitle="Nothing here leaves your account"
        />
        <RecordForm
          action={recordShortfallAsLoanAction}
          fields={fields}
          csrfToken={csrfToken}
          idPrefix="shortfall"
          submitLabel="Save as a loan"
          pendingLabel="Saving the loan..."
        />
      </Card>

      <Card tone="accent">
        <CardHeader title="What happens next" />
        <ul className="flex list-inside list-disc flex-col gap-1.5 text-small text-text-muted">
          <li>The loan appears under Financial › Loans with its remaining balance.</li>
          <li>Its interest is added to your monthly outflow from the month you start it.</li>
          <li>Your net position will then include it automatically.</li>
          <li>
            <Link href="/analysis" className="font-medium text-accent hover:underline">
              Back to the analysis
            </Link>{" "}
            to see the effect.
          </li>
        </ul>
      </Card>
    </div>
  );
}
