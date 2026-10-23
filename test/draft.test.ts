import { describe, expect, test } from "vitest";
import { draftIssues, fromDraft, looseDraft, newDraft } from "../entrypoints/options/draft";
import { BUILTIN_RULES } from "../lib/rules/builtin";

describe("looseDraft と fromDraft", () => {
  test.each(BUILTIN_RULES)("組み込みルール $id は下書きにしてから戻しても変わらない", (rule) => {
    expect(fromDraft(looseDraft(rule, rule.id))).toEqual(rule);
  });

  test("検証を通らない保存値からも、読み取れる部分だけを下書きに残す", () => {
    const draft = looseDraft({ name: "Broken", match: [{ type: "glob", pattern: 1, query: { id: "q" } }], label: 3 }, "user-1");
    expect(draft).toEqual({
      ...newDraft("user-1"),
      name: "Broken",
      match: [{ type: "urlpattern", pattern: "", query: [{ variable: "id", param: "q" }], documentTitleFallback: true }],
      selectors: [],
      label: "",
    });
  });

  test("下書きの id は、保存値の中の id ではなく引数の id を使う", () => {
    expect(looseDraft({ ...BUILTIN_RULES[0], id: "other" }, "github").id).toBe("github");
  });
});

test("同じ変数名のクエリが 2 行あれば、詰め替える前に検出する", () => {
  const draft = newDraft("user-1");
  draft.match = [
    {
      type: "urlpattern",
      pattern: "https://example.com/",
      query: [
        { variable: "key", param: "a" },
        { variable: "key", param: "b" },
      ],
      documentTitleFallback: true,
    },
  ];
  expect(draftIssues(draft)).toEqual([{ path: "match.0.query", code: "duplicateVariable", value: "key" }]);
  draft.match[0]!.query[1]!.variable = " key ";
  expect(draftIssues(draft)).toEqual([{ path: "match.0.query", code: "duplicateVariable", value: "key" }]);
});
