import { browser } from "wxt/browser";
import type { Issue } from "../../lib/rules/validate";

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export const t = (key: MessageKey): string => browser.i18n.getMessage(key);

export function issueMessage(issue: Issue): string {
  const message = t(`issue_${issue.code}` as MessageKey);
  return issue.detail ? `${message}: ${issue.detail}` : message;
}

export function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}
