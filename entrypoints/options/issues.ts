import type { Issue } from "../../lib/rules/validate";
import type { MessageKey } from "../../lib/i18n";

export type Translate = (key: MessageKey, substitutions?: string[]) => string;

export function issueMessage(issue: Issue, t: Translate): string {
  return t(`issue_${issue.code}`, issue.value === undefined ? undefined : [issue.value]);
}

// 未知の項目はその項目自体に名前が無いので、親の場所で示す
export function issueLocation(issue: Issue, t: Translate, ruleNames: readonly string[] = []): string | null {
  const segments = issue.path === "" ? [] : issue.path.split(".");
  if (issue.code === "unknownKey") segments.pop();
  if (segments.length === 0) return null;

  const [head, index, ...rest] = segments;
  if (head === "rules" && index !== undefined && /^\d+$/.test(index)) {
    const number = String(Number(index) + 1);
    const name = ruleNames[Number(index)];
    const rule = name ? t("loc_rule", [number, name]) : t("loc_ruleWithoutName", [number]);
    if (rest.length === 0) return rule;
    return t("loc_inRule", [rule, ruleFieldLocation(rest, t) ?? rest.join(".")]);
  }
  return topLevelLocation(segments, t) ?? ruleFieldLocation(segments, t) ?? segments.join(".");
}

function topLevelLocation([head]: string[], t: Translate): string | null {
  if (head === "version") return t("loc_version");
  if (head === "order") return t("loc_order");
  if (head === "disabled") return t("loc_disabled");
  if (head === "rules") return t("loc_rules");
  return null;
}

function ruleFieldLocation([head, second, third]: string[], t: Translate): string | null {
  const number = (value: string | undefined) => (value !== undefined && /^\d+$/.test(value) ? String(Number(value) + 1) : null);
  switch (head) {
    case "id":
      return t("loc_id");
    case "name":
      return t("fieldName");
    case "label":
      return t("fieldLabel");
    case "url":
      return t("fieldUrl");
    case "match": {
      const condition = number(second);
      if (second === undefined) return t("fieldMatch");
      if (condition === null) return null;
      if (third === undefined) return t("loc_condition", [condition]);
      if (third === "type") return t("loc_conditionType", [condition]);
      if (third === "pattern") return t("loc_conditionPattern", [condition]);
      if (third === "query") return t("loc_conditionQuery", [condition]);
      if (third === "documentTitleFallback") return t("loc_conditionFallback", [condition]);
      return null;
    }
    case "title": {
      if (second === undefined) return t("loc_title");
      const item = number(third);
      if (second === "selectors") return item === null ? t("fieldSelectors") : t("loc_selector", [item]);
      if (second === "documentTitleStrip") return item === null ? t("fieldStrip") : t("loc_strip", [item]);
      return null;
    }
    default:
      return null;
  }
}

// フォームでエラーを表示する入力欄のキー。クエリの各行の誤りは、クエリの欄にまとめて出す
export function fieldKey(path: string): string {
  const query = /^(match\.\d+\.query)(?:\.|$)/.exec(path);
  return query?.[1] ?? path;
}
