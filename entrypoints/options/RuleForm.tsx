import { useEffect, useRef, useState } from "preact/hooks";
import type { Issue } from "../../lib/rules/validate";
import { type ConditionDraft, emptyCondition, type RuleDraft } from "./draft";
import { t } from "../../lib/i18n";
import { fieldKey, issueLocation, issueMessage } from "./issues";

type Props = {
  initial: RuleDraft;
  isNew: boolean;
  onSave: (draft: RuleDraft) => Promise<Issue[] | string | null>;
  onCancel: () => void;
};

export function RuleForm({ initial, isNew, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initial);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // 保存に失敗したら、画面の外にある欄のエラーにも気づけるよう、最初のエラーの欄へ移る
  const focusFirstError = useRef(false);

  useEffect(() => {
    if (!focusFirstError.current) return;
    focusFirstError.current = false;
    const target = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form.current?.querySelector<HTMLElement>(".alert");
    target?.focus();
  }, [issues, error]);

  const update = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateCondition = (index: number, patch: (condition: ConditionDraft) => Partial<ConditionDraft>) =>
    setDraft((current) => ({
      ...current,
      match: replaceAt(current.match, index, (condition) => ({ ...condition, ...patch(condition) })),
    }));

  const submit = async (event: Event) => {
    event.preventDefault();
    setSaving(true);
    let result: Issue[] | string | null;
    try {
      result = await onSave(draft);
    } catch (error) {
      result = String(error);
    } finally {
      setSaving(false);
    }
    setIssues(Array.isArray(result) ? result : []);
    setError(typeof result === "string" ? result : Array.isArray(result) && result.length > 0 ? t("saveFailed") : null);
    focusFirstError.current = true;
  };

  const issuesFor = (key: string) => issues.filter((issue) => fieldKey(issue.path) === key);
  const fieldIssues = (key: string) => <FieldIssues id={issuesId(key)} issues={issuesFor(key)} />;
  // 入力欄に、表示しているエラーを結び付ける
  const invalid = (...keys: string[]) => {
    const shown = keys.filter((key) => issuesFor(key).length > 0);
    return shown.length === 0 ? {} : { "aria-invalid": true, "aria-describedby": shown.map(issuesId).join(" ") };
  };
  const unshown = issues.filter((issue) => !fieldKeys(draft).has(fieldKey(issue.path)));

  return (
    <form ref={form} class="rule-form" onSubmit={submit}>
      <h2>{isNew ? t("formHeadingNew") : t("formHeadingEdit")}</h2>
      {error && (
        <div class="alert" role="alert" tabIndex={-1}>
          <p>{error}</p>
          {unshown.length > 0 && (
            <ul>
              {unshown.map((issue) => (
                <IssueItem issue={issue} />
              ))}
            </ul>
          )}
        </div>
      )}

      <label class="field">
        <span class="field-label">{t("fieldName")}</span>
        <input value={draft.name} onInput={(e) => update({ name: e.currentTarget.value })} {...invalid("name")} />
        {fieldIssues("name")}
      </label>

      <fieldset>
        <legend>{t("fieldMatch")}</legend>
        <p class="help">{t("fieldMatchHelp")}</p>
        {fieldIssues("match")}
        {draft.match.map((condition, index) => (
          <div class="condition">
            <div class="row">
              <label>
                <span class="field-label">{t("conditionType")}</span>
                <select
                  value={condition.type}
                  onChange={(e) => {
                    const type = e.currentTarget.value as ConditionDraft["type"];
                    updateCondition(index, () => ({ type }));
                  }}
                >
                  <option value="urlpattern">{t("typeUrlPattern")}</option>
                  <option value="regex">{t("typeRegex")}</option>
                </select>
              </label>
              <label class="grow">
                <span class="field-label">{t("fieldPattern")}</span>
                <input
                  class="mono"
                  value={condition.pattern}
                  onInput={(e) => {
                    const pattern = e.currentTarget.value;
                    updateCondition(index, () => ({ pattern }));
                  }}
                  {...invalid(`match.${index}.pattern`, `match.${index}`)}
                />
              </label>
              <button
                type="button"
                class="secondary"
                disabled={draft.match.length === 1}
                onClick={() => setDraft((current) => ({ ...current, match: removeAt(current.match, index) }))}
              >
                {t("remove")}
              </button>
            </div>
            <p class="help">{condition.type === "urlpattern" ? t("patternHelpUrlPattern") : t("patternHelpRegex")}</p>
            {fieldIssues(`match.${index}`)}
            {fieldIssues(`match.${index}.pattern`)}

            {condition.type === "urlpattern" && (
              <div class="query">
                <span class="field-label">{t("fieldQuery")}</span>
                {condition.query.map((query, queryIndex) => (
                  <div class="row">
                    <input
                      class="mono"
                      placeholder={t("queryVariable")}
                      aria-label={t("queryVariable")}
                      value={query.variable}
                      {...invalid(`match.${index}.query`)}
                      onInput={(e) => {
                        const variable = e.currentTarget.value;
                        updateCondition(index, (c) => ({ query: replaceAt(c.query, queryIndex, (q) => ({ ...q, variable })) }));
                      }}
                    />
                    <span>=</span>
                    <input
                      class="mono"
                      placeholder={t("queryParam")}
                      aria-label={t("queryParam")}
                      value={query.param}
                      {...invalid(`match.${index}.query`)}
                      onInput={(e) => {
                        const param = e.currentTarget.value;
                        updateCondition(index, (c) => ({ query: replaceAt(c.query, queryIndex, (q) => ({ ...q, param })) }));
                      }}
                    />
                    <button
                      type="button"
                      class="secondary"
                      onClick={() => updateCondition(index, (c) => ({ query: removeAt(c.query, queryIndex) }))}
                    >
                      {t("remove")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="secondary"
                  onClick={() => updateCondition(index, (c) => ({ query: [...c.query, { variable: "", param: "" }] }))}
                >
                  {t("addQuery")}
                </button>
                {fieldIssues(`match.${index}.query`)}
              </div>
            )}

            <label class="checkbox">
              <input
                type="checkbox"
                checked={condition.documentTitleFallback}
                {...invalid(`match.${index}.documentTitleFallback`)}
                onChange={(e) => {
                  const documentTitleFallback = e.currentTarget.checked;
                  updateCondition(index, () => ({ documentTitleFallback }));
                }}
              />
              {t("fieldFallback")}
            </label>
            {fieldIssues(`match.${index}.documentTitleFallback`)}
          </div>
        ))}
        <button
          type="button"
          class="secondary"
          onClick={() => setDraft((current) => ({ ...current, match: [...current.match, emptyCondition()] }))}
        >
          {t("addCondition")}
        </button>
      </fieldset>

      <StringList
        legend={t("fieldSelectors")}
        help={t("selectorsHelp")}
        addLabel={t("addSelector")}
        values={draft.selectors}
        path="title.selectors"
        issuesFor={issuesFor}
        onChange={(selectors) => update({ selectors })}
      />
      <StringList
        legend={t("fieldStrip")}
        help={t("stripHelp")}
        addLabel={t("addStrip")}
        values={draft.documentTitleStrip}
        path="title.documentTitleStrip"
        issuesFor={issuesFor}
        onChange={(documentTitleStrip) => update({ documentTitleStrip })}
      />

      <label class="field">
        <span class="field-label">{t("fieldLabel")}</span>
        <input class="mono" value={draft.label} onInput={(e) => update({ label: e.currentTarget.value })} {...invalid("label")} />
        {fieldIssues("label")}
      </label>
      <label class="field">
        <span class="field-label">{t("fieldUrl")}</span>
        <input class="mono" value={draft.url} onInput={(e) => update({ url: e.currentTarget.value })} {...invalid("url")} />
        {fieldIssues("url")}
      </label>
      <p class="help">{t("templateHelp")}</p>

      <div class="actions">
        <button type="submit" disabled={saving}>
          {t("save")}
        </button>
        <button type="button" class="secondary" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

type StringListProps = {
  legend: string;
  help: string;
  addLabel: string;
  values: string[];
  path: string;
  issuesFor: (key: string) => Issue[];
  onChange: (values: string[]) => void;
};

function StringList({ legend, help, addLabel, values, path, issuesFor, onChange }: StringListProps) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <p class="help">{help}</p>
      {values.map((value, index) => {
        const key = `${path}.${index}`;
        const itemIssues = issuesFor(key);
        return (
          <>
            <div class="row">
              <input
                class="mono grow"
                aria-label={legend}
                value={value}
                onInput={(e) => {
                  const next = e.currentTarget.value;
                  onChange(replaceAt(values, index, () => next));
                }}
                {...(itemIssues.length > 0 ? { "aria-invalid": true, "aria-describedby": issuesId(key) } : {})}
              />
              <button type="button" class="secondary" onClick={() => onChange(removeAt(values, index))}>
                {t("remove")}
              </button>
            </div>
            <FieldIssues id={issuesId(key)} issues={itemIssues} />
          </>
        );
      })}
      <button type="button" class="secondary" onClick={() => onChange([...values, ""])}>
        {addLabel}
      </button>
    </fieldset>
  );
}

function FieldIssues({ id, issues }: { id: string; issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul class="field-issues" id={id}>
      {issues.map((issue) => (
        <li>
          {issueMessage(issue, t)}
          {issue.detail && <IssueDetail detail={issue.detail} />}
        </li>
      ))}
    </ul>
  );
}

export function IssueItem({ issue, ruleNames }: { issue: Issue; ruleNames?: readonly string[] }) {
  const location = issueLocation(issue, t, ruleNames);
  const message = issueMessage(issue, t);
  return (
    <li>
      {location ? t("issueWithLocation", [location, message]) : message}
      {issue.detail && <IssueDetail detail={issue.detail} />}
    </li>
  );
}

// ブラウザやライブラリの英語の説明は翻訳せず、手がかりとして添える
function IssueDetail({ detail }: { detail: string }) {
  return (
    <small class="issue-detail">
      {t("issueDetail")}: <code>{detail}</code>
    </small>
  );
}

const issuesId = (key: string) => `issues-${key}`;

const replaceAt = <T,>(items: readonly T[], index: number, replace: (item: T) => T): T[] =>
  items.map((item, i) => (i === index ? replace(item) : item));
const removeAt = <T,>(items: readonly T[], index: number): T[] => items.filter((_, i) => i !== index);

// フォームに表示場所がある欄のキー。これ以外のエラーは上部の要約に出す
function fieldKeys(draft: RuleDraft): Set<string> {
  return new Set([
    "name",
    "match",
    "label",
    "url",
    ...draft.match.flatMap((condition, index) => [
      `match.${index}`,
      `match.${index}.pattern`,
      `match.${index}.documentTitleFallback`,
      ...(condition.type === "urlpattern" ? [`match.${index}.query`] : []),
    ]),
    ...draft.selectors.map((_, index) => `title.selectors.${index}`),
    ...draft.documentTitleStrip.map((_, index) => `title.documentTitleStrip.${index}`),
  ]);
}
