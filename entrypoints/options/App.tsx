import { useEffect, useRef, useState } from "preact/hooks";
import { browser } from "wxt/browser";
import {
  buildExport,
  deleteRule,
  generateRuleId,
  QuotaError,
  readStored,
  replaceAll,
  resolveEntries,
  type RuleEntry,
  saveRule,
  setEnabled,
  setOrder,
  writeOrderNow,
} from "../../lib/rules/store";
import type { Settings } from "../../lib/rules/schema";
import { duplicateNameIssues, type Issue, validateExport, validateRule } from "../../lib/rules/validate";
import { draftIssues, fromDraft, looseDraft, newDraft, type RuleDraft } from "./draft";
import { type MessageKey, t } from "../../lib/i18n";
import { isValidSelector } from "./selector";
import { IssueItem, RuleForm } from "./RuleForm";

type Editing = { draft: RuleDraft; isNew: boolean } | null;
type Notice = { kind: "success" | "error"; message: string; issues?: Issue[]; ruleNames?: string[] } | null;

const KIND_LABEL: Record<RuleEntry["kind"], MessageKey> = {
  builtin: "kindBuiltin",
  edited: "kindEdited",
  user: "kindUser",
};

export function App() {
  const [entries, setEntries] = useState<RuleEntry[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rowElements = useRef<(HTMLTableRowElement | null)[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  // ドラッグ中の挿入位置。i は「i 番目の行の直前」、行数と同じ値は末尾を表す
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // 行の DOM を入れ替えるとフォーカスが外れるため、矢印キーで動かした行のつまみへ戻す
  const focusAfterMove = useRef<number | null>(null);
  // storage.sync は書き込み回数に上限があるため、矢印キーの連打などはまとめて保存する
  const pendingOrder = useRef<string[] | null>(null);
  const writingOrder = useRef(false);
  const orderTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSettings = useRef<Settings | null>(null);

  useEffect(() => {
    if (focusAfterMove.current === null) return;
    rowElements.current[focusAfterMove.current]?.querySelector<HTMLElement>(".drag-handle")?.focus();
    focusAfterMove.current = null;
  }, [entries]);

  const showError = (error: unknown) => setNotice({ kind: "error", message: quotaMessage(error) ?? String(error) });

  const reload = async () => {
    const stored = await readStored();
    lastSettings.current = stored.settings;
    // 保存前や保存中の並びを、保存済みの古い並びで上書きしないため
    if (pendingOrder.current || writingOrder.current) return;
    setEntries(resolveEntries(stored));
  };

  useEffect(() => {
    reload().catch(showError);
    // 別のタブで設定を変えたときにも一覧を最新にするため
    const listener = (_changes: unknown, area: string) => {
      if (area === "sync") reload().catch(showError);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushOrder();
    };
    browser.storage.onChanged.addListener(listener);
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flushOrderNow);
    return () => {
      browser.storage.onChanged.removeListener(listener);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flushOrderNow);
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setNotice(null);
    } catch (error) {
      showError(error);
    }
    await reload().catch(showError);
  };

  function flushOrder() {
    clearTimeout(orderTimer.current);
    const order = pendingOrder.current;
    if (!order) return;
    pendingOrder.current = null;
    writingOrder.current = true;
    run(async () => {
      try {
        await setOrder(order);
      } finally {
        writingOrder.current = false;
      }
    });
  }

  function flushOrderNow() {
    clearTimeout(orderTimer.current);
    const order = pendingOrder.current;
    if (!order || !lastSettings.current) return;
    pendingOrder.current = null;
    writeOrderNow(lastSettings.current, order).catch((error) => console.error(error));
  }

  // 保存の完了を待つと行が一瞬元の位置に戻るため、先に画面の並びだけを入れ替える
  const move = (from: number, to: number) => {
    if (!entries || to < 0 || to >= entries.length || to === from) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setEntries(next);
    pendingOrder.current = next.map((entry) => entry.id);
    clearTimeout(orderTimer.current);
    orderTimer.current = setTimeout(flushOrder, 300);
  };

  const endDrag = () => {
    setDragging(null);
    setDropIndex(null);
  };

  const drop = () => {
    if (dragging !== null && dropIndex !== null) move(dragging, dropIndex > dragging ? dropIndex - 1 : dropIndex);
    endDrag();
  };

  const rowClass = (index: number) => {
    const classes = [];
    if (index === dragging) classes.push("dragging");
    if (dropIndex === index) classes.push("drop-before");
    if (dropIndex === index + 1 && entries && index === entries.length - 1) classes.push("drop-after");
    return classes.join(" ");
  };

  const save = async (draft: RuleDraft): Promise<Issue[] | string | null> => {
    // 1 種類ずつ直させないよう、下書きの検査と検証のエラーをまとめて返す
    const preIssues = draftIssues(draft);
    const result = validateRule(fromDraft(draft), { isValidSelector });
    if (preIssues.length > 0 || !result.ok) return [...preIssues, ...(result.ok ? [] : result.issues)];
    try {
      const others = resolveEntries(await readStored()).flatMap((entry) => (entry.rule ? [entry.rule] : []));
      const nameIssues = duplicateNameIssues(result.value, others);
      if (nameIssues.length > 0) return nameIssues;
      await saveRule(result.value);
    } catch (error) {
      return quotaMessage(error) ?? String(error);
    }
    setEditing(null);
    await reload().catch(showError);
    return null;
  };

  const exportRules = async () => {
    let data: ReturnType<typeof buildExport>;
    try {
      data = buildExport(await readStored());
    } catch (error) {
      showError(error);
      return;
    }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "copy-title-url-rules.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importRules = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setNotice({ kind: "error", message: t("importFailed"), issues: [{ path: "", code: "invalidJson", detail }] });
      return;
    }
    const result = validateExport(parsed, { isValidSelector });
    if (!result.ok) {
      setNotice({ kind: "error", message: t("importFailed"), issues: result.issues, ruleNames: ruleNamesOf(parsed) });
      return;
    }
    if (!confirm(t("confirmImport"))) return;
    await run(() => replaceAll(result.value));
    setNotice((current) => current ?? { kind: "success", message: t("importDone") });
  };

  if (editing) {
    return (
      <main>
        <RuleForm initial={editing.draft} isNew={editing.isNew} onSave={save} onCancel={() => setEditing(null)} />
      </main>
    );
  }

  return (
    <main>
      <h1>{t("optionsTitle")}</h1>
      <p>{t("optionsDescription")}</p>

      {notice && (
        <div class={notice.kind === "error" ? "alert" : "notice"} role={notice.kind === "error" ? "alert" : "status"}>
          <p>{notice.message}</p>
          {notice.issues && (
            <ul>
              {notice.issues.map((issue) => (
                <IssueItem issue={issue} ruleNames={notice.ruleNames} />
              ))}
            </ul>
          )}
        </div>
      )}

      <section>
        <h2>{t("rulesHeading")}</h2>
        {entries && (
          <table class="rules">
            <thead>
              <tr>
                <th aria-hidden="true" />
                <th>{t("columnEnabled")}</th>
                <th class="name">{t("columnName")}</th>
                <th>{t("columnKind")}</th>
                <th>{t("columnActions")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  ref={(element) => {
                    rowElements.current[index] = element;
                  }}
                  class={rowClass(index)}
                  onDragOver={(e) => {
                    if (dragging === null) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop();
                  }}
                >
                  <td>
                    <span
                      class="drag-handle"
                      draggable
                      tabIndex={0}
                      role="button"
                      title={t("dragHandle")}
                      aria-label={t("dragHandle")}
                      onDragStart={(e) => {
                        e.dataTransfer?.setData("text/plain", entry.id);
                        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                        const row = rowElements.current[index];
                        if (row) e.dataTransfer?.setDragImage(row, 16, 16);
                        setDragging(index);
                      }}
                      onDragEnd={endDrag}
                      onKeyDown={(e) => {
                        const offset = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                        if (offset === 0) return;
                        e.preventDefault();
                        focusAfterMove.current = index + offset;
                        move(index, index + offset);
                      }}
                    >
                      ⋮⋮
                    </span>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={t("columnEnabled")}
                      checked={entry.enabled}
                      onChange={(e) => run(() => setEnabled(entry.id, e.currentTarget.checked))}
                    />
                  </td>
                  <td>
                    {entry.rule?.name ?? entry.id}
                    {entry.issues.length > 0 && <span class="badge error">{t("invalidRule")}</span>}
                  </td>
                  <td>{t(KIND_LABEL[entry.kind])}</td>
                  <td>
                    <div class="row-actions">
                    <button
                      type="button"
                      class="secondary"
                      onClick={() => setEditing({ draft: looseDraft(entry.raw, entry.id), isNew: false })}
                    >
                      {t("edit")}
                    </button>
                    {entry.kind === "user" && (
                      <button
                        type="button"
                        class="danger"
                        onClick={() => confirm(t("confirmDelete")) && run(() => deleteRule(entry.id))}
                      >
                        {t("delete")}
                      </button>
                    )}
                    {entry.kind === "edited" && (
                      <button
                        type="button"
                        class="secondary"
                        onClick={() => confirm(t("confirmReset")) && run(() => deleteRule(entry.id))}
                      >
                        {t("resetBuiltin")}
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p class="help order-help">{t("rulesOrderHelp")}</p>
        <button type="button" onClick={() => setEditing({ draft: newDraft(generateRuleId()), isNew: true })}>
          {t("addRule")}
        </button>
      </section>

      <section>
        <h2>{t("importExportHeading")}</h2>
        <p class="help">{t("importExportHelp")}</p>
        <div class="actions">
          <button type="button" class="secondary" onClick={exportRules}>
            {t("exportButton")}
          </button>
          <button type="button" class="secondary" onClick={() => fileInput.current?.click()}>
            {t("importButton")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) importRules(file);
            }}
          />
        </div>
      </section>
    </main>
  );
}

// 検証を通らなかったファイルからも、エラーの場所を示すためにルールの名前だけを拾う
function ruleNamesOf(data: unknown): string[] {
  const rules = (data as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => {
    const name = (rule as { name?: unknown } | null)?.name;
    return typeof name === "string" ? name : "";
  });
}

function quotaMessage(error: unknown): string | null {
  if (!(error instanceof QuotaError)) return null;
  return t(error.code === "itemTooLarge" ? "quotaItemTooLarge" : "quotaTotalTooLarge");
}
