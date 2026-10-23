import { describe, expect, test } from "vitest";
import en from "../public/_locales/en/messages.json";
import ja from "../public/_locales/ja/messages.json";
import { fieldKey, issueLocation, issueMessage, type Translate } from "../entrypoints/options/issues";
import type { Issue } from "../lib/rules/validate";

type Messages = Record<string, { message: string; placeholders?: Record<string, { content: string }> }>;

// chrome.i18n.getMessage と同じ規則で、名前付きのプレースホルダーと $$ を置き換える
const translator =
  (messages: Messages): Translate =>
  (key, substitutions = []) => {
    const entry = messages[key];
    if (!entry) throw new Error(`missing message: ${key}`);
    return entry.message.replace(/\$\$|\$([A-Za-z0-9_@]+)\$/g, (token, name: string | undefined) => {
      if (token === "$$") return "$";
      const content = entry.placeholders?.[name!.toLowerCase()]?.content;
      if (content === undefined) throw new Error(`undefined placeholder ${token} in ${key}`);
      return content.replace(/\$(\d)/g, (_, n: string) => substitutions[Number(n) - 1] ?? "");
    });
  };

const tEn = translator(en as Messages);
const tJa = translator(ja as Messages);
const issue = (path: string, code: Issue["code"] = "required"): Issue => ({ path, code });

describe("issueMessage", () => {
  test("入力した値を文言の中に差し込む", () => {
    const undefinedVariable: Issue = { path: "url", code: "undefinedVariable", value: "key" };
    expect(issueMessage(undefinedVariable, tJa)).toBe("変数 key は、すべての条件で取り出される変数ではありません");
    expect(issueMessage(undefinedVariable, tEn)).toBe("The variable key is not captured by every condition");
  });

  test("$$ は $ として表示する", () => {
    expect(issueMessage(issue("match.0.query.a b", "invalidVariableName"), tEn)).toContain("_, or $ and");
  });
});

describe("issueLocation", () => {
  test.each([
    "name",
    "id",
    "label",
    "url",
    "match",
    "match.0",
    "match.0.type",
    "match.0.pattern",
    "match.0.query.a b",
    "match.0.documentTitleFallback",
    "title",
    "title.selectors",
    "title.selectors.1",
    "title.documentTitleStrip.0",
    "version",
    "order.0",
    "disabled.2",
    "rules",
    "rules.2",
    "rules.2.match.0.pattern",
  ])("%s はパスではなく名前で示す", (path) => {
    for (const t of [tEn, tJa]) {
      const location = issueLocation(issue(path), t, ["a", "b", "c"]);
      expect(location).not.toBeNull();
      expect(location).not.toBe(path);
      expect(location).not.toMatch(/\w\.\w/);
    }
  });

  test("インポートでは、ルールの番号と名前を添える", () => {
    const pattern = issue("rules.2.match.0.pattern");
    expect(issueLocation(pattern, tJa, ["", "", "My Jira"])).toBe("3 番目のルール「My Jira」、URL の条件 1 のパターン");
    expect(issueLocation(pattern, tEn, ["", "", "My Jira"])).toBe('Pattern of URL condition 1 in rule 3 ("My Jira")');
    expect(issueLocation(pattern, tJa)).toBe("3 番目のルール、URL の条件 1 のパターン");
  });

  test("未知の項目は、その親の場所で示す", () => {
    expect(issueLocation(issue("extra", "unknownKey"), tJa)).toBeNull();
    expect(issueLocation(issue("rules.0.title.extra", "unknownKey"), tJa)).toBe("1 番目のルール、タイトルの取得");
  });

  test("場所の無いエラーは null を返す", () => {
    expect(issueLocation(issue("", "invalidJson"), tJa)).toBeNull();
  });
});

test("クエリの各行のエラーは、クエリの欄にまとめる", () => {
  expect(fieldKey("match.1.query.a b")).toBe("match.1.query");
  expect(fieldKey("match.1.query")).toBe("match.1.query");
  expect(fieldKey("match.1.pattern")).toBe("match.1.pattern");
});

test.each(Object.keys(en))("%s のプレースホルダーが en と ja で一致し、すべて定義されている", (key) => {
  for (const messages of [en, ja] as Messages[]) {
    const entry = messages[key]!;
    const used = [...entry.message.replace(/\$\$/g, "").matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map(([, name]) => name!.toLowerCase());
    expect(Object.keys(entry.placeholders ?? {}).sort()).toEqual([...new Set(used)].sort());
  }
  expect(Object.keys((ja as Messages)[key]?.placeholders ?? {}).sort()).toEqual(
    Object.keys((en as Messages)[key]!.placeholders ?? {}).sort(),
  );
});
