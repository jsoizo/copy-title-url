import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const errors = [];
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
};

const manifest = readJson("manifest.json") ?? {};
const locales = readdirSync("_locales", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const messages = Object.fromEntries(
  locales.map((locale) => [locale, readJson(join("_locales", locale, "messages.json")) ?? {}]),
);

const serviceWorker = manifest.background?.service_worker;
if (!serviceWorker || !existsSync(serviceWorker)) {
  errors.push(`manifest.json: service_worker が見つからない: ${serviceWorker}`);
}
if (!locales.includes(manifest.default_locale)) {
  errors.push(`manifest.json: default_locale の _locales/${manifest.default_locale} が無い`);
}

const baseKeys = Object.keys(messages[manifest.default_locale] ?? {}).sort();
for (const locale of locales) {
  const keys = Object.keys(messages[locale]).sort();
  if (keys.join() !== baseKeys.join()) {
    errors.push(`_locales/${locale}: キーが ${manifest.default_locale} と一致しない`);
  }
}

const jsFiles = ["src", "scripts", "test"].flatMap((dir) =>
  readdirSync(dir).filter((name) => name.endsWith(".js")).map((name) => join(dir, name)),
);
const usedKeys = new Set(
  [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]),
);
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    errors.push(`${file}: ${error.stderr}`);
  }
  if (file.startsWith("src")) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/getMessage\("(\w+)"\)/g)) usedKeys.add(m[1]);
    for (const m of source.matchAll(/from "(\.[^"]+)"/g)) {
      if (!existsSync(join(dirname(file), m[1]))) errors.push(`${file}: import 先が見つからない: ${m[1]}`);
    }
  }
}
for (const key of usedKeys) {
  if (!baseKeys.includes(key)) errors.push(`i18n キーが未定義: ${key}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`check passed (${jsFiles.length} files, ${locales.length} locales)`);
