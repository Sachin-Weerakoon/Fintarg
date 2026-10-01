import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorised } from "@/lib/cron-auth";
import { dueReminders, reminderEmail, reminderSms, syncReminders } from "@/lib/reminders/schedule";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/auth/sms";

export const dynamic = "force-dynamic";

/**
 * Scheduled reminders (NFR: "Reminders: email by default").
 *
 * Run daily. Materialises reminder rows for every account, sends the ones that
 * are inside that account's own lead window, and marks them sent so a rerun is
 * harmless. Email is the channel; an account registered with a mobile only
 * (FR-1.1) falls back to SMS rather than silently hearing nothing.
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

  // No `leadDays` here on purpose: each account's own preference is applied.
  const due = await dueReminders({ now });
  let sentEmail = 0;
  let sentSms = 0;
  const failed: string[] = [];
  const skippedNoChannel: string[] = [];

  for (const reminder of due) {
    const channel = reminder.email ? "email" : reminder.mobile ? "sms" : null;
    if (!channel) {
      skippedNoChannel.push(reminder.id);
      continue;
    }
    try {
      if (channel === "email") {
        const { subject, text } = reminderEmail(reminder);
        await sendEmail({ to: reminder.email!, subject, text });
      } else {
        await sendSms({ to: reminder.mobile!, body: reminderSms(reminder) });
      }
      // `sentAt: null` in the where clause means two concurrent cron runs cannot
      // both deliver the same reminder.
      await prisma.reminder.updateMany({
        where: { id: reminder.id, sentAt: null },
        data: { sentAt: new Date(), channel },
      });
      if (channel === "email") sentEmail += 1;
      else sentSms += 1;
    } catch (error) {
      failed.push(`${reminder.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: users.length,
    scheduled,
    due: due.length,
    sent: sentEmail + sentSms,
    sentEmail,
    sentSms,
    skippedNoChannel,
    failed,
    at: now.toISOString(),
  });
}
