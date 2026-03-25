/**
 * Unicode graph rendering.
 * Port of print/unicode.rs
 */

import chalk from 'chalk';
import { Characters, Settings } from '../settings';
import { format as formatCommitText } from './format';
import type {
  GitGraph as ActualGitGraph,
  CommitInfo as ActualCommitInfo,
  BranchInfo as ActualBranchInfo,
  HeadInfo as ActualHeadInfo,
} from '../graph';
import { getDeviateIndex } from './index';
import type { CommitData } from './format';

// ---- Character constants (indices into Characters.chars) ----

export const SPACE = 0;
export const DOT = 1;
export const CIRCLE = 2;
export const VER = 3;
export const HOR = 4;
export const CROSS = 5;
export const R_U = 6;
export const R_D = 7;
export const L_D = 8;
export const L_U = 9;
export const VER_L = 10;
export const VER_R = 11;
export const HOR_U = 12;
export const HOR_D = 13;
export const ARR_L = 14;
export const ARR_R = 15;

// ---- Color constants ----

export const WHITE = 7;
export const HEAD_COLOR = 14;
export const HASH_COLOR = 11;

// ---- GridCell ----

export interface GridCell {
  character: number;
  color: number;
  pers: number;
}

// ---- Grid ----

export class Grid {
  width: number;
  height: number;
  data: GridCell[];

  constructor(width: number, height: number, initial: GridCell) {
    this.width = width;
    this.height = height;
    this.data = [];
    for (let i = 0; i < width * height; i++) {
      this.data.push({ ...initial });
    }
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  getTuple(x: number, y: number): [number, number, number] {
    const idx = this.index(x, y);
    const cell = this.data[idx];
    return [cell.character, cell.color, cell.pers];
  }

  set(x: number, y: number, character: number, color: number, pers: number): void {
    const idx = this.index(x, y);
    const cell = this.data[idx];
    cell.character = character;
    cell.color = color;
    cell.pers = pers;
  }

  setOpt(x: number, y: number, character?: number, color?: number, pers?: number): void {
    const idx = this.index(x, y);
    const cell = this.data[idx];
    if (character !== undefined) cell.character = character;
    if (color !== undefined) cell.color = color;
    if (pers !== undefined) cell.pers = pers;
  }

  reverse(): void {
    const rows: GridCell[][] = [];
    for (let y = 0; y < this.height; y++) {
      const start = y * this.width;
      rows.push(this.data.slice(start, start + this.width));
    }
    rows.reverse();
    // Also reverse cells within each row (horizontal mirror)
    for (const row of rows) {
      row.reverse();
    }
    this.data = rows.flat();
  }
}

// ---- Occ (Occupancy) ----

export type Occ =
  | { type: 'Commit'; index: number; column: number }
  | { type: 'Range'; childIdx: number; parentIdx: number; startCol: number; endCol: number };

export function occOverlaps(occ: Occ, start: number, end: number): boolean {
  if (occ.type === 'Commit') {
    return occ.column >= start && occ.column <= end;
  }
  const [minCol, maxCol] = sorted(occ.startCol, occ.endCol);
  return maxCol >= start && minCol <= end;
}

// ---- Helper: sorted ----

export function sorted(v1: number, v2: number): [number, number] {
  return v1 <= v2 ? [v1, v2] : [v2, v1];
}

// ---- vline ----

export function vline(
  grid: Grid,
  [from, to]: [number, number],
  column: number,
  color: number,
  pers: number
): void {
  const gridCol = column * 2;
  for (let row = from + 1; row <= to - 1; row++) {
    const [ch, , existingPers] = grid.getTuple(gridCol, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        // skip
        break;
      case HOR:
      case HOR_U:
      case HOR_D:
        grid.set(gridCol, row, CROSS, color, pers);
        break;
      case CROSS:
      case VER:
      case VER_L:
      case VER_R:
        if (pers <= existingPers) {
          grid.setOpt(gridCol, row, undefined, color, pers);
        }
        break;
      case L_D:
      case L_U:
        grid.set(gridCol, row, VER_L, color, pers);
        break;
      case R_D:
      case R_U:
        grid.set(gridCol, row, VER_R, color, pers);
        break;
      default:
        grid.set(gridCol, row, VER, color, pers);
        break;
    }
  }
}

// ---- hline ----

export function hline(
  grid: Grid,
  index: number,
  [from, to]: [number, number],
  merge: boolean,
  color: number,
  pers: number
): void {
  if (from < to) {
    hlineForward(grid, index, from, to, merge, color, pers);
  } else {
    hlineBackward(grid, index, from, to, merge, color, pers);
  }
}

function hlineForward(
  grid: Grid,
  row: number,
  from: number,
  to: number,
  merge: boolean,
  color: number,
  pers: number
): void {
  const from2 = from * 2;
  const to2 = to * 2;

  // Middle cells
  for (let col = from2 + 1; col <= to2 - 1; col++) {
    const isLast = col === to2 - 1;
    if (merge && isLast) {
      grid.set(col, row, ARR_R, color, pers);
      continue;
    }

    const [ch] = grid.getTuple(col, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(col, row, CROSS, color, pers);
        break;
      case HOR:
      case CROSS:
      case HOR_U:
      case HOR_D:
        grid.setOpt(col, row, undefined, color, pers);
        break;
      case L_U:
      case R_U:
        grid.set(col, row, HOR_U, color, pers);
        break;
      case L_D:
      case R_D:
        grid.set(col, row, HOR_D, color, pers);
        break;
      default:
        grid.set(col, row, HOR, color, pers);
        break;
    }
  }

  // Left cell (from2)
  {
    const [ch] = grid.getTuple(from2, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(from2, row, VER_R, color, pers);
        break;
      case VER_L:
        grid.set(from2, row, CROSS, color, pers);
        break;
      case VER_R:
        break;
      case HOR:
      case L_U:
        grid.set(from2, row, HOR_U, color, pers);
        break;
      default:
        grid.set(from2, row, R_D, color, pers);
        break;
    }
  }

  // Right cell (to2)
  {
    const [ch] = grid.getTuple(to2, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(to2, row, VER_L, color, pers);
        break;
      case VER_L:
      case HOR_U:
        grid.setOpt(to2, row, undefined, color, pers);
        break;
      case HOR:
      case R_U:
        grid.set(to2, row, HOR_U, color, pers);
        break;
      default:
        grid.set(to2, row, L_U, color, pers);
        break;
    }
  }
}

function hlineBackward(
  grid: Grid,
  row: number,
  from: number,
  to: number,
  merge: boolean,
  color: number,
  pers: number
): void {
  const from2 = from * 2;
  const to2 = to * 2;

  // Middle cells (from2-1 down to to2+1)
  for (let col = from2 - 1; col >= to2 + 1; col--) {
    const isFirst = col === to2 + 1;
    if (merge && isFirst) {
      grid.set(col, row, ARR_L, color, pers);
      continue;
    }

    const [ch] = grid.getTuple(col, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(col, row, CROSS, color, pers);
        break;
      case HOR:
      case CROSS:
      case HOR_U:
      case HOR_D:
        grid.setOpt(col, row, undefined, color, pers);
        break;
      case L_U:
      case R_U:
        grid.set(col, row, HOR_U, color, pers);
        break;
      case L_D:
      case R_D:
        grid.set(col, row, HOR_D, color, pers);
        break;
      default:
        grid.set(col, row, HOR, color, pers);
        break;
    }
  }

  // Left cell (to2)
  {
    const [ch] = grid.getTuple(to2, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(to2, row, VER_R, color, pers);
        break;
      case VER_R:
        grid.setOpt(to2, row, undefined, color, pers);
        break;
      case HOR:
      case L_U:
        grid.set(to2, row, HOR_U, color, pers);
        break;
      default:
        grid.set(to2, row, R_U, color, pers);
        break;
    }
  }

  // Right cell (from2)
  {
    const [ch] = grid.getTuple(from2, row);
    switch (ch) {
      case DOT:
      case CIRCLE:
        break;
      case VER:
        grid.set(from2, row, VER_L, color, pers);
        break;
      case VER_R:
        grid.set(from2, row, CROSS, color, pers);
        break;
      case VER_L:
        grid.setOpt(from2, row, undefined, color, pers);
        break;
      case HOR:
      case R_D:
        grid.set(from2, row, HOR_D, color, pers);
        break;
      default:
        grid.set(from2, row, L_D, color, pers);
        break;
    }
  }
}

// ---- zigZagLine ----

export function zigZagLine(
  grid: Grid,
  [row1, row2, row3]: [number, number, number],
  [col1, col2]: [number, number],
  isMerge: boolean,
  color: number,
  pers: number
): void {
  vline(grid, [row1, row2], col1, color, pers);
  hline(grid, row2, [col2, col1], isMerge, color, pers);
  vline(grid, [row2, row3], col2, color, pers);
}

// ---- printGraph ----

export function printGraph(
  characters: Characters,
  grid: Grid,
  textLines: (string | null)[],
  color: boolean
): [string[], string[]] {
  const graphLines: string[] = [];

  for (let y = 0; y < grid.height; y++) {
    let line = '';
    for (let x = 0; x < grid.width; x++) {
      const [ch, col] = grid.getTuple(x, y);
      const charStr = characters.chars[ch];
      if (color && col !== WHITE && ch !== SPACE) {
        line += chalk.ansi256(col)(charStr);
      } else {
        line += charStr;
      }
    }
    graphLines.push(line);
  }

  return [graphLines, textLines.map((t) => t ?? '')];
}

// ---- Types for graph integration ----
// These are now imported from ../graph, so the local definitions are removed.
// The local BranchInfo/CommitInfo/HeadInfo/GitGraph/ParentInfo/BranchVisual types
// are replaced by the actual graph.ts types above.

// ---- getInserts (using actual graph types) ----

export function getInserts(
  graph: ActualGitGraph,
  compact: boolean
): Map<number, Occ[][]> {
  const inserts = new Map<number, Occ[][]>();

  // Initialize each commit with a Commit occupation
  for (let idx = 0; idx < graph.commits.length; idx++) {
    const info = graph.commits[idx];
    const column = graph.allBranches[info.branchTrace!].visual.column!;
    inserts.set(idx, [[{ type: 'Commit', index: idx, column }]]);
  }

  // Find cross-branch connections that need additional rows
  for (let idx = 0; idx < graph.commits.length; idx++) {
    const info = graph.commits[idx];
    if (info.branchTrace === null) continue;

    const branch = graph.allBranches[info.branchTrace];
    const column = branch.visual.column!;

    for (let p = 0; p < 2; p++) {
      const parOid = info.parents[p];
      if (!parOid) continue;

      const parIdx = graph.indices.get(parOid);
      if (parIdx === undefined) continue;

      const parInfo = graph.commits[parIdx];
      const parBranch = graph.allBranches[parInfo.branchTrace!];
      const parColumn = parBranch.visual.column!;

      if (column !== parColumn) {
        const [startCol, endCol] = sorted(column, parColumn);
        const splitIndex = getDeviateIndex(graph, idx, parIdx);

        const entry = inserts.get(splitIndex);
        if (!entry) continue;

        // Find non-overlapping row or create new one
        let insertAt = entry.length;
        for (let insertIdx = 0; insertIdx < entry.length; insertIdx++) {
          const subEntry = entry[insertIdx];
          let occ = false;
          for (const otherRange of subEntry) {
            if (occOverlaps(otherRange, startCol, endCol)) {
              if (otherRange.type === 'Commit') {
                if (!compact || !info.isMerge || idx !== otherRange.index || p === 0) {
                  occ = true;
                  break;
                }
              } else {
                if (idx !== otherRange.childIdx && parIdx !== otherRange.parentIdx) {
                  occ = true;
                  break;
                }
              }
            }
          }
          if (!occ) {
            insertAt = insertIdx;
            break;
          }
        }

        if (insertAt === entry.length) {
          entry.push([{ type: 'Range', childIdx: idx, parentIdx: parIdx, startCol, endCol }]);
        } else {
          entry[insertAt].push({ type: 'Range', childIdx: idx, parentIdx: parIdx, startCol, endCol });
        }
      }
    }
  }

  return inserts;
}

// ---- formatBranches (using actual graph types) ----

export function formatBranches(
  graph: ActualGitGraph,
  info: ActualCommitInfo,
  head: ActualHeadInfo | null,
  color: boolean
): string {
  let branchStr = '';
  const headStr = 'HEAD ->';

  // Show detached HEAD
  if (head && !head.isBranch) {
    if (color) {
      branchStr += ` ${chalk.ansi256(HEAD_COLOR)(headStr)}`;
    } else {
      branchStr += ` ${headStr}`;
    }
  }

  // Show branch names
  if (info.branches.length > 0) {
    branchStr += ' (';

    // Sort branches so HEAD's branch comes first
    const sortedBranches = [...info.branches].sort((a, b) => {
      if (head) {
        const aIsHead = graph.allBranches[a].name === head.name ? 0 : 1;
        const bIsHead = graph.allBranches[b].name === head.name ? 0 : 1;
        return aIsHead - bIsHead;
      }
      return 0;
    });

    for (let i = 0; i < sortedBranches.length; i++) {
      const branchIndex = sortedBranches[i];
      const branch = graph.allBranches[branchIndex];
      const branchColor = branch.visual.termColor;

      if (head && i === 0 && head.isBranch) {
        if (color) {
          branchStr += `${chalk.ansi256(HEAD_COLOR)(headStr)} `;
        } else {
          branchStr += `${headStr} `;
        }
      }

      if (color) {
        branchStr += chalk.ansi256(branchColor)(branch.name);
      } else {
        branchStr += branch.name;
      }

      if (i < sortedBranches.length - 1) {
        branchStr += ', ';
      }
    }
    branchStr += ')';
  }

  // Show tags
  if (info.tags.length > 0) {
    const currColor = info.branchTrace !== null
      ? graph.allBranches[info.branchTrace].visual.termColor
      : undefined;

    branchStr += ' [';
    for (let i = 0; i < info.tags.length; i++) {
      const tagIndex = info.tags[i];
      const tag = graph.allBranches[tagIndex];
      const tagColor = currColor ?? tag.visual.termColor;
      const tagName = tag.name.startsWith('tags/') ? tag.name.slice(5) : tag.name;

      if (color) {
        branchStr += chalk.ansi256(tagColor)(tagName);
      } else {
        branchStr += tagName;
      }

      if (i < info.tags.length - 1) {
        branchStr += ', ';
      }
    }
    branchStr += ']';
  }

  return branchStr;
}

// ---- UnicodeGraphInfo ----

export type UnicodeGraphInfo = [string[], string[], number[]];

/** Raw grid data before stringification. */
export interface UnicodeGridResult {
  grid: Grid;
  textLines: (string | null)[];
  indexMap: number[];
}

// Find insert index for a specific connection
function findInsertIdx(
  inserts: Occ[][],
  childIdx: number,
  parentIdx: number
): number | null {
  for (let insertIdx = 0; insertIdx < inserts.length; insertIdx++) {
    for (const occ of inserts[insertIdx]) {
      if (occ.type === 'Range' && occ.childIdx === childIdx && occ.parentIdx === parentIdx) {
        return insertIdx;
      }
    }
  }
  return null;
}

// ---- buildUnicodeGrid (builds the raw grid, used by both printUnicode and printSvg) ----

export function buildUnicodeGrid(
  graph: ActualGitGraph,
  settings: Settings
): UnicodeGridResult | null {
  if (graph.allBranches.length === 0) {
    return null;
  }

  // 1. Calculate dimensions
  const numCols = graph.allBranches
    .map((b) => b.visual.column ?? 0)
    .reduce((max, c) => Math.max(max, c), 0) + 1;

  const inserts = getInserts(graph, settings.compact);

  // 2. Build commit text lines and index map
  const headIdx = graph.indices.get(graph.head.oid);
  const textLines: (string | null)[] = [];
  const indexMap: number[] = [];
  let offset = 0;

  for (let idx = 0; idx < graph.commits.length; idx++) {
    const info = graph.commits[idx];
    indexMap.push(idx + offset);

    // Count inserts that are range-only (not commit)
    const commitInserts = inserts.get(idx);
    const cntInserts = commitInserts
      ? commitInserts.filter((row) =>
          row.every((occ) => occ.type === 'Range')
        ).length
      : 0;

    const head = headIdx === idx ? graph.head : null;
    const branchStr = formatBranches(graph, info, head, settings.colored);

    // Build CommitData for formatting
    const commit = graph.commits[idx];
    const commitData: CommitData = commit.data ?? {
      oid: commit.oid,
      summary: '',
      parentOids: commit.parents.filter((p): p is string => p !== null),
      message: '',
      author: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
      committer: { name: '', email: '', timestamp: 0, timezoneOffset: 0 },
    };

    const hashColor = settings.colored ? HASH_COLOR : undefined;
    const lines = formatCommitText(
      settings.format,
      commitData,
      branchStr,
      undefined,
      hashColor
    );

    const numLines = lines.length > 0 ? lines.length - 1 : 0;
    const maxInserts = Math.max(cntInserts, numLines);
    const addLines = maxInserts - numLines;

    textLines.push(...lines.map((l) => l as string | null));
    for (let i = 0; i < addLines; i++) {
      textLines.push(null);
    }

    offset += maxInserts;
  }

  // 3. Build grid
  const totalRows = textLines.length;
  const gridWidth = numCols * 2;
  const grid = new Grid(gridWidth, totalRows, {
    character: SPACE,
    color: WHITE,
    pers: (settings.branches.persistence.length + 2) as number,
  });

  // 4. Draw commit points and connections
  for (let idx = 0; idx < graph.commits.length; idx++) {
    const info = graph.commits[idx];
    if (info.branchTrace === null) continue;

    const branch = graph.allBranches[info.branchTrace];
    const column = branch.visual.column!;
    const idxMap = indexMap[idx];

    // Draw commit dot
    let commitChar: number;
    if (settings.mergesOnly) {
      commitChar = info.isMerge ? CIRCLE : VER;
    } else {
      commitChar = info.isMerge ? CIRCLE : DOT;
    }
    grid.set(
      column * 2,
      idxMap,
      commitChar,
      branch.visual.termColor,
      branch.persistence
    );

    // Draw parent connections
    const branchColor = branch.visual.termColor;

    for (let p = 0; p < 2; p++) {
      const parOid = info.parents[p];
      if (!parOid) continue;

      const parIdx = graph.indices.get(parOid);
      if (parIdx === undefined) {
        // Parent outside scope - draw to bottom
        vline(grid, [idxMap, grid.height], column, branchColor, branch.persistence);
        continue;
      }

      const parIdxMap = indexMap[parIdx];
      const parInfo = graph.commits[parIdx];
      const parBranch = graph.allBranches[parInfo.branchTrace!];
      const parColumn = parBranch.visual.column!;

      const [color, pers] = info.isMerge
        ? [parBranch.visual.termColor, parBranch.persistence]
        : [branchColor, branch.persistence];

      if (branch.visual.column === parBranch.visual.column) {
        if (parIdxMap > idxMap + 1) {
          vline(grid, [idxMap, parIdxMap], column, color, pers);
        }
      } else {
        const splitIndex = getDeviateIndex(graph, idx, parIdx);
        const splitIdxMap = indexMap[splitIndex];
        const commitInserts = inserts.get(splitIndex);
        const insertIdx = commitInserts ? findInsertIdx(commitInserts, idx, parIdx) : null;
        const idxSplit = splitIdxMap + (insertIdx ?? 0);

        const isSecondaryMerge = info.isMerge && p > 0;

        zigZagLine(
          grid,
          [idxMap, idxSplit, parIdxMap],
          [column, parColumn],
          isSecondaryMerge,
          color,
          pers
        );
      }
    }
  }

  // 5. Handle reverse
  if (settings.reverseCommitOrder) {
    textLines.reverse();
    grid.reverse();
  }

  return { grid, textLines, indexMap };
}

// ---- printUnicode (main entry point, using actual graph types) ----

export function printUnicode(
  graph: ActualGitGraph,
  settings: Settings
): UnicodeGraphInfo {
  const result = buildUnicodeGrid(graph, settings);
  if (!result) {
    return [[], [], []];
  }

  const { grid, textLines, indexMap } = result;
  const [gLines, tLines] = printGraph(settings.characters, grid, textLines, settings.colored);

  return [gLines, tLines, indexMap];
}
