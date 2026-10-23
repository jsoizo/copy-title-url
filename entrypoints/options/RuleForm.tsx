import { useState } from "preact/hooks";
import type { Issue } from "../../lib/rules/validate";
import { type ConditionDraft, emptyCondition, type RuleDraft } from "./draft";
import { issueMessage, t } from "./i18n";

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

  const update = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateCondition = (index: number, patch: Partial<ConditionDraft>) =>
    update({ match: draft.match.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)) });

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
  };

  const fieldIssues = (path: string) => <FieldIssues issues={issues.filter((issue) => issue.path === path)} />;

  return (
    <form class="rule-form" onSubmit={submit}>
      <h2>{isNew ? t("formHeadingNew") : t("formHeadingEdit")}</h2>
      {error && (
        <div class="alert" role="alert">
          <p>{error}</p>
          {issues.length > 0 && (
            <ul>
              {issues.map((issue) => (
                <li>
                  <code>{issue.path || "/"}</code> {issueMessage(issue)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label class="field">
        <span class="field-label">{t("fieldName")}</span>
        <input value={draft.name} onInput={(e) => update({ name: e.currentTarget.value })} />
        {fieldIssues("name")}
      </label>
      <p class="rule-id">
        ID: <code>{draft.id}</code>
      </p>

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
                  onChange={(e) => updateCondition(index, { type: e.currentTarget.value as ConditionDraft["type"] })}
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
                  onInput={(e) => updateCondition(index, { pattern: e.currentTarget.value })}
                />
              </label>
              <button
                type="button"
                class="secondary"
                disabled={draft.match.length === 1}
                onClick={() => update({ match: draft.match.filter((_, i) => i !== index) })}
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
                      onInput={(e) =>
                        updateCondition(index, {
                          query: condition.query.map((q, i) =>
                            i === queryIndex ? { ...q, variable: e.currentTarget.value } : q,
                          ),
                        })
                      }
                    />
                    <span>=</span>
                    <input
                      class="mono"
                      placeholder={t("queryParam")}
                      aria-label={t("queryParam")}
                      value={query.param}
                      onInput={(e) =>
                        updateCondition(index, {
                          query: condition.query.map((q, i) => (i === queryIndex ? { ...q, param: e.currentTarget.value } : q)),
                        })
                      }
                    />
                    <button
                      type="button"
                      class="secondary"
                      onClick={() => updateCondition(index, { query: condition.query.filter((_, i) => i !== queryIndex) })}
                    >
                      {t("remove")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="secondary"
                  onClick={() => updateCondition(index, { query: [...condition.query, { variable: "", param: "" }] })}
                >
                  {t("addQuery")}
                </button>
                <FieldIssues issues={issues.filter((issue) => issue.path.startsWith(`match.${index}.query`))} />
              </div>
            )}

            <label class="checkbox">
              <input
                type="checkbox"
                checked={condition.documentTitleFallback}
                onChange={(e) => updateCondition(index, { documentTitleFallback: e.currentTarget.checked })}
              />
              {t("fieldFallback")}
            </label>
            {fieldIssues(`match.${index}.documentTitleFallback`)}
          </div>
        ))}
        <button type="button" class="secondary" onClick={() => update({ match: [...draft.match, emptyCondition()] })}>
          {t("addCondition")}
        </button>
      </fieldset>

      <StringList
        legend={t("fieldSelectors")}
        help={t("selectorsHelp")}
        addLabel={t("addSelector")}
        values={draft.selectors}
        path="title.selectors"
        issues={issues}
        onChange={(selectors) => update({ selectors })}
      />
      <StringList
        legend={t("fieldStrip")}
        help={t("stripHelp")}
        addLabel={t("addStrip")}
        values={draft.documentTitleStrip}
        path="title.documentTitleStrip"
        issues={issues}
        onChange={(documentTitleStrip) => update({ documentTitleStrip })}
      />

      <label class="field">
        <span class="field-label">{t("fieldLabel")}</span>
        <input class="mono" value={draft.label} onInput={(e) => update({ label: e.currentTarget.value })} />
        {fieldIssues("label")}
      </label>
      <label class="field">
        <span class="field-label">{t("fieldUrl")}</span>
        <input class="mono" value={draft.url} onInput={(e) => update({ url: e.currentTarget.value })} />
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
  issues: Issue[];
  onChange: (values: string[]) => void;
};

function StringList({ legend, help, addLabel, values, path, issues, onChange }: StringListProps) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <p class="help">{help}</p>
      {values.map((value, index) => (
        <>
          <div class="row">
            <input
              class="mono grow"
              aria-label={legend}
              value={value}
              onInput={(e) => onChange(values.map((v, i) => (i === index ? e.currentTarget.value : v)))}
            />
            <button type="button" class="secondary" onClick={() => onChange(values.filter((_, i) => i !== index))}>
              {t("remove")}
            </button>
          </div>
          <FieldIssues issues={issues.filter((issue) => issue.path === `${path}.${index}`)} />
        </>
      ))}
      <button type="button" class="secondary" onClick={() => onChange([...values, ""])}>
        {addLabel}
      </button>
    </fieldset>
  );
}

function FieldIssues({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul class="field-issues">
      {issues.map((issue) => (
        <li>{issueMessage(issue)}</li>
      ))}
    </ul>
  );
}
