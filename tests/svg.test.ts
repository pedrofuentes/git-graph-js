import { describe, it, expect } from 'vitest';
import { parseAnsi, printSvg, commitCoord } from '../src/print/svg';
import { Characters } from '../src/settings';
import type { Settings } from '../src/settings';
import { BranchSettingsDef, BranchSettings, MergePatterns } from '../src/settings';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    reverseCommitOrder: false,
    debug: false,
    compact: false,
    colored: true,
    includeRemote: false,
    format: { type: 'OneLine' },
    wrapping: null,
    characters: Characters.thin(),
    branchOrder: { type: 'ShortestFirst', forward: true },
    branches: BranchSettings.from(BranchSettingsDef.none()),
    mergePatterns: MergePatterns.default(),
    ...overrides,
  };
}

describe('commitCoord', () => {
  it('returns correct coordinates for index 0, column 0', () => {
    const [x, y] = commitCoord(0, 0);
    expect(x).toBe(15);
    expect(y).toBe(15);
  });

  it('returns correct coordinates for index 2, column 3', () => {
    const [x, y] = commitCoord(2, 3);
    expect(x).toBeCloseTo(60);
    expect(y).toBeCloseTo(45);
  });

  it('scales linearly', () => {
    const [x1, y1] = commitCoord(1, 1);
    const [x2, y2] = commitCoord(2, 2);
    expect(x2 - x1).toBeCloseTo(15);
    expect(y2 - y1).toBeCloseTo(15);
  });

  it('swaps axes when horizontal is true', () => {
    const [vx, vy] = commitCoord(2, 3);        // vertical: x=column, y=index
    const [hx, hy] = commitCoord(2, 3, true);   // horizontal: x=index, y=column
    expect(hx).toBe(vy);  // horizontal x = vertical y (index axis)
    expect(hy).toBe(vx);  // horizontal y = vertical x (column axis)
  });

  it('horizontal index 0, column 0 gives same result as vertical', () => {
    const [vx, vy] = commitCoord(0, 0);
    const [hx, hy] = commitCoord(0, 0, true);
    expect(hx).toBe(vy);
    expect(hy).toBe(vx);
  });
});

describe('parseAnsi', () => {
  it('returns a single span for plain text', () => {
    const result = parseAnsi('hello world');
    expect(result).toEqual([{ text: 'hello world' }]);
  });

  it('returns empty array for empty string', () => {
    const result = parseAnsi('');
    expect(result).toEqual([]);
  });

  it('parses ANSI-256 foreground color sequences', () => {
    // ESC[38;5;11m = set fg to color 11 (bright yellow)
    const result = parseAnsi('\x1b[38;5;11mhello\x1b[39m');
    expect(result).toEqual([{ text: 'hello', color: '#ffff55' }]);
  });

  it('handles reset (ESC[0m) to end color', () => {
    const result = parseAnsi('\x1b[38;5;9mred text\x1b[0m normal');
    expect(result).toEqual([
      { text: 'red text', color: '#ff5555' },
      { text: ' normal' },
    ]);
  });

  it('parses mixed colored and plain text', () => {
    const result = parseAnsi('start \x1b[38;5;12mblue\x1b[39m end');
    expect(result).toEqual([
      { text: 'start ' },
      { text: 'blue', color: '#5555ff' },
      { text: ' end' },
    ]);
  });

  it('handles consecutive colors without reset between', () => {
    const result = parseAnsi('\x1b[38;5;9mred\x1b[38;5;10mgreen\x1b[39m');
    expect(result).toEqual([
      { text: 'red', color: '#ff5555' },
      { text: 'green', color: '#55ff55' },
    ]);
  });

  it('omits empty spans', () => {
    const result = parseAnsi('\x1b[38;5;9m\x1b[38;5;10mgreen\x1b[39m');
    expect(result).toEqual([{ text: 'green', color: '#55ff55' }]);
  });
});

describe('printSvg', () => {
  const simpleGraph = {
    commits: [
      {
        oid: 'abc1234567890',
        isMerge: false,
        parents: [null, null] as [string | null, string | null],
        children: [],
        branches: [0],
        tags: [],
        branchTrace: 0,
        data: {
          oid: 'abc1234567890',
          summary: 'Initial commit',
          parentOids: [],
          message: 'Initial commit\n',
          author: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
          committer: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
        },
      },
    ],
    indices: new Map([['abc1234567890', 0]]),
    allBranches: [
      {
        target: 'abc1234567890',
        mergeTarget: null,
        sourceBranch: null,
        targetBranch: null,
        name: 'main',
        persistence: 0,
        isRemote: false,
        isMerged: false,
        isTag: false,
        visual: {
          orderGroup: 0,
          targetOrderGroup: null,
          sourceOrderGroup: null,
          termColor: 12,
          svgColor: 'blue',
          column: 0,
        },
        range: [0, 0] as [number | null, number | null],
      },
    ],
    head: { oid: 'abc1234567890', name: 'main', isBranch: true },
  } as any;

  it('returns valid SVG with dark background', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);

    expect(svgStr).toContain('<svg');
    expect(svgStr).toContain('</svg>');
    expect(svgStr).toContain('<rect');
    expect(svgStr).toContain('#1e1e1e');
  });

  it('uses monospace font', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);
    expect(svgStr).toMatch(/font-family.*monospace/i);
  });

  it('renders text elements with commit info', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);
    expect(svgStr).toContain('<text');
    // Should contain the abbreviated hash
    expect(svgStr).toContain('abc1234');
    // Should contain the commit message
    expect(svgStr).toContain('Initial commit');
  });

  it('renders colored tspan elements', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);
    expect(svgStr).toContain('<tspan');
    expect(svgStr).toMatch(/fill="#[0-9a-f]{6}"/);
  });

  it('includes viewBox with proper dimensions', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);
    expect(svgStr).toMatch(/viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/);
  });

  it('renders graph characters from unicode renderer', () => {
    const settings = makeSettings();
    const svgStr = printSvg(simpleGraph, settings);
    // The thin character set uses ● for non-merge commits (overridden to U+26AB in SVG)
    expect(svgStr).toContain('\u26AB');
  });

  it('handles multi-branch graphs', () => {
    const graph = {
      commits: [
        {
          oid: 'merge1234567890',
          isMerge: true,
          parents: ['parent123456789', 'feat1234567890'] as [string | null, string | null],
          children: [],
          branches: [0],
          tags: [],
          branchTrace: 0,
          data: {
            oid: 'merge1234567890',
            summary: "Merge branch 'feature'",
            parentOids: ['parent123456789', 'feat1234567890'],
            message: "Merge branch 'feature'\n",
            author: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
            committer: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
          },
        },
        {
          oid: 'parent123456789',
          isMerge: false,
          parents: [null, null] as [string | null, string | null],
          children: ['merge1234567890'],
          branches: [0],
          tags: [],
          branchTrace: 0,
          data: {
            oid: 'parent123456789',
            summary: 'Base commit',
            parentOids: [],
            message: 'Base commit\n',
            author: { name: 'Test', email: 'test@test.com', timestamp: 999000, timezoneOffset: 0 },
            committer: { name: 'Test', email: 'test@test.com', timestamp: 999000, timezoneOffset: 0 },
          },
        },
        {
          oid: 'feat1234567890',
          isMerge: false,
          parents: ['parent123456789', null] as [string | null, string | null],
          children: ['merge1234567890'],
          branches: [1],
          tags: [],
          branchTrace: 1,
          data: {
            oid: 'feat1234567890',
            summary: 'Feature work',
            parentOids: ['parent123456789'],
            message: 'Feature work\n',
            author: { name: 'Test', email: 'test@test.com', timestamp: 999500, timezoneOffset: 0 },
            committer: { name: 'Test', email: 'test@test.com', timestamp: 999500, timezoneOffset: 0 },
          },
        },
      ],
      indices: new Map([
        ['merge1234567890', 0],
        ['parent123456789', 1],
        ['feat1234567890', 2],
      ]),
      allBranches: [
        {
          target: 'merge1234567890',
          mergeTarget: null,
          sourceBranch: null,
          targetBranch: null,
          name: 'main',
          persistence: 0,
          isRemote: false,
          isMerged: false,
          isTag: false,
          visual: {
            orderGroup: 0,
            targetOrderGroup: null,
            sourceOrderGroup: null,
            termColor: 12,
            svgColor: 'blue',
            column: 0,
          },
          range: [0, 1] as [number | null, number | null],
        },
        {
          target: 'feat1234567890',
          mergeTarget: 'merge1234567890',
          sourceBranch: null,
          targetBranch: 0,
          name: 'feature',
          persistence: 1,
          isRemote: false,
          isMerged: true,
          isTag: false,
          visual: {
            orderGroup: 1,
            targetOrderGroup: null,
            sourceOrderGroup: null,
            termColor: 11,
            svgColor: 'orange',
            column: 1,
          },
          range: [2, 2] as [number | null, number | null],
        },
      ],
      head: { oid: 'merge1234567890', name: 'main', isBranch: true },
    } as any;

    const settings = makeSettings();
    const svgStr = printSvg(graph, settings);
    expect(svgStr).toContain('<svg');
    expect(svgStr).toContain('</svg>');
    // Should contain multiple text lines
    const textCount = (svgStr.match(/<text /g) || []).length;
    expect(textCount).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['thin', Characters.thin(), '\u26AB'],
    ['round', Characters.round(), '\u26AB'],
    ['bold', Characters.bold(), '\u26AB'],
    ['double', Characters.double(), '\u26AB'],
    ['ascii', Characters.ascii(), '*'],
  ])('respects %s character style', (_name, chars, expectedDot) => {
    const settings = makeSettings({ characters: chars });
    const svgStr = printSvg(simpleGraph, settings);
    expect(svgStr).toContain(expectedDot);
  });

  it('renders horizontal SVG with SVG primitives (circles, lines, paths)', () => {
    const settings = makeSettings();

    const horizontal = printSvg(simpleGraph, settings, true);

    // Should be valid SVG
    expect(horizontal).toContain('<svg');
    expect(horizontal).toContain('</svg>');

    // Should use SVG circles for commit dots
    expect(horizontal).toContain('<circle');

    // Should not contain commit message text (horizontal is graph-only)
    expect(horizontal).not.toContain('Initial commit');
  });

  it('renders horizontal SVG with swapped viewBox dimensions', () => {
    const graph = {
      commits: [
        {
          oid: 'abc123',
          isMerge: false,
          parents: [null, null] as [string | null, string | null],
          children: [],
          branches: [0],
          tags: [],
          branchTrace: 0,
          data: {
            oid: 'abc123',
            summary: 'Commit',
            parentOids: [],
            message: 'Commit\n',
            author: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
            committer: { name: 'Test', email: 'test@test.com', timestamp: 1000000, timezoneOffset: 0 },
          },
        },
      ],
      indices: new Map([['abc123', 0]]),
      allBranches: [
        {
          target: 'abc123', mergeTarget: null, sourceBranch: null, targetBranch: null,
          name: 'main', persistence: 0, isRemote: false, isMerged: false, isTag: false,
          visual: { orderGroup: 0, targetOrderGroup: null, sourceOrderGroup: null, termColor: 12, svgColor: 'blue', column: 0 },
          range: [0, 0] as [number | null, number | null],
        },
      ],
      head: { oid: 'abc123', name: 'main', isBranch: true },
    } as any;

    const settings = makeSettings();
    const horizontal = printSvg(graph, settings, true);

    // Extract viewBox dimensions
    const hMatch = horizontal.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(hMatch).not.toBeNull();
    // Horizontal: width should be the index axis (wider), height the column axis
    expect(Number(hMatch![1])).toBeGreaterThan(0);
    expect(Number(hMatch![2])).toBeGreaterThan(0);
  });
});
