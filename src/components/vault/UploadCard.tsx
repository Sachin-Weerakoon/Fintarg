import { FileUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { uploadDocumentAction } from "@/app/(app)/vault/actions";

/** Upload card (FR-9). One form covers every category so nothing is misfiled. */

const FIELDS: FieldSpec[] = [
  {
    name: "category",
    label: "Where does this file belong?",
    type: "select",
    defaultValue: "profile",
    options: [
      { value: "profile", label: "Profile picture" },
      { value: "cv", label: "CV and related" },
      { value: "nic", label: "NIC - front and back" },
      { value: "bank", label: "Bank documents" },
      { value: "medical", label: "Medical" },
      { value: "other", label: "Other" },
    ],
  },
  {
    name: "sensitivity",
    label: "How private is it?",
    type: "select",
    defaultValue: "standard",
    options: [
      { value: "standard", label: "Standard" },
      { value: "sensitive", label: "Sensitive" },
      { value: "restricted", label: "Restricted" },
    ],
    hint: "Restricted is for identity and medical files",
  },
  {
    name: "label",
    label: "Label",
    type: "text",
    required: true,
    span: 2,
    placeholder: "e.g. NIC front side",
    hint: "A name you will recognise later",
  },
  {
    name: "note",
    label: "Note",
    type: "text",
    span: 2,
    placeholder: "Anything worth remembering about this file",
  },
  {
    name: "file",
    label: "File",
    type: "file",
    required: true,
    span: 2,
    accept: ".pdf,.jpg,.jpeg,.png,.docx",
    hint: "PDF, JPG, PNG or DOCX. Up to 10 MB.",
  },
];

export function UploadCard({ csrfToken }: { csrfToken: string }) {
  return (
    <Card>
      <CardHeader
        title="Add a file"
        subtitle="Your file is encrypted before it is saved. We never see it in the clear."
      />
      <RecordForm
        action={uploadDocumentAction}
        fields={FIELDS}
        encType="multipart/form-data"
        csrfToken={csrfToken}
        idPrefix="vault-upload"
        submitLabel="Encrypt and upload"
        pendingLabel="Encrypting..."
        footer={
          <p className="text-caption text-text-muted">
            <FileUp aria-hidden className="mr-1 inline h-4 w-4" />
            Files stay encrypted on our servers. Downloads are given back to you as a normal
            download, not as a link anyone else can use.
          </p>
        }
      />
    </Card>
  );
}
