import { describe, expect, test } from "vitest";
import type { CopyFormat } from "../lib/format";
import type { ExtractedTitle } from "../lib/messages";
import { type CopyPlan, planCopy } from "../lib/plan";
import { BUILTIN_RULES } from "../lib/rules/builtin";
import { matchRules } from "../lib/rules/match";
import type { Rule } from "../lib/rules/schema";

function plan(pageUrl: string, extracted: Partial<ExtractedTitle>, format: CopyFormat = "plain", rules: readonly Rule[] = BUILTIN_RULES): CopyPlan {
  return planCopy(matchRules(rules, pageUrl), { element: null, document: "", ...extracted }, pageUrl, format);
}

describe("GitHub", () => {
  const title = "proof of concept for flag-level disable auth check";
  const normalized = [
    ["https://github.com/cli/cli/pull/9000", "https://github.com/cli/cli/pull/9000"],
    ["https://github.com/cli/cli/pull/9000/files?diff=split#diff-abc", "https://github.com/cli/cli/pull/9000"],
    ["https://github.com/cli/cli/pull/9000/changes", "https://github.com/cli/cli/pull/9000"],
    ["https://github.com/cli/cli/pull/9000/commits/abc123", "https://github.com/cli/cli/pull/9000"],
    ["https://github.com/cli/cli/pull/9000/", "https://github.com/cli/cli/pull/9000"],
    ["https://github.com/cli/cli/issues/10000#issuecomment-1", "https://github.com/cli/cli/issues/10000"],
    ["https://github.com/cli/cli/discussions/9500?sort=new", "https://github.com/cli/cli/discussions/9500"],
    ["https://github.com/Owner/Repo.js/issues/1", "https://github.com/Owner/Repo.js/issues/1"],
    ["https://github.com/orgs/community/discussions/12#discussioncomment-3", "https://github.com/orgs/community/discussions/12"],
  ];
  test.each(normalized)("%s -> %s", (pageUrl, url) => {
    const number = url.split("/").at(-1);
    expect(plan(pageUrl, { element: `\n  ${title}\n` })).toEqual({ status: "ok", text: `${title} #${number}\n${url}` });
  });

  const unmatched = [
    "https://github.com/cli/cli/issues/new",
    "https://github.com/cli/cli/pull/new/branch",
    "https://github.com/cli/cli/issues?q=is%3Aopen",
    "https://github.com/cli/cli/issues/",
    "https://github.com/cli/cli/discussions/categories/general",
    "https://github.com/cli/cli/pulls/1",
    "https://github.com/cli/cli/issues/0",
    "https://github.com/cli/cli/issues/0123",
    "https://github.com/cli/cli/issues/12a",
    "https://github.com/cli/issues/1",
    "https://gist.github.com/cli/cli/issues/1",
    "https://www.github.com/cli/cli/issues/1",
    "https://github.com:8443/cli/cli/issues/1",
    "http://github.com/cli/cli/issues/1",
  ];
  test.each(unmatched)("ルールに一致せず汎用コピーになる: %s", (pageUrl) => {
    expect(plan(pageUrl, { element: "ignored", document: "Page title" })).toEqual({
      status: "ok",
      text: `Page title\n${pageUrl}`,
    });
  });

  test.each([
    ["https://github.com/cli/cli/pull/9000", `${title} by andyfeller · Pull Request #9000 · cli/cli · GitHub`, `${title} #9000`],
    ["https://github.com/cli/cli/pull/9000", `${title} by andyfeller · Pull Request #9000 · cli/cli`, `${title} #9000`],
    ["https://github.com/cli/cli/issues/10000", "Fix A · B · Issue #10000 · cli/cli · GitHub", "Fix A · B #10000"],
    ["https://github.com/cli/cli/discussions/9500", "How to use? · cli/cli · Discussion #9500 · GitHub", "How to use? #9500"],
    ["https://github.com/orgs/community/discussions/12", "Blockquote Button · community · Discussion #12 · GitHub", "Blockquote Button #12"],
  ])("タイトル要素が無ければ document.title を整形して代用する: %s", (pageUrl, documentTitle, label) => {
    expect(plan(pageUrl, { document: documentTitle })).toEqual({ status: "fallback", text: `${label}\n${pageUrl}` });
  });
});

describe("Jira", () => {
  test("/browse/KEY はキーを先頭に付け、URL を正規化する", () => {
    expect(
      plan("https://example.atlassian.net/browse/PROJ-12?focusedCommentId=1", { element: "ログイン画面の修正" }),
    ).toEqual({ status: "ok", text: "PROJ-12 ログイン画面の修正\nhttps://example.atlassian.net/browse/PROJ-12" });
  });

  test("selectedIssue のキーを使う", () => {
    expect(
      plan("https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1/backlog?selectedIssue=PROJ-5", {
        element: "[設定] 通知メールの文面の更新",
        document: "PROJ board - バックログ - Jira",
      }),
    ).toEqual({ status: "ok", text: "PROJ-5 [設定] 通知メールの文面の更新\nhttps://example.atlassian.net/browse/PROJ-5" });
  });

  test("selectedIssue の画面では document.title で代用しない", () => {
    expect(
      plan("https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1?selectedIssue=PROJ-5", {
        document: "PROJ board - スクラム ボード - Jira",
      }),
    ).toEqual({ status: "titleNotFound" });
  });

  test("課題を開いていないボードは汎用コピーになる", () => {
    const pageUrl = "https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1";
    expect(plan(pageUrl, { document: "PROJ board - Jira" })).toEqual({ status: "ok", text: `PROJ board - Jira\n${pageUrl}` });
  });

  test.each([
    ["[PROJ-5] [設定] 通知メールの文面の更新 - Jira", "PROJ-5 [設定] 通知メールの文面の更新"],
    ["[ACJIRA-1] Provide webhooks - Ecosystem Jira", "ACJIRA-1 Provide webhooks"],
  ])("/browse/KEY では document.title の最初の一致だけを削って代用する: %s", (documentTitle, label) => {
    const key = label.split(" ")[0];
    expect(plan(`https://example.atlassian.net/browse/${key}`, { document: documentTitle })).toEqual({
      status: "fallback",
      text: `${label}\nhttps://example.atlassian.net/browse/${key}`,
    });
  });
});

describe("汎用コピー", () => {
  test("URL はクエリとハッシュを含めてそのまま使う", () => {
    const pageUrl = "https://example.com/a?b=1#c";
    expect(plan(pageUrl, { document: "Example" })).toEqual({ status: "ok", text: `Example\n${pageUrl}` });
  });

  test("ASCII の空白はまとめ、全角スペースと NBSP は残す", () => {
    expect(plan("https://example.com/", { document: "\n  修正　テスト A\t\tB  " })).toEqual({
      status: "ok",
      text: "修正　テスト A B\nhttps://example.com/",
    });
  });

  test("document.title が空ならタイトル取得失敗になる", () => {
    expect(plan("https://example.com/", { document: " \n " })).toEqual({ status: "titleNotFound" });
  });
});

describe("Markdown リンク", () => {
  test("表示名の角括弧とバックスラッシュ、URL の丸括弧と空白をエスケープする", () => {
    const pageUrl = "https://example.com/a (b)";
    expect(plan(pageUrl, { document: "[x] a\\b" }, "markdown")).toEqual({
      status: "ok",
      text: "[\\[x\\] a\\\\b](https://example.com/a%20%28b%29)",
    });
  });

  test("ルールに一致したページは正規化した URL でリンクにする", () => {
    expect(plan("https://github.com/cli/cli/pull/9000/files", { element: "Fix" }, "markdown")).toEqual({
      status: "ok",
      text: "[Fix #9000](https://github.com/cli/cli/pull/9000)",
    });
  });
});

describe("ユーザー定義ルール", () => {
  const rule: Rule = {
    id: "user-1",
    name: "Example",
    match: [{ type: "regex", pattern: String.raw`^https://jira\.example\.com/browse/(?<key>[A-Z]+-\d+)` }],
    title: { selectors: [], documentTitleStrip: [String.raw`\s-\s[^-]*Jira$`] },
    label: "{{{key}}} {title}",
    url: "{origin}/browse/{key}",
  };

  test("セレクタが空なら document.title を整形して使い、警告にしない", () => {
    expect(plan("https://jira.example.com/browse/AB-1?x=1", { element: "ignored", document: "[AB-1] Fix - Jira" }, "plain", [rule])).toEqual({
      status: "ok",
      text: "{AB-1} [AB-1] Fix\nhttps://jira.example.com/browse/AB-1",
    });
  });

  test("省略可能なグループで変数が欠けた一致は、一致しなかったものとして次へ進む", () => {
    const optional: Rule = {
      ...rule,
      match: [{ type: "urlpattern", pattern: "https://example.com/items{/:id}?" }],
      title: { selectors: ["h1"] },
      label: "{id} {title}",
      url: "https://example.com/items/{id}",
    };
    expect(plan("https://example.com/items/3", { element: "Item" }, "plain", [optional])).toEqual({
      status: "ok",
      text: "3 Item\nhttps://example.com/items/3",
    });
    expect(plan("https://example.com/items", { element: "Item", document: "Items" }, "plain", [optional])).toEqual({
      status: "ok",
      text: "Items\nhttps://example.com/items",
    });
  });

  test("上にあるルールを優先する", () => {
    const github = BUILTIN_RULES.find((r) => r.id === "github")!;
    const override: Rule = { ...github, id: "user-2", label: "[{repo}] {title}" };
    expect(plan("https://github.com/cli/cli/pull/1", { element: "Fix" }, "plain", [override, github])).toEqual({
      status: "ok",
      text: "[cli] Fix\nhttps://github.com/cli/cli/pull/1",
    });
  });
});
