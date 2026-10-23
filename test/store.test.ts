import { beforeEach, describe, expect, test, vi } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { BUILTIN_RULES } from "../lib/rules/builtin";
import type { Rule } from "../lib/rules/schema";
import {
  activeRules,
  buildExport,
  deleteRule,
  QuotaError,
  readStored,
  replaceAll,
  resolveEntries,
  saveRule,
  setEnabled,
  setOrder,
} from "../lib/rules/store";

const userRule: Rule = {
  id: "user-1",
  name: "Example",
  match: [{ type: "urlpattern", pattern: "https://example.com/items/:id" }],
  title: { selectors: ["h1"] },
  label: "{title}",
  url: "https://example.com/items/{id}",
};

const builtinIds = BUILTIN_RULES.map((rule) => rule.id);
const builtin = (id: string) => BUILTIN_RULES.find((rule) => rule.id === id)!;
const entries = async () => resolveEntries(await readStored());
const summary = async () => (await entries()).map(({ id, kind, enabled }) => ({ id, kind, enabled }));

beforeEach(() => {
  vi.restoreAllMocks();
  fakeBrowser.reset();
});

describe("有効なルール一覧", () => {
  test("設定が空なら組み込みだけを定義順に返す", async () => {
    expect(activeRules(await entries())).toEqual(BUILTIN_RULES);
  });

  test("order に無いルールは末尾に足し、存在しない ID は無視する", async () => {
    await browser.storage.sync.set({
      settings: { version: 1, order: ["missing", "user-1", "jira"], disabled: [] },
      "rule:user-1": userRule,
    });
    expect((await entries()).map((entry) => entry.id)).toEqual(["user-1", "jira", "github"]);
  });

  test("検証を通らない保存値は評価から外し、一覧にはエラー付きで残す", async () => {
    await browser.storage.sync.set({ "rule:user-1": { ...userRule, match: [] } });
    const entry = (await entries()).find((e) => e.id === "user-1");
    expect(entry).toMatchObject({ kind: "user", rule: null, issues: [{ path: "match", code: "atLeastOne" }] });
    expect(activeRules(await entries())).toEqual(BUILTIN_RULES);
  });

  test("保存先のキーと中の id が違う保存値は、検証を通らないものとして扱う", async () => {
    await browser.storage.sync.set({ "rule:user-1": { ...userRule, id: "user-2" } });
    const entry = (await entries()).find((e) => e.id === "user-1");
    expect(entry).toMatchObject({ kind: "user", rule: null, issues: [{ path: "id", code: "idMismatch", value: "user-1" }] });
    expect(activeRules(await entries())).toEqual(BUILTIN_RULES);
  });
});

describe("編集と組み込みへの復帰", () => {
  test("編集した組み込みは保存値を使い、戻すと最新の組み込み定義に従う", async () => {
    const edited = { ...builtin("github"), label: "{title}" };
    await saveRule(edited);
    expect((await entries())[0]).toMatchObject({ id: "github", kind: "edited", rule: edited });

    await deleteRule("github");
    expect((await entries())[0]).toMatchObject({ id: "github", kind: "builtin", rule: builtin("github") });
  });

  test("ユーザー定義を削除すると、並び順と無効化の一覧からも消える", async () => {
    await saveRule(userRule);
    await setEnabled("user-1", false);
    await deleteRule("user-1");
    expect(await browser.storage.sync.get(null)).toEqual({ settings: { version: 1, order: builtinIds, disabled: [] } });
  });
});

describe("組み込みの廃止", () => {
  test("拡張の更新で廃止された組み込みも、編集して保存してあればユーザー定義として残る", async () => {
    await saveRule({ ...builtin("jira"), name: "My Jira" });
    const remaining = BUILTIN_RULES.filter((rule) => rule.id !== "jira");
    const entry = resolveEntries(await readStored(), remaining).find((e) => e.id === "jira");
    expect(entry).toMatchObject({ kind: "user", enabled: true, rule: { name: "My Jira" } });
  });
});

describe("並べ替えと有効・無効", () => {
  test("未編集の組み込みも無効にでき、評価から外れる", async () => {
    await setEnabled("jira", false);
    expect(await summary()).toEqual([
      { id: "github", kind: "builtin", enabled: true },
      { id: "jira", kind: "builtin", enabled: false },
    ]);
    expect(activeRules(await entries()).map((rule) => rule.id)).toEqual(["github"]);
  });

  test("渡した並びをそのまま保存する", async () => {
    await saveRule(userRule);
    await setOrder(["user-1", "jira", "github"]);
    expect((await entries()).map((entry) => entry.id)).toEqual(["user-1", "jira", "github"]);
  });
});

describe("エクスポートとインポート", () => {
  test("エクスポートは未編集の組み込みを含めず、インポートで同じ状態に戻る", async () => {
    await saveRule(userRule);
    await saveRule({ ...builtin("jira"), name: "My Jira" });
    await setEnabled("github", false);
    const exported = buildExport(await readStored());
    expect(exported).toEqual({
      version: 1,
      order: ["github", "jira", "user-1"],
      disabled: ["github"],
      rules: [{ ...builtin("jira"), name: "My Jira" }, userRule],
    });
    const before = await summary();

    await replaceAll({ version: 1, order: [], disabled: [], rules: [] });
    expect(await summary()).toEqual(builtinIds.map((id) => ({ id, kind: "builtin", enabled: true })));

    await replaceAll(exported);
    expect(await summary()).toEqual(before);
  });
});

describe("書き込みの順", () => {
  const largeRules = (prefix: string) =>
    Array.from({ length: 8 }, (_, i) => ({ ...userRule, id: `${prefix}-${i}`, title: { selectors: ["x".repeat(7000)] } }));

  const callOrder = () => {
    const calls: string[] = [];
    vi.spyOn(fakeBrowser.storage.sync, "set").mockImplementation(async () => void calls.push("set"));
    vi.spyOn(fakeBrowser.storage.sync, "remove").mockImplementation(async () => void calls.push("remove"));
    return calls;
  };

  test("新旧の合計が上限に収まるインポートは、書き込んでから古いルールを消す", async () => {
    await saveRule(userRule);
    const calls = callOrder();
    await replaceAll({ version: 1, order: [], disabled: [], rules: [{ ...userRule, id: "user-2" }] });
    expect(calls).toEqual(["set", "remove"]);
  });

  test("新旧の合計が上限を超えるインポートは、先に古いルールを消して空きを作る", async () => {
    await replaceAll({ version: 1, order: [], disabled: [], rules: largeRules("old") });
    const calls = callOrder();
    await replaceAll({ version: 1, order: [], disabled: [], rules: largeRules("new") });
    expect(calls).toEqual(["remove", "set"]);
  });
});

describe("容量の上限", () => {
  test("1 項目 8KB を超えるルールは保存しない", async () => {
    const large = { ...userRule, title: { selectors: ["x".repeat(9000)] } };
    await expect(saveRule(large)).rejects.toEqual(new QuotaError("itemTooLarge"));
    expect(await browser.storage.sync.get(null)).toEqual({});
  });

  test("合計 100KB を超える場合は保存しない", async () => {
    const rules = Array.from({ length: 15 }, (_, i) => ({
      ...userRule,
      id: `user-${i}`,
      title: { selectors: ["x".repeat(7500)] },
    }));
    await expect(replaceAll({ version: 1, order: [], disabled: [], rules })).rejects.toEqual(new QuotaError("totalTooLarge"));
    expect(await browser.storage.sync.get(null)).toEqual({});
  });
});
