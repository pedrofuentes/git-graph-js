const subsetFont = require('subset-font');
const fs = require('fs');

const fontBuffer = fs.readFileSync('fonts/KreativeSquareSM.ttf');

// Characters needed for git graph SVG rendering:
// Include full blocks so we can swap characters without re-subsetting
const chars = [
  // ASCII printable U+0020-U+007E
  ...[...Array(95)].map((_, i) => String.fromCodePoint(0x20 + i)),
  // Latin-1 Supplement U+00A0-U+00FF
  ...[...Array(96)].map((_, i) => String.fromCodePoint(0xA0 + i)),
  // Modifier letters U+02B0-U+02FF (includes ˄ ˅)
  ...[...Array(80)].map((_, i) => String.fromCodePoint(0x02B0 + i)),
  // Arrows U+2190-U+21FF
  ...[...Array(112)].map((_, i) => String.fromCodePoint(0x2190 + i)),
  // Mathematical Operators U+2200-U+22FF
  ...[...Array(256)].map((_, i) => String.fromCodePoint(0x2200 + i)),
  // Box Drawing U+2500-U+257F (full block)
  ...[...Array(128)].map((_, i) => String.fromCodePoint(0x2500 + i)),
  // Block Elements U+2580-U+259F
  ...[...Array(32)].map((_, i) => String.fromCodePoint(0x2580 + i)),
  // Geometric Shapes U+25A0-U+25FF (includes ● ○)
  ...[...Array(96)].map((_, i) => String.fromCodePoint(0x25A0 + i)),
  // Misc Symbols U+2600-U+26FF
  ...[...Array(256)].map((_, i) => String.fromCodePoint(0x2600 + i)),
  // Dingbats U+2700-U+27BF
  ...[...Array(192)].map((_, i) => String.fromCodePoint(0x2700 + i)),
  // PUA U+E000-U+F0FF (Kreative Square has custom glyphs here)
  ...[...Array(0x1100)].map((_, i) => String.fromCodePoint(0xE000 + i)),
].join('');

(async () => {
  const subset = await subsetFont(fontBuffer, chars, { targetFormat: 'woff2' });
  const b64 = subset.toString('base64');
  fs.writeFileSync('fonts/KreativeSquareSM-subset.woff2', subset);
  fs.writeFileSync('fonts/KreativeSquareSM-subset.woff2.b64', b64);
  console.log('Subset WOFF2 size:', subset.length, 'bytes');
  console.log('Base64 length:', b64.length, 'chars');
})();
