import * as v from "valibot";

// JSON Schema の生成スクリプトを Node で直接実行するため、valibot 以外を import しないこと

// 第 2 引数は validate.ts が読むエラーコード
const NonEmptyString = v.pipe(v.string(), v.minLength(1, "required"));

export const VARIABLE_NAME = /^[A-Za-z_$][\w$]*$/;
const VariableName = v.pipe(v.string(), v.regex(VARIABLE_NAME, "invalidVariableName"));

export const RULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RuleId = v.pipe(v.string(), v.regex(RULE_ID, "invalidId"));

const UrlPatternCondition = v.strictObject({
  type: v.literal("urlpattern"),
  pattern: NonEmptyString,
  query: v.optional(v.record(VariableName, NonEmptyString)),
  documentTitleFallback: v.optional(v.boolean()),
});

const RegexCondition = v.strictObject({
  type: v.literal("regex"),
  pattern: NonEmptyString,
  documentTitleFallback: v.optional(v.boolean()),
});

export const MatchConditionSchema = v.variant("type", [UrlPatternCondition, RegexCondition]);

export const RuleSchema = v.strictObject({
  id: RuleId,
  name: NonEmptyString,
  match: v.pipe(v.array(MatchConditionSchema), v.minLength(1, "atLeastOne")),
  title: v.strictObject({
    selectors: v.array(NonEmptyString),
    documentTitleStrip: v.optional(v.array(NonEmptyString)),
  }),
  label: NonEmptyString,
  url: NonEmptyString,
});

export const SettingsSchema = v.strictObject({
  version: v.literal(1),
  order: v.array(RuleId),
  disabled: v.array(RuleId),
});

export const ExportSchema = v.strictObject({
  $schema: v.optional(v.string()),
  version: v.literal(1),
  order: v.array(RuleId),
  disabled: v.array(RuleId),
  rules: v.array(RuleSchema),
});

export type MatchCondition = v.InferOutput<typeof MatchConditionSchema>;
export type Rule = v.InferOutput<typeof RuleSchema>;
export type Settings = v.InferOutput<typeof SettingsSchema>;
export type ExportData = v.InferOutput<typeof ExportSchema>;
