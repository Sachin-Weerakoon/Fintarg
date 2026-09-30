import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

/**
 * Development helper: mints a session cookie for an existing account so the app
 * can be inspected without going through the sign-in form.
 *
 *   npx tsx scripts/dev-session.ts basic@fintarg.lk
 */

async function main() {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] ?? "basic@fintarg.lk";
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const token = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    console.log(token);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});