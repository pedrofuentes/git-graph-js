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
