import { NextResponse } from "next/server";
import { loadLogo } from "@/lib/contact-logo";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Serves an uploaded logo. Members only — unlike Instagram avatars, nothing
 * outside the dashboard needs these, so there's no reason to leave them open.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // A redirect to the login page would only show up as a broken image, so a
  // stranger is told the same thing as someone asking for a logo we don't have.
  const session = await getSession();
  if (!session?.user?.isMember) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const light = url.searchParams.get("tone") === "light";

  const logo = await loadLogo(id, light ? "LIGHT" : "DARK").catch(() => null);
  if (!logo) return new NextResponse("Not found", { status: 404 });

  const tag = `"${logo.updatedAt.getTime()}"`;
  if (req.headers.get("if-none-match") === tag) {
    return new NextResponse(null, { status: 304 });
  }

  // Downloading is the page's business: it links with a filename, which the
  // browser honours because this is the same origin.
  const headers: Record<string, string> = {
    "Content-Type": logo.mime,
    // Revalidate every time: replacing a logo keeps the same url.
    "Cache-Control": "private, no-cache",
    ETag: tag,
    // An svg can reference anything it likes; served from our own origin, it
    // gets nothing. Belt and braces alongside refusing scripts on upload.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
  };

  return new NextResponse(new Uint8Array(logo.data), { headers });
}
