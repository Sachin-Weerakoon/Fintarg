export type UserModeValue = "salary" | "business" | "both";

export const USER_MODES: UserModeValue[] = ["salary", "business", "both"];

export function isMode(value: unknown): value is UserModeValue {
  return USER_MODES.includes(value as UserModeValue);
}

export const MODE_LABEL: Record<UserModeValue, string> = {
  salary: "Salary",
  business: "Business",
  both: "Both",
};

export const MODE_DESCRIPTION: Record<UserModeValue, string> = {
  salary: "Personal income, expenses, bills, loans and goals.",
  business: "Businesses, branches, sales, costs and targets.",
  both: "Personal and business finances with owner draws.",
};

export function hasPersonalLedger(mode: UserModeValue): boolean {
  return mode === "salary" || mode === "both";
}

export function hasBusinessLedger(mode: UserModeValue): boolean {
  return mode === "business" || mode === "both";
}

export function defaultPlanForMode(mode: UserModeValue): "basic" | "business" {
  return "basic";
}

export function defaultWorkspaceForMode(mode: UserModeValue): WorkspaceKind {
  switch (mode) {
    case "salary":
      return { kind: "personal" };
    case "business":
      return { kind: "allBusinesses" };
    case "both":
      return { kind: "combined" };
  }
}

export type WorkspaceKind =
  | { kind: "personal" }
  | { kind: "combined" }
  | { kind: "business"; businessId: string }
  | { kind: "allBusinesses" };

export const WORKSPACE_COOKIE = "fintarg_ws";

export function workspaceFromCookie(
  cookie: string | undefined,
  userMode: UserModeValue,
  userBusinessIds: string[]
): WorkspaceKind {
  if (!cookie) return defaultWorkspaceForMode(userMode);

  if (cookie === "personal") {
    if (hasPersonalLedger(userMode)) return { kind: "personal" };
    return defaultWorkspaceForMode(userMode);
  }
  if (cookie === "combined") {
    if (userMode === "both") return { kind: "combined" };
    return defaultWorkspaceForMode(userMode);
  }
  if (cookie === "allBusinesses") {
    if (hasBusinessLedger(userMode)) return { kind: "allBusinesses" };
    return defaultWorkspaceForMode(userMode);
  }
  if (cookie.startsWith("b:")) {
    const businessId = cookie.slice(2);
    if (hasBusinessLedger(userMode) && userBusinessIds.includes(businessId)) {
      return { kind: "business", businessId };
    }
    return defaultWorkspaceForMode(userMode);
  }
  return defaultWorkspaceForMode(userMode);
}

export function workspaceToCookie(ws: WorkspaceKind): string {
  switch (ws.kind) {
    case "personal":
      return "personal";
    case "combined":
      return "combined";
    case "business":
      return `b:${ws.businessId}`;
    case "allBusinesses":
      return "allBusinesses";
  }
}