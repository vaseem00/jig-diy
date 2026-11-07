// scripts/anim-webp.mjs: still WebP frames join into one animated WebP (VP8X with the animation flag, ANIM, one ANMF
// for each frame with its time), and frames of another size are refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { animWebp, chunks, sizeOf } from "../scripts/anim-webp.mjs";

const still = readFileSync(new URL("../.github/assets/dark.webp", import.meta.url));
const other = readFileSync(new URL("../.github/assets/cut.webp", import.meta.url));

test("two frames: VP8X with the animation flag and the canvas size, ANIM with an endless loop, two ANMF with their times", () => {
  const { width, height } = sizeOf(chunks(still));
  const out = animWebp([still, still], { delays: [150, 900] });
  assert.equal(out.readUInt32LE(4), out.length - 8, "the RIFF size");
  const list = chunks(out);
  assert.deepEqual(list.map((c) => c.id), ["VP8X", "ANIM", "ANMF", "ANMF"]);
  assert.equal(list[0].data[0] & 0x02, 0x02, "the animation flag");
  assert.deepEqual(sizeOf(list), { width, height });
  assert.equal(list[1].data.readUInt16LE(4), 0, "loop for ever");
  assert.deepEqual(list.slice(2).map((c) => c.data.readUIntLE(12, 3)), [150, 900]);
  assert.deepEqual(list.slice(2).map((c) => [1 + c.data.readUIntLE(6, 3), 1 + c.data.readUIntLE(9, 3)]), [[width, height], [width, height]]);
});

test("frames of different sizes and a file that is not WebP are refused", () => {
  assert.throws(() => animWebp([still, other]), /frame 2 is \d+ x \d+, not/);
  assert.throws(() => animWebp([Buffer.from("not a webp file at all")]), /not a WebP file/);
  assert.throws(() => animWebp([]), /no frames/);
});
