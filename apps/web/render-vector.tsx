import { createWriteStream } from "fs";
import { deflateSync } from "zlib";
import { getVectorFrame, VECTOR_W, VECTOR_H } from "./src/world/characters/vector/vectorSprites";
import { getAllPresets } from "./src/world/characters/characterPresets";

function writePNG(path: string, rgba: Uint8ClampedArray, w: number, h: number): Promise<void> {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const idat = deflateSync(raw);
  const table: number[] = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const b of td) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc, 0);
    return Buffer.concat([len, td, cb]);
  };
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
  return new Promise((res, rej) => { const s = createWriteStream(path); s.on("finish", res); s.on("error", rej); s.end(png); });
}
async function main() {
  const presets = getAllPresets();
  const cols = 3, rows = 3;
  const sheet = new Uint8ClampedArray(VECTOR_W * cols * VECTOR_H * rows * 4);
  for (const [i, preset] of presets.entries()) {
    const frame = getVectorFrame(preset, "front", "idle", 0, false, null);
    const cx = (i % cols) * VECTOR_W, cy = Math.floor(i / cols) * VECTOR_H;
    for (let y = 0; y < VECTOR_H; y++) for (let x = 0; x < VECTOR_W; x++) {
      const si = (y * VECTOR_W + x) * 4;
      const di = (((cy + y) * VECTOR_W * cols) + (cx + x)) * 4;
      sheet[di] = frame[si]; sheet[di+1] = frame[si+1]; sheet[di+2] = frame[si+2]; sheet[di+3] = frame[si+3];
    }
    console.log(preset.agentId);
  }
  await writePNG("/tmp/vector-new.png", sheet, VECTOR_W * cols, VECTOR_H * rows);
  console.log("done");
}
main();
