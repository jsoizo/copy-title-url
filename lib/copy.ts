import { browser } from "wxt/browser";
import type { CopyFormat } from "./format";
import { COPIER_API_KEY, type CopierApi, TOAST_TITLE_NOT_FOUND, type Toast } from "./messages";
import { planCopy } from "./plan";
import { matchRules } from "./rules/match";
import { activeRules, readStored, resolveEntries } from "./rules/store";

export async function callCopier<M extends keyof CopierApi>(
  tabId: number,
  method: M,
  ...args: Parameters<CopierApi[M]>
): Promise<Awaited<ReturnType<CopierApi[M]>>> {
  const target = { tabId };
  await browser.scripting.executeScript({ target, files: ["/copier.js"] });
  const [injection] = await browser.scripting.executeScript({
    target,
    // 注入する関数は文字列化されるため、引数と globalThis 以外を参照しない
    func: (key: string, name: string, values: unknown[]) =>
      (globalThis as unknown as Record<string, Record<string, (...values: unknown[]) => unknown>>)[key]![name]!(...values),
    args: [COPIER_API_KEY, method, args],
  });
  if (!injection) throw new Error(`copier returned no result for ${method}`);
  return injection.result as Awaited<ReturnType<CopierApi[M]>>;
}

export type PreparedCopy = { status: "ready"; text: string; toast: Toast } | { status: "titleNotFound"; toast: Toast };

export async function prepareCopy(tabId: number, pageUrl: string, format: CopyFormat): Promise<PreparedCopy> {
  const match = matchRules(activeRules(resolveEntries(await readStored())), pageUrl);
  const extracted = await callCopier(tabId, "extractTitle", match?.rule.title.selectors ?? []);
  if (!extracted) throw new Error("copier returned no title");
  const plan = planCopy(match, extracted, pageUrl, format);
  if (plan.status === "titleNotFound") return { status: "titleNotFound", toast: TOAST_TITLE_NOT_FOUND };
  return {
    status: "ready",
    text: plan.text,
    toast:
      plan.status === "fallback"
        ? { kind: "warning", messageKey: "toastCopiedWithFallback" }
        : { kind: "success", messageKey: "toastCopied" },
  };
}
