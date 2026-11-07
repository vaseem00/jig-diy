#!/usr/bin/env node
// Joins still WebP frames (a headless Chrome capture writes them) into one looping animated WebP, with no
// dependencies: the frames' VP8 or VP8L data goes into ANMF chunks unchanged. GitHub shows an animated WebP inline in a
// README, as a silent video.
//
//   node scripts/anim-webp.mjs <out.webp> [--ms 200] [--hold-last ms] <frame.webp> ...
//
// Every frame must have the same size. --ms is the time of each frame; --hold-last keeps the last frame longer.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const u24 = (v) => Buffer.from([v & 255, (v >> 8) & 255, (v >> 16) & 255]);
function chunk(id, data) {
  const head = Buffer.alloc(8);
  head.write(id, 0, "ascii");
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

// The chunks of one WebP file: [{ id, data, raw }] (raw: the chunk with its header and padding).
export function chunks(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") throw new Error("not a WebP file");
  const out = [];
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString("ascii", p, p + 4), size = buf.readUInt32LE(p + 4), end = p + 8 + size + (size % 2);
    out.push({ id, data: buf.subarray(p + 8, p + 8 + size), raw: buf.subarray(p, Math.min(end, buf.length)) });
    p = end;
  }
  return out;
}

// { width, height } of a still WebP: from VP8X, else from the VP8 or VP8L bitstream header.
export function sizeOf(list) {
  const x = list.find((c) => c.id === "VP8X"), vp8 = list.find((c) => c.id === "VP8 "), vp8l = list.find((c) => c.id === "VP8L");
  if (x) return { width: 1 + x.data.readUIntLE(4, 3), height: 1 + x.data.readUIntLE(7, 3) };
  if (vp8) return { width: vp8.data.readUInt16LE(6) & 0x3fff, height: vp8.data.readUInt16LE(8) & 0x3fff };
  if (vp8l) { const b = vp8l.data.readUInt32LE(1); return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) }; }
  throw new Error("no image data in the WebP file");
}

// animWebp([Buffer], { delays: [ms], loop }) -> Buffer of one animated WebP (loop 0: for ever).
export function animWebp(frames, { delays = [], loop = 0 } = {}) {
  if (!frames.length) throw new Error("no frames");
  const parsed = frames.map((f) => { const list = chunks(f); return { list, size: sizeOf(list) }; });
  const { width, height } = parsed[0].size;
  parsed.forEach((f, i) => { if (f.size.width !== width || f.size.height !== height) throw new Error(`frame ${i + 1} is ${f.size.width} x ${f.size.height}, not ${width} x ${height}`); });
  const alpha = parsed.some((f) => f.list.some((c) => c.id === "ALPH" || c.id === "VP8L"));
  const vp8x = Buffer.concat([Buffer.from([0x02 | (alpha ? 0x10 : 0), 0, 0, 0]), u24(width - 1), u24(height - 1)]);
  const anim = Buffer.alloc(6);
  anim.writeUInt16LE(loop, 4); // background colour 0 (transparent); loop count
  const body = [chunk("VP8X", vp8x), chunk("ANIM", anim)];
  parsed.forEach((f, i) => {
    const image = f.list.filter((c) => c.id === "ALPH" || c.id === "VP8 " || c.id === "VP8L").map((c) => c.raw);
    const ms = Math.max(20, Math.min(0xffffff, Math.round(delays[i] ?? 100)));
    const head = Buffer.concat([u24(0), u24(0), u24(width - 1), u24(height - 1), u24(ms), Buffer.from([0x02])]); // no blend, no disposal
    body.push(chunk("ANMF", Buffer.concat([head, ...image])));
  });
  const data = Buffer.concat([Buffer.from("WEBP", "ascii"), ...body]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(data.length, 4);
  return Buffer.concat([riff, data]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const ms = Number(opt("--ms", 200)), hold = Number(opt("--hold-last", 0)), [out, ...files] = args;
  if (!out || !files.length || !/\.webp$/i.test(out)) {
    console.error("usage: node scripts/anim-webp.mjs <out.webp> [--ms 200] [--hold-last ms] <frame.webp> ...");
    process.exit(2);
  }
  const delays = files.map((_, i) => (i === files.length - 1 && hold > 0 ? hold : ms));
  const buf = animWebp(files.map((f) => readFileSync(f)), { delays });
  writeFileSync(out, buf);
  console.error(`Wrote ${out}: ${files.length} frames, ${Math.round(buf.length / 1024)} KiB.`);
}
