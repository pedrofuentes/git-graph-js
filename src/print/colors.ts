export const NAMED_COLORS: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  bright_black: 8,
  bright_red: 9,
  bright_green: 10,
  bright_yellow: 11,
  bright_blue: 12,
  bright_magenta: 13,
  bright_cyan: 14,
  bright_white: 15,
};

/**
 * Standard 16 ANSI colors mapped to hex (typical dark terminal theme).
 */
const STANDARD_16_HEX: string[] = [
  '#000000', // 0  black
  '#aa0000', // 1  red
  '#00aa00', // 2  green
  '#aa5500', // 3  yellow
  '#0000aa', // 4  blue
  '#aa00aa', // 5  magenta
  '#00aaaa', // 6  cyan
  '#aaaaaa', // 7  white
  '#555555', // 8  bright black
  '#ff5555', // 9  bright red
  '#55ff55', // 10 bright green
  '#ffff55', // 11 bright yellow
  '#5555ff', // 12 bright blue
  '#ff55ff', // 13 bright magenta
  '#55ffff', // 14 bright cyan
  '#ffffff', // 15 bright white
];

const CUBE_STEPS = [0, 95, 135, 175, 215, 255];

/**
 * Convert an ANSI-256 color index (0–255) to a hex color string.
 */
export function ansi256ToHex(index: number): string {
  if (index < 0 || index > 255 || !Number.isInteger(index)) {
    throw new Error(`ANSI-256 color index out of range: ${index}`);
  }
  if (index < 16) {
    return STANDARD_16_HEX[index];
  }
  if (index < 232) {
    const i = index - 16;
    const r = CUBE_STEPS[Math.floor(i / 36)];
    const g = CUBE_STEPS[Math.floor((i % 36) / 6)];
    const b = CUBE_STEPS[i % 6];
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  // Grayscale ramp 232–255
  const gray = 8 + (index - 232) * 10;
  return `#${hex2(gray)}${hex2(gray)}${hex2(gray)}`;
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function toTerminalColor(color: string): number {
  const named = NAMED_COLORS[color];
  if (named !== undefined) {
    return named;
  }

  const parsed = Number(color);
  if (color !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 255) {
    return parsed;
  }

  throw new Error(`Color ${color} not found`);
}
