// load.mjs: JSON and module projects, the line and column of a JSON syntax error, the error scanner against JSON.parse
// on mutated texts (seeded), missing files, wrong file types, no default export, a byte order mark, paths with spaces.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject, parseJson, jsonErrorAt, decodeText, LoadError } from "../engine/lib/load.mjs";

const TMP = mkdtempSync(join(tmpdir(), "jig load "));
after(() => rmSync(TMP, { recursive: true, force: true }));
const put = (name, text) => { const p = join(TMP, name); writeFileSync(p, text); return p; };
const rejects = (file, re) => assert.rejects(loadProject(file), (e) => e instanceof LoadError && re.test(e.message) && !e.message.includes("\n"));

test("a JSON project: kind json, the absolute path, a byte order mark is fine", async () => {
  const p = put("project.json", '{ "id": "box", "title": "Box" }');
  assert.deepEqual(await loadProject(p), { project: { id: "box", title: "Box" }, kind: "json", file: p });
  const bom = put("bom.json", `${String.fromCharCode(0xfeff)}{ "id": "bom" }`);
  assert.equal((await loadProject(bom)).project.id, "bom");
});

test("UTF-16 with a byte order mark (Windows PowerShell 5.1) loads as UTF-8 does; with none, one clear line", async () => {
  const shelf = readFileSync(new URL("../examples/pine-bookshelf/project.json", import.meta.url), "utf8");
  const want = (await loadProject(put("u8.json", shelf))).project;
  const le = put("le.json", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(shelf, "utf16le")]));
  const be = put("be.json", Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(shelf, "utf16le").swap16()]));
  assert.deepEqual((await loadProject(le)).project, want);
  assert.deepEqual((await loadProject(be)).project, want);
  await rejects(put("nobom.json", Buffer.from(shelf, "utf16le")), /looks like UTF-16 with no byte order mark\. Save it as UTF-8\./);
  await rejects(put("odd.json", Buffer.from([0xfe, 0xff, 0x00, 0x7b, 0x00])), /odd number of bytes/);
  assert.equal(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x41])), "A");
  assert.equal(decodeText(Buffer.from("plain", "utf8")), "plain");
});

test("a module project: the default export of .mjs and of a CommonJS .js", async () => {
  const m = put("project.mjs", 'const size = [10, 20, 30];\nexport default { id: "mod", parts: [{ size }] };\n');
  const r = await loadProject(m);
  assert.equal(r.kind, "module");
  assert.deepEqual(r.project, { id: "mod", parts: [{ size: [10, 20, 30] }] });
  const c = put("common.js", 'module.exports = { id: "cjs" };\n');
  assert.deepEqual((await loadProject(c)).project, { id: "cjs" });
});

test("a module with no default export, or a syntax error, gives one line", async () => {
  await rejects(put("named.mjs", "export const project = {};\n"), /named\.mjs: The module has no default export/);
  await rejects(put("broken.mjs", "export default {\n  id: 'x',\n  title: ;\n};\n"), /broken\.mjs:3: The module cannot be loaded: SyntaxError/);
  await rejects(put("throws.mjs", 'throw new TypeError("no project");\n'), /throws\.mjs: The module cannot be loaded: TypeError: no project$/);
});

test("missing files, folders and other file types", async () => {
  await rejects(join(TMP, "none.json"), /The file ".*none\.json" does not exist\./);
  mkdirSync(join(TMP, "dir.json"));
  await rejects(join(TMP, "dir.json"), /is not a file/);
  await rejects(put("notes.txt", "x"), /is not a project file/);
  await rejects("", /No project file is given/);
});

test("bad JSON names the file, the line and the column", async () => {
  const p = put("bad.json", '{\n  "id": "x"\n  "title": "y"\n}\n');
  await rejects(p, /bad\.json:3:3: The JSON is not valid: Expected ',' or '}' after property value\. Look for/);
  const at = (text) => { try { parseJson(text, "p.json"); } catch (e) { return /^p\.json:(\d+:\d+):/.exec(e.message)?.[1]; } return "ok"; };
  assert.equal(at('{"a": }'), "1:7");
  assert.equal(at("[1,]"), "1:4");
  assert.equal(at('{"a":1}}'), "1:8");
  assert.equal(at(""), "1:1");
  assert.equal(at('{\r\n"a": tru}'), "2:6");
  assert.equal(at('{"a": [1, 2]}'), "ok");
});

// mulberry32: a small seeded PRNG, so the mutated texts are the same on every run.
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("jsonErrorAt agrees with JSON.parse on 3000 mutated texts", () => {
  const rnd = prng(20261102), pick = (s) => s[Math.floor(rnd() * s.length)];
  const base = ['{"a": [1, -2.5e3, true, null], "b": {"c": "x\\"y\\u00e9"}}', "[0, 10, 1.5E+2, false]", '"text"', "{}", "[]", "  42 "];
  const chars = '{}[]",:0123456789.-+eE \n\ttruefalsn\\ua';
  for (let k = 0; k < 3000; k++) {
    let s = pick(base);
    for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
      const i = Math.floor(rnd() * (s.length + 1)), op = rnd();
      s = op < 0.4 ? s.slice(0, i) + s.slice(i + 1) : op < 0.8 ? s.slice(0, i) + pick(chars) + s.slice(i) : s.slice(0, i) + pick(chars) + s.slice(i + 1);
    }
    let valid = true;
    try { JSON.parse(s); } catch { valid = false; }
    const at = jsonErrorAt(s);
    assert.equal(at === null, valid, JSON.stringify(s));
    if (at !== null) assert.ok(at >= 0 && at <= s.length, JSON.stringify(s));
  }
});
