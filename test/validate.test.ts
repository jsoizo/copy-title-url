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

const without = <T extends object>(value: T, key: keyof T): unknown => {
  const copy = { ...value };
  delete copy[key];
  return copy;
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
    ["未知のフィールド", { ...base, extra: 1 }, [{ path: "extra", code: "unknownKey" }]],
    ["必須のフィールドが無い", without(base, "label"), [{ path: "label", code: "required" }]],
    ["条件の種類が無い", { ...base, match: [{ pattern: "x" }] }, [{ path: "match.0.type", code: "required" }]],
    ["オブジェクトの位置にオブジェクト以外", { ...base, title: "h1" }, [{ path: "title", code: "invalidType" }]],
    ["条件がオブジェクトでない", { ...base, match: [1] }, [{ path: "match.0", code: "invalidType" }]],
    ["型が違う", { ...base, name: 3 }, [{ path: "name", code: "invalidType" }]],
    [
      "条件の種類が不正",
      { ...base, match: [{ type: "glob", pattern: "x" }] },
      [{ path: "match.0.type", code: "invalidConditionType" }],
    ],
    [
      "クエリの変数名の形式",
      { ...base, match: [{ ...base.match[0], query: { "a b": "q" } }] },
      [{ path: "match.0.query.a b", code: "invalidVariableName" }],
    ],
    [
      "URLPattern として不正",
      { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/(" }] },
      [{ path: "match.0.pattern", code: "invalidUrlPattern" }],
    ],
    [
      "正規表現として不正",
      { ...base, match: [{ type: "regex", pattern: "(?<id>" }], label: "{title}", url: "https://example.com/" },
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
    ["名前が空白だけ", { ...base, name: " \u3000 " }, [{ path: "name", code: "required" }]],
    ["名前が長すぎる", { ...base, name: "a".repeat(101) }, [{ path: "name", code: "tooLong" }]],
    ["表示名のテンプレートが空白だけ", { ...base, label: "  " }, [{ path: "label", code: "required" }]],
    [
      "正規表現のパターンが空白だけ",
      { ...base, match: [{ type: "regex", pattern: " " }] },
      [{ path: "match.0.pattern", code: "required" }],
    ],
    ["セレクタが空白だけ", { ...base, title: { selectors: [" "] } }, [{ path: "title.selectors.0", code: "required" }]],
    ["URL がスキームで始まらない", { ...base, url: "example.com/items/{id}" }, [{ path: "url", code: "urlNotAbsolute" }]],
    ["URL のスキームが http でも https でもない", { ...base, url: "ftp://{host}/{id}" }, [{ path: "url", code: "urlNotAbsolute" }]],
    ["URL が {host} で始まる", { ...base, url: "{host}/items/{id}" }, [{ path: "url", code: "urlNotAbsolute" }]],
    ["閉じていない波括弧", { ...base, label: "{id" }, [{ path: "label", code: "templateInvalidPlaceholder" }]],
    ["対応しない閉じ波括弧", { ...base, label: "{id}}x}" }, [{ path: "label", code: "templateUnmatchedBrace" }]],
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

  test("正規表現の文字クラスの中の (?<title> は変数として扱わない", () => {
    const rule = { ...base, match: [{ type: "regex", pattern: String.raw`^https://example\.com/[(?<title>]/(?<id>\d+)` }] };
    expect(issuesOf(rule)).toEqual([]);
  });

  test.each([
    ["ポートを変数にする", "http://localhost::port/items/:id", "http://localhost:{port}/items/{id}"],
    ["取り出した URL を丸ごと使う", String.raw`^(?<base>https://example\.com/items/\d+)`, "{base}"],
  ])("URL のテンプレートの検査で正しいテンプレートを弾かない: %s", (_name, pattern, url) => {
    const type = pattern.startsWith("^") ? "regex" : "urlpattern";
    expect(issuesOf({ ...base, match: [{ type, pattern }], label: "{title}", url })).toEqual([]);
  });

  test("エスケープした \\(?<id> は、名前付きグループの重複として数えない", () => {
    const rule = { ...base, match: [{ type: "regex", pattern: String.raw`^https://example\.com/(?<id>\d+)/\(?<id>` }] };
    expect(issuesOf(rule)).toEqual([]);
  });

  test("| の左右で同じ名前のグループを取り出すと弾く", () => {
    const rule = { ...base, match: [{ type: "regex", pattern: String.raw`^https://example\.com/(?:a/(?<id>\d+)|b/(?<id>\d+))` }] };
    expect(issuesOf(rule)).toEqual([{ path: "match.0", code: "duplicateVariable" }]);
  });

  test("URLPattern の正規表現グループ内の : は変数として扱わない", () => {
    const rule = { ...base, match: [{ type: "urlpattern", pattern: "https://example.com/:id((?:\\d+))" }] };
    expect(issuesOf(rule)).toEqual([]);
  });

  test("名前、URLPattern、クエリ、セレクタは前後の空白を削り、テンプレートと正規表現は削らない", () => {
    const result = validateRule({
      ...base,
      name: " Example ",
      match: [{ type: "urlpattern", pattern: " https://example.com/items/:id ", query: { " page ": " p " } }],
      title: { selectors: [" h1 "], documentTitleStrip: [" - Site$"] },
      label: "{id} {title} ",
      url: "{origin}/items/{id}",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        ...base,
        name: "Example",
        match: [{ type: "urlpattern", pattern: "https://example.com/items/:id", query: { page: "p" } }],
        title: { selectors: ["h1"], documentTitleStrip: [" - Site$"] },
        label: "{id} {title} ",
        url: "{origin}/items/{id}",
      },
    });
  });

  test("名前の上限を超えたときは、上限の文字数を文言に差し込む", () => {
    const result = validateRule({ ...base, name: "a".repeat(101) });
    expect(result.ok ? [] : result.issues).toEqual([{ path: "name", code: "tooLong", value: "100" }]);
  });

  test("文言に差し込む値と、英語の詳細を分けて返す", () => {
    const result = validateRule({ ...base, label: "{id} x}", match: [{ type: "regex", pattern: "(?<id>" }], url: "https://example.com/" });
    expect(result.ok ? [] : result.issues).toEqual([
      { path: "match.0.pattern", code: "invalidRegex", detail: expect.stringContaining("Invalid regular expression") },
      { path: "label", code: "templateUnmatchedBrace", value: "7" },
    ]);
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

  test("ルールの名前が、ほかのルールや残る組み込みと重なれば弾く", () => {
    const result = validateExport({
      version: 1,
      order: [],
      disabled: [],
      rules: [
        { ...base, name: "GitHub" },
        { ...base, id: "user-2", name: "Other" },
        { ...base, id: "user-3", name: "Other" },
        { ...BUILTIN_RULES.find((rule) => rule.id === "jira")!, name: "Jira" },
      ],
    });
    expect(result.ok ? [] : result.issues).toEqual([
      { path: "rules.0.name", code: "duplicateName", value: "GitHub" },
      { path: "rules.2.name", code: "duplicateName", value: "Other" },
    ]);
  });

  test("$schema キーは無視する", () => {
    expect(validateExport({ $schema: "./rules.schema.json", version: 1, order: [], disabled: [], rules: [] }).ok).toBe(true);
  });

  test("version が 1 でなければ弾く", () => {
    expect(validateExport({ order: [], disabled: [], rules: [] })).toEqual({
      ok: false,
      issues: [{ path: "version", code: "required" }],
    });
    expect(validateExport({ version: 2, order: [], disabled: [], rules: [] })).toEqual({
      ok: false,
      issues: [{ path: "version", code: "unsupportedVersion", value: "2" }],
    });
  });
});
