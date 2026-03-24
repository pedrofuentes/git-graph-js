/**
 * Print module entry point.
 * Port of print/mod.rs
 */

import type { GitGraph } from '../graph';

export { printSvg } from './svg';

/**
 * Find the index at which a between-branch connection
 * has to deviate from the current branch's column.
 *
 * Returns the last index on the current column.
 */
export function getDeviateIndex(
  graph: GitGraph,
  index: number,
  parIndex: number
): number {
  const info = graph.commits[index];
  const parInfo = graph.commits[parIndex];
  const parBranch = graph.allBranches[parInfo.branchTrace!];

  let minSplitIdx = index;

  for (const siblingOid of parInfo.children) {
    const siblingIndex = graph.indices.get(siblingOid);
    if (siblingIndex === undefined) continue;

    const sibling = graph.commits[siblingIndex];
    if (!sibling) continue;

    const siblingTrace = sibling.branchTrace;
    if (siblingTrace === null) continue;

    const siblingBranch = graph.allBranches[siblingTrace];
    if (
      siblingOid !== info.oid &&
      siblingBranch.visual.column === parBranch.visual.column &&
      siblingIndex > minSplitIdx
    ) {
      minSplitIdx = siblingIndex;
    }
  }

  if (info.isMerge) {
    return Math.max(index, minSplitIdx);
  } else {
    return parIndex - 1;
  }
}
