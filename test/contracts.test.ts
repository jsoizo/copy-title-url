import { expect, test } from "vitest";
import en from "../public/_locales/en/messages.json";
import ja from "../public/_locales/ja/messages.json";
import committedSchema from "../schema/rules.schema.json";
import { buildJsonSchema } from "../lib/rules/json-schema";
import { ISSUE_CODES } from "../lib/rules/validate";

test("コミット済みの rules.schema.json が schema.ts から生成した内容と一致する（pnpm schema で更新）", () => {
  expect(committedSchema).toEqual(buildJsonSchema());
});

test("en と ja の i18n キーが一致する", () => {
  expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
});

// 検証エラーの文言キーは文字列を組み立てて引くため、型では検査されない
test.each(ISSUE_CODES)("検証エラー %s の文言がある", (code) => {
  expect(en).toHaveProperty(`issue_${code}`);
});
