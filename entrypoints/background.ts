import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { callCopier, prepareCopy } from "../lib/copy";
import type { CopyFormat } from "../lib/format";
import { t } from "../lib/i18n";
import { TOAST_FAILED } from "../lib/messages";

const PARENT_MENU_ID = "copy-title-url";
const OPTIONS_MENU_ID = "open-options";
const FORMAT_MENUS = [
  { id: "copy-plain", format: "plain", title: "menuCopyPlain" },
  { id: "copy-markdown", format: "markdown", title: "menuCopyMarkdown" },
] as const;

// 素早く続けて実行したとき、後の実行の結果が最後に残るよう 1 件ずつ処理する
let queue: Promise<unknown> = Promise.resolve();
const serialize = (task: () => Promise<unknown>) => {
  queue = queue.then(task).catch((error) => console.error(error));
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
    const format = FORMAT_MENUS.find((menu) => menu.id === info.menuItemId)?.format;
    const tabId = tab?.id;
    const pageUrl = info.pageUrl;
    if (!format || tabId === undefined || !pageUrl) return;
    serialize(() => copyPage(tabId, pageUrl, format));
  });
});

async function registerMenus() {
  await browser.contextMenus.removeAll();
  const contexts: ["page", "selection"] = ["page", "selection"];
  const items = [
    { id: PARENT_MENU_ID, title: t("menuParent") },
    ...FORMAT_MENUS.map(({ id, title }) => ({ id, parentId: PARENT_MENU_ID, title: t(title) })),
    { id: "separator", parentId: PARENT_MENU_ID, type: "separator" as const },
    { id: OPTIONS_MENU_ID, parentId: PARENT_MENU_ID, title: t("menuOpenOptions") },
  ];
  for (const item of items) {
    browser.contextMenus.create({ ...item, contexts }, () => {
      if (browser.runtime.lastError) console.error(browser.runtime.lastError);
    });
  }
}

async function copyPage(tabId: number, pageUrl: string, format: CopyFormat) {
  try {
    const prepared = await prepareCopy(tabId, pageUrl, format);
    if (prepared.status === "ready") await callCopier(tabId, "copy", prepared.text, prepared.toast);
    else await callCopier(tabId, "notify", prepared.toast);
  } catch (error) {
    console.error(error);
    // chrome:// などで注入自体が拒否された場合はトーストも出せず、上の記録だけが残る
    await callCopier(tabId, "notify", TOAST_FAILED).catch(() => {});
  }
}
