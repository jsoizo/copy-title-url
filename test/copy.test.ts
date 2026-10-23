import { beforeEach, describe, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { callCopier, prepareCopy } from "../lib/copy";
import { COPIER_API_KEY, type CopierApi, type ExtractedTitle } from "../lib/messages";

const TAB_ID = 1;

// files で copier を注入すると API が定義され、func はその API を引数付きで呼ぶ、という流れを再現する
function fakeCopier(title: ExtractedTitle) {
  const api = {
    extractTitle: vi.fn<CopierApi["extractTitle"]>(() => title),
    copy: vi.fn<CopierApi["copy"]>(async () => true),
    notify: vi.fn<CopierApi["notify"]>(),
  };
  vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation((async (details: {
    files?: string[];
    func?: (...args: unknown[]) => unknown;
    args?: unknown[];
  }) => {
    if (details.files) {
      (globalThis as Record<string, unknown>)[COPIER_API_KEY] = api;
      return [];
    }
    return [{ frameId: 0, result: await details.func!(...(details.args ?? [])) }];
  }) as never);
  return api;
}

beforeEach(() => {
  vi.restoreAllMocks();
  fakeBrowser.reset();
  delete (globalThis as Record<string, unknown>)[COPIER_API_KEY];
});

describe("callCopier", () => {
  test("注入した copier の API を、引数を渡して呼び、結果を返す", async () => {
    const api = fakeCopier({ element: null, document: "" });
    await expect(callCopier(TAB_ID, "copy", "text", { kind: "success", messageKey: "toastCopied" })).resolves.toBe(true);
    expect(api.copy).toHaveBeenCalledWith("text", { kind: "success", messageKey: "toastCopied" });
  });

  test("注入の結果が無ければ失敗として扱う", async () => {
    vi.spyOn(fakeBrowser.scripting, "executeScript").mockResolvedValue([] as never);
    await expect(callCopier(TAB_ID, "notify", { kind: "error", messageKey: "toastFailed" })).rejects.toThrow();
  });
});

describe("prepareCopy", () => {
  const pr = "https://github.com/cli/cli/pull/9000/files";

  test("ルールのセレクタでタイトルを取り、成功のトーストを付ける", async () => {
    const api = fakeCopier({ element: "Fix it", document: "" });
    await expect(prepareCopy(TAB_ID, pr, "markdown")).resolves.toEqual({
      status: "ready",
      text: "[Fix it #9000](https://github.com/cli/cli/pull/9000)",
      toast: { kind: "success", messageKey: "toastCopied" },
    });
    expect(api.extractTitle).toHaveBeenCalledWith(["h1 .markdown-title"]);
  });

  test("ページのタイトルで代用したときは警告のトーストを付ける", async () => {
    fakeCopier({ element: null, document: "Fix it · Issue #9 · cli/cli · GitHub" });
    await expect(prepareCopy(TAB_ID, "https://github.com/cli/cli/issues/9", "plain")).resolves.toMatchObject({
      status: "ready",
      toast: { kind: "warning", messageKey: "toastCopiedWithFallback" },
    });
  });

  test("タイトルを取れなければエラーのトーストを返す", async () => {
    fakeCopier({ element: null, document: "" });
    await expect(prepareCopy(TAB_ID, "https://example.com/", "plain")).resolves.toEqual({
      status: "titleNotFound",
      toast: { kind: "error", messageKey: "toastTitleNotFound" },
    });
  });

  test("無効にしたルールは使わず、汎用コピーになる", async () => {
    await fakeBrowser.storage.sync.set({ settings: { version: 1, order: [], disabled: ["github"] } });
    const api = fakeCopier({ element: "Fix it", document: "Page title" });
    await expect(prepareCopy(TAB_ID, pr, "plain")).resolves.toMatchObject({ text: `Page title\n${pr}` });
    expect(api.extractTitle).toHaveBeenCalledWith([]);
  });
});
