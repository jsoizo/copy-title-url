import type { MessageKey } from "./i18n";

export type Toast = {
  kind: "success" | "warning" | "error";
  // 文言はトーストを表示する側で解決する
  messageKey: MessageKey;
};

export const TOAST_TITLE_NOT_FOUND: Toast = { kind: "error", messageKey: "toastTitleNotFound" };
export const TOAST_COPY_FAILED: Toast = { kind: "error", messageKey: "toastCopyFailed" };
export const TOAST_FAILED: Toast = { kind: "error", messageKey: "toastFailed" };

export const toastAfterCopy = (toast: Toast, copied: boolean): Toast => (copied ? toast : TOAST_COPY_FAILED);

export type ExtractedTitle = {
  element: string | null;
  document: string;
};

// copier がページの isolated world に定義する API。引数と戻り値は executeScript で受け渡せる値に限る
export type CopierApi = {
  extractTitle(selectors: string[]): ExtractedTitle;
  copy(text: string, toast: Toast): Promise<boolean>;
  notify(toast: Toast): void;
};

export const COPIER_API_KEY = "__copyTitleUrl";
