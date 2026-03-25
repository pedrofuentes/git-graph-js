import { describe, it, expect } from 'vitest';
import {
  Grid,
  GridCell,
  SPACE,
  DOT,
  CIRCLE,
  VER,
  HOR,
  CROSS,
  R_U,
  R_D,
  L_D,
  L_U,
  VER_L,
  VER_R,
  HOR_U,
  HOR_D,
  ARR_L,
  ARR_R,
  vline,
  hline,
  zigZagLine,
  sorted,
  Occ,
  occOverlaps,
} from '../src/print/unicode';
import { Characters, BranchSettings, BranchSettingsDef, MergePatterns } from '../src/settings';
import { printUnicode } from '../src/print/unicode';

// Test constants matching the Rust tests
const DEF_CH = SPACE;
const DEF_COL = 0;
const DEF_PERS = 10;
const ROW_INDEX = 1;

function makeGrid(width: number, height: number): Grid {
  return new Grid(width, height, { character: DEF_CH, color: DEF_COL, pers: DEF_PERS });
}

// ---- Grid tests ----

describe('Grid', () => {
  it('constructor initializes all cells', () => {
    const grid = makeGrid(3, 2);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.data.length).toBe(6);
    for (const cell of grid.data) {
      expect(cell.character).toBe(DEF_CH);
      expect(cell.color).toBe(DEF_COL);
      expect(cell.pers).toBe(DEF_PERS);
    }
  });

  it('index computes row-major index', () => {
    const grid = makeGrid(5, 3);
    expect(grid.index(0, 0)).toBe(0);
    expect(grid.index(4, 0)).toBe(4);
    expect(grid.index(0, 1)).toBe(5);
    expect(grid.index(2, 2)).toBe(12);
  });

  it('set and getTuple work correctly', () => {
    const grid = makeGrid(5, 3);
    grid.set(2, 1, VER, 5, 3);
    expect(grid.getTuple(2, 1)).toEqual([VER, 5, 3]);
    // Unmodified cells remain default
    expect(grid.getTuple(0, 0)).toEqual([DEF_CH, DEF_COL, DEF_PERS]);
  });

  it('setOpt updates only provided fields', () => {
    const grid = makeGrid(5, 3);
    grid.set(1, 1, HOR, 5, 3);

    // Update only color
    grid.setOpt(1, 1, undefined, 9, undefined);
    expect(grid.getTuple(1, 1)).toEqual([HOR, 9, 3]);

    // Update only character
    grid.setOpt(1, 1, VER, undefined, undefined);
    expect(grid.getTuple(1, 1)).toEqual([VER, 9, 3]);

    // Update only pers
    grid.setOpt(1, 1, undefined, undefined, 1);
    expect(grid.getTuple(1, 1)).toEqual([VER, 9, 1]);

    // Update all
    grid.setOpt(1, 1, CROSS, 2, 7);
    expect(grid.getTuple(1, 1)).toEqual([CROSS, 2, 7]);
  });

  it('reverse flips row order and mirrors columns', () => {
    const grid = makeGrid(2, 3);
    // Row 0
    grid.set(0, 0, DOT, 1, 1);
    grid.set(1, 0, CIRCLE, 2, 2);
    // Row 1
    grid.set(0, 1, VER, 3, 3);
    grid.set(1, 1, HOR, 4, 4);
    // Row 2
    grid.set(0, 2, CROSS, 5, 5);
    grid.set(1, 2, R_U, 6, 6);

    grid.reverse();

    // Former row 2 is now row 0, columns mirrored
    expect(grid.getTuple(0, 0)).toEqual([R_U, 6, 6]);
    expect(grid.getTuple(1, 0)).toEqual([CROSS, 5, 5]);
    // Former row 1 stays row 1, columns mirrored
    expect(grid.getTuple(0, 1)).toEqual([HOR, 4, 4]);
    expect(grid.getTuple(1, 1)).toEqual([VER, 3, 3]);
    // Former row 0 is now row 2, columns mirrored
    expect(grid.getTuple(0, 2)).toEqual([CIRCLE, 2, 2]);
    expect(grid.getTuple(1, 2)).toEqual([DOT, 1, 1]);
  });
});

// ---- GridCell char rendering ----

describe('GridCell char rendering', () => {
  it('Characters.thin maps character indices to unicode chars', () => {
    const chars = Characters.thin();
    expect(chars.chars[SPACE]).toBe(' ');
    expect(chars.chars[DOT]).toBe('●');
    expect(chars.chars[CIRCLE]).toBe('○');
    expect(chars.chars[VER]).toBe('│');
    expect(chars.chars[HOR]).toBe('─');
    expect(chars.chars[CROSS]).toBe('┼');
    expect(chars.chars[R_U]).toBe('└');
    expect(chars.chars[R_D]).toBe('┌');
    expect(chars.chars[L_D]).toBe('┐');
    expect(chars.chars[L_U]).toBe('┘');
    expect(chars.chars[VER_L]).toBe('┤');
    expect(chars.chars[VER_R]).toBe('├');
    expect(chars.chars[HOR_U]).toBe('┴');
    expect(chars.chars[HOR_D]).toBe('┬');
    expect(chars.chars[ARR_L]).toBe('<');
    expect(chars.chars[ARR_R]).toBe('>');
  });
});

// ---- vline tests ----

describe('vline', () => {
  it('draws vertical line between rows', () => {
    // 10 columns wide (graph columns 0-4), 4 rows tall
    const grid = makeGrid(10, 4);
    const color = 5;
    const pers = 2;
    const column = 2; // graph column 2 → grid column 4

    vline(grid, [0, 3], column, color, pers);

    // Rows 1 and 2 should be VER at grid column 4
    expect(grid.getTuple(4, 1)).toEqual([VER, color, pers]);
    expect(grid.getTuple(4, 2)).toEqual([VER, color, pers]);
    // Row 0 and 3 should be untouched (endpoints)
    expect(grid.getTuple(4, 0)).toEqual([DEF_CH, DEF_COL, DEF_PERS]);
    expect(grid.getTuple(4, 3)).toEqual([DEF_CH, DEF_COL, DEF_PERS]);
  });

  it('skips DOT and CIRCLE cells', () => {
    const grid = makeGrid(10, 5);
    grid.set(4, 1, DOT, 1, 1);
    grid.set(4, 2, CIRCLE, 2, 2);

    vline(grid, [0, 4], 2, 5, 2);

    // DOT and CIRCLE should be untouched
    expect(grid.getTuple(4, 1)).toEqual([DOT, 1, 1]);
    expect(grid.getTuple(4, 2)).toEqual([CIRCLE, 2, 2]);
    // Row 3 should get VER
    expect(grid.getTuple(4, 3)).toEqual([VER, 5, 2]);
  });

  it('converts HOR to CROSS', () => {
    const grid = makeGrid(10, 4);
    grid.set(4, 1, HOR, 3, 3);

    vline(grid, [0, 3], 2, 5, 2);

    expect(grid.getTuple(4, 1)).toEqual([CROSS, 5, 2]);
  });

  it('converts HOR_U and HOR_D to CROSS', () => {
    const grid = makeGrid(10, 5);
    grid.set(4, 1, HOR_U, 3, 3);
    grid.set(4, 2, HOR_D, 3, 3);

    vline(grid, [0, 4], 2, 5, 2);

    expect(grid.getTuple(4, 1)).toEqual([CROSS, 5, 2]);
    expect(grid.getTuple(4, 2)).toEqual([CROSS, 5, 2]);
  });

  it('updates color/pers for CROSS/VER/VER_L/VER_R if lower pers', () => {
    const grid = makeGrid(10, 4);
    grid.set(4, 1, VER, 3, 5);

    vline(grid, [0, 3], 2, 7, 2);

    // pers 2 < 5, so should update color and pers
    expect(grid.getTuple(4, 1)).toEqual([VER, 7, 2]);
  });

  it('does not update color/pers for VER when existing pers is lower', () => {
    const grid = makeGrid(10, 4);
    grid.set(4, 1, VER, 3, 1);

    vline(grid, [0, 3], 2, 7, 5);

    // pers 5 > 1, so should not update
    expect(grid.getTuple(4, 1)).toEqual([VER, 3, 1]);
  });

  it('converts L_D and L_U to VER_L', () => {
    const grid = makeGrid(10, 5);
    grid.set(4, 1, L_D, 3, 3);
    grid.set(4, 2, L_U, 3, 3);

    vline(grid, [0, 4], 2, 5, 2);

    expect(grid.getTuple(4, 1)[0]).toBe(VER_L);
    expect(grid.getTuple(4, 2)[0]).toBe(VER_L);
  });

  it('converts R_D and R_U to VER_R', () => {
    const grid = makeGrid(10, 5);
    grid.set(4, 1, R_D, 3, 3);
    grid.set(4, 2, R_U, 3, 3);

    vline(grid, [0, 4], 2, 5, 2);

    expect(grid.getTuple(4, 1)[0]).toBe(VER_R);
    expect(grid.getTuple(4, 2)[0]).toBe(VER_R);
  });
});

// ---- hline tests ----

describe('hline', () => {
  // Graph column: 0   1   2   3   4   5
  // Grid columns: 0 1 2 3 4 5 6 7 8 9

  describe('forward (from < to)', () => {
    it('draws horizontal line from column 1 to 3 (non-merge)', () => {
      const grid = makeGrid(10, 3);
      const color = 5;
      const pers = 2;

      hline(grid, ROW_INDEX, [1, 3], false, color, pers);

      // Left cell (grid col 2 = graph col 1): R_D
      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(R_D);
      // Middle cells (grid cols 3, 4, 5): HOR
      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(HOR);
      // Right cell (grid col 6 = graph col 3): L_U
      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(L_U);
    });

    it('draws horizontal line from column 1 to 3 with merge → ARR_R', () => {
      const grid = makeGrid(10, 3);
      const color = 5;
      const pers = 2;

      hline(grid, ROW_INDEX, [1, 3], true, color, pers);

      // Left cell: R_D
      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(R_D);
      // Middle cells: HOR except last middle which is ARR_R
      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(ARR_R);
      // Right cell: L_U
      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(L_U);
    });

    it('forward: VER → CROSS in middle', () => {
      const grid = makeGrid(10, 3);
      grid.set(4, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(CROSS);
    });

    it('forward: left cell VER → VER_R', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(VER_R);
    });

    it('forward: right cell VER → VER_L', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(VER_L);
    });

    it('forward: left cell VER_L → CROSS', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, VER_L, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(CROSS);
    });

    it('forward: skips DOT and CIRCLE in middle', () => {
      const grid = makeGrid(10, 3);
      grid.set(4, ROW_INDEX, DOT, 1, 1);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(DOT);
    });

    it('forward: L_U/R_U in middle → HOR_U', () => {
      const grid = makeGrid(12, 3);
      grid.set(3, ROW_INDEX, L_U, 3, 3);
      grid.set(5, ROW_INDEX, R_U, 3, 3);

      hline(grid, ROW_INDEX, [1, 4], false, 5, 2);

      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(HOR_U);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('forward: L_D/R_D in middle → HOR_D', () => {
      const grid = makeGrid(12, 3);
      grid.set(3, ROW_INDEX, L_D, 3, 3);
      grid.set(5, ROW_INDEX, R_D, 3, 3);

      hline(grid, ROW_INDEX, [1, 4], false, 5, 2);

      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(HOR_D);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(HOR_D);
    });

    it('forward: right cell HOR → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, HOR, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('forward: right cell R_U → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, R_U, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('forward: left cell HOR → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, HOR, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('forward: left cell L_U → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, L_U, 3, 3);

      hline(grid, ROW_INDEX, [1, 3], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(HOR_U);
    });
  });

  describe('backward (from > to)', () => {
    it('draws horizontal line from column 3 to 1 (non-merge)', () => {
      const grid = makeGrid(10, 3);
      const color = 5;
      const pers = 2;

      hline(grid, ROW_INDEX, [3, 1], false, color, pers);

      // Right cell (grid col 6 = graph col 3): L_D
      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(L_D);
      // Middle cells (grid cols 3, 4, 5): HOR
      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(HOR);
      // Left cell (grid col 2 = graph col 1): R_U
      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(R_U);
    });

    it('draws horizontal line from column 3 to 1 with merge → ARR_L', () => {
      const grid = makeGrid(10, 3);
      const color = 5;
      const pers = 2;

      hline(grid, ROW_INDEX, [3, 1], true, color, pers);

      // Right cell: L_D
      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(L_D);
      // Middle cells: HOR except first middle which is ARR_L
      expect(grid.getTuple(3, ROW_INDEX)[0]).toBe(ARR_L);
      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(HOR);
      expect(grid.getTuple(5, ROW_INDEX)[0]).toBe(HOR);
      // Left cell: R_U
      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(R_U);
    });

    it('backward: VER → CROSS in middle', () => {
      const grid = makeGrid(10, 3);
      grid.set(4, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(4, ROW_INDEX)[0]).toBe(CROSS);
    });

    it('backward: left cell VER → VER_R', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(VER_R);
    });

    it('backward: right cell VER → VER_L', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, VER, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(VER_L);
    });

    it('backward: right cell VER_R → CROSS', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, VER_R, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(CROSS);
    });

    it('backward: left cell HOR → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, HOR, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('backward: left cell L_U → HOR_U', () => {
      const grid = makeGrid(10, 3);
      grid.set(2, ROW_INDEX, L_U, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(2, ROW_INDEX)[0]).toBe(HOR_U);
    });

    it('backward: right cell HOR → HOR_D', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, HOR, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      // backward right cell: HOR → HOR_D
      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(HOR_D);
    });

    it('backward: right cell R_D → HOR_D', () => {
      const grid = makeGrid(10, 3);
      grid.set(6, ROW_INDEX, R_D, 3, 3);

      hline(grid, ROW_INDEX, [3, 1], false, 5, 2);

      expect(grid.getTuple(6, ROW_INDEX)[0]).toBe(HOR_D);
    });
  });
});

// ---- zigZagLine tests ----

describe('zigZagLine', () => {
  it('draws a zig-zag connecting two columns', () => {
    const grid = makeGrid(10, 6);
    const color = 5;
    const pers = 2;

    // From column 1, row 0 → row 2, then across to column 3, then down row 2 → row 5
    zigZagLine(grid, [0, 2, 5], [1, 3], false, color, pers);

    // Vertical line segment 1: rows 1 at grid col 2
    expect(grid.getTuple(2, 1)[0]).toBe(VER);
    // Horizontal segment at row 2 from col 3 to col 1 (backward)
    // Left endpoint (grid col 2): updated by hline backward left cell
    // Middle cells (grid cols 3, 4, 5): HOR
    expect(grid.getTuple(3, 2)[0]).toBe(HOR);
    expect(grid.getTuple(4, 2)[0]).toBe(HOR);
    expect(grid.getTuple(5, 2)[0]).toBe(HOR);
    // Vertical line segment 2: rows 3, 4 at grid col 6
    expect(grid.getTuple(6, 3)[0]).toBe(VER);
    expect(grid.getTuple(6, 4)[0]).toBe(VER);
  });
});

// ---- sorted tests ----

describe('sorted', () => {
  it('returns [min, max] when first < second', () => {
    expect(sorted(1, 5)).toEqual([1, 5]);
  });

  it('returns [min, max] when first > second', () => {
    expect(sorted(5, 1)).toEqual([1, 5]);
  });

  it('returns [v, v] when equal', () => {
    expect(sorted(3, 3)).toEqual([3, 3]);
  });
});

// ---- Occ overlaps tests ----

describe('Occ overlaps', () => {
  it('Commit overlaps when column is in range', () => {
    const occ: Occ = { type: 'Commit', index: 0, column: 3 };
    expect(occOverlaps(occ, 2, 5)).toBe(true);
    expect(occOverlaps(occ, 3, 3)).toBe(true);
  });

  it('Commit does not overlap when column is outside range', () => {
    const occ: Occ = { type: 'Commit', index: 0, column: 3 };
    expect(occOverlaps(occ, 4, 6)).toBe(false);
    expect(occOverlaps(occ, 0, 2)).toBe(false);
  });

  it('Range overlaps when ranges intersect', () => {
    const occ: Occ = {
      type: 'Range',
      childIdx: 0,
      parentIdx: 1,
      startCol: 2,
      endCol: 5,
    };
    expect(occOverlaps(occ, 3, 4)).toBe(true);
    expect(occOverlaps(occ, 0, 3)).toBe(true);
    expect(occOverlaps(occ, 4, 7)).toBe(true);
    expect(occOverlaps(occ, 1, 6)).toBe(true);
  });

  it('Range does not overlap when ranges are disjoint', () => {
    const occ: Occ = {
      type: 'Range',
      childIdx: 0,
      parentIdx: 1,
      startCol: 2,
      endCol: 5,
    };
    expect(occOverlaps(occ, 6, 8)).toBe(false);
    expect(occOverlaps(occ, 0, 1)).toBe(false);
  });

  it('Range with reversed startCol/endCol still overlaps correctly', () => {
    const occ: Occ = {
      type: 'Range',
      childIdx: 0,
      parentIdx: 1,
      startCol: 5,
      endCol: 2,
    };
    expect(occOverlaps(occ, 3, 4)).toBe(true);
    expect(occOverlaps(occ, 6, 8)).toBe(false);
  });
});

describe('printUnicode mergesOnly', () => {
  it('hides dots on non-merge commits and shows only merge circles', () => {
    const graph = {
      commits: [
        {
          oid: 'merge1',
          isMerge: true,
          parents: ['p1', 'p2'] as [string | null, string | null],
          children: [],
          branches: [0],
          tags: [],
          branchTrace: 0,
          data: {
            oid: 'merge1', summary: 'Merge', parentOids: ['p1', 'p2'], message: 'Merge',
            author: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
            committer: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
          },
        },
        {
          oid: 'p1',
          isMerge: false,
          parents: [null, null] as [string | null, string | null],
          children: ['merge1'],
          branches: [0],
          tags: [],
          branchTrace: 0,
          data: {
            oid: 'p1', summary: 'Regular', parentOids: [], message: 'Regular',
            author: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
            committer: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
          },
        },
      ],
      indices: new Map([['merge1', 0], ['p1', 1]]),
      allBranches: [
        {
          target: 'merge1', mergeTarget: null, sourceBranch: null, targetBranch: null,
          name: 'main', persistence: 0, isRemote: false, isMerged: false, isTag: false,
          visual: { orderGroup: 0, targetOrderGroup: null, sourceOrderGroup: null, termColor: 12, svgColor: 'blue', column: 0 },
          range: [0, 1] as [number | null, number | null],
        },
      ],
      head: { oid: 'merge1', name: 'main', isBranch: true },
    } as any;

    const settings = {
      reverseCommitOrder: false, debug: false, compact: true, colored: false,
      includeRemote: false, format: { type: 'OneLine' as const }, wrapping: null,
      characters: Characters.thin(), branchOrder: { type: 'ShortestFirst', forward: true },
      branches: BranchSettings.from(BranchSettingsDef.none()),
      mergePatterns: MergePatterns.default(),
      mergesOnly: true,
    };

    const [gLines] = printUnicode(graph, settings);
    const chars = Characters.thin();

    // Merge commit (index 0) should still have ○
    expect(gLines[0]).toContain(chars.chars[CIRCLE]);

    // Regular commit (index 1) should NOT have ● — should have │ instead
    expect(gLines[1]).not.toContain(chars.chars[DOT]);
    expect(gLines[1]).toContain(chars.chars[VER]);
  });
});
