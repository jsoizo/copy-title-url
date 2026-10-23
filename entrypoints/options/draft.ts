import type { MatchCondition, Rule } from "../../lib/rules/schema";
import type { Issue } from "../../lib/rules/validate";

type QueryDraft = { variable: string; param: string };

export type ConditionDraft = {
  type: MatchCondition["type"];
  pattern: string;
  query: QueryDraft[];
  documentTitleFallback: boolean;
};

export type RuleDraft = {
  id: string;
  name: string;
  match: ConditionDraft[];
  selectors: string[];
  documentTitleStrip: string[];
  label: string;
  url: string;
};

export const emptyCondition = (): ConditionDraft => ({
  type: "urlpattern",
  pattern: "",
  query: [],
  documentTitleFallback: true,
});

export function newDraft(id: string): RuleDraft {
  return { id, name: "", match: [emptyCondition()], selectors: [""], documentTitleStrip: [], label: "{title}", url: "" };
}

// 検証は呼び出し側で行うため、入力をそのままルールの形に詰め替える
export function fromDraft(draft: RuleDraft): Rule {
  return {
    id: draft.id,
    name: draft.name,
    match: draft.match.map((condition): MatchCondition => {
      const fallback = condition.documentTitleFallback ? {} : { documentTitleFallback: false };
      if (condition.type === "regex") return { type: "regex", pattern: condition.pattern, ...fallback };
      const query = Object.fromEntries(condition.query.map(({ variable, param }) => [variable, param]));
      return {
        type: "urlpattern",
        pattern: condition.pattern,
        ...(condition.query.length > 0 ? { query } : {}),
        ...fallback,
      };
    }),
    title: {
      selectors: draft.selectors,
      ...(draft.documentTitleStrip.length > 0 ? { documentTitleStrip: draft.documentTitleStrip } : {}),
    },
    label: draft.label,
    url: draft.url,
  };
}

// 検証を通らない保存値を編集し直すときに、読み取れる部分だけを下書きに残す
export function looseDraft(raw: unknown, id: string): RuleDraft {
  const record = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const texts = (value: unknown) => (Array.isArray(value) ? value.map(text) : []);
  const rule = record(raw);
  const title = record(rule.title);
  const match = Array.isArray(rule.match)
    ? rule.match.map((value): ConditionDraft => {
        const condition = record(value);
        return {
          type: condition.type === "regex" ? "regex" : "urlpattern",
          pattern: text(condition.pattern),
          query: Object.entries(record(condition.query)).map(([variable, param]) => ({ variable, param: text(param) })),
          documentTitleFallback: condition.documentTitleFallback !== false,
        };
      })
    : [];
  return {
    ...newDraft(id),
    name: text(rule.name),
    ...(match.length > 0 ? { match } : {}),
    selectors: texts(title.selectors),
    documentTitleStrip: texts(title.documentTitleStrip),
    label: text(rule.label),
    url: text(rule.url),
  };
}

// fromDraft で query をオブジェクトに詰め替えると重複した変数名が黙って潰れるため、先に検出する
export function draftIssues(draft: RuleDraft): Issue[] {
  return draft.match.flatMap((condition, index) => {
    if (condition.type !== "urlpattern") return [];
    // 保存時に前後の空白を削るため、削ったあとの名前で比べる
    const names = condition.query.map((query) => query.variable.trim());
    const duplicated = [...new Set(names.filter((name, i) => names.indexOf(name) !== i))];
    return duplicated.map((name): Issue => ({ path: `match.${index}.query`, code: "duplicateVariable", value: name }));
  });
}
