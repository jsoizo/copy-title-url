import type { ExtractedTitle } from "./plan";

export type ToastKind = "success" | "warning" | "error";

export type Toast = {
  kind: ToastKind;
  message: string;
};

export type CopierRequest =
  | { type: "extractTitle"; selectors: string[] }
  | { type: "copy"; text: string; toast: Toast; failureMessage: string }
  | { type: "notify"; toast: Toast };

export type CopierResponse<T extends CopierRequest["type"]> = T extends "extractTitle"
  ? ExtractedTitle
  : T extends "copy"
    ? { copied: boolean }
    : null;

// background が executeScript の func で書き込み、直後に注入した copier が読み出す
export const COPIER_REQUEST_KEY = "__copyTitleUrlRequest";

// ポップアップはフォーカスを持つため、クリップボードへの書き込みだけをポップアップで行う
export type PreparedCopy =
  | { status: "ready"; text: string; toast: Toast; failureMessage: string }
  | { status: "titleNotFound"; toast: Toast }
  | { status: "failed" };

export type PopupRequest =
  | { type: "popup:prepare"; tabId: number; pageUrl: string; format: "plain" | "markdown" }
  | { type: "popup:notify"; tabId: number; toast: Toast };

export type NotifyResult = { shown: boolean };
