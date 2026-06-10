import { google } from "googleapis";
import { db, purgeRecordsTable } from "@workspace/db";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export type PurgeSource = "manual" | "auto";

export async function countSpam(auth: OAuth2Client): Promise<number> {
  const gmail = google.gmail({ version: "v1", auth });
  let count = 0;
  let pageToken: string | undefined;

  do {
    const listResp = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SPAM"],
      maxResults: 500,
      pageToken,
    });
    count += (listResp.data.messages ?? []).length;
    pageToken = listResp.data.nextPageToken ?? undefined;
  } while (pageToken);

  return count;
}

export async function purgeAllSpam(
  auth: OAuth2Client,
  source: PurgeSource,
): Promise<{ deleted: number; durationMs: number }> {
  const gmail = google.gmail({ version: "v1", auth });
  const startTime = Date.now();

  let deleted = 0;
  let pageToken: string | undefined;

  do {
    const listResp = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SPAM"],
      maxResults: 500,
      pageToken,
    });

    const messages = listResp.data.messages ?? [];
    if (messages.length === 0) break;

    const ids = messages.map((m) => m.id!).filter(Boolean);
    if (ids.length > 0) {
      await gmail.users.messages.batchDelete({
        userId: "me",
        requestBody: { ids },
      });
      deleted += ids.length;
    }

    pageToken = listResp.data.nextPageToken ?? undefined;
  } while (pageToken);

  const durationMs = Date.now() - startTime;

  await db.insert(purgeRecordsTable).values({ deletedCount: deleted, durationMs, source });

  return { deleted, durationMs };
}
