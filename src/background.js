import { formatOutput, normalizeTitle, parseItemUrl } from "./github.js";
import { copyAndNotify, extractTitle } from "./inject.js";

const MENU_ID = "copy-title-url";

function registerMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: chrome.i18n.getMessage("menuTitle"),
        contexts: ["page", "selection"],
        documentUrlPatterns: [
          "https://github.com/*/*/issues/*",
          "https://github.com/*/*/pull/*",
          "https://github.com/*/*/discussions/*",
        ],
      },
      () => {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      },
    );
  });
}

chrome.runtime.onInstalled.addListener(registerMenu);
// ブラウザの UI 言語の変更をメニュー文言に反映するため
chrome.runtime.onStartup.addListener(registerMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
  copyItem(tab.id, info.pageUrl).catch((error) => console.error(error));
});

async function copyItem(tabId, pageUrl) {
  const target = { tabId };
  const notify = (options) =>
    chrome.scripting.executeScript({ target, func: copyAndNotify, args: [options] });

  const item = parseItemUrl(pageUrl);
  if (!item) {
    await notify({ text: null, errorMessage: chrome.i18n.getMessage("toastUnsupportedPage") });
    return;
  }

  const [{ result: rawTitle }] = await chrome.scripting.executeScript({ target, func: extractTitle });
  const title = normalizeTitle(rawTitle);
  if (!title) {
    await notify({ text: null, errorMessage: chrome.i18n.getMessage("toastTitleNotFound") });
    return;
  }

  await notify({
    text: formatOutput(title, item),
    successMessage: chrome.i18n.getMessage("toastCopied"),
    errorMessage: chrome.i18n.getMessage("toastCopyFailed"),
  });
}
