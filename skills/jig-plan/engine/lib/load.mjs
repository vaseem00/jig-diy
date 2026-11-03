// Reads a project file. project.json is parsed as data (a syntax error gives its line and column); project.mjs or .js
// is imported and its default export is the project. Every failure is a LoadError with one line for people.

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export class LoadError extends Error {
  constructor(message, cause) { super(message, cause ? { cause } : undefined); this.name = "LoadError"; }
}

const KINDS = { ".json": "json", ".mjs": "module", ".js": "module" };
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`); // a byte order mark, which JSON.parse does not accept
const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

// Offset of the first JSON syntax error in s, or null. Used when JSON.parse gives no position.
export function jsonErrorAt(s) {
  let i = 0;
  const fail = () => { throw i; };
  const ws = () => { while (i < s.length && " \t\n\r".includes(s[i])) i++; };
  const str = () => {
    i++;
    while (i < s.length && s[i] !== '"') {
      if (s[i] < " ") fail();
      if (s[i] === "\\") { i++; if (s[i] === "u") { if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) fail(); i += 4; } else if (!'"\\/bfnrt'.includes(s[i] || "x")) fail(); }
      i++;
    }
    if (i >= s.length) fail();
    i++;
  };
  const list = (close, item) => {
    i++; ws();
    if (s[i] === close) return void i++;
    for (;;) { item(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === close) return void i++; fail(); }
  };
  const value = () => {
    ws();
    if (s[i] === "{") return list("}", () => { ws(); if (s[i] !== '"') fail(); str(); ws(); if (s[i] !== ":") fail(); i++; value(); });
    if (s[i] === "[") return list("]", value);
    if (s[i] === '"') return str();
    NUM.lastIndex = i;
    const m = NUM.exec(s);
    if (!m) fail();
    i += m[0].length;
  };
  try { value(); ws(); return i < s.length ? i : null; } catch (e) { if (typeof e === "number") return e; throw e; }
}

// decodeText(buf, name) -> the text of a file: UTF-8 (with or without a byte order mark), or UTF-16 LE or BE with a
// byte order mark (Windows PowerShell 5.1 writes UTF-16 LE with > and Out-File). UTF-16 with no byte order mark is a
// LoadError, because it would decode to garbled text.
export function decodeText(buf, name = "the file") {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf ?? "");
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return b.subarray(3).toString("utf8");
  if (b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString("utf16le");
  if (b[0] === 0xfe && b[1] === 0xff) {
    const s = b.subarray(2);
    if (s.length % 2) throw new LoadError(`The file "${name}" is UTF-16 with an odd number of bytes. Save it again as UTF-8.`);
    return Buffer.from(s).swap16().toString("utf16le");
  }
  if (b.subarray(0, 4).includes(0)) throw new LoadError(`The file "${name}" looks like UTF-16 with no byte order mark. Save it as UTF-8.`);
  return b.toString("utf8");
}

// 1-based line and column of an offset.
function lineCol(s, at) {
  const before = s.slice(0, at).split(/\r\n|\r|\n/);
  return { line: before.length, column: before.at(-1).length + 1 };
}

// JSON.parse with a LoadError that names the file, the line and the column.
export function parseJson(text, name = "project.json") {
  const s = String(text).replace(BOM, "");
  try { return JSON.parse(s); } catch (e) {
    const m = /\(line (\d+) column (\d+)\)/.exec(e.message), at = m ? null : jsonErrorAt(s);
    const pos = m ? { line: +m[1], column: +m[2] } : lineCol(s, at ?? s.length);
    const why = e.message.replace(/ in JSON at position \d+.*$/s, "").replace(/, ".*" is not valid JSON$/s, "").replace(/\.$/, "");
    throw new LoadError(`${name}:${pos.line}:${pos.column}: The JSON is not valid: ${why}. Look for a missing or extra comma, quote or bracket near this place.`, e);
  }
}

// The line of a module syntax error. import() does not give it, so node --check reads the file ("file:///...:12").
function syntaxLine(path) {
  try {
    const r = spawnSync(process.execPath, ["--check", path], { encoding: "utf8", timeout: 10000, windowsHide: true });
    return /:(\d+)\r?\n/.exec(r.stderr ?? "")?.[1] ?? null;
  } catch { return null; }
}

// loadProject(file) -> { project, kind: "json" | "module", file: absolute path }.
export async function loadProject(file) {
  const name = String(file ?? ""), path = resolve(name), kind = KINDS[extname(path).toLowerCase()];
  if (!name) throw new LoadError("No project file is given. Give the path of a project.json file.");
  if (!kind) throw new LoadError(`"${name}" is not a project file. Use a .json file, or a .mjs or .js module.`);
  let st = null;
  try { st = statSync(path); } catch (e) {
    throw new LoadError(e.code === "ENOENT" ? `The file "${name}" does not exist.` : `The file "${name}" cannot be read (${e.code ?? e.message}).`, e);
  }
  if (!st.isFile()) throw new LoadError(`"${name}" is not a file.`);
  if (kind === "json") {
    let buf;
    try { buf = readFileSync(path); } catch (e) { throw new LoadError(`The file "${name}" cannot be read (${e.code ?? e.message}).`, e); }
    return { project: parseJson(decodeText(buf, name), name), kind, file: path };
  }
  const url = pathToFileURL(path).href;
  let mod;
  try { mod = await import(url); } catch (e) {
    const at = e?.name === "SyntaxError" ? syntaxLine(path) : null;
    throw new LoadError(`${name}${at ? `:${at}` : ""}: The module cannot be loaded: ${e?.name ?? "Error"}: ${e?.message ?? e}`, e);
  }
  if (!("default" in mod)) throw new LoadError(`${name}: The module has no default export. Write "export default { ... }" with the project object.`);
  return { project: mod.default, kind, file: path };
}
