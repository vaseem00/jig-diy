// offline.mjs: the pinned three.js files and loadThree() with an injected fetch: hash check, cache read and write,
// a corrupt cache, HTTP and network failures. No test touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, linkSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { THREE_VERSION, THREE_BASE, THREE_FILES, THREE_NOTICE, THREE_LICENSE, loadThree } from "../engine/lib/offline.mjs";
import { compute } from "../engine/lib/model.mjs";
import { renderPage } from "../engine/lib/page.mjs";

const sha = (s) => createHash("sha384").update(s).digest("base64");
const SRC = { a: "export const A = 1;\n", b: "import { A } from 'three';\nexport const B = A;\n" };
const FILES = [
  { specifier: "three", url: "https://cdn.example/three@0.160.0/build/a.js", sha384: sha(SRC.a) },
  { specifier: "three/addons/b.js", url: "https://cdn.example/three@0.160.0/examples/b.js", sha384: sha(SRC.b) },
];
// A fetch that serves body(url) and counts calls.
function fakeFetch(body = (url) => (url.endsWith("a.js") ? SRC.a : SRC.b), status = 200) {
  const f = async (url) => { f.calls.push(url); return { ok: status === 200, status, arrayBuffer: async () => new TextEncoder().encode(body(url)).buffer }; };
  f.calls = [];
  return f;
}
const tmp = () => mkdtempSync(join(tmpdir(), "jig-offline-"));

test("pinned files: three.js 0.160.0 on jsDelivr, the two import-map specifiers, sha384 digests, MIT notice", () => {
  assert.equal(THREE_VERSION, "0.160.0");
  assert.equal(THREE_BASE, "https://cdn.jsdelivr.net/npm/three@0.160.0");
  assert.deepEqual(THREE_FILES.map((f) => f.specifier), ["three", "three/addons/controls/OrbitControls.js"]);
  assert.deepEqual(THREE_FILES.map((f) => f.url), [`${THREE_BASE}/build/three.module.min.js`, `${THREE_BASE}/examples/jsm/controls/OrbitControls.js`]);
  for (const f of THREE_FILES) assert.match(f.sha384, /^[A-Za-z0-9+/]{64}$/);
  assert.ok(Object.isFrozen(THREE_FILES) && THREE_FILES.every(Object.isFrozen));
  assert.match(THREE_NOTICE, /MIT License/);
});

test("the three.js licence: the r160 LICENSE text, the same as THIRD_PARTY_NOTICES.md, safe in an HTML comment", () => {
  assert.ok(THREE_LICENSE.startsWith("The MIT License\n\nCopyright © 2010-2023 three.js authors\n\nPermission is hereby granted, free of charge,"));
  assert.ok(THREE_LICENSE.endsWith("OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."));
  assert.doesNotMatch(THREE_LICENSE, /--|[<>\r]/);
  // the fenced block of section 1 in THIRD_PARTY_NOTICES.md holds the same text
  const notices = readFileSync(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8").replace(/\r\n?/g, "\n");
  const blocks = [...notices.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]).filter((b) => b.startsWith("The MIT License"));
  assert.equal(blocks.length, 1, "one MIT licence block in THIRD_PARTY_NOTICES.md");
  assert.equal(blocks[0], THREE_LICENSE);
});

test("an --offline page holds the full three.js licence; an online page does not change", () => {
  const model = compute(JSON.parse(readFileSync(new URL("../examples/pine-bookshelf/project.json", import.meta.url), "utf8")));
  const three = { three: "export const REVISION = '160';\n", "three/addons/controls/OrbitControls.js": "export class OrbitControls {}\n" };
  for (const artifact of [false, true]) {
    const off = renderPage(model, { offline: true, three, artifact }), on = renderPage(model, { artifact });
    assert.ok(off.includes(`<!--\n${THREE_LICENSE}\n-->\n<script type="importmap">`), "the licence comes before the inlined three.js");
    assert.ok(off.includes("Permission is hereby granted, free of charge") && off.includes("Copyright © 2010-2023 three.js authors"));
    assert.ok(!on.includes("Permission is hereby granted"), "an online page does not hold three.js, so it needs no licence text");
    assert.equal(on.split("<!--").length - 1, 1, "an online page has one comment: the short notice");
    assert.ok(on.includes(`<!-- ${THREE_NOTICE} -->\n<script type="importmap">`));
  }
});

// The byte sizes of the pinned three.module.min.js and OrbitControls.js (r160). engine/docs/cli.md and the jig and
// jig-3d SKILL.md files say an --offline page is "about 0.9 MB" larger; if this test fails, change those docs too.
const THREE_BYTES = { three: 670681, "three/addons/controls/OrbitControls.js": 29868 };

test("an --offline page is about 0.9 MB larger than the online page (stubs of the real three.js sizes)", () => {
  const model = compute(JSON.parse(readFileSync(new URL("../examples/pine-bookshelf/project.json", import.meta.url), "utf8")));
  const three = Object.fromEntries(Object.entries(THREE_BYTES).map(([k, n]) => [k, "x".repeat(n)]));
  const diff = Buffer.byteLength(renderPage(model, { offline: true, three })) - Buffer.byteLength(renderPage(model));
  assert.ok(diff >= 850_000 && diff <= 1_000_000, `offline - online = ${diff} bytes`);
});

test("loadThree: downloads, verifies and caches; the next call reads the cache with no fetch", async () => {
  const dir = tmp();
  try {
    const f1 = fakeFetch();
    assert.deepEqual(await loadThree({ cacheDir: dir, fetch: f1, files: FILES }), { three: SRC.a, "three/addons/b.js": SRC.b });
    assert.deepEqual(f1.calls, FILES.map((f) => f.url));
    assert.equal(readFileSync(join(dir, "three@0.160.0", "a.js"), "utf8"), SRC.a);
    const f2 = fakeFetch();
    assert.deepEqual(await loadThree({ cacheDir: dir, fetch: f2, files: FILES }), { three: SRC.a, "three/addons/b.js": SRC.b });
    assert.equal(f2.calls.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadThree: a cache file with the wrong hash is fetched again and replaced", async () => {
  const dir = tmp();
  try {
    await loadThree({ cacheDir: dir, fetch: fakeFetch(), files: FILES });
    writeFileSync(join(dir, "three@0.160.0", "b.js"), "tampered");
    const f = fakeFetch();
    assert.equal((await loadThree({ cacheDir: dir, fetch: f, files: FILES }))["three/addons/b.js"], SRC.b);
    assert.deepEqual(f.calls, [FILES[1].url]);
    assert.equal(readFileSync(join(dir, "three@0.160.0", "b.js"), "utf8"), SRC.b);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadThree: a cache file that is a hard link to another file is not written through", async () => {
  const dir = tmp();
  try {
    const victim = join(dir, "victim.txt"), cache = join(dir, "three@0.160.0");
    writeFileSync(victim, "keep");
    mkdirSync(cache);
    linkSync(victim, join(cache, "a.js"));
    const f = fakeFetch();
    assert.equal((await loadThree({ cacheDir: dir, fetch: f, files: FILES })).three, SRC.a, "the download is still used");
    assert.equal(readFileSync(victim, "utf8"), "keep", "the linked file is unchanged");
    assert.equal(readFileSync(join(cache, "b.js"), "utf8"), SRC.b, "a normal cache file is written");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadThree: a download with the wrong hash throws and is not cached", async () => {
  const dir = tmp();
  try {
    const bad = fakeFetch((url) => (url.endsWith("a.js") ? "evil()" : SRC.b));
    await assert.rejects(loadThree({ cacheDir: dir, fetch: bad, files: FILES }), (e) =>
      e instanceof Error && e.message.includes("failed the integrity check") && e.message.includes(`expected sha384-${FILES[0].sha384}`) && e.message.includes(`got sha384-${sha("evil()")}`));
    assert.ok(!existsSync(join(dir, "three@0.160.0", "a.js")));
    // the real pinned files reject bytes that are not three.js too
    await assert.rejects(loadThree({ fetch: fakeFetch(() => "not three") }), /three\.module\.min\.js failed the integrity check/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadThree: HTTP errors, network errors and no fetch give a clear Error", async () => {
  await assert.rejects(loadThree({ fetch: fakeFetch(undefined, 404), files: FILES }), /Cannot download https:\/\/cdn\.example\/.*a\.js: HTTP 404/);
  const down = async () => { throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND cdn.example") }); };
  await assert.rejects(loadThree({ fetch: down, files: FILES }), /Cannot download .*: getaddrinfo ENOTFOUND cdn\.example\. Connect to the network, or build without --offline\./);
  await assert.rejects(loadThree({ fetch: null, files: FILES }), /no fetch/);
});

test("loadThree: no cacheDir fetches every time; an unwritable cache still returns the sources", async () => {
  const f = fakeFetch();
  await loadThree({ fetch: f, files: FILES });
  await loadThree({ fetch: f, files: FILES });
  assert.equal(f.calls.length, 4);
  const dir = tmp(), file = join(dir, "not-a-folder");
  try {
    writeFileSync(file, "x");
    assert.equal((await loadThree({ cacheDir: file, fetch: fakeFetch(), files: FILES })).three, SRC.a);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
