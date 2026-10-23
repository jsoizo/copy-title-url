import * as v from "valibot";
import { TemplateError, templateVariables } from "../format";
import { conditionVariables, RESERVED_VARIABLES } from "./match";
import { ExportSchema, RuleSchema, type ExportData, type Rule } from "./schema";

export const ISSUE_CODES = [
  "invalidValue",
  "required",
  "atLeastOne",
  "invalidId",
  "invalidVariableName",
  "invalidUrlPattern",
  "invalidRegex",
  "invalidSelector",
  "invalidTemplate",
  "reservedVariable",
  "duplicateVariable",
  "undefinedVariable",
  "titleInUrl",
  "noTitleSource",
  "duplicateRuleId",
  "invalidJson",
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export type Issue = {
  path: string;
  code: IssueCode;
  detail?: string;
};

export type Validated<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export type ValidateOptions = {
  // service worker には DOM が無いため、セレクタはオプション画面でだけ検査する
  isValidSelector?: (selector: string) => boolean;
};

export function validateRule(input: unknown, options: ValidateOptions = {}): Validated<Rule> {
  const parsed = v.safeParse(RuleSchema, input);
  if (!parsed.success) return { ok: false, issues: parsed.issues.map(toIssue) };
  const issues = checkRule(parsed.output, options);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: parsed.output };
}

export function validateExport(input: unknown, options: ValidateOptions = {}): Validated<ExportData> {
  const parsed = v.safeParse(ExportSchema, input);
  if (!parsed.success) return { ok: false, issues: parsed.issues.map(toIssue) };
  const data = parsed.output;
  const issues: Issue[] = [];
  const seen = new Set<string>();
  data.rules.forEach((rule, index) => {
    if (seen.has(rule.id)) issues.push({ path: `rules.${index}.id`, code: "duplicateRuleId", detail: rule.id });
    seen.add(rule.id);
    for (const issue of checkRule(rule, options)) issues.push({ ...issue, path: `rules.${index}.${issue.path}` });
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: data };
}

function checkRule(rule: Rule, { isValidSelector }: ValidateOptions): Issue[] {
  const issues: Issue[] = [];

  const conditionNames = rule.match.map((condition, index) => {
    const path = `match.${index}`;
    const error = compileError(condition.type, condition.pattern);
    if (error !== null) {
      issues.push({ path: `${path}.pattern`, code: condition.type === "urlpattern" ? "invalidUrlPattern" : "invalidRegex", detail: error });
      return null;
    }
    const names = conditionVariables(condition);
    const seen = new Set<string>();
    for (const name of names) {
      if (RESERVED_VARIABLES.includes(name)) {
        issues.push({ path, code: "reservedVariable", detail: name });
      } else if (seen.has(name)) {
        issues.push({ path, code: "duplicateVariable", detail: name });
      }
      seen.add(name);
    }
    if (rule.title.selectors.length === 0 && condition.documentTitleFallback === false) {
      issues.push({ path: `${path}.documentTitleFallback`, code: "noTitleSource" });
    }
    return seen;
  });

  rule.title.selectors.forEach((selector, index) => {
    if (isValidSelector && !isValidSelector(selector)) {
      issues.push({ path: `title.selectors.${index}`, code: "invalidSelector", detail: selector });
    }
  });
  rule.title.documentTitleStrip?.forEach((pattern, index) => {
    const error = compileError("regex", pattern);
    if (error !== null) issues.push({ path: `title.documentTitleStrip.${index}`, code: "invalidRegex", detail: error });
  });

  for (const field of ["label", "url"] as const) {
    let used: string[];
    try {
      used = templateVariables(rule[field]);
    } catch (error) {
      issues.push({ path: field, code: "invalidTemplate", detail: (error as TemplateError).message });
      continue;
    }
    for (const name of new Set(used)) {
      if (name === "title") {
        if (field === "url") issues.push({ path: field, code: "titleInUrl" });
        continue;
      }
      if (RESERVED_VARIABLES.includes(name)) continue;
      // どの条件で一致しても値が揃うよう、すべての条件で取り出す変数だけを使える
      // パターンが壊れている条件は変数を正しく数えられないため、ここでは照合しない
      if (conditionNames.some((names) => names !== null && !names.has(name))) {
        issues.push({ path: field, code: "undefinedVariable", detail: name });
      }
    }
  }

  return issues;
}

function compileError(type: "urlpattern" | "regex", pattern: string): string | null {
  try {
    if (type === "urlpattern") new URLPattern(pattern);
    else new RegExp(pattern, "u");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function toIssue(issue: v.BaseIssue<unknown>): Issue {
  const path = v.getDotPath(issue) ?? "";
  const lastKey = path.split(".").at(-1) ?? "";
  if (issue.type === "min_length") {
    return { path, code: Array.isArray(issue.input) ? "atLeastOne" : "required" };
  }
  if (issue.type === "regex") {
    return { path, code: lastKey === "id" || /^(order|disabled)\.\d+$/.test(path) ? "invalidId" : "invalidVariableName" };
  }
  return { path, code: "invalidValue", detail: issue.message };
}
