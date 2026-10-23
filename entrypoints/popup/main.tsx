import { render } from "preact";
import { useState } from "preact/hooks";
import { browser } from "wxt/browser";
import { callCopier, prepareCopy } from "../../lib/copy";
import type { CopyFormat } from "../../lib/format";
import { setDocumentLanguage, t } from "../../lib/i18n";
import { TOAST_FAILED, type Toast, toastAfterCopy } from "../../lib/messages";
import { writeClipboard } from "../../lib/page";

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
      const prepared = await prepareCopy(tabId, pageUrl, format);
      // ポップアップを開いている間はページにフォーカスが無いため、クリップボードにはポップアップから書き込む
      const toast =
        prepared.status === "ready"
          ? toastAfterCopy(prepared.toast, await writeClipboard(prepared.text).catch(() => false))
          : prepared.toast;
      const shown = await callCopier(tabId, "notify", toast).then(
        () => true,
        () => false,
      );
      // ページにトーストを出せなかった場合は、結果が伝わるようポップアップに残す
      if (shown) window.close();
      else setMessage(toast);
    } catch (error) {
      // 注入できないページ（chrome:// など）
      console.error(error);
      setMessage(TOAST_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const openOptions = async () => {
    try {
      await browser.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      console.error(error);
      setMessage(TOAST_FAILED);
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
      <button type="button" disabled={busy} onClick={openOptions}>
        {t("menuOpenOptions")}
      </button>
      {message && (
        <p class={`message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {t(message.messageKey)}
        </p>
      )}
    </main>
  );
}

setDocumentLanguage();
render(<Popup />, document.getElementById("app")!);
