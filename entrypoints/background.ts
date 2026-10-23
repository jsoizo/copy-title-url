import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import type { CopyFormat } from "../lib/format";
import {
  COPIER_REQUEST_KEY,
  type CopierRequest,
  type CopierResponse,
  type NotifyResult,
  type PopupRequest,
  type PreparedCopy,
  type Toast,
} from "../lib/messages";
import { planCopy } from "../lib/plan";
import { matchRules } from "../lib/rules/match";
import { activeRules, readStored, resolveEntries } from "../lib/rules/store";

const PARENT_MENU_ID = "copy-title-url";
const OPTIONS_MENU_ID = "open-options";
const FORMAT_BY_MENU_ID: Record<string, CopyFormat> = {
  "copy-plain": "plain",
  "copy-markdown": "markdown",
};

// 依頼内容を copier へ受け渡すグローバル変数が、連続クリックで上書きされないよう 1 件ずつ処理する
let queue: Promise<unknown> = Promise.resolve();
const serialize = (task: () => Promise<unknown>) => {
  queue = queue.then(task, task).catch((error) => console.error(error));
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => serialize(registerMenus));
  // ブラウザの UI 言語の変更をメニュー文言に反映するため
  browser.runtime.onStartup.addListener(() => serialize(registerMenus));

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === OPTIONS_MENU_ID) {
      browser.runtime.openOptionsPage().catch((error) => console.error(error));
      return;
    }
    const format = FORMAT_BY_MENU_ID[String(info.menuItemId)];
    const tabId = tab?.id;
    const pageUrl = info.pageUrl;
    if (!format || tabId === undefined || !pageUrl) return;
    serialize(() => copyPage(tabId, pageUrl, format));
  });

  browser.runtime.onMessage.addListener((message: PopupRequest, sender, sendResponse) => {
    // 拡張自身のページ（ポップアップ）からの依頼だけを受け付ける
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL("/"))) return false;
    return handlePopupMessage(message, sendResponse);
  });
});

async function registerMenus() {
  await browser.contextMenus.removeAll();
  const contexts: ["page", "selection"] = ["page", "selection"];
  const items = [
    { id: PARENT_MENU_ID, title: browser.i18n.getMessage("menuParent") },
    { id: "copy-plain", parentId: PARENT_MENU_ID, title: browser.i18n.getMessage("menuCopyPlain") },
    { id: "copy-markdown", parentId: PARENT_MENU_ID, title: browser.i18n.getMessage("menuCopyMarkdown") },
    { id: "separator", parentId: PARENT_MENU_ID, type: "separator" as const },
    { id: OPTIONS_MENU_ID, parentId: PARENT_MENU_ID, title: browser.i18n.getMessage("menuOpenOptions") },
  ];
  for (const item of items) {
    browser.contextMenus.create({ ...item, contexts }, () => {
      if (browser.runtime.lastError) console.error(browser.runtime.lastError);
    });
  }
}

async function runCopier<T extends CopierRequest>(tabId: number, request: T): Promise<CopierResponse<T["type"]>> {
  const target = { tabId };
  // 注入する関数は文字列化されるため、引数以外を参照しない
  await browser.scripting.executeScript({
    target,
    func: (key: string, value: CopierRequest) => {
      (globalThis as Record<string, unknown>)[key] = value;
    },
    args: [COPIER_REQUEST_KEY, request],
  });
  const [injection] = await browser.scripting.executeScript({ target, files: ["/copier.js"] });
  return injection?.result as CopierResponse<T["type"]>;
}

async function prepareCopy(tabId: number, pageUrl: string, format: CopyFormat): Promise<PreparedCopy> {
  const match = matchRules(activeRules(resolveEntries(await readStored())), pageUrl);
  const extracted = await runCopier(tabId, { type: "extractTitle", selectors: match?.rule.title.selectors ?? [] });
  const plan = planCopy(match, extracted, pageUrl, format);
  if (plan.status === "titleNotFound") {
    return { status: "titleNotFound", toast: errorToast(browser.i18n.getMessage("toastTitleNotFound")) };
  }
  return {
    status: "ready",
    text: plan.text,
    toast:
      plan.status === "fallback"
        ? { kind: "warning", message: browser.i18n.getMessage("toastCopiedWithFallback") }
        : { kind: "success", message: browser.i18n.getMessage("toastCopied") },
    failureMessage: browser.i18n.getMessage("toastCopyFailed"),
  };
}

const errorToast = (message: string): Toast => ({ kind: "error", message });

async function copyPage(tabId: number, pageUrl: string, format: CopyFormat) {
  try {
    const prepared = await prepareCopy(tabId, pageUrl, format);
    if (prepared.status === "ready") {
      const { text, toast, failureMessage } = prepared;
      await runCopier(tabId, { type: "copy", text, toast, failureMessage });
    } else if (prepared.status === "titleNotFound") {
      await runCopier(tabId, { type: "notify", toast: prepared.toast });
    }
  } catch (error) {
    console.error(error);
    // chrome:// などで注入自体が拒否された場合は、ここでも失敗するのでログだけが残る
    await runCopier(tabId, { type: "notify", toast: errorToast(browser.i18n.getMessage("toastFailed")) });
  }
}

function handlePopupMessage(message: PopupRequest, sendResponse: (response: PreparedCopy | NotifyResult) => void): boolean {
  if (message.type === "popup:prepare") {
    serialize(async () => {
      try {
        sendResponse(await prepareCopy(message.tabId, message.pageUrl, message.format));
      } catch (error) {
        console.error(error);
        sendResponse({ status: "failed" });
      }
    });
    return true;
  }
  if (message.type === "popup:notify") {
    serialize(async () => {
      let shown = false;
      try {
        await runCopier(message.tabId, { type: "notify", toast: message.toast });
        shown = true;
      } finally {
        sendResponse({ shown });
      }
    });
    return true;
  }
  return false;
}
