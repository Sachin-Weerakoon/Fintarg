/**
 * Letter templates as data (FR-10).
 *
 * Each template is a plain-English skeleton with the same rhythm: date, sender
 * block, recipient, a subject line, the body, and a sign-off. `render` turns the
 * values the user typed into finished text, so a Basic user can write a bank
 * letter for themselves and a Business user can put the same letter on company
 * letterhead. No lorem ipsum, no "XYZ" placeholders - every sentence is real
 * English that the user can edit as it stands.
 */

export interface LetterTemplate {
  key: "bank" | "offer" | "personal" | "company";
  label: string;
  description: string;
  businessOnly?: boolean;
  fields: {
    name: string;
    label: string;
    hint?: string;
    required?: boolean;
    multiline?: boolean;
    defaultValue?: string;
  }[];
  /** Builds the plain-text letter body from the user's variables. */
  render: (
    vars: Record<string, string>,
    context: {
      signerName: string;
      signerEmail: string;
      companyName?: string;
      companyAddress?: string;
      today: string;
    },
  ) => string;
}

function read(vars: Record<string, string>, name: string, fallback: string): string {
  const value = vars[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function paragraphs(blocks: string[]): string {
  return blocks.filter((block) => block.trim().length > 0).join("\n\n");
}

const SIGNER_CONTACT = (context: { signerEmail: string }) => `Email: ${context.signerEmail}`;

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    key: "bank",
    label: "Bank letter",
    description: "Ask a bank to confirm your account details and send a statement.",
    fields: [
      {
        name: "recipientName",
        label: "Recipient",
        hint: "For example: The Branch Manager",
        required: true,
        defaultValue: "The Branch Manager",
      },
      {
        name: "recipientAddress",
        label: "Bank address",
        hint: "Branch name, street and town, on separate lines",
        multiline: true,
      },
      {
        name: "bankName",
        label: "Name of the bank",
        defaultValue: "your bank",
      },
      {
        name: "accountType",
        label: "Type of account",
        defaultValue: "savings",
      },
      {
        name: "accountNumber",
        label: "Account number",
        hint: "Type the number exactly as your bank shows it",
        defaultValue: "the account number I have with you",
      },
      {
        name: "statementPeriod",
        label: "Statement period",
        defaultValue: "the last three months",
      },
      {
        name: "signOff",
        label: "Sign-off",
        defaultValue: "Yours faithfully",
      },
    ],
    render: (vars, context) => {
      const companyBlock = context.companyName
        ? paragraphs([context.companyName, context.companyAddress ?? ""])
        : paragraphs([context.signerName, context.signerEmail]);

      return paragraphs([
        context.today,
        companyBlock,
        read(vars, "recipientName", "The Branch Manager"),
        read(vars, "recipientAddress", ""),
        "Subject: Letter of account details / balance confirmation",
        `Dear ${read(vars, "recipientName", "Sir or Madam")},`,
        `I am writing to ask you to confirm the details of my ${read(vars, "accountType", "savings")} account held with ${read(vars, "bankName", "your bank")}. Please confirm the name on the account, the account number, the account type and the balance as at the date of this letter, and send me a stamped account statement covering ${read(vars, "statementPeriod", "the last three months")}.`,
        paragraphs([
          "My details are:",
          `Account holder: ${context.signerName}`,
          `Account number: ${read(vars, "accountNumber", "the account number I have with you")}`,
          `Account type: ${read(vars, "accountType", "savings")}`,
          `My reference: ${context.signerEmail}`,
          SIGNER_CONTACT(context),
        ]),
        "If any of these details are different from what your records show, please tell me within fourteen days of the date of this letter so that I can have them corrected. You can reply to this letter at the email address above or hand it in at any branch with my name and account number.",
        `${read(vars, "signOff", "Yours faithfully")},`,
        context.signerName,
      ]);
    },
  },
  {
    key: "offer",
    label: "Offer letter",
    description: "Confirm a job offer with the position, start date and salary.",
    fields: [
      {
        name: "recipientName",
        label: "Recipient",
        hint: "The name of the person being offered the job",
        required: true,
        defaultValue: "the successful candidate",
      },
      {
        name: "recipientAddress",
        label: "Recipient address",
        multiline: true,
      },
      {
        name: "positionTitle",
        label: "Position",
        defaultValue: "the position we discussed",
      },
      {
        name: "startDate",
        label: "Start date",
        defaultValue: "",
      },
      {
        name: "salary",
        label: "Salary",
        hint: "For example: Rs. 85,000 per month",
        defaultValue: "the salary we agreed",
      },
      {
        name: "supervisor",
        label: "Reports to",
        defaultValue: "your immediate supervisor",
      },
      {
        name: "duties",
        label: "Main duties",
        defaultValue: "the duties we agreed during the interview",
      },
      {
        name: "acceptBy",
        label: "Accept by",
        defaultValue: "the date given in this letter",
      },
      {
        name: "signOff",
        label: "Sign-off",
        defaultValue: "Yours sincerely",
      },
    ],
    render: (vars, context) => {
      const employer = context.companyName ?? "our organisation";
      const companyBlock = paragraphs([
        context.companyName ?? context.signerName,
        context.companyAddress ?? "",
        context.companyName ? `For and on behalf of ${context.companyName}` : context.signerEmail,
      ]);

      return paragraphs([
        context.today,
        companyBlock,
        read(vars, "recipientName", "the successful candidate"),
        read(vars, "recipientAddress", ""),
        `Subject: Offer of employment - ${read(vars, "positionTitle", "the position we discussed")}`,
        `Dear ${read(vars, "recipientName", "Sir or Madam")},`,
        `Thank you for the time you gave us and for the interview you attended. I am pleased to offer you the position of ${read(vars, "positionTitle", "the position we discussed")} with ${employer}, starting on ${read(vars, "startDate", "the date written below")}.`,
        `Your starting salary will be ${read(vars, "salary", "the salary we agreed")}. It will be paid on the last working day of each month, and you will be included in the staff benefits that apply to your role. You will report to ${read(vars, "supervisor", "your immediate supervisor")}, and your main duties will be ${read(vars, "duties", "the duties we agreed during the interview")}.`,
        `Please confirm in writing that you accept this offer by ${read(vars, "acceptBy", "the date written below")}. On your first day we will ask you for your personal details and the documents we need to open your payroll record.`,
        paragraphs([
          "This letter sets out the main terms of our offer. Anything else we agreed in writing during your interview remains unchanged. If you have any questions before you accept, please call or email me.",
          "We enjoyed meeting you and we look forward to welcoming you to the team.",
        ]),
        `${read(vars, "signOff", "Yours sincerely")},`,
        context.signerName,
        context.companyName ? `${context.signerName}, ${context.companyName}` : "",
        context.companyAddress ?? "",
      ]);
    },
  },
  {
    key: "personal",
    label: "Personal letter",
    description: "A general letter for anything that is not a bank or job letter.",
    fields: [
      {
        name: "recipientName",
        label: "Recipient",
        hint: "The person or office you are writing to",
        required: true,
        defaultValue: "Sir or Madam",
      },
      {
        name: "recipientAddress",
        label: "Recipient address",
        multiline: true,
      },
      {
        name: "subject",
        label: "Subject line",
        defaultValue: "Request for information",
      },
      {
        name: "opening",
        label: "Greeting",
        defaultValue: "Dear Sir or Madam",
      },
      {
        name: "message",
        label: "What you need to say",
        hint: "Two or three sentences is enough. Edit this box freely.",
        multiline: true,
        defaultValue:
          "I am writing to ask for your help with the matter set out in the subject line above. Please let me know what you need from me and the best way to reply.",
      },
      {
        name: "closing",
        label: "Closing line",
        defaultValue: "Thank you for your time and help.",
      },
      {
        name: "signOff",
        label: "Sign-off",
        defaultValue: "Yours sincerely",
      },
    ],
    render: (vars, context) => {
      const senderBlock = paragraphs([
        context.signerName,
        context.companyName ?? "",
        context.companyAddress ?? "",
        context.signerEmail,
      ]);

      return paragraphs([
        context.today,
        senderBlock,
        read(vars, "recipientName", "Sir or Madam"),
        read(vars, "recipientAddress", ""),
        `Subject: ${read(vars, "subject", "Request for information")}`,
        read(vars, "opening", "Dear Sir or Madam"),
        read(vars, "message", "I am writing to ask for your help with the matter set out above."),
        read(vars, "closing", "Thank you for your time and help."),
        `${read(vars, "signOff", "Yours sincerely")},`,
        context.signerName,
      ]);
    },
  },
  {
    key: "company",
    label: "Company letter",
    description: "A formal letter on your company letterhead.",
    businessOnly: true,
    fields: [
      {
        name: "recipientName",
        label: "Recipient",
        hint: "The person or organisation you are writing to",
        required: true,
        defaultValue: "Sir or Madam",
      },
      {
        name: "recipientAddress",
        label: "Recipient address",
        multiline: true,
      },
      {
        name: "subject",
        label: "Subject line",
        defaultValue: "Request for information",
      },
      {
        name: "opening",
        label: "Greeting",
        defaultValue: "Dear Sir or Madam",
      },
      {
        name: "message",
        label: "What you need to say",
        hint: "Two or three sentences is enough. Edit this box freely.",
        multiline: true,
        defaultValue:
          "We are writing on behalf of the company to raise the matter set out in the subject line above. Please confirm what you need from us and the best way for us to respond.",
      },
      {
        name: "closing",
        label: "Closing line",
        defaultValue: "Thank you for your attention to this matter.",
      },
      {
        name: "signOff",
        label: "Sign-off",
        defaultValue: "Yours faithfully",
      },
    ],
    render: (vars, context) => {
      const company = context.companyName ?? "the company";
      const header = paragraphs([
        company,
        context.companyAddress ?? "",
        "For and on behalf of the company",
      ]);

      return paragraphs([
        context.today,
        header,
        read(vars, "recipientName", "Sir or Madam"),
        read(vars, "recipientAddress", ""),
        `Subject: ${read(vars, "subject", "Request for information")}`,
        read(vars, "opening", "Dear Sir or Madam"),
        read(vars, "message", "We are writing on behalf of the company about the matter set out above."),
        read(vars, "closing", "Thank you for your attention to this matter."),
        `${read(vars, "signOff", "Yours faithfully")},`,
        context.signerName,
        context.signerEmail,
        `For and on behalf of ${company}`,
      ]);
    },
  },
];

export const LETTER_TEMPLATE_KEYS = LETTER_TEMPLATES.map((template) => template.key);

export function letterTemplateByKey(key: string | null | undefined): LetterTemplate | undefined {
  return LETTER_TEMPLATES.find((template) => template.key === key);
}

/** Templates a user of this edition may pick. */
export function letterTemplatesFor(edition: string | null | undefined): LetterTemplate[] {
  const business = edition === "business";
  return LETTER_TEMPLATES.filter((template) => business || !template.businessOnly);
}
