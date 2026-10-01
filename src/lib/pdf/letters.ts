import { Buffer } from "node:buffer";
import PDFDocument from "pdfkit";

/**
 * PDF letter builder (FR-10). Server-only: this file must never reach the
 * browser bundle (pdfkit is listed in `serverExternalPackages`).
 *
 * The document is produced entirely in memory - nothing is written to disk here
 * - so the caller can either stream the buffer to a response or store it in the
 * encrypted vault.
 */

export interface LetterPdfCompany {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  regNumber?: string;
}

export interface LetterPdfInput {
  title: string;
  body: string;
  recipientName: string;
  recipientAddress?: string;
  signerName: string;
  signerEmail?: string;
  todayLabel: string;
  company?: LetterPdfCompany | null;
  accentHex: string;
}

const A4 = "A4";
const MARGIN = 56.7; // 2 cm
const BODY_SIZE = 12;
const LINE_GAP = 6;

function hexToRgb(hex: string): string {
  const cleaned = hex.replace("#", "").trim();
  const full = cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#0f766e";
  return `#${full.toLowerCase()}`;
}

/** Renders one letter as a PDF and returns the bytes. */
export function renderLetterPdf(input: LetterPdfInput): Buffer {
  const doc = new PDFDocument({
    size: A4,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: input.title,
      Author: "Fintarg",
      Creator: "Fintarg",
      Subject: `Letter to ${input.recipientName}`,
    },
  });

  // The required signature is synchronous, so the chunks are collected straight
  // off the document instead of through an async 'data' listener. Anything the
  // constructor already buffered (the PDF header and the first objects) is
  // drained first so the file keeps its exact byte order.
  const chunks: Buffer[] = [];
  const drain = doc as unknown as { read: () => Buffer | null; push: (chunk: Buffer | string | null) => boolean };
  let pending: Buffer | null = drain.read();
  while (pending !== null) {
    chunks.push(pending);
    pending = drain.read();
  }
  drain.push = (chunk: Buffer | string | null) => {
    if (chunk === null) return false; // end-of-stream signal, not data
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };

  const accent = hexToRgb(input.accentHex);
  const width = doc.page.width - MARGIN * 2;

  if (input.company) {
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(16).text(input.company.name, { align: "left" });
    doc.moveDown(0.2);
    doc
      .fillColor("#444444")
      .font("Helvetica")
      .fontSize(9)
      .text(
        [
          input.company.address,
          [input.company.phone, input.company.email].filter(Boolean).join("  |  "),
          input.company.regNumber ? `Reg. No. ${input.company.regNumber}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        { width },
      );
    doc
      .moveTo(MARGIN, doc.y + 8)
      .lineTo(doc.page.width - MARGIN, doc.y + 8)
      .lineWidth(1)
      .strokeColor(accent)
      .stroke();
    doc.y += 20;
  }

  doc.moveDown(0.5);
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(BODY_SIZE + 2).text(input.title);
  doc.moveDown(0.6);

  doc.font("Helvetica").fontSize(BODY_SIZE).fillColor("#111111");
  for (const block of splitBlocks(input.body)) {
    const isSubject = block.startsWith("Subject:");
    if (isSubject) {
      doc.font("Helvetica-Bold").text(block, { width, align: "left" });
    } else {
      doc.font("Helvetica").text(block, { width, align: "left", lineGap: LINE_GAP });
    }
    doc.moveDown(0.7);
  }

  stampFooters(doc, input, accent, width);

  doc.end();
  return Buffer.concat(chunks);
}

/** Page footer with the app name and a page number, added once the pages exist. */
function stampFooters(doc: PDFKit.PDFDocument, input: LetterPdfInput, accent: string, width: number): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    // The footer sits in the bottom margin, so the page break check has to see
    // the full page height here or pdfkit would start a new page for it.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGIN + 12;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text("Created with Fintarg", MARGIN, y, { width, align: "left", lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(accent)
      .text(`Page ${index + 1} of ${range.count}`, MARGIN, y, { width, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}

/** Blank lines separate paragraphs; single line breaks stay inside a paragraph. */
function splitBlocks(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter((block) => block.length > 0);
}

/** Filesystem-safe slug used in the download filename. */
export function letterFileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "letter";
}
