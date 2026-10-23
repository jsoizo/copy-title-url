import { writeFileSync } from "node:fs";
import { buildJsonSchema } from "../lib/rules/json-schema.ts";

writeFileSync(new URL("../schema/rules.schema.json", import.meta.url), `${JSON.stringify(buildJsonSchema(), null, 2)}\n`);
