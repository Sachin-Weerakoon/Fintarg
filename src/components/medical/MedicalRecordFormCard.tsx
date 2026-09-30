import { ClipboardPlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { createMedicalRecordAction } from "@/app/(app)/medical/actions";

/**
 * The one place a medical record is created. A single form covers the three
 * kinds so a first-time user never has to learn three different screens.
 */

const KIND_OPTIONS = [
  { value: "expense", label: "Medical expense" },
  { value: "appointment", label: "Appointment" },
  { value: "medication", label: "Medication" },
];

const FIELDS: FieldSpec[] = [
  {
    name: "kind",
    label: "What are you recording?",
    type: "select",
    options: KIND_OPTIONS,
    defaultValue: "expense",
    hint: "An expense you paid for, an appointment you have, or a medicine you take",
  },
  {
    name: "date",
    label: "Date",
    type: "date",
    required: true,
    hint: "The day it happened",
  },
  {
    name: "title",
    label: "Title",
    type: "text",
    required: true,
    placeholder: "Clinic consultation",
    hint: "e.g. Clinic consultation, or Blood pressure tablets",
  },
  {
    name: "provider",
    label: "Doctor, clinic or pharmacy",
    type: "text",
    placeholder: "e.g. Apothecary, Negombo",
  },
  {
    name: "amount",
    label: "Amount",
    type: "amount",
    hint: "Only needed for expenses and medicines",
  },
  {
    name: "nextDoseAt",
    label: "Next dose or next appointment",
    type: "date",
    span: 2,
    hint: "We will remind you on this day",
  },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    span: 2,
    placeholder: "Anything you want to remember later",
  },
];

export function MedicalRecordFormCard({ csrfToken, today }: { csrfToken: string; today: string }) {
  const fields: FieldSpec[] = FIELDS.map((field) =>
    field.name === "date" ? { ...field, defaultValue: today } : field,
  );

  return (
    <Card>
      <CardHeader
        title="Add a record"
        subtitle="One place for what you paid, what you were told and what you need to take."
      />
      <RecordForm
        action={createMedicalRecordAction}
        fields={fields}
        csrfToken={csrfToken}
        idPrefix="medical"
        submitLabel="Save record"
        pendingLabel="Saving..."
        footer={
          <p className="text-caption text-text-muted">
            <ClipboardPlus aria-hidden className="mr-1 inline h-4 w-4" />
            If you enter an amount for an expense or a medicine, it is added to your monthly
            analysis as a Medical expense. Appointments are reminders only.
          </p>
        }
      />
    </Card>
  );
}
