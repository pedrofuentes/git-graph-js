import { describe, it, expect } from 'vitest';
import { commitCoord, printSvg } from '../src/print/svg';

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
});

describe('printSvg', () => {
  it('returns valid SVG string for a simple graph', () => {
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
        },
      ],
      indices: new Map([['abc123', 0]]),
      allBranches: [
        {
          target: 'abc123',
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
      head: { oid: 'abc123', name: 'main', isBranch: true },
    } as any;

    const settings = { debug: false } as any;

    const svgStr = printSvg(graph, settings);
    expect(svgStr).toContain('<svg');
    expect(svgStr).toContain('</svg>');
    expect(svgStr).toContain('<circle');
    expect(svgStr).toContain('blue');
  });

  it('renders merge connections between branches', () => {
    const graph = {
      commits: [
        {
          oid: 'merge1',
          isMerge: true,
          parents: ['parent1', 'parent2'] as [string | null, string | null],
          children: [],
          branches: [0],
          tags: [],
          branchTrace: 0,
        },
        {
          oid: 'parent1',
          isMerge: false,
          parents: [null, null] as [string | null, string | null],
          children: ['merge1'],
          branches: [0],
          tags: [],
          branchTrace: 0,
        },
        {
          oid: 'parent2',
          isMerge: false,
          parents: [null, null] as [string | null, string | null],
          children: ['merge1'],
          branches: [1],
          tags: [],
          branchTrace: 1,
        },
      ],
      indices: new Map([['merge1', 0], ['parent1', 1], ['parent2', 2]]),
      allBranches: [
        {
          visual: { column: 0, svgColor: 'blue' },
          range: [0, 1],
        },
        {
          visual: { column: 1, svgColor: 'green' },
          range: [2, 2],
        },
      ],
      head: { oid: 'merge1', name: 'main', isBranch: true },
    } as any;

    const settings = { debug: false } as any;

    const svgStr = printSvg(graph, settings);
    expect(svgStr).toContain('<svg');
    expect(svgStr).toContain('<circle');
    // Should have lines or paths connecting branches
    expect(svgStr).toMatch(/<(line|path)/);
  });
});
