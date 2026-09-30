import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorised } from "@/lib/cron-auth";
import { dueReminders, reminderEmail, syncReminders } from "@/lib/reminders/schedule";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Scheduled reminders (NFR: email by default).
 *
 * Run daily. Materialises reminder rows for every account, emails the ones that
 * are within the lead window, and marks them sent so a rerun is harmless.
 */
export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { suspendedAt: null },
    select: { id: true, profile: { select: { remindersEnabled: true } } },
    take: 500,
  });

  let scheduled = 0;
  for (const user of users) {
    if (user.profile?.remindersEnabled === false) continue;
    const result = await syncReminders(user.id, { today: now });
    scheduled += result.scheduled;
  }

  const due = await dueReminders({ now });
  let sent = 0;
  const failed: string[] = [];

  for (const reminder of due) {
    try {
      const { subject, text } = reminderEmail(reminder);
      await sendEmail({ to: reminder.email, subject, text });
      await prisma.reminder.updateMany({
        where: { id: reminder.id, sentAt: null },
        data: { sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      failed.push(`${reminder.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: users.length,
    scheduled,
    due: due.length,
    sent,
    failed,
    at: now.toISOString(),
  });
}
