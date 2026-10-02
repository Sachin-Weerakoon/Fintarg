"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { type UserModeValue, type WorkspaceKind, workspaceFromCookie, workspaceToCookie, WORKSPACE_COOKIE } from "@/lib/mode";
import { prisma } from "@/lib/db";

export interface SetWorkspaceResult {
  ok: boolean;
  workspace: WorkspaceKind;
}

export async function getWorkspace(): Promise<WorkspaceKind> {
  const user = await requireUser();
  const store = await cookies();
  const cookie = store.get(WORKSPACE_COOKIE)?.value;

  const businessIds = await prisma.business.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });

  return workspaceFromCookie(cookie, user.mode, businessIds.map((b) => b.id));
}

export async function setWorkspaceAction(
  _state: unknown,
  formData: FormData
): Promise<SetWorkspaceResult> {
  const { assertCsrf } = await import("@/lib/auth/csrf");
  await assertCsrf(formData);

  const user = await requireUser();

  const raw = String(formData.get("workspace") ?? "");
  if (!raw) return { ok: false, workspace: { kind: "personal" } };

  const businessIds = await prisma.business.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });

  const ids = businessIds.map((b) => b.id);

  let ws: WorkspaceKind;
  if (raw === "personal") {
    if (!["salary", "both"].includes(user.mode)) {
      return { ok: false, workspace: { kind: "personal" } };
    }
    ws = { kind: "personal" };
  } else if (raw === "combined") {
    if (user.mode !== "both") {
      return { ok: false, workspace: { kind: "combined" } };
    }
    ws = { kind: "combined" };
  } else if (raw === "allBusinesses") {
    if (!["business", "both"].includes(user.mode)) {
      return { ok: false, workspace: { kind: "allBusinesses" } };
    }
    ws = { kind: "allBusinesses" };
  } else if (raw.startsWith("b:")) {
    if (!["business", "both"].includes(user.mode)) {
      return { ok: false, workspace: { kind: "allBusinesses" } };
    }
    const businessId = raw.slice(2);
    if (!ids.includes(businessId)) {
      return { ok: false, workspace: { kind: "allBusinesses" } };
    }
    ws = { kind: "business", businessId };
  } else {
    ws = workspaceFromCookie("", user.mode, ids);
  }

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceToCookie(ws), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true, workspace: ws };
}