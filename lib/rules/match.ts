import { templateVariables } from "../format";
import type { MatchCondition, Rule } from "./schema";
import { VARIABLE_NAME, VARIABLE_NAME_PREFIX } from "./variable";

export type MatchResult = {
  rule: Rule;
  condition: MatchCondition;
  variables: Record<string, string>;
};

const URL_COMPONENTS = ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"] as const;

export function matchRules(rules: readonly Rule[], rawUrl: string): MatchResult | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const rule of rules) {
    const required = requiredVariables(rule);
    for (const condition of rule.match) {
      const captured = matchCondition(condition, url);
      // 省略可能なグループなどで値が欠けると表示名や URL を組み立てられないため、一致しなかったものとして扱う
      if (captured && required.every((name) => captured[name] !== undefined)) {
        return { rule, condition, variables: { ...captured, host: url.host, origin: url.origin } };
      }
    }
  }
  return null;
}

export const RESERVED_VARIABLES: readonly string[] = ["title", "host", "origin"];

function requiredVariables(rule: Rule): string[] {
  try {
    return [...templateVariables(rule.label), ...templateVariables(rule.url)].filter((name) => !RESERVED_VARIABLES.includes(name));
  } catch {
    return [];
  }
}

function matchCondition(condition: MatchCondition, url: URL): Record<string, string> | null {
  try {
    return condition.type === "urlpattern" ? matchUrlPattern(condition, url) : matchRegex(condition.pattern, url);
  } catch {
    return null;
  }
}

function matchUrlPattern(condition: Extract<MatchCondition, { type: "urlpattern" }>, url: URL): Record<string, string> | null {
  // パターン文字列ではクエリの一部だけを条件にしにくいため、クエリとハッシュは照合から外して query で扱う
  const result = new URLPattern(condition.pattern).exec(url.origin + url.pathname);
  if (!result) return null;

  const captured: Record<string, string> = {};
  for (const component of URL_COMPONENTS) {
    for (const [name, value] of Object.entries(result[component].groups)) {
      // 名前の無いワイルドカードは "0" などの数字のグループ名になるため除く
      if (VARIABLE_NAME.test(name) && value !== undefined) captured[name] = value;
    }
  }
  for (const [name, param] of Object.entries(condition.query ?? {})) {
    const value = url.searchParams.get(param);
    if (!value) return null;
    captured[name] = value;
  }
  return captured;
}

function matchRegex(pattern: string, url: URL): Record<string, string> | null {
  const result = new RegExp(pattern, "u").exec(url.href);
  if (!result) return null;
  return Object.fromEntries(Object.entries(result.groups ?? {}).filter(([, value]) => value !== undefined)) as Record<
    string,
    string
  >;
}

export function conditionVariables(condition: MatchCondition): string[] {
  const names =
    condition.type === "urlpattern" ? urlPatternGroupNames(condition.pattern) : regexGroupNames(condition.pattern);
  return condition.type === "urlpattern" ? [...names, ...Object.keys(condition.query ?? {})] : names;
}

function urlPatternGroupNames(pattern: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") {
      i++;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (char === ":" && depth === 0) {
      const name = VARIABLE_NAME_PREFIX.exec(pattern.slice(i + 1))?.[0];
      if (name) {
        names.push(name);
        i += name.length;
      }
    }
  }
  return names;
}

function regexGroupNames(pattern: string): string[] {
  let names: string[];
  try {
    // 空文字列に必ず一致させ、すべての名前付きグループを groups のキーとして得る
    names = Object.keys(new RegExp(`(?:${pattern})|`, "u").exec("")?.groups ?? {});
  } catch {
    return [];
  }
  // | の左右に書いた同じ名前のグループは groups では 1 つにまとまるため、書いた回数だけ数えて重複を検出できるようにする
  return names.flatMap((name) => Array<string>(Math.max(1, pattern.split(`(?<${name}>`).length - 1)).fill(name));
}
