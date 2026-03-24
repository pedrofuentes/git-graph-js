/**
 * Create graphs in SVG format (Scalable Vector Graphics).
 * Port of print/svg.rs
 */

import type { GitGraph } from '../graph';
import type { Settings } from '../settings';
import { getDeviateIndex } from './index';

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

/**
 * Creates an SVG visual representation of a graph.
 * When horizontal is true, the graph flows left-to-right instead of top-to-bottom.
 */
export function printSvg(graph: GitGraph, settings: Settings, horizontal: boolean = false): string {
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
        // Parent outside scope - draw line to bottom
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

    elements.push(
      svgCommitDot(idx, column, branchColor, !info.isMerge, horizontal)
    );
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
