import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, FolderLock, HeartPulse, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/dates";
import { can, canUpgrade, planLabel, PLANS } from "@/lib/plans";
import { ACCENT_PRESETS } from "@/lib/theme";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { AppearanceForm } from "@/components/forms/AppearanceForm";
import {
  addContactAction,
  changePasswordAction,
  deleteContactAction,
  requestAccountDeletionAction,
  updateProfileAction,
  updateReminderPreferencesAction,
  upgradeToBusinessAction,
} from "@/app/(app)/settings/actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, contacts] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.contact.findMany({ where: { userId: user.id }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
  ]);

  const csrfToken = await ensureCsrfToken();
  const label = planLabel(user.edition);

  const profileFields: FieldSpec[] = [
    { name: "fullName", label: "Full name", type: "text", required: true, defaultValue: profile?.fullName ?? "" },
    { name: "email", label: "Email", type: "text", required: true, defaultValue: user.email ?? "" },
    { name: "mobile", label: "Mobile number", type: "text", defaultValue: profile?.mobile ?? "", hint: "e.g. 0771234567" },
    { name: "dateOfBirth", label: "Date of birth", type: "date", defaultValue: profile?.dateOfBirth ? toDateInputValue(profile.dateOfBirth) : "" },
    { name: "nicNumber", label: "NIC number", type: "text", defaultValue: profile?.nicNumber ?? "", hint: "Stored privately. Never shown to anyone." },
    { name: "portfolioUrl", label: "Portfolio or work link", type: "text", defaultValue: profile?.portfolioUrl ?? "", hint: "Start with https://" },
    { name: "address", label: "Address", type: "textarea", defaultValue: profile?.address ?? "", rows: 3, span: 2 },
  ];

  const contactFields: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "relationship", label: "Relationship", type: "text", hint: "e.g. Wife, Brother, Friend" },
    { name: "phone", label: "Phone number", type: "text", required: true },
    {
      name: "kind",
      label: "Which group",
      type: "select",
      defaultValue: "personal",
      options: [
        { value: "personal", label: "Personal contact" },
        { value: "family", label: "Family contact" },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description="Your profile, your look, your plan. Everything here is private to you." />

      <Card>
        <CardHeader title="Your profile" subtitle="Used on letters you generate" />
        <RecordForm
          action={updateProfileAction}
          fields={profileFields}
          csrfToken={csrfToken}
          idPrefix="profile"
          submitLabel="Save profile"
        />
      </Card>

      <Card>
        <CardHeader
          title="Contacts"
          subtitle="2 to 3 personal numbers and your family contacts, for quick use on your letters"
        />
        {contacts.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-3 rounded-input border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-small font-medium text-text">
                    {contact.name}
                    {contact.relationship ? (
                      <span className="ml-2 text-caption font-normal text-text-muted">{contact.relationship}</span>
                    ) : null}
                  </p>
                  <p className="tabular text-small text-text-muted">{contact.phone}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={contact.kind === "family" ? "accent" : "neutral"}>
                    {contact.kind === "family" ? "Family" : "Personal"}
                  </Badge>
                  <ConfirmDelete
                    action={deleteContactAction}
                    hiddenFields={{ id: contact.id, _csrf: csrfToken }}
                    label="Remove"
                    title={`Remove ${contact.name}?`}
                    description="This contact will be taken off your list. You can add them again later."
                    confirmLabel="Yes, remove"
                    variant="secondary"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-small text-text-muted">
            No contacts yet. Add the two or three people you call most often.
          </p>
        )}
        <RecordForm
          action={addContactAction}
          fields={contactFields}
          csrfToken={csrfToken}
          idPrefix="contact"
          submitLabel="Add contact"
          pendingLabel="Adding..."
        />
      </Card>

      <Card>
        <CardHeader
          title="Appearance"
          subtitle="Your theme colour is checked for readability, then applied everywhere on all your devices"
        />
        <AppearanceForm
          csrfToken={csrfToken}
          initial={{
            themeAccent: profile?.themeAccent ?? ACCENT_PRESETS[0].hex,
            themeMode: profile?.themeMode ?? "system",
            fontScale: profile?.fontScale ?? "medium",
            density: profile?.density ?? "comfortable",
          }}
        />
      </Card>

      <Card>
        <CardHeader title="Password" subtitle="Use at least 8 characters with one letter and one number" />
        <RecordForm
          action={changePasswordAction}
          fields={[
            { name: "currentPassword", label: "Current password", type: "password", required: true, span: 2, autoComplete: "current-password" },
            { name: "newPassword", label: "New password", type: "password", required: true, span: 2, autoComplete: "new-password", hint: "At least 8 characters, with one letter and one number. This signs out your other devices." },
          ]}
          csrfToken={csrfToken}
          idPrefix="password"
          submitLabel="Change password"
        />
      </Card>

      <Card id="plan">
        <CardHeader title="Your plan" subtitle={`You are on the ${label} plan`} />
        <div className="flex flex-col gap-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {PLANS.filter((plan) => plan !== "free").map((plan) => {
              const isCurrent = plan === (user.edition === "business" ? "business" : "basic");
              return (
                <li
                  key={plan}
                  className={`rounded-card border p-3 ${isCurrent ? "border-accent bg-accent-soft" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body font-medium text-text">{planLabel(plan)}</p>
                    {isCurrent ? <Badge tone="accent">Your plan</Badge> : null}
                  </div>
                  <p className="mt-1 text-small text-text-muted">{plan === "business" ? planPitch.business : planPitch.basic}</p>
                  <ul className="mt-2 flex list-inside list-disc flex-col gap-1 text-caption text-text-muted">
                    {(plan === "business" ? featuresOf(user.edition, "business") : featuresOf(user.edition, "basic")).map(
                      (feature) => (
                        <li key={feature}>{feature}</li>
                      ),
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>

          {canUpgrade(user.edition) ? (
            <>
              <AlertBanner
                level="info"
                title="Need company letters and agreements?"
                message="The Business plan adds company profiles, company-branded letters and the Advanced section with agreements."
              />
              <div className="flex justify-end">
                <RecordForm
                  action={upgradeToBusinessAction}
                  fields={[]}
                  hidden={{ edition: "business" }}
                  csrfToken={csrfToken}
                  idPrefix="upgrade"
                  submitLabel="Upgrade to Business"
                  pendingLabel="Upgrading..."
                />
              </div>
            </>
          ) : (
            <AlertBanner
              level="info"
              title="You are on the Business plan"
              message="You have company profiles, company letters and the Advanced section."
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Reminders"
          subtitle="Fintarg emails you before a money date. You stay in control of this."
        />
        <RecordForm
          action={updateReminderPreferencesAction}
          fields={[
            {
              name: "remindersEnabled",
              label: "Email me before a money date",
              type: "checkbox",
              checked: profile?.remindersEnabled ?? true,
              hint: "Finance payments, pawn interest, loan dates, goal dates, agreements and medical reminders",
            },
            {
              name: "reminderLeadDays",
              label: "How many days ahead",
              type: "number",
              defaultValue: String(profile?.reminderLeadDays ?? 3),
              min: "0",
              max: "30",
              hint: "0 means the same day. 7 is a comfortable week ahead.",
            },
          ]}
          csrfToken={csrfToken}
          idPrefix="reminders"
          submitLabel="Save reminder settings"
        />
      </Card>

      <Card>
        <CardHeader title="Your data and privacy" subtitle="You are in control" />
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2 text-small text-text-muted">
            <li className="flex items-start gap-2">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              Only you can see your records. There is no sharing between accounts.
            </li>
            <li className="flex items-start gap-2">
              <FolderLock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              Your NIC, bank and medical files are stored encrypted.
            </li>
            <li className="flex items-start gap-2">
              <HeartPulse aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              Ask us to delete your account and every record is removed within 30 days, as required by Sri
              Lanka&apos;s Personal Data Protection Act No. 9 of 2022.
            </li>
          </ul>

          <div className="flex flex-col gap-2">
            <p className="text-small font-medium text-text">Your data</p>
            <p className="text-caption text-text-muted">
              Download one file with every record we hold for you - income, expenses, loans, goals, letters,
              medical and reminder history. Vault document contents are not included; only their details.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action="/settings/export" method="post">
                <input type="hidden" name="_csrf" value={csrfToken} />
                <Button type="submit" variant="secondary" size="sm" icon={<Download aria-hidden className="h-4 w-4" />}>
                  Download my data
                </Button>
              </form>
              <ButtonLink href="/vault" variant="secondary" size="sm" icon={<FolderLock aria-hidden className="h-4 w-4" />}>
                Open the document vault
              </ButtonLink>
              <ButtonLink href="/medical" variant="secondary" size="sm" icon={<HeartPulse aria-hidden className="h-4 w-4" />}>
                Medical records
              </ButtonLink>
            </div>
          </div>

          <div className="rounded-card border border-danger/40 bg-danger-soft/40 p-3">
            <p className="text-small font-medium text-danger">Close my account</p>
            <p className="mt-1 text-caption text-text-muted">
              This signs you out straight away and schedules every record for permanent deletion within 30 days.
            </p>
            <div className="mt-3">
              <RecordForm
                action={requestAccountDeletionAction}
                fields={[
                  {
                    name: "confirm",
                    label: "Type DELETE to confirm",
                    type: "text",
                    required: true,
                    span: 2,
                    placeholder: "DELETE",
                  },
                ]}
                csrfToken={csrfToken}
                idPrefix="delete-account"
                submitLabel="Request account deletion"
                pendingLabel="Requesting..."
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const planPitch: Record<string, string> = {
  basic: "Everything you need to see whether you can make it this month.",
  business: "Everything in Basic, plus company letters and agreements.",
};

function featuresOf(_edition: string, plan: "basic" | "business"): string[] {
  const shared = [
    "Income, expenses and fixed payments",
    "Monthly analysis with shortfall warnings",
    "Savings goals with feasibility checks",
    "Planned personal spending",
    "Document vault and letters",
    "Medical records and reminders",
  ];
  if (plan === "business") {
    return [...shared, "Company profiles", "Company-branded letters", "Advanced section with agreements"];
  }
  return shared;
}
