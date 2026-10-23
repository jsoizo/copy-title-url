import { afterEach, expect, test, vi } from "vitest";
import { extractTitle, writeClipboard } from "../lib/page";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("extractTitle は空白だけの要素と不正なセレクタを飛ばし、次のセレクタを試す", () => {
  const elements: Record<string, { textContent: string }> = {
    ".empty": { textContent: "  \n" },
    ".fullwidth": { textContent: "\u3000" },
    h1: { textContent: " Title " },
  };
  const querySelector = (selector: string) => {
    if (selector === "a[=") throw new SyntaxError("invalid selector");
    return elements[selector] ?? null;
  };
  vi.stubGlobal("document", { title: "Doc", querySelector });
  expect(extractTitle(["a[=", ".missing", ".empty", "h1"])).toEqual({ element: " Title ", document: "Doc" });
  expect(extractTitle([".fullwidth", "h1"])).toEqual({ element: "\u3000", document: "Doc" });
  expect(extractTitle([".missing"])).toEqual({ element: null, document: "Doc" });
});

test("writeClipboard は Clipboard API が拒否されたら execCommand で再試行し、フォーカスを戻す", async () => {
  const focus = vi.fn();
  const execCommand = vi.fn(() => true);
  vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
  vi.stubGlobal("document", {
    activeElement: { focus },
    getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} }),
    createElement: () => ({ style: {}, select() {}, remove() {} }),
    body: { append() {} },
    execCommand,
  });
  await expect(writeClipboard("text")).resolves.toBe(true);
  expect(execCommand).toHaveBeenCalledWith("copy");
  expect(focus).toHaveBeenCalled();
});
