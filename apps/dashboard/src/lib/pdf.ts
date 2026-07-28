import PDFDocument from "pdfkit";
import { formatInTz } from "./time";

export interface PdfPerson {
  userId: string;
  username: string | null;
  displayName: string | null;
  status: string;
  note: string | null;
  overriddenBy: string | null;
}

export interface PdfEvent {
  title: string;
  kind: string;
  startAt: Date;
  channelName: string;
  location: string | null;
  rsvps: PdfPerson[];
}

export interface PdfInput {
  guildName: string;
  timezone: string;
  events: PdfEvent[];
}

const LEFT = 50;
const RIGHT = 545;

function names(people: PdfPerson[]): string {
  if (people.length === 0) return "—";
  return people
    .map(
      (p) =>
        (p.displayName || p.username || p.userId) +
        (p.overriddenBy ? " (adjusted)" : ""),
    )
    .join(", ");
}

function renderList(
  doc: PDFKit.PDFDocument,
  label: string,
  people: PdfPerson[],
) {
  doc.fontSize(10).fillColor("#111827").text(`${label} (${people.length})`);
  doc.fontSize(9).fillColor("#4b5563").text(names(people), {
    indent: 10,
    width: RIGHT - LEFT - 10,
  });
  doc.moveDown(0.3);
}

/** Like renderList, but shows each person's motivation reason on its own line. */
function renderMotivations(doc: PDFKit.PDFDocument, people: PdfPerson[]) {
  doc.fontSize(10).fillColor("#111827").text(`Motivation (${people.length})`);
  if (people.length === 0) {
    doc.fontSize(9).fillColor("#4b5563").text("—", { indent: 10 });
  } else {
    for (const p of people) {
      const who =
        (p.displayName || p.username || p.userId) +
        (p.overriddenBy ? " (adjusted)" : "");
      doc
        .fontSize(9)
        .fillColor("#374151")
        .text(who, { indent: 10, width: RIGHT - LEFT - 10, continued: false });
      doc
        .fontSize(9)
        .fillColor("#6b7280")
        .text(p.note?.trim() || "(no reason given)", {
          indent: 22,
          width: RIGHT - LEFT - 22,
        });
    }
  }
  doc.moveDown(0.3);
}

function renderEvent(doc: PDFKit.PDFDocument, e: PdfEvent, tz: string) {
  if (doc.y > 720) doc.addPage();

  const going = e.rsvps.filter((r) => r.status === "GOING");
  const motivated = e.rsvps.filter((r) => r.status === "MOTIVATED");
  const participating = going.length;

  doc.moveDown(0.6);
  doc.fontSize(14).fillColor("#111827").text(`${e.title}  [${e.kind}]`);
  doc
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      `${formatInTz(e.startAt, tz)}   |   #${e.channelName}${e.location ? "   |   " + e.location : ""}`,
    );
  doc
    .fontSize(9)
    .fillColor("#374151")
    .text(
      `Participating: ${participating}  (Going ${going.length}, Motivation ${motivated.length})`,
    );
  doc.moveDown(0.4);

  renderList(doc, "Going", going);
  renderMotivations(doc, motivated);

  doc.moveDown(0.2);
  doc
    .strokeColor("#e5e7eb")
    .moveTo(LEFT, doc.y)
    .lineTo(RIGHT, doc.y)
    .stroke();
}

export function buildPresencePdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: LEFT });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).fillColor("#111827").text("CyLiis Remora");
    doc
      .fontSize(12)
      .fillColor("#4b5563")
      .text(`${input.guildName} — Presence report`);
    doc
      .fontSize(9)
      .fillColor("#9ca3af")
      .text(
        `Generated ${formatInTz(new Date(), input.timezone)} (${input.timezone})`,
      );
    doc
      .strokeColor("#e5e7eb")
      .moveTo(LEFT, doc.y + 6)
      .lineTo(RIGHT, doc.y + 6)
      .stroke();

    if (input.events.length === 0) {
      doc.moveDown().fontSize(12).fillColor("#4b5563").text("No events.");
    } else {
      for (const e of input.events) renderEvent(doc, e, input.timezone);
    }

    doc.end();
  });
}
