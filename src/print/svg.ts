/**
 * Create graphs in SVG format (Scalable Vector Graphics).
 * Renders a terminal-style output: colored Unicode graph characters
 * alongside commit text on a dark background with monospace font.
 */

import type { GitGraph } from '../graph';
import type { Settings } from '../settings';
import { printUnicode, buildUnicodeGrid, Grid, SPACE, DOT, CIRCLE, VER, HOR, CROSS, R_U, R_D, L_D, L_U, VER_L, VER_R, HOR_U, HOR_D, ARR_L, ARR_R, WHITE } from './unicode';
import { ansi256ToHex } from './colors';
import { getDeviateIndex } from './index';
import chalk from 'chalk';

// Layout constants — Kreative Square SM is a 1:1 (square cell) monospace font
const FONT_SIZE = 14;
const CHAR_WIDTH = FONT_SIZE;
const LINE_HEIGHT = FONT_SIZE;
const PADDING_X = 10;
const PADDING_Y = 8;
const BG_COLOR = '#1e1e1e';
const DEFAULT_TEXT_COLOR = '#cccccc';
const FONT_FAMILY = "'Kreative Square SM', monospace";
const TEXT_FONT_FAMILY = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace";
const TEXT_FONT_SIZE = 12;
const TEXT_CHAR_WIDTH = 7.2;

// Kreative Square SM (subset) — SIL OFL licensed, 1:1 square monospace font
// Source: https://github.com/kreativekorp/open-relay/tree/master/KreativeSquare
import { FONT_BASE64 } from './font-data';

/**
 * SVG character override map.
 * Maps terminal characters → Kreative Square SM glyphs for SVG output.
 * Edit this map to swap characters — no other changes needed.
 */
const SVG_CHAR_OVERRIDE: Record<string, string> = {
  '●': '\u26AB', // U+25CF → U+26AB (medium black circle)
  '○': '\u26AA', // U+25CB → U+26AA (medium white circle)
};

/**
 * Additional overrides for horizontal SVG (by character index).
 * These are applied on top of SVG_CHAR_OVERRIDE.
 */
const SVG_HORIZONTAL_OVERRIDE: Record<number, string> = {
  [ARR_L]: '\u02C4',  // < → ˄ (up arrow)
  [ARR_R]: '\u02C5',  // > → ˅ (down arrow)
};

function applySvgOverrides(spans: AnsiSpan[]): AnsiSpan[] {
  return spans.map(span => {
    let text = span.text;
    for (const [from, to] of Object.entries(SVG_CHAR_OVERRIDE)) {
      text = text.replaceAll(from, to);
    }
    return text === span.text ? span : { ...span, text };
  });
}

function resolveHorizontalChar(charIndex: number, characters: { chars: string[] }): string {
  if (SVG_HORIZONTAL_OVERRIDE[charIndex] !== undefined) return SVG_HORIZONTAL_OVERRIDE[charIndex];
  const base = characters.chars[charIndex];
  return SVG_CHAR_OVERRIDE[base] ?? base;
}

function svgFontFace(): string {
  return `<defs><style>@font-face{font-family:'Kreative Square SM';src:url('data:font/woff2;base64,${FONT_BASE64}') format('woff2');}</style></defs>`;
}

/** A span of text with an optional hex color. */
export interface AnsiSpan {
  text: string;
  color?: string;
}

/**
 * Parse a string containing ANSI-256 color escape sequences into
 * structured spans with hex colors.
 *
 * Handles: ESC[38;5;Nm (set fg), ESC[39m (reset fg), ESC[0m (full reset)
 */
export function parseAnsi(input: string): AnsiSpan[] {
  if (input.length === 0) return [];

  const spans: AnsiSpan[] = [];
  // Match ANSI 256-color set (38;5;N), fg reset (39), or full reset (0)
  const ansiRe = /\x1b\[(?:38;5;(\d+)|39|0)m/g;

  let currentColor: string | undefined;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRe.exec(input)) !== null) {
    // Text before this escape
    const text = input.slice(lastIndex, match.index);
    if (text.length > 0) {
      spans.push(currentColor ? { text, color: currentColor } : { text });
    }

    if (match[1] !== undefined) {
      // ESC[38;5;Nm — set foreground color
      currentColor = ansi256ToHex(parseInt(match[1], 10));
    } else {
      // ESC[39m or ESC[0m — reset
      currentColor = undefined;
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  const tail = input.slice(lastIndex);
  if (tail.length > 0) {
    spans.push(currentColor ? { text: tail, color: currentColor } : { text: tail });
  }

  return spans;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a line of spans as SVG `<text>` with colored `<tspan>` children.
 */
function renderSvgLine(spans: AnsiSpan[], x: number, y: number): string {
  const parts: string[] = [];
  for (const span of spans) {
    const fill = span.color ?? DEFAULT_TEXT_COLOR;
    parts.push(`<tspan fill="${fill}">${escapeXml(span.text)}</tspan>`);
  }
  return `<text x="${x}" y="${y}" xml:space="preserve">${parts.join('')}</text>`;
}

/**
 * Character index mapping for transposing the grid.
 * Transpose swaps axes: left↔up, right↔down.
 */
const TRANSPOSE_MAP: Record<number, number> = {
  [SPACE]: SPACE,
  [DOT]: DOT,
  [CIRCLE]: CIRCLE,
  [VER]: HOR,
  [HOR]: VER,
  [CROSS]: CROSS,
  [R_U]: L_D,    // └(right+up) → ┐(left+down)
  [R_D]: R_D,    // ┌(right+down) → ┌(right+down) — symmetric on diagonal
  [L_D]: R_U,    // ┐(left+down) → └(right+up)
  [L_U]: L_U,    // ┘(left+up) → ┘(left+up) — symmetric on diagonal
  [VER_L]: HOR_U, // ┤(up+down+left) → ┴(left+right+up)
  [VER_R]: HOR_D, // ├(up+down+right) → ┬(left+right+down)
  [HOR_U]: VER_L, // ┴(left+right+up) → ┤(up+down+left)
  [HOR_D]: VER_R, // ┬(left+right+down) → ├(up+down+right)
  [ARR_L]: ARR_L,
  [ARR_R]: ARR_R,
};

/**
 * Character index mapping for transposing a reversed grid.
 * Combines the normal transpose (VER↔HOR, corner/T-junction rotation)
 * with an up↔down flip to account for the reversed row order.
 */
const TRANSPOSE_MAP_REVERSED: Record<number, number> = {
  [SPACE]: SPACE,
  [DOT]: DOT,
  [CIRCLE]: CIRCLE,
  [VER]: HOR,
  [HOR]: VER,
  [CROSS]: CROSS,
  [R_U]: R_D,
  [R_D]: R_U,
  [L_D]: L_U,
  [L_U]: L_D,
  [VER_L]: HOR_D,
  [VER_R]: HOR_U,
  [HOR_U]: VER_R,
  [HOR_D]: VER_L,
  [ARR_L]: ARR_L,
  [ARR_R]: ARR_R,
};

/**
 * Transpose a grid: swap rows↔columns and remap box-drawing characters.
 */
export function transposeGrid(grid: Grid, reversed: boolean = false): Grid {
  const map = reversed ? TRANSPOSE_MAP_REVERSED : TRANSPOSE_MAP;
  const newGrid = new Grid(grid.height, grid.width, {
    character: SPACE,
    color: WHITE,
    pers: 0,
  });

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.data[grid.index(x, y)];
      const newChar = map[cell.character] ?? cell.character;
      newGrid.set(y, x, newChar, cell.color, cell.pers);
    }
  }

  return newGrid;
}

/**
 * Creates a terminal-style SVG representation of a graph.
 * Produces colored Unicode graph characters alongside formatted commit text
 * on a dark background with monospace font.
 * When horizontal is true, the graph flows left-to-right using the original
 * SVG primitive renderer (circles, lines, paths).
 */
export function printSvg(graph: GitGraph, settings: Settings, horizontal: boolean = false): string {
  // Force colored output — chalk may disable colors when piped
  const prevLevel = chalk.level;
  chalk.level = 2; // 256-color support
  try {
    if (horizontal) {
      return printSvgHorizontal(graph, settings);
    }
    return printSvgVertical(graph, settings);
  } finally {
    chalk.level = prevLevel;
  }
}

function printSvgVertical(graph: GitGraph, settings: Settings): string {
  const svgSettings: Settings = { ...settings, colored: true };

  const [graphLines, textLines] = printUnicode(graph, svgSettings);

  // Parse graph and text ANSI separately, trimming trailing spaces from graph
  const parsedGraph = graphLines.map(line => {
    const spans = parseAnsi(line);
    // Trim trailing whitespace-only spans
    while (spans.length > 0) {
      const last = spans[spans.length - 1];
      const trimmed = last.text.replace(/\s+$/, '');
      if (trimmed.length === 0) {
        spans.pop();
      } else {
        spans[spans.length - 1] = { ...last, text: trimmed };
        break;
      }
    }
    return spans;
  });
  const parsedText = textLines.map(parseAnsi);

  // Calculate graph width in characters (max stripped length of graph lines)
  const graphCharWidth = graphLines.reduce((max, line) => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    return Math.max(max, stripped.length);
  }, 0);

  // Calculate text width for SVG sizing
  const maxTextLen = textLines.reduce((max, line) => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    return Math.max(max, stripped.length);
  }, 0);

  const textXOffset = graphCharWidth * CHAR_WIDTH + 2 * CHAR_WIDTH; // 2-char gap
  const width = PADDING_X * 2 + textXOffset + maxTextLen * TEXT_CHAR_WIDTH;
  const height = PADDING_Y * 2 + graphLines.length * LINE_HEIGHT;

  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    svgFontFace(),
    `<rect width="100%" height="100%" fill="${BG_COLOR}"/>`,
  ];

  // Graph portion — Kreative Square SM (1:1 square cells)
  elements.push(`<g font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" dominant-baseline="text-before-edge">`);
  for (let i = 0; i < parsedGraph.length; i++) {
    if (parsedGraph[i].length === 0) continue;
    const x = PADDING_X;
    const y = PADDING_Y + i * LINE_HEIGHT;
    elements.push(renderSvgLine(applySvgOverrides(parsedGraph[i]), x, y));
  }
  elements.push('</g>');

  // Text portion — standard monospace font
  elements.push(`<g font-family="${TEXT_FONT_FAMILY}" font-size="${TEXT_FONT_SIZE}" dominant-baseline="text-before-edge">`);
  for (let i = 0; i < parsedText.length; i++) {
    if (parsedText[i].length === 0) continue;
    const x = PADDING_X + textXOffset;
    const y = PADDING_Y + i * LINE_HEIGHT;
    elements.push(renderSvgLine(parsedText[i], x, y));
  }
  elements.push('</g>');

  elements.push('</svg>');

  return elements.join('\n');
}

// ---- Horizontal SVG — original SVG primitive renderer ----

/**
 * Convert commit index and column to SVG coordinates.
 * When horizontal is true, axes are swapped (time flows left-to-right).
 */
export function commitCoord(
  index: number,
  column: number,
  horizontal: boolean = false
): [number, number] {
  const colCoord = 15.0 * (column + 1);
  const idxCoord = 15.0 * (index + 1);
  return horizontal ? [idxCoord, colCoord] : [colCoord, idxCoord];
}

function printSvgHorizontal(graph: GitGraph, settings: Settings): string {
  const horizontal = true;
  const elements: string[] = [];
  const maxIdx = graph.commits.length;
  let maxColumn = 0;

  // Debug: draw branch ranges
  if (settings.debug) {
    for (const branch of graph.allBranches) {
      const [start, end] = branch.range;
      if (start !== null && end !== null) {
        elements.push(
          svgBoldLine(start, branch.visual.column!, end, branch.visual.column!, 'cyan', horizontal)
        );
      }
    }
  }

  for (let idx = 0; idx < graph.commits.length; idx++) {
    const info = graph.commits[idx];
    const trace = info.branchTrace;
    if (trace === null) continue;

    const branch = graph.allBranches[trace];
    const branchColor = branch.visual.svgColor;
    const column = branch.visual.column!;

    if (column > maxColumn) {
      maxColumn = column;
    }

    for (let p = 0; p < 2; p++) {
      const parOid = info.parents[p];
      if (!parOid) continue;

      const parIdx = graph.indices.get(parOid);
      if (parIdx === undefined) {
        elements.push(svgLine(idx, column, maxIdx, column, branchColor, horizontal));
        continue;
      }

      const parInfo = graph.commits[parIdx];
      const parBranch = graph.allBranches[parInfo.branchTrace!];

      const color = info.isMerge ? parBranch.visual.svgColor : branchColor;

      if (branch.visual.column === parBranch.visual.column) {
        elements.push(
          svgLine(idx, column, parIdx, parBranch.visual.column!, color, horizontal)
        );
      } else {
        const splitIndex = getDeviateIndex(graph, idx, parIdx);
        elements.push(
          svgPath(
            idx,
            column,
            parIdx,
            parBranch.visual.column!,
            splitIndex,
            color,
            horizontal
          )
        );
      }
    }

    if (!settings.mergesOnly || info.isMerge) {
      elements.push(
        svgCommitDot(idx, column, branchColor, !info.isMerge, horizontal)
      );
    }
  }

  const [xMax, yMax] = commitCoord(maxIdx + 1, maxColumn + 1, horizontal);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${xMax} ${yMax}" width="${xMax}" height="${yMax}">`,
    ...elements,
    '</svg>',
  ].join('\n');
}

function svgCommitDot(
  index: number,
  column: number,
  color: string,
  filled: boolean,
  horizontal: boolean = false
): string {
  const [x, y] = commitCoord(index, column, horizontal);
  return `<circle cx="${x}" cy="${y}" r="4" fill="${filled ? color : 'white'}" stroke="${color}" stroke-width="1"/>`;
}

function svgLine(
  index1: number,
  column1: number,
  index2: number,
  column2: number,
  color: string,
  horizontal: boolean = false
): string {
  const [x1, y1] = commitCoord(index1, column1, horizontal);
  const [x2, y2] = commitCoord(index2, column2, horizontal);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`;
}

function svgBoldLine(
  index1: number,
  column1: number,
  index2: number,
  column2: number,
  color: string,
  horizontal: boolean = false
): string {
  const [x1, y1] = commitCoord(index1, column1, horizontal);
  const [x2, y2] = commitCoord(index2, column2, horizontal);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="5"/>`;
}

function svgPath(
  index1: number,
  column1: number,
  index2: number,
  column2: number,
  splitIdx: number,
  color: string,
  horizontal: boolean = false
): string {
  const c0 = commitCoord(index1, column1, horizontal);
  const c1 = commitCoord(splitIdx, column1, horizontal);
  const c2 = commitCoord(splitIdx + 1, column2, horizontal);
  const c3 = commitCoord(index2, column2, horizontal);

  const m: [number, number] = [
    0.5 * (c1[0] + c2[0]),
    0.5 * (c1[1] + c2[1]),
  ];

  const d = [
    `M ${c0[0]} ${c0[1]}`,
    `L ${c1[0]} ${c1[1]}`,
    `Q ${c1[0]} ${m[1]} ${m[0]} ${m[1]}`,
    `Q ${c2[0]} ${m[1]} ${c2[0]} ${c2[1]}`,
    `L ${c3[0]} ${c3[1]}`,
  ].join(' ');

  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1"/>`;
}
