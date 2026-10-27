import { createReadStream } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { auth, chromewebstore, type chromewebstore_v2 } from "@googleapis/chromewebstore";

type RevisionStatus = chromewebstore_v2.Schema$ItemRevisionStatus;

const [, , zip, version] = process.argv;
const { CWS_PUBLISHER_ID: publisherId, CWS_EXTENSION_ID: extensionId } = process.env;
if (!zip || !version || !publisherId || !extensionId) {
  console.error("Usage: CWS_PUBLISHER_ID=<id> CWS_EXTENSION_ID=<id> node scripts/submit-store.ts <zip> <version>");
  process.exit(2);
}

const name = `publishers/${publisherId}/items/${extensionId}`;
const store = chromewebstore({
  version: "v2",
  // ADC 既定の cloud-platform スコープでは Chrome Web Store API を呼べない
  auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/chromewebstore"] }),
});

const hasVersion = (revision: RevisionStatus | undefined) =>
  revision?.distributionChannels?.some((channel) => channel.crxVersion === version) ?? false;

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

const { data: status } = await store.publishers.items.fetchStatus({ name });
const published = status.publishedItemRevisionStatus;
const submitted = status.submittedItemRevisionStatus;

if (status.takenDown) fail("the item has been taken down for a policy violation; check the developer dashboard");
if (status.warned) console.warn("warning: the item has a policy warning and may be taken down; check the developer dashboard");
// 再実行で二重に提出しないよう、この版が既に通っているか審査に出ているなら何もしない
if (hasVersion(published)) {
  console.log(`${version} is already published; nothing to do`);
  process.exit(0);
}
if (hasVersion(submitted)) {
  if (["PENDING_REVIEW", "STAGED", "PUBLISHED", "PUBLISHED_TO_TESTERS"].includes(submitted?.state ?? "")) {
    console.log(`${version} is already submitted (${submitted?.state}); nothing to do`);
    process.exit(0);
  }
  fail(`${version} was already submitted and is ${submitted?.state}; check the developer dashboard`);
}
// 審査中の提出を自動で取り消さない。取り消すかはダッシュボードで判断する
if (submitted?.state === "PENDING_REVIEW" || submitted?.state === "STAGED") {
  const other = submitted.distributionChannels?.map((channel) => channel.crxVersion).join(", ");
  fail(`another version (${other}) is ${submitted.state}; cancel it in the developer dashboard or wait, then rerun`);
}

console.log(`Uploading ${zip}`);
const { data: upload } = await store.media.upload({
  name,
  media: { mimeType: "application/zip", body: createReadStream(zip) },
});
if (upload.crxVersion && upload.crxVersion !== version) fail(`the uploaded package is ${upload.crxVersion}, not ${version}`);
let uploadState = upload.uploadState;
for (let attempt = 0; uploadState === "IN_PROGRESS"; attempt++) {
  if (attempt >= 30) fail("the upload is still in progress after 5 minutes");
  await sleep(10_000);
  const { data } = await store.publishers.items.fetchStatus({ name });
  // 非同期アップロードの状態がまだ反映されていないこともあるので、未設定なら待ち続ける
  uploadState = data.lastAsyncUploadState ?? "IN_PROGRESS";
}
if (uploadState !== "SUCCEEDED") fail(`the upload ended in ${uploadState}`);

const { data: submission } = await store.publishers.items.publish({
  name,
  requestBody: { publishType: "DEFAULT_PUBLISH" },
});
for (const warning of submission.warningInfo?.warnings ?? []) {
  console.warn(`warning: ${warning.reason}: ${warning.description}`);
}
console.log(`Submitted ${version} for review (${submission.state})`);
