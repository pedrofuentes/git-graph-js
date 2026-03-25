import { describe, it, expect, beforeAll } from 'vitest';
import { toTerminalColor, NAMED_COLORS } from '../src/print/colors';

describe('NAMED_COLORS', () => {
  it('contains exactly 16 named colors', () => {
    expect(Object.keys(NAMED_COLORS)).toHaveLength(16);
  });

  it.each([
    ['black', 0],
    ['red', 1],
    ['green', 2],
    ['yellow', 3],
    ['blue', 4],
    ['magenta', 5],
    ['cyan', 6],
    ['white', 7],
    ['bright_black', 8],
    ['bright_red', 9],
    ['bright_green', 10],
    ['bright_yellow', 11],
    ['bright_blue', 12],
    ['bright_magenta', 13],
    ['bright_cyan', 14],
    ['bright_white', 15],
  ])('maps "%s" to %i', (name, index) => {
    expect(NAMED_COLORS[name]).toBe(index);
  });
});

describe('toTerminalColor', () => {
  it('returns the correct index for named colors', () => {
    expect(toTerminalColor('red')).toBe(1);
    expect(toTerminalColor('bright_cyan')).toBe(14);
  });

  it('parses numeric string input as a number', () => {
    expect(toTerminalColor('5')).toBe(5);
    expect(toTerminalColor('0')).toBe(0);
    expect(toTerminalColor('255')).toBe(255);
    expect(toTerminalColor('128')).toBe(128);
  });

  it('throws on unknown color name', () => {
    expect(() => toTerminalColor('purple')).toThrow('Color purple not found');
    expect(() => toTerminalColor('foobar')).toThrow('Color foobar not found');
  });

  it('throws on empty string', () => {
    expect(() => toTerminalColor('')).toThrow('Color  not found');
  });

  it('throws on negative numeric string', () => {
    expect(() => toTerminalColor('-1')).toThrow('Color -1 not found');
  });

  it('throws on numeric string exceeding u8 range', () => {
    expect(() => toTerminalColor('256')).toThrow('Color 256 not found');
  });

  it('throws on non-integer numeric string', () => {
    expect(() => toTerminalColor('3.5')).toThrow('Color 3.5 not found');
  });

  it('prefers named color over numeric parse', () => {
    // Named colors take priority; this verifies lookup order
    expect(toTerminalColor('black')).toBe(0);
  });
});

describe('ansi256ToHex', () => {
  // Lazy import to avoid breaking if function doesn't exist yet
  let ansi256ToHex: (index: number) => string;
  beforeAll(async () => {
    const mod = await import('../src/print/colors');
    ansi256ToHex = mod.ansi256ToHex;
  });

  it('maps standard 16 colors to expected hex values', () => {
    // Black
    expect(ansi256ToHex(0)).toBe('#000000');
    // Red
    expect(ansi256ToHex(1)).toBe('#aa0000');
    // Green
    expect(ansi256ToHex(2)).toBe('#00aa00');
    // Yellow
    expect(ansi256ToHex(3)).toBe('#aa5500');
    // Blue
    expect(ansi256ToHex(4)).toBe('#0000aa');
    // Magenta
    expect(ansi256ToHex(5)).toBe('#aa00aa');
    // Cyan
    expect(ansi256ToHex(6)).toBe('#00aaaa');
    // White
    expect(ansi256ToHex(7)).toBe('#aaaaaa');
    // Bright black
    expect(ansi256ToHex(8)).toBe('#555555');
    // Bright red
    expect(ansi256ToHex(9)).toBe('#ff5555');
    // Bright green
    expect(ansi256ToHex(10)).toBe('#55ff55');
    // Bright yellow
    expect(ansi256ToHex(11)).toBe('#ffff55');
    // Bright blue
    expect(ansi256ToHex(12)).toBe('#5555ff');
    // Bright magenta
    expect(ansi256ToHex(13)).toBe('#ff55ff');
    // Bright cyan
    expect(ansi256ToHex(14)).toBe('#55ffff');
    // Bright white
    expect(ansi256ToHex(15)).toBe('#ffffff');
  });

  it('maps 6x6x6 color cube correctly (indices 16-231)', () => {
    // Index 16 = rgb(0,0,0) in cube
    expect(ansi256ToHex(16)).toBe('#000000');
    // Index 21 = rgb(0,0,5) → (0,0,255)
    expect(ansi256ToHex(21)).toBe('#0000ff');
    // Index 196 = rgb(5,0,0) → (255,0,0)
    expect(ansi256ToHex(196)).toBe('#ff0000');
    // Index 46 = rgb(0,5,0) → (0,255,0)
    expect(ansi256ToHex(46)).toBe('#00ff00');
    // Index 231 = rgb(5,5,5) → (255,255,255)
    expect(ansi256ToHex(231)).toBe('#ffffff');
    // Index 172: i=156, r=floor(156/36)=4→215, g=floor(12/6)=2→135, b=0→0
    expect(ansi256ToHex(172)).toBe('#d78700');
  });

  it('maps grayscale ramp correctly (indices 232-255)', () => {
    // Index 232 = darkest gray (8)
    expect(ansi256ToHex(232)).toBe('#080808');
    // Index 255 = lightest gray (238)
    expect(ansi256ToHex(255)).toBe('#eeeeee');
    // Index 244 = mid gray: 8 + (244-232)*10 = 8+120 = 128
    expect(ansi256ToHex(244)).toBe('#808080');
  });

  it('throws for out-of-range indices', () => {
    expect(() => ansi256ToHex(-1)).toThrow();
    expect(() => ansi256ToHex(256)).toThrow();
  });
});
