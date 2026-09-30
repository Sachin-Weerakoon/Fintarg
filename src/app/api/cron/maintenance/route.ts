import { NextResponse } from "next/server";
import { isAuthorised } from "@/lib/cron-auth";
import { pruneExpiredSessions } from "@/lib/auth/session";
import { purgeExpiredRequests } from "@/lib/deletion";
import { removeOrphanedFiles } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Daily housekeeping (NFR: automated backups/maintenance, 30-day deletion).
 *
 * Prunes expired sessions, enforces any account deletion request whose 30-day
 * window has closed, and clears vault blobs with no owning row.
 */
export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const sessionsRemoved = await pruneExpiredSessions();
  const purge = await purgeExpiredRequests();
  const orphansRemoved = await removeOrphanedFiles();

  return NextResponse.json({
    ok: purge.errors.length === 0,
    sessionsRemoved,
    accountsPurged: purge.purged,
    filesRemoved: purge.filesRemoved,
    orphansRemoved: orphansRemoved.length,
    errors: purge.errors,
    at: new Date().toISOString(),
  });
}
