import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test CLI argument parsing logic as pure functions
// We test the parsing/matching helpers, not the full commander integration

describe('CLI argument parsing helpers', () => {
  describe('parseWrapArgs', () => {
    // Import dynamically since cli.ts may import graph which may not exist yet
    let parseWrapArgs: (args: string[]) => [number | null, number | null, number | null] | null;

    beforeEach(async () => {
      const mod = await import('../src/cli');
      parseWrapArgs = mod.parseWrapArgs;
    });

    it('returns default wrapping for empty args', () => {
      const result = parseWrapArgs([]);
      expect(result).toEqual([null, 0, 8]);
    });

    it('parses "none" as null (no wrapping)', () => {
      const result = parseWrapArgs(['none']);
      expect(result).toBeNull();
    });

    it('parses "auto" with defaults', () => {
      const result = parseWrapArgs(['auto']);
      expect(result).toEqual([null, null, null]);
    });

    it('parses "auto" with indent args', () => {
      const result = parseWrapArgs(['auto', '4', '8']);
      expect(result).toEqual([null, 4, 8]);
    });

    it('parses explicit width', () => {
      const result = parseWrapArgs(['80']);
      expect(result).toEqual([80, null, null]);
    });

    it('parses width with indents', () => {
      const result = parseWrapArgs(['80', '0', '8']);
      expect(result).toEqual([80, 0, 8]);
    });

    it('throws on non-numeric width', () => {
      expect(() => parseWrapArgs(['abc'])).toThrow();
    });
  });

  describe('parseColorArgs', () => {
    let parseColorArgs: (colorMode: string | undefined, noColor: boolean) => boolean;

    beforeEach(async () => {
      const mod = await import('../src/cli');
      parseColorArgs = mod.parseColorArgs;
    });

    it('returns false for no-color flag', () => {
      expect(parseColorArgs(undefined, true)).toBe(false);
    });

    it('returns true for "always"', () => {
      expect(parseColorArgs('always', false)).toBe(true);
    });

    it('returns false for "never"', () => {
      expect(parseColorArgs('never', false)).toBe(false);
    });

    it('throws for unknown mode', () => {
      expect(() => parseColorArgs('sometimes', false)).toThrow();
    });
  });

  describe('parseMaxCount', () => {
    let parseMaxCount: (value: string | undefined) => number | undefined;

    beforeEach(async () => {
      const mod = await import('../src/cli');
      parseMaxCount = mod.parseMaxCount;
    });

    it('returns undefined for undefined input', () => {
      expect(parseMaxCount(undefined)).toBeUndefined();
    });

    it('parses valid number', () => {
      expect(parseMaxCount('100')).toBe(100);
    });

    it('throws for non-numeric input', () => {
      expect(() => parseMaxCount('abc')).toThrow();
    });
  });
});
