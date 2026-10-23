import { google, type gmail_v1 } from "googleapis";
import { db, purgeRecordsTable, purgedMessagesTable, allowlistTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { oauthClientForUser } from "./google";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export type PurgeSource = "manual" | "auto";

export interface PurgeOutcome {
  deleted: number;
  spamDeleted: number;
  trashDeleted: number;
  // Spam left in place because of the allowlist or the delay window.
  spamKept: number;
  durationMs: number;
}

// Gmail treats labelIds as AND, so SPAM and TRASH must be queried separately.
// includeSpamTrash is required: without it, messages.list silently excludes
// TRASH results even when TRASH is the explicit labelId filter.
const PAGE_SIZE = 500;
// messages.get costs 5 quota units; Gmail allows 250 units per user per second.
const METADATA_CONCURRENCY = 10;
const MAX_LOGGED_FIELD = 300;

export class NotConnectedError extends Error {
  constructor() {
    super("Gmail is not connected");
  }
}

function gmailFor(user: User): gmail_v1.Gmail {
  const auth: OAuth2Client | null = oauthClientForUser(user);
  if (!auth) throw new NotConnectedError();
  return google.gmail({ version: "v1", auth });
}

async function countLabel(gmail: gmail_v1.Gmail, label: "SPAM" | "TRASH"): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  do {
    const resp = await gmail.users.messages.list({
      userId: "me",
      labelIds: [label],
      includeSpamTrash: true,
      maxResults: PAGE_SIZE,
      pageToken,
      fields: "messages/id,nextPageToken",
    });
    count += (resp.data.messages ?? []).length;
    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);
  return count;
}

export async function countPurgeable(user: User): Promise<{ count: number; spam: number; trash: number }> {
  const gmail = gmailFor(user);
  const [spam, trash] = await Promise.all([countLabel(gmail, "SPAM"), countLabel(gmail, "TRASH")]);
  return { count: (user.purgeSpam ? spam : 0) + (user.purgeTrash ? trash : 0), spam, trash };
}

// Extracts the bare address from a From header such as `"Acme" <deals@acme.com>`.
export function senderAddress(from: string | null | undefined): string | null {
  if (!from) return null;
  const angle = from.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : from).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

export function normalizeAllowlistPattern(raw: string): string | null {
  const p = raw.trim().toLowerCase().replace(/^@/, "");
  if (!p || p.length > 254 || /\s/.test(p)) return null;
  if (p.includes("@")) return /^[^@]+@[^@]+\.[^@]+$/.test(p) ? p : null;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(p) ? p : null;
}

export function isAllowlisted(address: string | null, patterns: string[]): boolean {
  if (!address) return false;
  const domain = address.split("@")[1] ?? "";
  return patterns.some((p) => (p.includes("@") ? address === p : domain === p || domain.endsWith(`.${p}`)));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function header(msg: gmail_v1.Schema$Message, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ? h.value.slice(0, MAX_LOGGED_FIELD) : null;
}

async function purgeSpam(gmail: gmail_v1.Gmail, user: User): Promise<{ deleted: number; kept: number }> {
  const patterns = (
    await db.select({ pattern: allowlistTable.pattern }).from(allowlistTable).where(eq(allowlistTable.userId, user.id))
  ).map((r) => r.pattern);
  const cutoff = Date.now() - user.spamDelayMinutes * 60 * 1000;

  let deleted = 0;
  let kept = 0;
  let pageToken: string | undefined;
  do {
    const resp = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SPAM"],
      includeSpamTrash: true,
      maxResults: PAGE_SIZE,
      pageToken,
      fields: "messages/id,nextPageToken",
    });
    const ids = (resp.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) break;

    const metas = await mapLimit(ids, METADATA_CONCURRENCY, async (id) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
        fields: "id,internalDate,payload/headers",
      });
      return data;
    });

    const doomed = metas.filter((m) => {
      if (user.spamDelayMinutes > 0 && Number(m.internalDate ?? 0) > cutoff) return false;
      return !isAllowlisted(senderAddress(header(m, "From")), patterns);
    });
    kept += metas.length - doomed.length;

    if (doomed.length > 0) {
      await gmail.users.messages.batchDelete({
        userId: "me",
        requestBody: { ids: doomed.map((m) => m.id!) },
      });
      await db.insert(purgedMessagesTable).values(
        doomed.map((m) => ({ userId: user.id, sender: header(m, "From"), subject: header(m, "Subject") })),
      );
      deleted += doomed.length;
    }

    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { deleted, kept };
}

async function purgeTrash(gmail: gmail_v1.Gmail): Promise<number> {
  let deleted = 0;
  let pageToken: string | undefined;
  do {
    const resp = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["TRASH"],
      includeSpamTrash: true,
      maxResults: PAGE_SIZE,
      pageToken,
      fields: "messages/id,nextPageToken",
    });
    const ids = (resp.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) break;
    await gmail.users.messages.batchDelete({ userId: "me", requestBody: { ids } });
    deleted += ids.length;
    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);
  return deleted;
}

export async function purgeForUser(user: User, source: PurgeSource): Promise<PurgeOutcome> {
  const gmail = gmailFor(user);
  const startTime = Date.now();

  const spam = user.purgeSpam ? await purgeSpam(gmail, user) : { deleted: 0, kept: 0 };
  const trashDeleted = user.purgeTrash ? await purgeTrash(gmail) : 0;

  const deleted = spam.deleted + trashDeleted;
  const durationMs = Date.now() - startTime;
  await db.insert(purgeRecordsTable).values({ userId: user.id, deletedCount: deleted, durationMs, source });

  return { deleted, spamDeleted: spam.deleted, trashDeleted, spamKept: spam.kept, durationMs };
}
