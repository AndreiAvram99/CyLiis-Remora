import { DateTime } from "luxon";
import { google, type docs_v1, type drive_v3 } from "googleapis";
import { env } from "./env";
import { serviceAccount, serviceAccountAuth } from "./google-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

/**
 * Discord channel -> the folder its minutes live in, inside the shared minutes
 * folder. #announcements is the whole team, so it files under General.
 */
const CHANNEL_FOLDERS: Record<string, string> = {
  announcements: "General",
  events: "Events",
  branding: "Branding",
  hardware: "Hardware",
  pagination: "Pagination",
  sustenability: "Sustainability",
};

let clients: { drive: drive_v3.Drive; docs: docs_v1.Docs } | null | undefined;

function getClients() {
  if (clients !== undefined) return clients;
  const auth = serviceAccountAuth(SCOPES);
  clients = auth
    ? {
        drive: google.drive({ version: "v3", auth }),
        docs: google.docs({ version: "v1", auth }),
      }
    : null;
  return clients;
}

function tabTitles(startAt: Date, timezone: string) {
  const date = DateTime.fromJSDate(startAt)
    .setZone(timezone)
    .toFormat("d.MM.yyyy");
  return {
    date,
    agenda: `Agendă meeting ${date}`,
    resume: `Meeting resume ${date}`,
  };
}

/**
 * Find the team's folder by name inside the shared minutes folder. Names are
 * matched case-insensitively so a rename in Drive doesn't break the mapping.
 */
async function folderFor(
  drive: drive_v3.Drive,
  channelName: string,
): Promise<string> {
  const wanted = CHANNEL_FOLDERS[channelName.toLowerCase()];
  if (!wanted) {
    throw new Error(`#${channelName} has no minutes folder in Drive.`);
  }

  const root = env.googleAgendaFolderId();
  const res = await drive.files.list({
    q: `'${root}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 100,
  });

  const match = res.data.files?.find(
    (f) => f.name?.toLowerCase() === wanted.toLowerCase(),
  );
  if (!match?.id) {
    throw new Error(`Couldn't find a "${wanted}" folder in Drive.`);
  }
  return match.id;
}

/**
 * Create the document in the team's folder. Made through Drive rather than the
 * Docs API so it lands in the right folder — and, on a shared drive, is owned by
 * the drive instead of the service account, which has no storage of its own.
 */
async function createDoc(
  drive: drive_v3.Drive,
  folderId: string,
  title: string,
): Promise<{ id: string; url: string }> {
  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: [folderId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error("Drive didn't return an id for the new document.");
  return {
    id,
    url:
      res.data.webViewLink ?? `https://docs.google.com/document/d/${id}/edit`,
  };
}

/** Starter content, so a fresh tab isn't an intimidating blank page. */
function agendaBody(title: string, date: string): string {
  return [
    `${title} — ${date}`,
    "",
    "Participanți:",
    "",
    "Subiecte:",
    "1. ",
    "",
    "Altele:",
    "",
  ].join("\n");
}

function resumeBody(title: string, date: string): string {
  return [
    `${title} — ${date}`,
    "",
    "Ce s-a discutat:",
    "",
    "Decizii:",
    "",
    "Task-uri (cine / ce / până când):",
    "",
  ].join("\n");
}

async function addTab(
  docs: docs_v1.Docs,
  documentId: string,
  title: string,
  parentTabId?: string,
): Promise<string> {
  const res = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ addDocumentTab: { tabProperties: { title, parentTabId } } }],
    },
  });
  const tabId =
    res.data.replies?.[0]?.addDocumentTab?.tabProperties?.tabId ?? null;
  if (!tabId)
    throw new Error(`Docs didn't return an id for the "${title}" tab.`);
  return tabId;
}

async function fillTab(
  docs: docs_v1.Docs,
  documentId: string,
  tabId: string,
  text: string,
) {
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ insertText: { text, location: { tabId, index: 1 } } }],
    },
  });
}

/** Rename the tab a brand-new document comes with, instead of leaving it empty. */
async function renameFirstTab(
  docs: docs_v1.Docs,
  documentId: string,
  title: string,
): Promise<string> {
  const doc = await docs.documents.get({
    documentId,
    includeTabsContent: true,
  });
  const tabId = doc.data.tabs?.[0]?.tabProperties?.tabId;
  if (!tabId) throw new Error("The new document has no tab to rename.");

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          updateDocumentTabProperties: {
            tabProperties: { tabId, title },
            fields: "title",
          },
        },
      ],
    },
  });
  return tabId;
}

export interface AgendaTarget {
  title: string;
  startAt: Date;
  timezone: string;
  channelName: string;
  /** Set when a previous occurrence of this series already made the document. */
  existingDocId?: string | null;
}

export interface AgendaResult {
  docId: string;
  url: string;
  /** True when this call added a date to a document that already existed. */
  appended: boolean;
}

/**
 * Ensure the meeting has an agenda document, returning where it lives.
 *
 * A one-off meeting gets its own document. A recurring one keeps a single
 * document and gains a fresh "Agendă meeting <date>" tab per occurrence, with
 * the matching resume nested underneath it.
 */
export async function ensureAgendaDoc(
  target: AgendaTarget,
): Promise<AgendaResult> {
  const c = getClients();
  if (!c) {
    throw new Error(
      "Google isn't configured for Drive access. Add the service account key and share the minutes folder with it.",
    );
  }

  const { date, agenda, resume } = tabTitles(target.startAt, target.timezone);

  let docId = target.existingDocId ?? null;
  let url = docId ? `https://docs.google.com/document/d/${docId}/edit` : "";
  let agendaTabId: string;

  try {
    if (docId) {
      agendaTabId = await addTab(c.docs, docId, agenda);
    } else {
      const folderId = await folderFor(c.drive, target.channelName);
      const created = await createDoc(c.drive, folderId, target.title);
      docId = created.id;
      url = created.url;
      agendaTabId = await renameFirstTab(c.docs, docId, agenda);
    }

    const resumeTabId = await addTab(c.docs, docId, resume, agendaTabId);
    await fillTab(c.docs, docId, resumeTabId, resumeBody(target.title, date));
    await fillTab(c.docs, docId, agendaTabId, agendaBody(target.title, date));
  } catch (err) {
    throw new Error(describeFailure(err));
  }

  return { docId, url, appended: Boolean(target.existingDocId) };
}

/** Turn Google's errors into something a manager can act on. */
function describeFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const email = serviceAccount()?.client_email ?? "the service account";

  if (/storage quota/i.test(raw)) {
    return `Google refused to create the file because ${email} has no storage of its own. The minutes folder has to live on a shared drive with ${email} added as Content manager.`;
  }
  if (/File not found|notFound|404/i.test(raw)) {
    return `Google can't see the minutes folder. Share it with ${email} as Content manager.`;
  }
  if (/insufficient|forbidden|403/i.test(raw)) {
    return `${email} isn't allowed to write in the minutes folder. Give it Content manager access.`;
  }
  return raw;
}
