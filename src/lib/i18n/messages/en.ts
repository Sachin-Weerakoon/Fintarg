/**
 * Typed message catalogue.
 *
 * `en` is the source of truth: every other dictionary must match its shape, so a
 * missing Sinhala or Tamil string is a **type error** rather than an English word
 * leaking onto a page that claims to be in another language. That matters more than
 * usual here, because a half-translated finance screen is worse than an English one.
 *
 * Placeholders use `{name}` and are substituted by `t()`.
 */
export const en = {
  "nav.home": "Home",
  "nav.home.description": "Your month at a glance",
  "nav.financial": "Financial",
  "nav.financial.description": "Income, expenses, bills, loans and pawned items",
  "nav.analysis": "Analysis",
  "nav.analysis.description": "Monthly analysis and next month",
  "nav.goals": "Goals",
  "nav.goals.description": "Savings goals and progress",
  "nav.letters": "Letters",
  "nav.letters.description": "Generate and store letters",
  "nav.medical": "Medical",
  "nav.medical.description": "Medical expenses, records and reminders",
  "nav.advanced": "Advanced",
  "nav.advanced.description": "Company profiles and agreements",
  "nav.vault": "Documents",
  "nav.vault.description": "Your private document vault",
  "nav.settings": "Settings",
  "nav.settings.description": "Profile, theme, contacts and plan",
  "nav.reminders": "Reminders",
  "nav.reminders.description": "Every money date coming up",
  "nav.admin": "Admin",
  "nav.admin.description": "Accounts and feature flags",

  "common.save": "Save",
  "common.saving": "Saving",
  "common.saved": "Saved",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.add": "Add",
  "common.back": "Back",
  "common.next": "Next",
  "common.yes": "Yes",
  "common.no": "No",
  "common.loading": "Loading",
  "common.retry": "Try again",
  "common.none": "None",
  "common.optional": "Optional",
  "common.required": "Required",
  "common.signIn": "Sign in",
  "common.signOut": "Sign out",
  "common.signUp": "Create an account",
  "common.download": "Download",
  "common.month": "Month",
  "common.amount": "Amount",
  "common.date": "Date",
  "common.notes": "Notes",
  "common.category": "Category",
  "common.total": "Total",
  "common.noneYet": "Nothing here yet",

  "money.income": "Money in",
  "money.out": "Money out",
  "money.remaining": "Remaining",
  "money.shortfall": "Shortfall",
  "money.surplus": "Left over",
  "money.net": "Net position",
  "money.spent": "Spent",
  "money.saved": "Saved",
  "money.target": "Target",
  "money.perDay": "a day",
  "money.perMonth": "this month",
  "money.leftOver": "left",
  "money.of": "of",

  "status.onTrack": "On track",
  "status.notPossible": "Not possible this month",
  "status.reached": "Goal reached",
  "status.overdue": "Overdue",
  "status.dueToday": "Due today",
  "status.tomorrow": "Due tomorrow",
  "status.inDays": "in {days} days",

  "settings.language": "Language",
  "settings.languageHint": "Changes the language of the menus and labels. Your records stay in the language you typed them in.",

  "auth.welcomeBack": "Welcome back",
  "auth.welcomeBackSubtitle": "Sign in to see where your money stands this month.",
  "auth.identifierLabel": "Email or mobile number",
  "auth.identifierPlaceholder": "you@example.com or 0771234567",
  "auth.passwordLabel": "Password",
  "auth.nameLabel": "Your name",
  "auth.forgotPassword": "Forgotten your password?",
  "auth.signingIn": "Signing you in...",
  "auth.signIn": "Sign in",
  "auth.newHere": "New to Fintarg?",
  "auth.haveAccount": "Already have an account?",
  "auth.creatingAccount": "Creating your account...",
  "auth.createAccount": "Create account",
  "auth.choosePlan": "Which plan suits you?",
  "auth.choosePlanHint": "You can change this later in Settings.",
  "auth.consentLabel": "I agree to the privacy notice",
  "auth.passwordHint": "At least 8 characters, with one letter and one number.",
  "auth.planBasicDetail": "Everything you need to see whether you can make it this month.",
  "auth.planBusinessDetail": "Everything in Basic, plus companies and agreements.",
  "auth.consentHint":
    "Fintarg stores your records on this device and encrypts your documents. See the Personal Data Protection Act No. 9 of 2022.",
  "auth.smsUsedFor": "A mobile number is used for SMS sign-in.",
  "auth.emailUsedFor": "An email address is used for sign-in and reminders.",
} as const;

/** The catalogue shape every locale must satisfy. */
export type Messages = { [K in keyof typeof en]: string };

export default en;