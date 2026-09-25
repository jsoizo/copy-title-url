import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { copyAndNotify, extractTitle } from "../src/inject.js";

// executeScript と同じく関数を文字列化して、外側のスコープを参照していないことを確かめる
function runSerialized(fn, args, globals) {
  const context = vm.createContext({ ...globals });
  return vm.runInContext(`(${fn.toString()})(...${JSON.stringify(args)})`, context);
}

function createElementStub() {
  return {
    style: {},
    select() {},
    remove() {},
    setAttribute() {},
    append() {},
    attachShadow() {
      return { append() {} };
    },
  };
}

test("extractTitle は単体で実行できる", () => {
  const document = { querySelector: () => ({ textContent: " title " }) };
  assert.equal(runSerialized(extractTitle, [], { document }), " title ");
});

test("copyAndNotify は単体で実行でき、テキストをコピーする", async () => {
  let written;
  const appended = [];
  const document = {
    getElementById: () => null,
    createElement: createElementStub,
    documentElement: { append: (el) => appended.push(el) },
  };
  const navigator = { clipboard: { writeText: async (value) => void (written = value) } };
  await runSerialized(copyAndNotify, [{ text: "a #1\nhttps://github.com/o/r/issues/1", successMessage: "ok", errorMessage: "ng" }], {
    document,
    navigator,
    setTimeout: () => {},
  });
  assert.equal(written, "a #1\nhttps://github.com/o/r/issues/1");
  assert.equal(appended.length, 1);
});

test("copyAndNotify は Clipboard API が失敗したら execCommand で再試行する", async () => {
  let execCommandCalled = false;
  const document = {
    activeElement: null,
    getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} }),
    getElementById: () => null,
    createElement: createElementStub,
    body: { append() {} },
    documentElement: { append() {} },
    execCommand: () => (execCommandCalled = true),
  };
  const navigator = { clipboard: { writeText: async () => Promise.reject(new Error("denied")) } };
  await runSerialized(copyAndNotify, [{ text: "x", successMessage: "ok", errorMessage: "ng" }], {
    document,
    navigator,
    setTimeout: () => {},
  });
  assert.equal(execCommandCalled, true);
});
