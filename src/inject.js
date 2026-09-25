// executeScript が関数を文字列化して注入するため、各関数は外側のスコープを参照しないこと

export function extractTitle() {
  return document.querySelector("h1 .markdown-title")?.textContent ?? null;
}

export async function copyAndNotify({ text, successMessage, errorMessage }) {
  const writeClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // ページにフォーカスが無いと Clipboard API が拒否されるため
      const activeElement = document.activeElement;
      const selection = document.getSelection();
      const ranges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i));
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      activeElement?.focus?.();
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
      return copied;
    }
  };

  const copied = text != null && (await writeClipboard(text));
  const isError = !copied;

  const hostId = "copy-gh-title-url-toast";
  document.getElementById(hostId)?.remove();
  const host = document.createElement("div");
  host.id = hostId;
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
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
      color: #fff;
      background: ${isError ? "#cf222e" : "#1f883d"};
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = isError ? errorMessage : successMessage;
  shadow.append(style, toast);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), isError ? 5000 : 3000);
}
