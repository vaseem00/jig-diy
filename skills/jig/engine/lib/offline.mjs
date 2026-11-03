// three.js for --offline builds: the exact files the page's import map uses, pinned by sha384. loadThree() reads a
// verified cache, or downloads from jsDelivr, checks the hash and writes the cache. I/O module.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const THREE_VERSION = "0.160.0";
export const THREE_BASE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
// specifier: the import-map key the viewer imports; url: the file on jsDelivr; sha384: base64 digest of its bytes.
export const THREE_FILES = Object.freeze([
  Object.freeze({ specifier: "three", url: `${THREE_BASE}/build/three.module.min.js`, sha384: "8/hf5tabFfIo0BPku31TKUvGIKpWGYaMwNtlSNqNyZzXgZCMd4lnOGWbJElML9dv" }),
  Object.freeze({ specifier: "three/addons/controls/OrbitControls.js", url: `${THREE_BASE}/examples/jsm/controls/OrbitControls.js`, sha384: "qlO/ZugKPxAQUAvTlQoo0QECzxJIJySZmCF/DHdb2Xn/hHndFwX/vfUAC9Hbk6LP" }),
]);
export const THREE_NOTICE = `three.js ${THREE_VERSION} (three.module.min.js, OrbitControls.js). MIT License. Copyright 2010-2023 Three.js Authors. https://github.com/mrdoob/three.js/blob/r160/LICENSE`;
// The LICENSE file of three.js r160, word for word. An --offline page holds three.js, so it carries this text too.
export const THREE_LICENSE = `The MIT License

Copyright © 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`;

const sha384 = (buf) => createHash("sha384").update(buf).digest("base64");
const why = (e) => e?.cause?.message ?? e?.message ?? String(e);
// A cache path that is a symbolic link or a hard link to another file. The cache is in a shared temp folder, so the
// file is not written through such a link (a missing file is not a link).
const linked = (p) => { try { const s = lstatSync(p); return s.isSymbolicLink() || s.nlink > 1; } catch { return false; } };

// loadThree({ cacheDir, fetch, files }) -> { [specifier]: source }. cacheDir: optional folder for the verified files
// (kept under three@<version>/). fetch and files (default THREE_FILES): injectable for tests. Throws an Error with a
// fix when a file cannot be had or fails its hash.
export async function loadThree({ cacheDir = null, fetch = globalThis.fetch, files = THREE_FILES } = {}) {
  const out = {};
  for (const f of files) {
    const file = cacheDir ? join(cacheDir, `three@${THREE_VERSION}`, f.url.slice(f.url.lastIndexOf("/") + 1)) : null;
    let buf = null;
    if (file) {
      try { const b = readFileSync(file); if (sha384(b) === f.sha384) buf = b; } catch { /* no cache yet */ }
    }
    if (!buf) {
      if (typeof fetch !== "function") throw new Error(`Cannot download ${f.url}: this Node.js has no fetch. Use Node.js 22 or later.`);
      let res;
      try { res = await fetch(f.url); } catch (e) {
        throw new Error(`Cannot download ${f.url}: ${why(e)}. Connect to the network, or build without --offline.`);
      }
      if (!res?.ok) throw new Error(`Cannot download ${f.url}: HTTP ${res?.status ?? "error"}. Try again later, or build without --offline.`);
      buf = Buffer.from(await res.arrayBuffer());
      const got = sha384(buf);
      if (got !== f.sha384) throw new Error(`${f.url} failed the integrity check: expected sha384-${f.sha384}, got sha384-${got}. Try again later, or build without --offline.`);
      if (file && !linked(file)) {
        try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, buf); } catch { /* a read-only cache only costs a download next time */ }
      }
    }
    out[f.specifier] = buf.toString("utf8");
  }
  return out;
}
