import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { COPIER_REQUEST_KEY, type CopierRequest, type CopierResponse } from "../lib/messages";
import { extractTitle, showToast, writeClipboard } from "../lib/page";

export default defineUnlistedScript(async (): Promise<CopierResponse<CopierRequest["type"]>> => {
  const state = globalThis as { [COPIER_REQUEST_KEY]?: CopierRequest };
  const request = state[COPIER_REQUEST_KEY];
  delete state[COPIER_REQUEST_KEY];

  switch (request?.type) {
    case "extractTitle":
      return extractTitle(request.selectors);
    case "copy": {
      const copied = await writeClipboard(request.text).catch(() => false);
      showToast(copied ? request.toast : { kind: "error", message: request.failureMessage });
      return { copied };
    }
    case "notify":
      showToast(request.toast);
      return null;
    default:
      return null;
  }
});
