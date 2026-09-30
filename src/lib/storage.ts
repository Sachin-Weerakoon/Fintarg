import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

/**
 * Encrypted-at-rest document vault (FR-9, NFR: "encrypted storage for
 * NIC/medical/bank files").
 *
 * Files are stored outside the web root and encrypted with AES-256-GCM using a
 * key derived from AUTH_SECRET. Each file gets its own random IV and auth tag,
 * and the stored name is a random opaque id - a user's real file name never
 * touches the filesystem.
 *
 * Production note: swap `storageRoot()` for an S3-compatible private bucket
 * (Cloudflare R2 / Supabase Storage) behind the same four functions, keeping
 * server-side encryption on.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file (FR-9)

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".docx"] as const;

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "./storage");
}

function vaultKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHash("sha256").update(`fintarg-vault-v1:${secret}`).digest();
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isAllowedExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function newStoredName(): string {
  return `${randomBytes(16).toString("hex")}.enc`;
}

/** Path for a user's file. The userId segment is validated to prevent traversal. */
export function resolveVaultPath(userId: string, storedName: string): string {
  if (!/^[a-z0-9_-]+$/i.test(userId)) throw new Error("INVALID_USER_ID");
  if (!/^[a-f0-9]{32}\.enc$/i.test(storedName)) throw new Error("INVALID_STORED_NAME");
  return path.join(storageRoot(), userId, storedName);
}

export async function writeEncryptedFile(
  userId: string,
  storedName: string,
  data: Buffer,
): Promise<void> {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, vaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  const target = resolveVaultPath(userId, storedName);
  await mkdir(path.dirname(target), { recursive: true });
  // [iv][tag][ciphertext]
  await writeFile(target, Buffer.concat([iv, tag, ciphertext]), { mode: 0o600 });
}

export async function readEncryptedFile(userId: string, storedName: string): Promise<Buffer> {
  const raw = await readFile(resolveVaultPath(userId, storedName));
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, vaultKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function deleteEncryptedFile(userId: string, storedName: string): Promise<void> {
  await unlink(resolveVaultPath(userId, storedName)).catch(() => undefined);
}

/**
 * Housekeeping: drop encrypted blobs that no longer belong to any `Document`
 * row. A failed upload, a rolled-back transaction or a restored-from-backup
 * database can otherwise leave files behind forever, since nothing else knows
 * they exist.
 *
 * Deliberately conservative: only files with no row at all are removed, only
 * ones older than `minAgeMs` so an upload still in flight is never caught, and
 * only the exact 32-hex `.enc` pattern inside a valid user-id directory.
 */
export async function removeOrphanedFiles(options: { minAgeMs?: number } = {}): Promise<string[]> {
  const minAgeMs = options.minAgeMs ?? 24 * 60 * 60 * 1000;
  const removed: string[] = [];

  let userDirs: Dirent[];
  try {
    userDirs = await readdir(storageRoot(), { withFileTypes: true });
  } catch {
    return removed; // storage not created yet
  }

  for (const entry of userDirs) {
    if (!entry.isDirectory() || !/^[a-z0-9_-]+$/i.test(entry.name)) continue;

    const rows = await prisma.document.findMany({
      where: { userId: entry.name },
      select: { storedName: true },
    });
    const known = new Set(rows.map((row) => row.storedName));

    const files = await readdir(path.join(storageRoot(), entry.name), { withFileTypes: true }).catch(
      (): Dirent[] => [],
    );
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!/^[a-f0-9]{32}\.enc$/i.test(file.name)) continue;
      if (known.has(file.name)) continue;

      const target = path.join(storageRoot(), entry.name, file.name);
      const info = await stat(target).catch(() => null);
      if (!info || Date.now() - info.mtimeMs < minAgeMs) continue;

      await unlink(target).catch(() => undefined);
      removed.push(`${entry.name}/${file.name}`);
    }
  }

  return removed;
}
