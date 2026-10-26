import { toJsonSchema } from "@valibot/to-json-schema";
import { ExportSchema } from "./schema.ts";

// URLPattern や正規表現として解釈できるかなど、JSON Schema で表せない検証は validate.ts だけが行う
// trim などの変換も JSON Schema では表せないため、省いて生成する
export function buildJsonSchema() {
  return {
    ...toJsonSchema(ExportSchema, { errorMode: "ignore" }),
    title: "Tidy Title & URL rules",
  };
}
