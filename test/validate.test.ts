import { describe, expect, test } from "vitest";
import { BUILTIN_RULES } from "../lib/rules/builtin";
import type { Rule } from "../lib/rules/schema";
import { type Issue, validateExport, validateRule } from "../lib/rules/validate";

const base: Rule = {
  id: "user-1",
  name: "Example",
  match: [{ type: "urlpattern", pattern: "https://example.com/items/:id" }],
  title: { selectors: ["h1"] },
  label: "{id} {title}",
  url: "https://{host}/items/{id}",
};

const issuesOf = (input: unknown, options = {}): Pick<Issue, "path" | "code">[] => {
  const result = validateRule(input, options);
  return result.ok ? [] : result.issues.map(({ path, code }) => ({ path, code }));
};

describe("validateRule", () => {
  test.each(BUILTIN_RULES)("組み込みルール $id は検証を通る", (rule) => {
    expect(validateRule(rule)).toEqual({ ok: true, value: rule });
  });

  test.each<[string, unknown, Pick<Issue, "path" | "code">[]]>([
    ["名前が空", { ...base, name: "" }, [{ path: "name", code: "required" }]],
    ["条件が 0 件", { ...base, match: [] }, [{ path: "match", code: "atLeastOne" }]],
    ["ID の形式", { ...base, id: "User 1" }, [{ path: "id", code: "invalidId" }]],
    ["未知のフィールド", { ...base, extra: 1 }, [{ path: "extra", code: "invalidValue" }]],
    [
      "URLPattern として不正",
      { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/(" }] },
      [{ path: "match.0.pattern", code: "invalidUrlPattern" }],
    ],
    [
      "正規表現として不正",
      { ...base, match: [{ type: "regex", pattern: "(?<id>" }], label: "{title}", url: "x" },
      [{ path: "match.0.pattern", code: "invalidRegex" }],
    ],
    [
      "除去用の正規表現が不正",
      { ...base, title: { selectors: ["h1"], documentTitleStrip: ["["] } },
      [{ path: "title.documentTitleStrip.0", code: "invalidRegex" }],
    ],
    [
      "予約名を取り出す",
      { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/:title/:id" }] },
      [{ path: "match.0", code: "reservedVariable" }],
    ],
    [
      "クエリとパスで同じ変数",
      { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/items/:id", query: { id: "id" } }] },
      [{ path: "match.0", code: "duplicateVariable" }],
    ],
    [
      "一部の条件でしか取り出さない変数",
      {
        ...base,
        match: [base.match[0], { type: "regex", pattern: "^https://example\\.org/(?<key>\\d+)" }],
      },
      [
        { path: "label", code: "undefinedVariable" },
        { path: "url", code: "undefinedVariable" },
      ],
    ],
    ["URL で title を使う", { ...base, url: "https://example.com/{title}" }, [{ path: "url", code: "titleInUrl" }]],
    ["閉じていない波括弧", { ...base, label: "{id" }, [{ path: "label", code: "invalidTemplate" }]],
    [
      "セレクタが空なのに代用を止める",
      { ...base, match: [{ ...base.match[0], documentTitleFallback: false }], title: { selectors: [] } },
      [{ path: "match.0.documentTitleFallback", code: "noTitleSource" }],
    ],
  ])("%s", (_name, input, expected) => {
    expect(issuesOf(input)).toEqual(expected);
  });

  test("正規表現の (?:...) や後読みは変数として扱わない", () => {
    const rule = {
      ...base,
      match: [{ type: "regex", pattern: String.raw`^https://example\.com/(?:a|b)/(?<=/)(?<id>\d+)` }],
    };
    expect(issuesOf(rule)).toEqual([]);
  });

  test("URLPattern の正規表現グループ内の : は変数として扱わない", () => {
    const rule = { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/:id((?:\\d+))" }] };
    expect(issuesOf(rule)).toEqual([]);
  });

  test("セレクタは検査関数を渡したときだけ検査する", () => {
    const rule = { ...base, title: { selectors: ["h1", "a[="] } };
    expect(issuesOf(rule)).toEqual([]);
    expect(issuesOf(rule, { isValidSelector: (s: string) => s !== "a[=" })).toEqual([
      { path: "title.selectors.1", code: "invalidSelector" },
    ]);
  });
});

describe("validateExport", () => {
  test("ルール ID の重複と、各ルールの検証エラーをパス付きで返す", () => {
    const result = validateExport({
      version: 1,
      order: [],
      disabled: [],
      rules: [base, { ...base, url: "https://example.com/{title}" }],
    });
    expect(result.ok ? [] : result.issues.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: "rules.1.id", code: "duplicateRuleId" },
      { path: "rules.1.url", code: "titleInUrl" },
    ]);
  });

  test("$schema キーは無視する", () => {
    expect(validateExport({ $schema: "./rules.schema.json", version: 1, order: [], disabled: [], rules: [] }).ok).toBe(true);
  });

  test("version が 1 でなければ弾く", () => {
    expect(validateExport({ version: 2, order: [], disabled: [], rules: [] }).ok).toBe(false);
  });
});
