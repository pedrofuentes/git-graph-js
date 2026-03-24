import { describe, it, expect } from 'vitest';
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
