import { type CopyFormat, formatOutput, normalizeTitle, renderTemplate, stripTitle } from "./format";
import type { MatchResult } from "./rules/match";

export type ExtractedTitle = {
  element: string | null;
  document: string;
};

export type CopyPlan = { status: "ok" | "fallback"; text: string } | { status: "titleNotFound" };

export function planCopy(
  match: MatchResult | null,
  extracted: ExtractedTitle,
  pageUrl: string,
  format: CopyFormat,
): CopyPlan {
  if (!match) {
    const title = normalizeTitle(extracted.document);
    return title ? { status: "ok", text: formatOutput(format, title, pageUrl) } : { status: "titleNotFound" };
  }

  const { rule, condition, variables } = match;
  const fromDocument = () => normalizeTitle(stripTitle(extracted.document, rule.title.documentTitleStrip ?? []));

  let title: string;
  let status: "ok" | "fallback" = "ok";
  if (rule.title.selectors.length === 0) {
    title = fromDocument();
  } else {
    title = normalizeTitle(extracted.element);
    if (!title && condition.documentTitleFallback !== false) {
      title = fromDocument();
      status = "fallback";
    }
  }
  if (!title) return { status: "titleNotFound" };

  const label = renderTemplate(rule.label, { ...variables, title });
  const url = renderTemplate(rule.url, variables);
  return { status, text: formatOutput(format, label, url) };
}
