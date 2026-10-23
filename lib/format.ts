import { VARIABLE_NAME } from "./rules/variable";

export type CopyFormat = "plain" | "markdown";

const ASCII_SPACES = /[ \t\n\r\f]+/g;
const NON_ASCII_SPACE = /[^ \t\n\r\f]/;

export function normalizeTitle(rawTitle: unknown): string {
  if (typeof rawTitle !== "string") return "";
  return rawTitle.replace(ASCII_SPACES, " ").trim();
}

// 全角スペースと NBSP はタイトルの一部として残すため、ASCII の空白だけを空とみなす
export const isBlank = (text: string): boolean => !NON_ASCII_SPACE.test(text);

// タイトル自体が除去対象と同じ形で始まることがあるため、g フラグを付けず最初の一致だけを削る
export function stripTitle(title: string, patterns: readonly string[]): string {
  return patterns.reduce((current, pattern) => current.replace(new RegExp(pattern, "u"), ""), title);
}

type TemplatePart = { text: string } | { variable: string };

export class TemplateError extends Error {
  // position は 0 始まりの文字位置
  constructor(
    readonly kind: "invalidPlaceholder" | "unmatchedBrace",
    readonly position: number,
  ) {
    super(`${kind} at ${position}`);
  }
}

function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let text = "";
  for (let i = 0; i < template.length; i++) {
    const char = template[i];
    const next = template[i + 1];
    if ((char === "{" && next === "{") || (char === "}" && next === "}")) {
      text += char;
      i++;
    } else if (char === "{") {
      const end = template.indexOf("}", i);
      const name = end === -1 ? "" : template.slice(i + 1, end);
      if (!VARIABLE_NAME.test(name)) throw new TemplateError("invalidPlaceholder", i);
      if (text) parts.push({ text });
      text = "";
      parts.push({ variable: name });
      i = end;
    } else if (char === "}") {
      throw new TemplateError("unmatchedBrace", i);
    } else {
      text += char;
    }
  }
  if (text) parts.push({ text });
  return parts;
}

export function templateVariables(template: string): string[] {
  return parseTemplate(template).flatMap((part) => ("variable" in part ? [part.variable] : []));
}

export function renderTemplate(template: string, variables: Readonly<Record<string, string>>): string {
  return parseTemplate(template)
    .map((part) => {
      if ("text" in part) return part.text;
      const value = variables[part.variable];
      if (value === undefined) throw new Error(`undefined variable: ${part.variable}`);
      return value;
    })
    .join("");
}

export function formatOutput(format: CopyFormat, label: string, url: string): string {
  if (format === "plain") return `${label}\n${url}`;
  const escapedLabel = label.replace(/[\\[\]]/g, "\\$&");
  const escapedUrl = url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
  return `[${escapedLabel}](${escapedUrl})`;
}
