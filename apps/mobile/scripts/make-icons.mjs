// Gera os ícones do app Finance (SPEC-0005, Marco 5) sem dependências: um "F" branco sobre o verde do painel.
//   node apps/mobile/scripts/make-icons.mjs
// Os PNG são escritos à mão (RGBA, deflate e CRC32 do node:zlib), com 4×4 amostras por pixel para suavizar as bordas.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");
const GREEN = [0x11, 0x63, 0x41, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];
const SS = 4;

// "F" em coordenadas de 0 a 1 dentro da caixa do símbolo: haste, barra de cima e barra do meio, com cantos arredondados.
const GLYPH = [
  { x0: 0.26, y0: 0.14, x1: 0.42, y1: 0.86, r: 0.05 },
  { x0: 0.26, y0: 0.14, x1: 0.78, y1: 0.30, r: 0.05 },
  { x0: 0.26, y0: 0.44, x1: 0.68, y1: 0.59, r: 0.05 },
];

function inRounded(x, y, { x0, y0, x1, y1, r }) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Desenha o símbolo numa tela quadrada. scale: fração da tela ocupada pela caixa do símbolo, centrada. */
function render(size, background, scale) {
  const pixels = Buffer.alloc(size * size * 4);
  const offset = (1 - scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const gx = ((px + (sx + 0.5) / SS) / size - offset) / scale;
          const gy = ((py + (sy + 0.5) / SS) / size - offset) / scale;
          if (GLYPH.some((shape) => inRounded(gx, gy, shape))) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = (py * size + px) * 4;
      for (let c = 0; c < 4; c++) pixels[i + c] = Math.round(background[c] * (1 - a) + WHITE[c] * a);
    }
  }
  return pixels;
}

function png(size, rgba) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits por canal, RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const files = [
  // Ícone completo: quadrado cheio, sem transparência (Expo pede 1024×1024).
  ["icon.png", 1024, GREEN, 0.62],
  // Ícone adaptativo do Android: o fundo é a cor do app.json; o símbolo fica dentro da área segura central.
  ["android-icon-foreground.png", 1024, CLEAR, 0.5],
  // Monocromático (ícones temáticos do Android 13+): o sistema pinta a forma.
  ["android-icon-monochrome.png", 1024, CLEAR, 0.5],
  // Abertura: símbolo branco sobre o fundo verde definido no app.json.
  ["splash-icon.png", 1024, CLEAR, 0.9],
  ["favicon.png", 48, GREEN, 0.7],
];
for (const [name, size, background, scale] of files) {
  writeFileSync(join(out, name), png(size, render(size, background, scale)));
  console.log("gerado", name, size + "×" + size);
}
