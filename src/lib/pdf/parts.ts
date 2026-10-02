import PDFKit from "pdfkit";
import { formatMoney } from "@/lib/money";
import type { Edition } from "@/lib/plans";

/**
 * Shared layout primitives for the PDF exports.
 *
 * Extracted from the monthly analysis PDF so every document in `src/lib/pdf` draws
 * the same way. Money is always written with `formatMoney`, so no document can
 * invent its own rounding.
 */

export interface PdfLayout {
  doc: PDFKit.PDFDocument;
  left: number;
  right: number;
  width: number;
}

/** Sets up an A4 document and returns the promise for its finished buffer. */
export function beginDocument(): { doc: PDFKit.PDFDocument; finished: Promise<Buffer> } {
  // pdfkit is in `serverExternalPackages`, so it stays Node-only and never reaches
  // the browser bundle.
  const doc = new PDFKit({ size: "A4", margin: 48, bufferPages: true });

  // pdfkit writes asynchronously, so the buffer can only be assembled once the
  // document stream has finished.
  const finished = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return { doc, finished };
}

export function layout(doc: PDFKit.PDFDocument): PdfLayout {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  return { doc, left, right, width: right - left };
}

/** Accent wordmark plus title, byline and date. */
export function documentHead(
  { doc, left, right, width }: PdfLayout,
  input: { title: string; subtitle: string; accentHex: string },
): void {
  doc.fillColor(input.accentHex).fontSize(11).font("Helvetica-Bold").text("FINTARG");
  doc
    .fillColor("#0f1b2f")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(input.title, { lineGap: 4 });
  doc.fillColor("#546680").fontSize(10).font("Helvetica").text(input.subtitle, { width });
  doc.moveDown(1.2);
  void left;
  void right;
}

export function sectionTitle(
  doc: PDFKit.PDFDocument,
  text: string,
  left: number,
  right: number,
): void {
  doc.moveDown(0.4);
  doc.fillColor("#0f1b2f").fontSize(12).font("Helvetica-Bold").text(text, left, doc.y);
  const y = doc.y + 2;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor("#dde5ef").stroke();
  doc.moveDown(0.5);
}

export function row(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  left: number,
  right: number,
  options: { bold?: boolean; rule?: boolean; tone?: "danger" | "positive" | "warning" } = {},
): void {
  const y = doc.y;
  const font = options.bold ? ("Helvetica-Bold" as const) : ("Helvetica" as const);
  doc.fontSize(options.bold ? 10.5 : 9.5).font(font).fillColor("#0f1b2f");
  doc.text(label, left, y, { width: right - left - 110 });
  doc.text(value, left, y, { width: right - left, align: "right" });
  if (options.tone === "danger") doc.fillColor("#b91c1c");
  else if (options.tone === "positive") doc.fillColor("#047857");
  else if (options.tone === "warning") doc.fillColor("#b45309");
  if (options.rule) {
    const lineY = doc.y + 2;
    doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(0.6).strokeColor("#dde5ef").stroke();
    doc.moveDown(0.35);
  }
}

/** Small grey explanatory line under a row. */
export function note(doc: PDFKit.PDFDocument, text: string, left: number, width: number): void {
  doc
    .fillColor("#546680")
    .fontSize(8.5)
    .font("Helvetica")
    .text(text, left + 8, doc.y + 1, { width: width - 8 });
  doc.moveDown(0.25);
}

/** A filled callout box, used for the headline figure. */
export function callout(
  { doc, left, right, width }: PdfLayout,
  input: { title: string; value: string; caption: string; tone: "danger" | "positive" | "warning" },
): void {
  const top = doc.y;
  const height = 64;
  const fill = input.tone === "danger" ? "#fef2f2" : input.tone === "warning" ? "#fffbeb" : "#ecfdf5";
  const ink = input.tone === "danger" ? "#b91c1c" : input.tone === "warning" ? "#b45309" : "#047857";

  doc.rect(left, top, width, height).fillColor(fill).fill();
  doc.fillColor(ink).fontSize(9).font("Helvetica-Bold").text(input.title.toUpperCase(), left + 14, top + 10);
  doc.fillColor(ink).fontSize(22).font("Helvetica-Bold").text(input.value, left + 14, top + 24);
  doc.fillColor("#546680").fontSize(8.5).font("Helvetica").text(input.caption, left + 14, top + 48, {
    width: width - 28,
  });

  doc.y = top + height + 10;
  void right;
}

/** Table header row for a ledger-style document. */
export function tableHead(
  { doc, left, right }: PdfLayout,
  columns: { label: string; width: number; align?: "left" | "right" }[],
): void {
  const y = doc.y;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#546680");
  let x = left;
  for (const column of columns) {
    doc.text(column.label.toUpperCase(), x, y, {
      width: column.width,
      align: column.align ?? "left",
    });
    x += column.width;
  }
  doc.y = y + 12;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.6).strokeColor("#dde5ef").stroke();
  doc.moveDown(0.4);
  void right;
}

/** Page footer stamped on every page once the body is complete. */
export function stampFooters(
  { doc, left, width }: PdfLayout,
  edition: Edition,
): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#546680")
      .text(
        `Fintarg · ${edition === "business" ? "Business" : "Basic"} plan · private document · page ${
          i - range.start + 1
        } of ${range.count}`,
        left,
        doc.page.height - 42,
        { width, align: "center" },
      );
  }
}

export { formatMoney };