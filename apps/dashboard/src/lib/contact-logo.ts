import { prisma } from "@repo/db";

export const LOGO_TONES = ["DARK", "LIGHT"] as const;
export type LogoTone = (typeof LOGO_TONES)[number];

/** Vectors only: they scale to any card, and a photo of a logo never looks right. */
export const LOGO_MIME = "image/svg+xml";
const MAX_BYTES = 512 * 1024;

/**
 * An svg is a document, not just a picture: it can carry scripts and remote
 * references, and we serve it from our own origin. Anything that could run or
 * phone home is refused rather than stripped, so what's stored is what was
 * drawn.
 */
const FORBIDDEN =
  /<script|<foreignobject|<iframe|<use[^>]+href\s*=\s*["']http|on\w+\s*=|javascript:/i;

export function logoUrlFor(contactId: string, tone: LogoTone): string {
  const base = `/api/contacts/${contactId}/logo`;
  return tone === "LIGHT" ? `${base}?tone=light` : base;
}

/**
 * Reads an uploaded file, refusing anything that isn't a plain svg drawing.
 * The buffer is spelled out because Prisma's Bytes won't take a view that
 * might be sharing memory.
 */
export async function readSvgUpload(
  file: File,
): Promise<Uint8Array<ArrayBuffer>> {
  if (file.size > MAX_BYTES) {
    throw new Error("That file is over 512 KB — logos should be far smaller.");
  }

  const text = await file.text();
  if (!/<svg[\s>]/i.test(text)) {
    throw new Error("Only SVG files can be uploaded.");
  }
  if (FORBIDDEN.test(text)) {
    throw new Error(
      "That SVG contains scripts or external references, so it can't be used.",
    );
  }

  return new TextEncoder().encode(text);
}

export async function saveLogo(
  contactId: string,
  tone: LogoTone,
  data: Uint8Array<ArrayBuffer>,
): Promise<void> {
  await prisma.contactLogo.upsert({
    where: { contactId_tone: { contactId, tone } },
    create: { contactId, tone, mime: LOGO_MIME, data },
    update: { mime: LOGO_MIME, data },
  });
}

export async function deleteLogo(
  contactId: string,
  tone: LogoTone,
): Promise<void> {
  await prisma.contactLogo
    .delete({ where: { contactId_tone: { contactId, tone } } })
    .catch(() => undefined);
}

export async function loadLogo(contactId: string, tone: LogoTone) {
  return prisma.contactLogo.findUnique({
    where: { contactId_tone: { contactId, tone } },
    select: { mime: true, data: true, updatedAt: true },
  });
}
