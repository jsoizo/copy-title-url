import { browser } from "wxt/browser";
import type { ExtractedTitle, Toast } from "./messages";

const TOAST_HOST_ID = "copy-title-url-toast";

export function extractTitle(selectors: readonly string[]): ExtractedTitle {
  let element: string | null = null;
  for (const selector of selectors) {
    let text: string | null | undefined;
    try {
      text = document.querySelector(selector)?.textContent;
    } catch {
      continue;
    }
    // normalizeTitle と同じく、ASCII の空白だけの要素は空とみなす
    if (text && /[^ \t\n\r\f]/.test(text)) {
      element = text;
      break;
    }
  }
  return { element, document: document.title };
}

export async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // ページにフォーカスが無いと Clipboard API が拒否されるため
    const activeElement = document.activeElement as HTMLElement | null;
    const selection = document.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i)) : [];
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    activeElement?.focus?.();
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    return copied;
  }
}

const TOAST_COLORS: Record<Toast["kind"], { background: string; color: string }> = {
  success: { background: "#1f883d", color: "#fff" },
  warning: { background: "#d4a72c", color: "#1f2328" },
  error: { background: "#cf222e", color: "#fff" },
};

export function showToast({ kind, messageKey }: Toast): void {
  document.getElementById(TOAST_HOST_ID)?.remove();
  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  const { background, color } = TOAST_COLORS[kind];
  style.textContent = `
    :host { all: initial; }
    .toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      max-width: calc(100vw - 48px);
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      color: ${color};
      background: ${background};
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = browser.i18n.getMessage(messageKey);
  shadow.append(style, toast);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), kind === "success" ? 3000 : 5000);
}
