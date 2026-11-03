// schema.mjs: engine/schema/project.schema.json equals SCHEMA byte for byte, every object closes unknown keys,
// every field has a description, and SCHEMA uses only the keywords validate.mjs interprets.
// Rewrite the file after a schema change: set JIG_WRITE_SCHEMA=1 and run this test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "../engine/lib/schema.mjs";

const file = fileURLToPath(new URL("../engine/schema/project.schema.json", import.meta.url));
const want = JSON.stringify(SCHEMA, null, 2) + "\n";
if (process.env.JIG_WRITE_SCHEMA === "1") writeFileSync(file, want);

const KEYWORDS = new Set(["$schema", "title", "description", "type", "required", "properties", "additionalProperties", "propertyNames",
  "enum", "const", "default", "minimum", "maximum", "exclusiveMinimum", "minLength", "maxLength", "pattern", "items", "minItems", "maxItems", "anyOf", "$ref", "$defs"]);
const TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);
const deref = (s) => (s.$ref ? SCHEMA.$defs[s.$ref.replace("#/$defs/", "")] : s);

// Every schema node with its path.
function nodes(s = SCHEMA, path = "#", out = []) {
  out.push([s, path]);
  for (const [k, v] of Object.entries(s.properties ?? {})) nodes(v, `${path}/properties/${k}`, out);
  for (const [k, v] of Object.entries(s.$defs ?? {})) nodes(v, `${path}/$defs/${k}`, out);
  (s.anyOf ?? []).forEach((v, i) => nodes(v, `${path}/anyOf/${i}`, out));
  for (const k of ["items", "additionalProperties", "propertyNames"]) if (s[k] && typeof s[k] === "object") nodes(s[k], `${path}/${k}`, out);
  return out;
}

test("project.schema.json equals JSON.stringify(SCHEMA, null, 2) + newline, UTF-8 without BOM", () => {
  const bytes = readFileSync(file);
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "the file starts with a BOM");
  assert.equal(bytes.toString("utf8"), want, "run: JIG_WRITE_SCHEMA=1 node --test tests/schema.test.mjs");
});

test("draft 2020-12, required top-level fields", () => {
  assert.equal(SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(SCHEMA.required, ["id", "title", "materials", "parts"]);
  assert.deepEqual(SCHEMA.$defs.material.anyOf.map((r) => deref(r).properties.kind.const), ["linear", "sheet", "each", "amount"]);
});

test("only keywords validate.mjs interprets; refs resolve; patterns compile", () => {
  for (const [s, path] of nodes()) {
    for (const k of Object.keys(s)) assert.ok(KEYWORDS.has(k), `${path}: keyword ${k}`);
    if (s.$ref) assert.ok(SCHEMA.$defs[s.$ref.replace("#/$defs/", "")], `${path}: $ref ${s.$ref}`);
    for (const t of [].concat(s.type ?? [])) assert.ok(TYPES.has(t), `${path}: type ${t}`);
    if (s.pattern) assert.doesNotThrow(() => new RegExp(s.pattern, "u"), path);
    if (s.enum) assert.ok(s.enum.length > 0, path);
    if (s.enum && s.default !== undefined) assert.ok(s.enum.includes(s.default), `${path}: default`);
  }
});

test("every object level closes unknown keys; every field has a description", () => {
  for (const [s, path] of nodes()) {
    if (s.properties) assert.equal(s.additionalProperties, false, `${path}: additionalProperties`);
    if ([].concat(s.type).includes("object") && !s.properties) assert.equal(typeof s.additionalProperties, "object", `${path}: a map needs a value schema`);
    for (const [k, v] of Object.entries(s.properties ?? {})) assert.ok(v.description || deref(v).description, `${path}/properties/${k}: description`);
  }
});
