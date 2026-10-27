import { expect, test } from "vitest";
import { rulesDocUrl, schemaUrl } from "../lib/links";

test("リリース版は v<version> のタグを指す", () => {
  expect(schemaUrl({ version: "0.1.1" })).toBe("https://raw.githubusercontent.com/jsoizo/copy-title-url/v0.1.1/schema/rules.schema.json");
  expect(rulesDocUrl({ version: "0.1.1" })).toBe("https://github.com/jsoizo/copy-title-url/blob/v0.1.1/README.md#rules");
});

test("プレリリース版は接尾辞の残る version_name のタグを指す", () => {
  expect(schemaUrl({ version: "0.2.0", version_name: "0.2.0-beta.1" })).toBe(
    "https://raw.githubusercontent.com/jsoizo/copy-title-url/v0.2.0-beta.1/schema/rules.schema.json",
  );
});
