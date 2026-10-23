import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { COPIER_API_KEY, type CopierApi, toastAfterCopy } from "../lib/messages";
import { extractTitle, showToast, writeClipboard } from "../lib/page";

export default defineUnlistedScript(() => {
  const api: CopierApi = {
    extractTitle,
    async copy(text, toast) {
      const copied = await writeClipboard(text).catch(() => false);
      showToast(toastAfterCopy(toast, copied));
      return copied;
    },
    notify: showToast,
  };
  (globalThis as Record<string, unknown>)[COPIER_API_KEY] = api;
});
