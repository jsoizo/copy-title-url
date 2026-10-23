import { browser } from "wxt/browser";

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export const t = (key: MessageKey, substitutions?: string[]): string => browser.i18n.getMessage(key, substitutions);

export function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}
