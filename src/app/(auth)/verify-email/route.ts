import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertCsrf } from "@/lib/auth/csrf";
import { consumeVerification } from "@/lib/auth/reset";

export const dynamic = "force-dynamic";

/** Confirms an email address from the one-time link, then returns to the app. */
export async function POST(request: Request) {
  const formData = await request.formData();
  await assertCsrf(formData);

  const token = String(formData.get("token") ?? "");
  if (token) await consumeVerification(token);

  revalidatePath("/", "layout");
  redirect("/");
}
