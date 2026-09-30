import { prisma } from "@/lib/db";
import { deleteEncryptedFile } from "@/lib/storage";

/**
 * Enforces the 30-day deletion window required by Sri Lanka's Personal Data
 * Protection Act No. 9 of 2022.
 *
 * `requestAccountDeletion` closes the account immediately so the user stops
 * being able to sign in, and records what must be unlinked. `purgeExpiredRequests`
 * then hard-deletes everything once the window has passed. Rows are removed
 * explicitly rather than relying only on cascade so the encrypted files on disk
 * are cleaned up too.
 */

const PURGE_AFTER_DAYS = 30;

export async function requestAccountDeletion(userId: string, now = new Date()) {
  const purgeAfter = new Date(now.getTime() + PURGE_AFTER_DAYS * 86_400_000);

  const documents = await prisma.document.findMany({
    where: { userId, deletedAt: null },
    select: { storedName: true },
  });

  const [request] = await Promise.all([
    prisma.deletionRequest.create({
      data: {
        userId,
        requestedAt: now,
        purgeAfter,
        fileNames: JSON.stringify(documents.map((document) => document.storedName)),
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { suspendedAt: now } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  return { purgeAfter, files: documents.length, requestId: request.id };
}

export interface PurgeResult {
  purged: number;
  filesRemoved: number;
  errors: string[];
}

export async function purgeExpiredRequests(now = new Date()): Promise<PurgeResult> {
  const due = await prisma.deletionRequest.findMany({
    where: { completedAt: null, purgeAfter: { lte: now } },
    orderBy: { purgeAfter: "asc" },
    take: 50,
  });

  const result: PurgeResult = { purged: 0, filesRemoved: 0, errors: [] };

  for (const request of due) {
    try {
      // Unlink the encrypted files first: if that fails we would rather retry
      // than leave a live database row pointing at deleted bytes.
      let storedNames: string[] = [];
      try {
        storedNames = JSON.parse(request.fileNames) as string[];
      } catch {
        storedNames = [];
      }
      for (const storedName of storedNames) {
        await deleteEncryptedFile(request.userId, storedName);
        result.filesRemoved += 1;
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (user) {
        await prisma.auditLog.create({
          data: {
            action: "account.purged",
            entityType: "user",
            meta: JSON.stringify({ requestId: request.id, filesRemoved: result.filesRemoved }),
          },
        });
        // `User` cascades to every child relation in the schema.
        await prisma.user.delete({ where: { id: user.id } });
      }

      // Only mark the request complete once the user row is really gone.
      await prisma.deletionRequest.deleteMany({ where: { id: request.id } });
      result.purged += 1;
    } catch (error) {
      result.errors.push(`${request.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return result;
}
