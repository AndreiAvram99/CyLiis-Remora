import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { env } from "./env";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** The raw service-account JSON, from either the inline env var or a file. */
function readServiceAccountJson(): string | null {
  const inline = env.googleServiceAccountJson();
  if (inline) {
    return inline.trim().startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8");
  }
  const file = env.googleServiceAccountFile();
  if (!file) return null;
  try {
    return readFileSync(file, "utf8");
  } catch (err) {
    console.error("[google] failed to read service account file:", err);
    return null;
  }
}

let cached: ServiceAccount | null | undefined;

export function serviceAccount(): ServiceAccount | null {
  if (cached !== undefined) return cached;
  const json = readServiceAccountJson();
  if (!json) {
    cached = null;
    return cached;
  }
  try {
    cached = JSON.parse(json) as ServiceAccount;
  } catch (err) {
    console.error("[google] service account JSON is not valid:", err);
    cached = null;
  }
  return cached;
}

/** An authenticated client for the given scopes, or null when unconfigured. */
export function serviceAccountAuth(scopes: string[]) {
  const creds = serviceAccount();
  if (!creds) return null;
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes,
  });
}
