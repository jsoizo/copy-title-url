import * as v from "valibot";
import { browser } from "wxt/browser";
import { BUILTIN_RULES } from "./builtin";
import { type ExportData, type Rule, type Settings, SettingsSchema } from "./schema";
import { type Issue, validateRule } from "./validate";

const SETTINGS_KEY = "settings";
const RULE_PREFIX = "rule:";

// chrome.storage.sync の QUOTA_BYTES_PER_ITEM と QUOTA_BYTES
export const QUOTA_BYTES_PER_ITEM = 8192;
export const QUOTA_BYTES = 102400;

export type StoredData = {
  settings: Settings;
  rules: Record<string, unknown>;
};

export type RuleKind = "builtin" | "edited" | "user";

export type RuleEntry = {
  id: string;
  kind: RuleKind;
  enabled: boolean;
  rule: Rule | null;
  raw: unknown;
  issues: Issue[];
};

export class QuotaError extends Error {
  constructor(readonly code: "itemTooLarge" | "totalTooLarge") {
    super(code);
  }
}

const emptySettings = (): Settings => ({ version: 1, order: [], disabled: [] });

export async function readStored(): Promise<StoredData> {
  const items = await browser.storage.sync.get(null);
  const parsed = v.safeParse(SettingsSchema, items[SETTINGS_KEY] ?? emptySettings());
  if (!parsed.success) console.error("invalid settings in storage", parsed.issues);
  const rules: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(items)) {
    if (key.startsWith(RULE_PREFIX)) rules[key.slice(RULE_PREFIX.length)] = value;
  }
  return { settings: parsed.success ? parsed.output : emptySettings(), rules };
}

export function resolveEntries(stored: StoredData, builtins: readonly Rule[] = BUILTIN_RULES): RuleEntry[] {
  const builtinIds = new Set(builtins.map((rule) => rule.id));
  const entries = new Map<string, RuleEntry>();

  for (const builtin of builtins) {
    entries.set(builtin.id, { id: builtin.id, kind: "builtin", enabled: true, rule: builtin, raw: builtin, issues: [] });
  }
  for (const [id, raw] of Object.entries(stored.rules)) {
    const result = validateRule(raw);
    const issues = result.ok ? [] : result.issues;
    if (!result.ok) console.error(`invalid rule in storage: ${id}`, issues);
    entries.set(id, {
      id,
      kind: builtinIds.has(id) ? "edited" : "user",
      enabled: true,
      rule: result.ok ? result.value : null,
      raw,
      issues,
    });
  }

  const ordered = stored.settings.order.flatMap((id) => {
    const entry = entries.get(id);
    entries.delete(id);
    return entry ? [entry] : [];
  });
  const disabled = new Set(stored.settings.disabled);
  return [...ordered, ...entries.values()].map((entry) => ({ ...entry, enabled: !disabled.has(entry.id) }));
}

export function activeRules(entries: readonly RuleEntry[]): Rule[] {
  return entries.flatMap((entry) => (entry.enabled && entry.rule ? [entry.rule] : []));
}

export function generateRuleId(): string {
  return `user-${crypto.randomUUID().slice(0, 8)}`;
}

export async function saveRule(rule: Rule): Promise<void> {
  const stored = await readStored();
  const order = currentOrder(stored);
  if (!order.includes(rule.id)) order.push(rule.id);
  await write(stored, { [ruleKey(rule.id)]: rule, [SETTINGS_KEY]: { ...stored.settings, order } }, []);
}

// 組み込みルールに対して呼ぶと「組み込みに戻す」になる
export async function deleteRule(id: string): Promise<void> {
  const stored = await readStored();
  const isBuiltin = BUILTIN_RULES.some((rule) => rule.id === id);
  const settings: Settings = isBuiltin
    ? stored.settings
    : {
        ...stored.settings,
        order: stored.settings.order.filter((other) => other !== id),
        disabled: stored.settings.disabled.filter((other) => other !== id),
      };
  await write(stored, { [SETTINGS_KEY]: settings }, [ruleKey(id)]);
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const stored = await readStored();
  const disabled = stored.settings.disabled.filter((other) => other !== id);
  if (!enabled) disabled.push(id);
  await write(stored, { [SETTINGS_KEY]: { ...stored.settings, disabled } }, []);
}

// index は、移動するルールを一覧から抜いたあとの位置
export async function moveRule(id: string, index: number): Promise<void> {
  const stored = await readStored();
  const order = currentOrder(stored);
  const from = order.indexOf(id);
  if (from === -1 || index < 0 || index >= order.length || index === from) return;
  order.splice(index, 0, ...order.splice(from, 1));
  await write(stored, { [SETTINGS_KEY]: { ...stored.settings, order } }, []);
}

// 未編集の組み込みは含めない。読み込んだ先でも組み込みの最新定義に追従させるため
export function buildExport(stored: StoredData): ExportData {
  const entries = resolveEntries(stored);
  return {
    version: 1,
    order: entries.map((entry) => entry.id),
    disabled: entries.filter((entry) => !entry.enabled).map((entry) => entry.id),
    rules: entries.flatMap((entry) => (entry.kind !== "builtin" && entry.rule ? [entry.rule] : [])),
  };
}

export async function replaceAll(data: ExportData): Promise<void> {
  const stored = await readStored();
  const next: Record<string, unknown> = {
    [SETTINGS_KEY]: { version: 1, order: data.order, disabled: data.disabled } satisfies Settings,
  };
  for (const rule of data.rules) next[ruleKey(rule.id)] = rule;
  const removed = Object.keys(stored.rules)
    .map(ruleKey)
    .filter((key) => !(key in next));
  await write(stored, next, removed, true);
}

function currentOrder(stored: StoredData): string[] {
  return resolveEntries(stored).map((entry) => entry.id);
}

function ruleKey(id: string): string {
  return `${RULE_PREFIX}${id}`;
}

async function write(
  stored: StoredData,
  items: Record<string, unknown>,
  removed: string[],
  replace = false,
): Promise<void> {
  const current: Record<string, unknown> = replace
    ? {}
    : { [SETTINGS_KEY]: stored.settings, ...Object.fromEntries(Object.entries(stored.rules).map(([id, rule]) => [ruleKey(id), rule])) };
  for (const key of removed) delete current[key];
  const next = { ...current, ...items };
  checkQuota(next);

  if (removed.length > 0) await browser.storage.sync.remove(removed);
  await browser.storage.sync.set(items);
}

export function checkQuota(items: Record<string, unknown>): void {
  let total = 0;
  for (const [key, value] of Object.entries(items)) {
    const size = byteLength(key) + byteLength(JSON.stringify(value));
    if (size > QUOTA_BYTES_PER_ITEM) throw new QuotaError("itemTooLarge");
    total += size;
  }
  if (total > QUOTA_BYTES) throw new QuotaError("totalTooLarge");
}

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;
