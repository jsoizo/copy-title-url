import { render } from "preact";
import { useState } from "preact/hooks";
import { browser } from "wxt/browser";
import type { CopyFormat } from "../../lib/format";
import type { NotifyResult, PopupRequest, PreparedCopy, Toast } from "../../lib/messages";
import { writeClipboard } from "../../lib/page";

const t = (key: Parameters<typeof browser.i18n.getMessage>[0]) => browser.i18n.getMessage(key);
const sendToBackground = (message: PopupRequest): Promise<unknown> => browser.runtime.sendMessage(message);

function Popup() {
  const [message, setMessage] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = async (format: CopyFormat) => {
    setBusy(true);
    setMessage(null);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      const pageUrl = tab?.url;
      if (tabId === undefined || !pageUrl) throw new Error("no active tab");
      const prepared = (await sendToBackground({ type: "popup:prepare", tabId, pageUrl, format })) as PreparedCopy;
      if (prepared.status === "failed") throw new Error("prepare failed");

      let toast = prepared.toast;
      if (prepared.status === "ready" && !(await writeClipboard(prepared.text).catch(() => false))) {
        toast = { kind: "error", message: prepared.failureMessage };
      }
      const { shown } = (await sendToBackground({ type: "popup:notify", tabId, toast })) as NotifyResult;
      // ページにトーストを出せなかった場合は、結果が伝わるようポップアップに残す
      if (shown) window.close();
      else setMessage(toast);
    } catch (error) {
      // 注入できないページ（chrome:// など）や background との通信の失敗
      console.error(error);
      setMessage({ kind: "error", message: t("toastFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <button type="button" autofocus disabled={busy} onClick={() => copy("plain")}>
        {t("menuCopyPlain")}
      </button>
      <button type="button" disabled={busy} onClick={() => copy("markdown")}>
        {t("menuCopyMarkdown")}
      </button>
      <hr />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          browser.runtime.openOptionsPage();
          window.close();
        }}
      >
        {t("menuOpenOptions")}
      </button>
      {message && (
        <p class={`message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.message}
        </p>
      )}
    </main>
  );
}

document.documentElement.lang = browser.i18n.getUILanguage();
render(<Popup />, document.getElementById("app")!);
