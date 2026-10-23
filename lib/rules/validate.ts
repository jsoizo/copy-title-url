import * as v from "valibot";
import { TemplateError, templateVariables } from "../format";
import { conditionVariables, RESERVED_VARIABLES } from "./match";
import { ExportSchema, RuleSchema, type ExportData, type Rule } from "./schema";

export const ISSUE_CODES = [
  "invalidValue",
  "invalidType",
  "unknownKey",
  "invalidConditionType",
  "unsupportedVersion",
  "required",
  "atLeastOne",
  "invalidId",
  "invalidVariableName",
  "invalidUrlPattern",
  "invalidRegex",
  "invalidSelector",
  "templateInvalidPlaceholder",
  "templateUnmatchedBrace",
  "reservedVariable",
  "duplicateVariable",
  "undefinedVariable",
  "titleInUrl",
  "noTitleSource",
  "duplicateRuleId",
  "idMismatch",
  "invalidJson",
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export type Issue = {
  path: string;
  code: IssueCode;
  // 文言に差し込む、利用者が入力した値
  value?: string;
  // ブラウザやライブラリが返した英語の説明。翻訳せず「詳細」として添える
  detail?: string;
};

export type Validated<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

type ValidateOptions = {
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
    if (seen.has(rule.id)) issues.push({ path: `rules.${index}.id`, code: "duplicateRuleId", value: rule.id });
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
        issues.push({ path, code: "reservedVariable", value: name });
      } else if (seen.has(name)) {
        issues.push({ path, code: "duplicateVariable", value: name });
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
      issues.push({ path: `title.selectors.${index}`, code: "invalidSelector" });
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
      if (!(error instanceof TemplateError)) throw error;
      const code = error.kind === "unmatchedBrace" ? "templateUnmatchedBrace" : "templateInvalidPlaceholder";
      issues.push({ path: field, code, value: String(error.position + 1) });
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
        issues.push({ path: field, code: "undefinedVariable", value: name });
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

const isIssueCode = (value: unknown): value is IssueCode => ISSUE_CODES.includes(value as IssueCode);

function toIssue(issue: v.BaseIssue<unknown>): Issue {
  const path = v.getDotPath(issue) ?? "";
  if (isIssueCode(issue.message)) return { path, code: issue.message };
  if (issue.type === "strict_object") return { path, code: "unknownKey", value: String(issue.input) };
  if (issue.type === "variant") return { path, code: "invalidConditionType", value: String(issue.input) };
  if (issue.type === "literal") return { path, code: "unsupportedVersion", value: String(issue.input) };
  if (issue.kind === "schema" && issue.input === undefined) return { path, code: "required" };
  if (issue.kind === "schema") return { path, code: "invalidType", detail: `Expected ${issue.expected}, received ${issue.received}` };
  return { path, code: "invalidValue", detail: issue.message };
}
