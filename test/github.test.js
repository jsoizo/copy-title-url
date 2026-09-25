import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatOutput, normalizeTitle, parseItemUrl } from "../src/github.js";

describe("parseItemUrl", () => {
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
  for (const [input, expected] of normalized) {
    test(`${input} -> ${expected}`, () => {
      assert.equal(parseItemUrl(input)?.url, expected);
    });
  }

  test("番号は URL から取る", () => {
    assert.equal(parseItemUrl("https://github.com/cli/cli/pull/9000/files")?.number, "9000");
  });

  const unsupported = [
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
    "not a url",
    undefined,
  ];
  for (const input of unsupported) {
    test(`対象外: ${input}`, () => {
      assert.equal(parseItemUrl(input), null);
    });
  }
});

describe("normalizeTitle", () => {
  test("前後の空白を削る", () => {
    assert.equal(normalizeTitle("\n    How to use pr create?\n  "), "How to use pr create?");
  });

  test("内部の改行とタブを半角スペース 1 個にまとめる", () => {
    assert.equal(normalizeTitle("a\n\tb   c"), "a b c");
  });

  test("全角スペースと NBSP は残す", () => {
    assert.equal(normalizeTitle("修正\u3000テスト\u00a0A"), "修正\u3000テスト\u00a0A");
  });

  test("空文字、空白のみ、文字列以外は空文字になる", () => {
    assert.equal(normalizeTitle(""), "");
    assert.equal(normalizeTitle("  \n "), "");
    assert.equal(normalizeTitle(null), "");
    assert.equal(normalizeTitle(undefined), "");
  });
});

describe("formatOutput", () => {
  test("LF 区切りで末尾に改行を付けない", () => {
    const item = parseItemUrl("https://github.com/cli/cli/pull/9000/files");
    assert.equal(
      formatOutput("proof of concept for flag-level disable auth check", item),
      "proof of concept for flag-level disable auth check #9000\nhttps://github.com/cli/cli/pull/9000",
    );
  });
});
