import { BranchSettings, MergePatterns, Settings, BranchOrder } from './settings';
import { toTerminalColor } from './print/colors';
import type { CommitData } from './print/format';

const ORIGIN = 'origin/';
const FORK = 'fork/';

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface HeadInfo {
  oid: string;
  name: string;
  isBranch: boolean;
}

export interface CommitInfo {
  oid: string;
  isMerge: boolean;
  parents: [string | null, string | null];
  children: string[];
  branches: number[];
  tags: number[];
  branchTrace: number | null;
  data?: CommitData;
}

export interface BranchVis {
  orderGroup: number;
  targetOrderGroup: number | null;
  sourceOrderGroup: number | null;
  termColor: number;
  svgColor: string;
  column: number | null;
}

export interface BranchInfo {
  target: string;
  mergeTarget: string | null;
  sourceBranch: number | null;
  targetBranch: number | null;
  name: string;
  persistence: number;
  isRemote: boolean;
  isMerged: boolean;
  isTag: boolean;
  visual: BranchVis;
  range: [number | null, number | null];
}

export interface GitGraph {
  commits: CommitInfo[];
  indices: Map<string, number>;
  allBranches: BranchInfo[];
  head: HeadInfo;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Tries to extract the name of a merged-in branch from the merge commit summary.
 */
export function parseMergeSummary(
  summary: string,
  patterns: MergePatterns,
): string | null {
  for (const regex of patterns.patterns) {
    const captures = regex.exec(summary);
    if (captures && captures.length === 2 && captures[1] != null) {
      return captures[1];
    }
  }
  return null;
}

/**
 * Finds the order-group index for a branch name from a list of order patterns.
 * Returns `order.length` if no pattern matches.
 */
export function branchOrder(name: string, order: RegExp[]): number {
  const stripped = name.startsWith(ORIGIN) ? name.slice(7) : null;
  for (let i = 0; i < order.length; i++) {
    if ((stripped !== null && order[i].test(stripped)) || order[i].test(name)) {
      return i;
    }
  }
  return order.length;
}

/**
 * Finds the color for a branch name from an ordered list of (regex, colors[])
 * pairs. Falls back to `unknown` colors for unmatched names.
 */
export function branchColor<T>(
  name: string,
  order: [RegExp, T[]][],
  unknown: T[],
  counter: number,
): T {
  const strippedName = name.startsWith(ORIGIN) ? name.slice(7) : name;

  for (const [regex, colors] of order) {
    if (regex.test(strippedName)) {
      return colors[counter % colors.length];
    }
  }

  return unknown[counter % unknown.length];
}

/**
 * Walks through commits and adds each commit's oid to the children of its parents.
 */
export function assignChildren(
  commits: CommitInfo[],
  indices: Map<string, number>,
): void {
  for (const info of commits) {
    for (const parOid of info.parents) {
      if (parOid !== null) {
        const parIdx = indices.get(parOid);
        if (parIdx !== undefined) {
          commits[parIdx].children.push(info.oid);
        }
      }
    }
  }
}

/**
 * Sorts branches into columns for visualization so that all branches can be
 * visualized linearly and without overlaps. Uses Shortest-First scheduling.
 */
export function assignBranchColumns(
  commits: CommitInfo[],
  indices: Map<string, number>,
  branches: BranchInfo[],
  settings: BranchSettings,
  shortestFirst: boolean,
  forward: boolean,
): void {
  const numGroups = settings.order.length + 1;
  const occupied: Array<Array<Array<[number, number]>>> = [];
  for (let i = 0; i < numGroups; i++) {
    occupied.push([]);
  }

  const lengthSortFactor = shortestFirst ? 1 : -1;
  const startSortFactor = forward ? 1 : -1;

  // Build sortable tuples: [branchIdx, start, end, sourceOrderGroup, targetOrderGroup]
  const branchesSort: Array<[number, number, number, number, number]> = [];
  for (let idx = 0; idx < branches.length; idx++) {
    const br = branches[idx];
    if (br.range[0] !== null || br.range[1] !== null) {
      branchesSort.push([
        idx,
        br.range[0] ?? 0,
        br.range[1] ?? branches.length - 1,
        br.visual.sourceOrderGroup ?? numGroups,
        br.visual.targetOrderGroup ?? numGroups,
      ]);
    }
  }

  // Sort by: max(sourceGroup, targetGroup), length * factor, start * factor
  branchesSort.sort((a, b) => {
    const aKey = Math.max(a[3], a[4]);
    const bKey = Math.max(b[3], b[4]);
    if (aKey !== bKey) return aKey - bKey;

    const aLen = (a[2] - a[1]) * lengthSortFactor;
    const bLen = (b[2] - b[1]) * lengthSortFactor;
    if (aLen !== bLen) return aLen - bLen;

    const aStart = a[1] * startSortFactor;
    const bStart = b[1] * startSortFactor;
    return aStart - bStart;
  });

  // Assign columns
  for (const [branchIdx, start, end] of branchesSort) {
    const branch = branches[branchIdx];
    const group = branch.visual.orderGroup;
    const groupOcc = occupied[group];

    // Determine alignment preference
    const alignRight =
      (branch.sourceBranch !== null &&
        branches[branch.sourceBranch].visual.orderGroup > branch.visual.orderGroup) ||
      (branch.targetBranch !== null &&
        branches[branch.targetBranch].visual.orderGroup > branch.visual.orderGroup);

    const len = groupOcc.length;
    let found = len;
    for (let i = 0; i < len; i++) {
      const index = alignRight ? len - i - 1 : i;
      const columnOcc = groupOcc[index];
      let occ = false;

      // Check overlap
      for (const [s, e] of columnOcc) {
        if (start <= e && end >= s) {
          occ = true;
          break;
        }
      }

      // Check merge target column collision in same group
      if (!occ && branch.mergeTarget !== null) {
        const tIdx = indices.get(branch.mergeTarget);
        if (tIdx !== undefined) {
          const mergeTrace = commits[tIdx].branchTrace;
          if (mergeTrace !== null) {
            const mergeBranch = branches[mergeTrace];
            if (
              mergeBranch.visual.orderGroup === branch.visual.orderGroup &&
              mergeBranch.visual.column === index
            ) {
              occ = true;
            }
          }
        }
      }

      if (!occ) {
        found = index;
        break;
      }
    }

    branch.visual.column = found;
    if (found === groupOcc.length) {
      groupOcc.push([]);
    }
    groupOcc[found].push([start, end]);
  }

  // Convert group-relative columns to absolute columns
  const groupOffset: number[] = [];
  let acc = 0;
  for (const group of occupied) {
    groupOffset.push(acc);
    acc += group.length;
  }

  for (const branch of branches) {
    if (branch.visual.column !== null) {
      branch.visual.column += groupOffset[branch.visual.orderGroup];
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers for BranchInfo / BranchVis construction
// ---------------------------------------------------------------------------

function makeBranchVis(
  orderGroup: number,
  termColor: number,
  svgColor: string,
): BranchVis {
  return {
    orderGroup,
    targetOrderGroup: null,
    sourceOrderGroup: null,
    termColor,
    svgColor,
    column: null,
  };
}

function makeBranchInfo(
  target: string,
  mergeTarget: string | null,
  name: string,
  persistence: number,
  isRemote: boolean,
  isMerged: boolean,
  isTag: boolean,
  visual: BranchVis,
  endIndex: number | null,
): BranchInfo {
  return {
    target,
    mergeTarget,
    targetBranch: null,
    sourceBranch: null,
    name,
    persistence,
    isRemote,
    isMerged,
    isTag,
    visual,
    range: [endIndex, null],
  };
}

// ---------------------------------------------------------------------------
// Git-dependent helpers (isomorphic-git)
// ---------------------------------------------------------------------------

export type FS = {
  promises: {
    readFile: (...args: any[]) => Promise<any>;
    writeFile: (...args: any[]) => Promise<any>;
    unlink: (...args: any[]) => Promise<any>;
    readdir: (...args: any[]) => Promise<any>;
    mkdir: (...args: any[]) => Promise<any>;
    rmdir: (...args: any[]) => Promise<any>;
    stat: (...args: any[]) => Promise<any>;
    lstat: (...args: any[]) => Promise<any>;
    readlink?: (...args: any[]) => Promise<any>;
    symlink?: (...args: any[]) => Promise<any>;
    chmod?: (...args: any[]) => Promise<any>;
  };
};

/**
 * Traces a branch back through first-parent links, assigning branch_trace
 * until a commit is reached that already has a trace.
 */
function traceBranch(
  commits: CommitInfo[],
  indices: Map<string, number>,
  branches: BranchInfo[],
  startOid: string,
  branchIndex: number,
  commitMessages: Map<string, string>,
): boolean {
  let currOid = startOid;
  let prevIndex: number | undefined;
  let startIndex: number | null = null;
  let anyAssigned = false;

  while (true) {
    const index = indices.get(currOid);
    if (index === undefined) break;

    const info = commits[index];
    if (info.branchTrace !== null) {
      const oldTrace = info.branchTrace;
      const oldBranch = branches[oldTrace];
      const oldName = oldBranch.name;
      const oldTerm = oldBranch.visual.termColor;
      const oldSvg = oldBranch.visual.svgColor;
      const oldRange = oldBranch.range;

      const newName = branches[branchIndex].name;
      const oldEnd = oldRange[0] ?? 0;
      const newEnd = branches[branchIndex].range[0] ?? 0;

      if (newName === oldName && oldEnd >= newEnd) {
        if (oldRange[1] !== null && oldRange[1] !== undefined) {
          if (index > oldRange[1]) {
            oldBranch.range = [null, null];
          } else {
            oldBranch.range = [index, oldBranch.range[1]];
          }
        } else {
          oldBranch.range = [index, oldBranch.range[1]];
        }
      } else {
        const branch = branches[branchIndex];
        if (branch.name.startsWith(ORIGIN) && branch.name.slice(7) === oldName) {
          branch.visual.termColor = oldTerm;
          branch.visual.svgColor = oldSvg;
        }
        if (prevIndex === undefined) {
          startIndex = index - 1;
        } else {
          if (commits[prevIndex].isMerge) {
            let tempIndex = prevIndex;
            for (const siblingOid of commits[index].children) {
              if (siblingOid !== currOid) {
                const siblingIndex = indices.get(siblingOid);
                if (siblingIndex !== undefined && siblingIndex > tempIndex) {
                  tempIndex = siblingIndex;
                }
              }
            }
            startIndex = tempIndex;
          } else {
            startIndex = index - 1;
          }
        }
        break;
      }
    }

    info.branchTrace = branchIndex;
    anyAssigned = true;

    // Move to first parent
    const firstParent = info.parents[0];
    if (firstParent === null) {
      startIndex = index;
      break;
    }
    prevIndex = index;
    currOid = firstParent;
  }

  const branch = branches[branchIndex];
  if (branch.range[0] !== null) {
    const end = branch.range[0];
    if (startIndex !== null) {
      if (startIndex < end) {
        branch.range = [null, null];
      } else {
        branch.range = [branch.range[0], startIndex];
      }
    } else {
      branch.range = [branch.range[0], null];
    }
  } else {
    branch.range = [branch.range[0], startIndex];
  }

  return anyAssigned;
}

/**
 * Extracts branches from commit data and assigns branches/branch traces to commits.
 */
function assignBranches(
  commits: CommitInfo[],
  indices: Map<string, number>,
  allBranchInfos: BranchInfo[],
): BranchInfo[] {
  let branchIdx = 0;

  const indexMap: Array<number | null> = allBranchInfos.map((branch, oldIdx) => {
    const idx = indices.get(branch.target);
    if (idx !== undefined) {
      const info = commits[idx];
      if (branch.isTag) {
        info.tags.push(oldIdx);
      } else if (!branch.isMerged) {
        info.branches.push(oldIdx);
      }

      const anyAssigned = traceBranch(
        commits,
        indices,
        allBranchInfos,
        info.oid,
        oldIdx,
        new Map(),
      );

      if (anyAssigned || !branch.isMerged) {
        branchIdx += 1;
        return branchIdx - 1;
      }
      return null;
    }
    return null;
  });

  // Count commits per branch
  const commitCount = new Array(allBranchInfos.length).fill(0);
  for (const info of commits) {
    if (info.branchTrace !== null) {
      commitCount[info.branchTrace] += 1;
    }
  }

  // Remove merged branches with zero commits
  let countSkipped = 0;
  for (let idx = 0; idx < allBranchInfos.length; idx++) {
    if (indexMap[idx] !== null) {
      if (commitCount[idx] === 0 && allBranchInfos[idx].isMerged && !allBranchInfos[idx].isTag) {
        indexMap[idx] = null;
        countSkipped += 1;
      } else {
        indexMap[idx] = indexMap[idx]! - countSkipped;
      }
    }
  }

  // Remap indices in commits
  for (const info of commits) {
    if (info.branchTrace !== null) {
      info.branchTrace = indexMap[info.branchTrace];
      info.branches = info.branches
        .filter(br => indexMap[br] !== null)
        .map(br => indexMap[br]!);
      info.tags = info.tags
        .filter(tag => indexMap[tag] !== null)
        .map(tag => indexMap[tag]!);
    }
  }

  // Filter out removed branches
  return allBranchInfos.filter((_, idx) => indexMap[idx] !== null);
}

/**
 * Corrects branch names when a merge branch has the same name as its target,
 * prefixing it with "fork/".
 */
function correctForkMerges(
  commits: CommitInfo[],
  indices: Map<string, number>,
  branches: BranchInfo[],
  settings: Settings,
): void {
  for (let idx = 0; idx < branches.length; idx++) {
    const branch = branches[idx];
    if (branch.mergeTarget === null) continue;

    const tIdx = indices.get(branch.mergeTarget);
    if (tIdx === undefined) continue;
    const info = commits[tIdx];
    if (info.branchTrace === null) continue;
    const mergeTarget = branches[info.branchTrace];
    if (!mergeTarget) continue;

    if (branch.name === mergeTarget.name) {
      const name = FORK + branch.name;
      const termCol = toTerminalColor(
        branchColor(
          name,
          settings.branches.terminalColors,
          settings.branches.terminalColorsUnknown,
          idx,
        ),
      );
      const pos = branchOrder(name, settings.branches.order);
      const svgCol = branchColor(
        name,
        settings.branches.svgColors,
        settings.branches.svgColorsUnknown,
        idx,
      );

      branches[idx].name = FORK + branches[idx].name;
      branches[idx].visual.orderGroup = pos;
      branches[idx].visual.termColor = termCol;
      branches[idx].visual.svgColor = svgCol;
    }
  }
}

/**
 * Assigns source and target branch relationships, and their order groups.
 */
function assignSourcesTargets(
  commits: CommitInfo[],
  indices: Map<string, number>,
  branches: BranchInfo[],
): void {
  // Assign target branches
  for (let idx = 0; idx < branches.length; idx++) {
    const branch = branches[idx];
    if (branch.mergeTarget === null) continue;

    const tIdx = indices.get(branch.mergeTarget);
    if (tIdx === undefined) continue;
    const info = commits[tIdx];
    if (info.branchTrace === null) continue;

    branches[idx].targetBranch = info.branchTrace;
    const targetBranch = branches[info.branchTrace];
    if (targetBranch) {
      branches[idx].visual.targetOrderGroup = targetBranch.visual.orderGroup;
    }
  }

  // Assign source branches
  for (const info of commits) {
    let maxParOrder: number | null = null;
    let sourceBranchId: number | null = null;

    for (const parOid of info.parents) {
      if (parOid === null) continue;
      const parIdx = indices.get(parOid);
      if (parIdx === undefined) continue;
      const parInfo = commits[parIdx];

      if (parInfo.branchTrace !== info.branchTrace) {
        if (parInfo.branchTrace !== null) {
          sourceBranchId = parInfo.branchTrace;
        }

        const group =
          parInfo.branchTrace !== null && branches[parInfo.branchTrace]
            ? branches[parInfo.branchTrace].visual.orderGroup
            : null;

        if (group !== null) {
          if (maxParOrder !== null) {
            if (group > maxParOrder) {
              maxParOrder = group;
            }
          } else {
            maxParOrder = group;
          }
        }
      }
    }

    if (info.branchTrace !== null && branches[info.branchTrace]) {
      const branch = branches[info.branchTrace];
      if (maxParOrder !== null) {
        branch.visual.sourceOrderGroup = maxParOrder;
      }
      if (sourceBranchId !== null) {
        branch.sourceBranch = sourceBranchId;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// createGitGraphFromData — build graph from raw data (no git repo needed)
// ---------------------------------------------------------------------------

/**
 * Raw commit data for building a graph without a git repository.
 */
export interface RawCommit {
  oid: string;
  parentOids: string[];
  message: string;
  author?: { name: string; email: string; timestamp: number; timezoneOffset: number };
  committer?: { name: string; email: string; timestamp: number; timezoneOffset: number };
}

/**
 * Raw branch reference for building a graph without a git repository.
 */
export interface RawBranch {
  name: string;
  /** Tip commit OID */
  oid: string;
  isRemote?: boolean;
}

/**
 * Raw tag reference for building a graph without a git repository.
 */
export interface RawTag {
  name: string;
  /** Peeled commit OID (not the tag object OID) */
  oid: string;
}

/**
 * Input data for createGitGraphFromData.
 * Commits should be in newest-first order (by committer timestamp).
 */
export interface RawGraphInput {
  head: HeadInfo;
  commits: RawCommit[];
  branches: RawBranch[];
  tags?: RawTag[];
}

/**
 * Creates a GitGraph from raw commit, branch, and tag data.
 * Use this when you have commit data from a source other than a git repository
 * (e.g., JSON, an API, or a database).
 *
 * The renderers (printUnicode, printSvg) work identically on graphs created
 * by this function or by createGitGraph.
 */
export function createGitGraphFromData(
  input: RawGraphInput,
  settings: Settings,
): GitGraph {
  const { head, commits: rawCommits, branches: rawBranches, tags: rawTags } = input;

  // Build CommitInfo[] and indices
  const commits: CommitInfo[] = [];
  const indices = new Map<string, number>();
  const commitMessages = new Map<string, string>();

  for (let i = 0; i < rawCommits.length; i++) {
    const raw = rawCommits[i];
    const parentOids = raw.parentOids;
    const summary = (raw.message ?? '').split('\n')[0];
    const info: CommitInfo = {
      oid: raw.oid,
      isMerge: parentOids.length > 1,
      parents: [parentOids[0] ?? null, parentOids[1] ?? null],
      children: [],
      branches: [],
      tags: [],
      branchTrace: null,
      data: {
        oid: raw.oid,
        summary,
        parentOids,
        message: raw.message ?? '',
        author: {
          name: raw.author?.name ?? '',
          email: raw.author?.email ?? '',
          timestamp: raw.author?.timestamp ?? 0,
          timezoneOffset: raw.author?.timezoneOffset ?? 0,
        },
        committer: {
          name: raw.committer?.name ?? '',
          email: raw.committer?.email ?? '',
          timestamp: raw.committer?.timestamp ?? 0,
          timezoneOffset: raw.committer?.timezoneOffset ?? 0,
        },
      },
    };
    commits.push(info);
    indices.set(raw.oid, i);
    commitMessages.set(raw.oid, raw.message);
  }

  // Assign children
  assignChildren(commits, indices);

  // Build branch infos
  let counter = 0;
  const allBranchInfos: BranchInfo[] = [];

  // Actual branches (local + remote)
  for (const br of rawBranches) {
    counter += 1;
    const endIndex = indices.get(br.oid) ?? null;
    const isRemote = br.isRemote ?? false;
    const termCol = toTerminalColor(
      branchColor(
        br.name,
        settings.branches.terminalColors,
        settings.branches.terminalColorsUnknown,
        counter,
      ),
    );
    const pos = branchOrder(br.name, settings.branches.order);
    const svgCol = branchColor(
      br.name,
      settings.branches.svgColors,
      settings.branches.svgColorsUnknown,
      counter,
    );
    allBranchInfos.push(
      makeBranchInfo(
        br.oid,
        null,
        br.name,
        branchOrder(br.name, settings.branches.persistence),
        isRemote,
        false,
        false,
        makeBranchVis(pos, termCol, svgCol),
        endIndex,
      ),
    );
  }

  // Merge branches (from merge commit summaries)
  for (let idx = 0; idx < commits.length; idx++) {
    const info = commits[idx];
    if (!info.isMerge) continue;
    const message = commitMessages.get(info.oid);
    if (!message) continue;

    counter += 1;
    const summary = message.split('\n')[0];
    const branchName = parseMergeSummary(summary, settings.mergePatterns) ?? 'unknown';
    const parentOid = info.parents[1];
    if (parentOid === null) continue;

    const persistence = branchOrder(branchName, settings.branches.persistence);
    const pos = branchOrder(branchName, settings.branches.order);
    const termCol = toTerminalColor(
      branchColor(
        branchName,
        settings.branches.terminalColors,
        settings.branches.terminalColorsUnknown,
        counter,
      ),
    );
    const svgCol = branchColor(
      branchName,
      settings.branches.svgColors,
      settings.branches.svgColorsUnknown,
      counter,
    );

    allBranchInfos.push(
      makeBranchInfo(
        parentOid,
        info.oid,
        branchName,
        persistence,
        false,
        true,
        false,
        makeBranchVis(pos, termCol, svgCol),
        idx + 1 < commits.length ? idx + 1 : idx,
      ),
    );
  }

  // Tags
  if (rawTags) {
    for (const tag of rawTags) {
      const targetIndex = indices.get(tag.oid);
      if (targetIndex === undefined) continue;

      counter += 1;
      const name = `tags/${tag.name}`;
      const termCol = toTerminalColor(
        branchColor(
          name,
          settings.branches.terminalColors,
          settings.branches.terminalColorsUnknown,
          counter,
        ),
      );
      const pos = branchOrder(name, settings.branches.order);
      const svgCol = branchColor(
        name,
        settings.branches.svgColors,
        settings.branches.svgColorsUnknown,
        counter,
      );

      allBranchInfos.push(
        makeBranchInfo(
          tag.oid,
          null,
          name,
          settings.branches.persistence.length + 1,
          false,
          false,
          true,
          makeBranchVis(pos, termCol, svgCol),
          targetIndex,
        ),
      );
    }
  }

  // Sort by persistence, then unmerged first
  allBranchInfos.sort((a, b) => {
    if (a.persistence !== b.persistence) return a.persistence - b.persistence;
    return (a.isMerged ? 1 : 0) - (b.isMerged ? 1 : 0);
  });

  // Assign branches (trace + filter)
  let allBranches = assignBranches(commits, indices, allBranchInfos);

  // Correct fork merges
  correctForkMerges(commits, indices, allBranches, settings);

  // Assign sources and targets
  assignSourcesTargets(commits, indices, allBranches);

  // Determine branch order parameters
  const shortestFirst = settings.branchOrder.type === 'ShortestFirst';
  const fwd = settings.branchOrder.forward;

  // Assign branch columns
  assignBranchColumns(commits, indices, allBranches, settings.branches, shortestFirst, fwd);

  // Filter commits to only those on a branch
  const filteredCommits = commits.filter(info => info.branchTrace !== null);

  // Create new indices
  const filteredIndices = new Map<string, number>();
  filteredCommits.forEach((info, idx) => {
    filteredIndices.set(info.oid, idx);
  });

  // Build old-to-new index map
  const indexMap = new Map<number, number | null>();
  for (const [oid, oldIndex] of indices) {
    const newIndex = filteredIndices.get(oid);
    indexMap.set(oldIndex, newIndex ?? null);
  }

  // Update branch ranges from old to new indices
  for (const branch of allBranches) {
    if (branch.range[0] !== null) {
      let startIdx = branch.range[0];
      let newIdx = indexMap.get(startIdx) ?? null;
      while (newIdx === null && startIdx < commits.length - 1) {
        startIdx += 1;
        newIdx = indexMap.get(startIdx) ?? null;
      }
      branch.range[0] = newIdx;
    }
    if (branch.range[1] !== null) {
      let endIdx = branch.range[1];
      let newIdx = indexMap.get(endIdx) ?? null;
      while (newIdx === null && endIdx > 0) {
        endIdx -= 1;
        newIdx = indexMap.get(endIdx) ?? null;
      }
      branch.range[1] = newIdx;
    }
  }

  return {
    commits: filteredCommits,
    indices: filteredIndices,
    allBranches,
    head,
  };
}

// ---------------------------------------------------------------------------
// GitGraph.create  (isomorphic-git based)
// ---------------------------------------------------------------------------

/**
 * Creates a GitGraph by reading from a git repository using isomorphic-git.
 */
export async function createGitGraph(
  dir: string,
  fs: FS,
  settings: Settings,
  startPoint?: string,
  maxCount?: number,
): Promise<GitGraph> {
  // Lazy-import isomorphic-git to keep pure functions testable without it
  const git = await import('isomorphic-git');

  // Resolve HEAD
  let headOid: string;
  let headName: string;
  let headIsBranch: boolean;
  try {
    headOid = await git.resolveRef({ fs, dir, ref: 'HEAD' });
    try {
      const symRef = await git.resolveRef({ fs, dir, ref: 'HEAD', depth: 1 });
      // If HEAD points to a branch, the symbolic ref differs from the oid
      // Read the symbolic ref name from .git/HEAD
      const headContent = await fs.promises
        .readFile(`${dir}/.git/HEAD`, { encoding: 'utf8' })
        .catch(() => null);
      if (headContent && headContent.trim().startsWith('ref: refs/heads/')) {
        headName = headContent.trim().slice('ref: refs/heads/'.length);
        headIsBranch = true;
      } else {
        headName = 'HEAD';
        headIsBranch = false;
      }
    } catch {
      headName = 'HEAD';
      headIsBranch = false;
    }
  } catch {
    throw new Error('No HEAD found in repository');
  }

  const head: HeadInfo = { oid: headOid, name: headName, isBranch: headIsBranch };

  // Collect commits using git.log
  const ref = startPoint ?? 'HEAD';
  let logEntries: Array<{ oid: string; commit: { parent: string[]; message: string } }>;
  try {
    logEntries = await git.log({ fs, dir, ref, depth: maxCount });
  } catch {
    logEntries = [];
  }

  // Also try to get commits from all branches if no start point given
  if (!startPoint) {
    const localBranches = await git.listBranches({ fs, dir }).catch(() => [] as string[]);
    const remoteBranches = settings.includeRemote
      ? await git.listBranches({ fs, dir, remote: 'origin' }).catch(() => [] as string[])
      : [];

    const seenOids = new Set(logEntries.map(e => e.oid));

    for (const brName of [...localBranches, ...remoteBranches.map(b => `origin/${b}`)]) {
      try {
        const branchRef = brName.startsWith('origin/') ? `refs/remotes/${brName}` : brName;
        const branchLog = await git.log({ fs, dir, ref: branchRef, depth: maxCount });
        for (const entry of branchLog) {
          if (!seenOids.has(entry.oid)) {
            seenOids.add(entry.oid);
            logEntries.push(entry);
          }
        }
      } catch {
        // Skip branches that can't be resolved
      }
    }
  }

  // Sort topologically+time (git.log already returns in topological order for each branch)
  // We use commit timestamp for ordering
  logEntries.sort((a, b) => {
    const aTime = (a.commit as any).committer?.timestamp ?? 0;
    const bTime = (b.commit as any).committer?.timestamp ?? 0;
    return bTime - aTime; // newest first
  });

  // Deduplicate (keep first occurrence)
  const seenOidsDedup = new Set<string>();
  const uniqueEntries: typeof logEntries = [];
  for (const entry of logEntries) {
    if (!seenOidsDedup.has(entry.oid)) {
      seenOidsDedup.add(entry.oid);
      uniqueEntries.push(entry);
    }
  }

  // Build commits and indices
  const commits: CommitInfo[] = [];
  const indices = new Map<string, number>();
  const commitMessages = new Map<string, string>();

  for (let i = 0; i < uniqueEntries.length; i++) {
    if (maxCount !== undefined && i >= maxCount) break;

    const entry = uniqueEntries[i];
    const parentOids = entry.commit.parent;
    const commitObj = entry.commit as any;
    const summary = (commitObj.message ?? '').split('\n')[0];
    const info: CommitInfo = {
      oid: entry.oid,
      isMerge: parentOids.length > 1,
      parents: [parentOids[0] ?? null, parentOids[1] ?? null],
      children: [],
      branches: [],
      tags: [],
      branchTrace: null,
      data: {
        oid: entry.oid,
        summary,
        parentOids: parentOids,
        message: commitObj.message ?? '',
        author: {
          name: commitObj.author?.name ?? '',
          email: commitObj.author?.email ?? '',
          timestamp: commitObj.author?.timestamp ?? 0,
          timezoneOffset: commitObj.author?.timezoneOffset ?? 0,
        },
        committer: {
          name: commitObj.committer?.name ?? '',
          email: commitObj.committer?.email ?? '',
          timestamp: commitObj.committer?.timestamp ?? 0,
          timezoneOffset: commitObj.committer?.timezoneOffset ?? 0,
        },
      },
    };
    commits.push(info);
    indices.set(entry.oid, i);
    commitMessages.set(entry.oid, entry.commit.message);
  }

  // Assign children
  assignChildren(commits, indices);

  // Extract branches from git
  let counter = 0;
  const allBranchInfos: BranchInfo[] = [];

  // Actual branches
  const localBranches = await git.listBranches({ fs, dir }).catch(() => [] as string[]);
  const remoteBranches = settings.includeRemote
    ? await git.listBranches({ fs, dir, remote: 'origin' }).catch(() => [] as string[])
    : [];

  for (const brName of localBranches) {
    try {
      const brOid = await git.resolveRef({ fs, dir, ref: brName });
      counter += 1;
      const endIndex = indices.get(brOid) ?? null;
      const termCol = toTerminalColor(
        branchColor(
          brName,
          settings.branches.terminalColors,
          settings.branches.terminalColorsUnknown,
          counter,
        ),
      );
      const pos = branchOrder(brName, settings.branches.order);
      const svgCol = branchColor(
        brName,
        settings.branches.svgColors,
        settings.branches.svgColorsUnknown,
        counter,
      );
      allBranchInfos.push(
        makeBranchInfo(
          brOid,
          null,
          brName,
          branchOrder(brName, settings.branches.persistence),
          false,
          false,
          false,
          makeBranchVis(pos, termCol, svgCol),
          endIndex,
        ),
      );
    } catch {
      // Skip unresolvable branches
    }
  }

  for (const brName of remoteBranches) {
    try {
      const fullName = `origin/${brName}`;
      const brOid = await git.resolveRef({ fs, dir, ref: `refs/remotes/${fullName}` });
      counter += 1;
      const endIndex = indices.get(brOid) ?? null;
      const termCol = toTerminalColor(
        branchColor(
          fullName,
          settings.branches.terminalColors,
          settings.branches.terminalColorsUnknown,
          counter,
        ),
      );
      const pos = branchOrder(fullName, settings.branches.order);
      const svgCol = branchColor(
        fullName,
        settings.branches.svgColors,
        settings.branches.svgColorsUnknown,
        counter,
      );
      allBranchInfos.push(
        makeBranchInfo(
          brOid,
          null,
          fullName,
          branchOrder(fullName, settings.branches.persistence),
          true,
          false,
          false,
          makeBranchVis(pos, termCol, svgCol),
          endIndex,
        ),
      );
    } catch {
      // Skip unresolvable branches
    }
  }

  // Merge branches (from merge commit summaries)
  for (let idx = 0; idx < commits.length; idx++) {
    const info = commits[idx];
    if (!info.isMerge) continue;
    const message = commitMessages.get(info.oid);
    if (!message) continue;

    counter += 1;
    const summary = message.split('\n')[0];
    const branchName = parseMergeSummary(summary, settings.mergePatterns) ?? 'unknown';
    const parentOid = info.parents[1];
    if (parentOid === null) continue;

    const persistence = branchOrder(branchName, settings.branches.persistence);
    const pos = branchOrder(branchName, settings.branches.order);
    const termCol = toTerminalColor(
      branchColor(
        branchName,
        settings.branches.terminalColors,
        settings.branches.terminalColorsUnknown,
        counter,
      ),
    );
    const svgCol = branchColor(
      branchName,
      settings.branches.svgColors,
      settings.branches.svgColorsUnknown,
      counter,
    );

    allBranchInfos.push(
      makeBranchInfo(
        parentOid,
        info.oid,
        branchName,
        persistence,
        false,
        true,
        false,
        makeBranchVis(pos, termCol, svgCol),
        idx + 1 < commits.length ? idx + 1 : idx,
      ),
    );
  }

  // Tags
  const tagNames = await git.listTags({ fs, dir }).catch(() => [] as string[]);
  for (const tagName of tagNames) {
    try {
      const tagOid = await git.resolveRef({ fs, dir, ref: `refs/tags/${tagName}` });
      // Try to resolve annotated tag to commit
      let targetOid = tagOid;
      try {
        const tagObj = await git.readTag({ fs, dir, oid: tagOid });
        targetOid = tagObj.tag.object;
      } catch {
        // Not an annotated tag, use oid directly
      }

      const targetIndex = indices.get(targetOid);
      if (targetIndex === undefined) continue;

      counter += 1;
      const name = `tags/${tagName}`;
      const termCol = toTerminalColor(
        branchColor(
          name,
          settings.branches.terminalColors,
          settings.branches.terminalColorsUnknown,
          counter,
        ),
      );
      const pos = branchOrder(name, settings.branches.order);
      const svgCol = branchColor(
        name,
        settings.branches.svgColors,
        settings.branches.svgColorsUnknown,
        counter,
      );

      allBranchInfos.push(
        makeBranchInfo(
          targetOid,
          null,
          name,
          settings.branches.persistence.length + 1,
          false,
          false,
          true,
          makeBranchVis(pos, termCol, svgCol),
          targetIndex,
        ),
      );
    } catch {
      // Skip unresolvable tags
    }
  }

  // Sort by persistence, then unmerged first
  allBranchInfos.sort((a, b) => {
    if (a.persistence !== b.persistence) return a.persistence - b.persistence;
    // !isMerged = true first (unmerged before merged), i.e. merged = false < merged = true
    // In Rust: sort_by_cached_key(|b| (b.persistence, !b.is_merged))
    // !false = true > !true = false, so unmerged first
    return (a.isMerged ? 1 : 0) - (b.isMerged ? 1 : 0);
  });

  // Assign branches (trace + filter)
  let allBranches = assignBranches(commits, indices, allBranchInfos);

  // Correct fork merges
  correctForkMerges(commits, indices, allBranches, settings);

  // Assign sources and targets
  assignSourcesTargets(commits, indices, allBranches);

  // Determine branch order parameters
  const shortestFirst = settings.branchOrder.type === 'ShortestFirst';
  const fwd = settings.branchOrder.forward;

  // Assign branch columns
  assignBranchColumns(commits, indices, allBranches, settings.branches, shortestFirst, fwd);

  // Filter commits to only those on a branch
  const filteredCommits = commits.filter(info => info.branchTrace !== null);

  // Create new indices
  const filteredIndices = new Map<string, number>();
  filteredCommits.forEach((info, idx) => {
    filteredIndices.set(info.oid, idx);
  });

  // Build old-to-new index map
  const indexMap = new Map<number, number | null>();
  for (const [oid, oldIndex] of indices) {
    const newIndex = filteredIndices.get(oid);
    indexMap.set(oldIndex, newIndex ?? null);
  }

  // Update branch ranges from old to new indices
  for (const branch of allBranches) {
    if (branch.range[0] !== null) {
      let startIdx = branch.range[0];
      let newIdx = indexMap.get(startIdx) ?? null;
      while (newIdx === null && startIdx < commits.length - 1) {
        startIdx += 1;
        newIdx = indexMap.get(startIdx) ?? null;
      }
      branch.range[0] = newIdx;
    }
    if (branch.range[1] !== null) {
      let endIdx = branch.range[1];
      let newIdx = indexMap.get(endIdx) ?? null;
      while (newIdx === null && endIdx > 0) {
        endIdx -= 1;
        newIdx = indexMap.get(endIdx) ?? null;
      }
      branch.range[1] = newIdx;
    }
  }

  return {
    commits: filteredCommits,
    indices: filteredIndices,
    allBranches,
    head,
  };
}
