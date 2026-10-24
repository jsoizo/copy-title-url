import { execFileSync } from "node:child_process";
import { readFileSync, renameSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

// STORE_BUILD を立てて manifest の key を省き、ストア提出用の名前で保存する
execFileSync("wxt", ["zip"], {
  stdio: "inherit",
  env: { ...process.env, STORE_BUILD: "1" },
});

const chromeZip = new URL(`../.output/copy-title-url-${version}-chrome.zip`, import.meta.url);
const storeZip = new URL(`../.output/copy-title-url-${version}-chrome-store.zip`, import.meta.url);
renameSync(chromeZip, storeZip);
console.log(`Store zip: .output/copy-title-url-${version}-chrome-store.zip`);
