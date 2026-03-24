import { describe, it, expect } from 'vitest';
import {
  parseMergeSummary,
  branchOrder,
  branchColor,
  assignChildren,
  assignBranchColumns,
  CommitInfo,
  BranchInfo,
  BranchVis,
} from '../src/graph';
import { MergePatterns, BranchSettings, BranchSettingsDef } from '../src/settings';

// ---------------------------------------------------------------------------
// parseMergeSummary
// ---------------------------------------------------------------------------

describe('parseMergeSummary', () => {
  const patterns = MergePatterns.default();

  it('parses GitLab-style merge summary', () => {
    const summary = "Merge branch 'feature/my-feature' into 'master'";
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('parses git default merge summary', () => {
    const summary = "Merge branch 'feature/my-feature' into dev";
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('parses git merge into master (no "into" clause)', () => {
    const summary = "Merge branch 'feature/my-feature'";
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('parses GitHub pull request merge summary', () => {
    const summary = 'Merge pull request #1 from user-x/feature/my-feature';
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('parses GitHub-style "of" merge summary', () => {
    const summary = "Merge branch 'feature/my-feature' of github.com:user-x/repo";
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('parses Bitbucket pull request merge summary', () => {
    const summary = 'Merged in feature/my-feature (pull request #1)';
    expect(parseMergeSummary(summary, patterns)).toBe('feature/my-feature');
  });

  it('returns null for non-merge summaries', () => {
    expect(parseMergeSummary('Initial commit', patterns)).toBeNull();
    expect(parseMergeSummary('fix: some bug', patterns)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// branchOrder
// ---------------------------------------------------------------------------

describe('branchOrder', () => {
  const gitFlowOrder = BranchSettings.from(BranchSettingsDef.gitFlow()).order;

  it('returns 0 for master/main/trunk (first pattern)', () => {
    expect(branchOrder('main', gitFlowOrder)).toBe(0);
    expect(branchOrder('master', gitFlowOrder)).toBe(0);
    expect(branchOrder('trunk', gitFlowOrder)).toBe(0);
  });

  it('returns 1 for hotfix/release branches', () => {
    expect(branchOrder('hotfix/123', gitFlowOrder)).toBe(1);
    expect(branchOrder('release/1.0', gitFlowOrder)).toBe(1);
  });

  it('returns 2 for develop/dev branches', () => {
    expect(branchOrder('develop', gitFlowOrder)).toBe(2);
    expect(branchOrder('dev', gitFlowOrder)).toBe(2);
  });

  it('returns order.length for unmatched branches', () => {
    expect(branchOrder('feature/foo', gitFlowOrder)).toBe(gitFlowOrder.length);
    expect(branchOrder('some-random', gitFlowOrder)).toBe(gitFlowOrder.length);
  });

  it('strips "origin/" prefix before matching', () => {
    expect(branchOrder('origin/main', gitFlowOrder)).toBe(0);
    expect(branchOrder('origin/develop', gitFlowOrder)).toBe(2);
    expect(branchOrder('origin/hotfix/fix', gitFlowOrder)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// branchColor
// ---------------------------------------------------------------------------

describe('branchColor', () => {
  const settings = BranchSettings.from(BranchSettingsDef.gitFlow());

  it('returns matching terminal color for main', () => {
    const color = branchColor(
      'main',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      0,
    );
    expect(color).toBe('bright_blue');
  });

  it('returns matching terminal color for develop', () => {
    const color = branchColor(
      'develop',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      0,
    );
    expect(color).toBe('bright_yellow');
  });

  it('cycles through colors for feature branches', () => {
    const color0 = branchColor(
      'feature/a',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      0,
    );
    const color1 = branchColor(
      'feature/b',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      1,
    );
    expect(color0).toBe('bright_magenta');
    expect(color1).toBe('bright_cyan');
  });

  it('returns unknown color for unmatched branch', () => {
    const color = branchColor(
      'some-random',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      0,
    );
    expect(color).toBe('white');
  });

  it('strips "origin/" prefix before matching', () => {
    const color = branchColor(
      'origin/main',
      settings.terminalColors,
      settings.terminalColorsUnknown,
      0,
    );
    expect(color).toBe('bright_blue');
  });

  it('works with SVG colors', () => {
    const color = branchColor(
      'main',
      settings.svgColors,
      settings.svgColorsUnknown,
      0,
    );
    expect(color).toBe('blue');
  });
});

// ---------------------------------------------------------------------------
// assignChildren
// ---------------------------------------------------------------------------

describe('assignChildren', () => {
  function makeCommit(oid: string, parents: [string | null, string | null]): CommitInfo {
    return {
      oid,
      isMerge: parents[1] !== null,
      parents,
      children: [],
      branches: [],
      tags: [],
      branchTrace: null,
    };
  }

  it('populates children for a linear chain A -> B -> C', () => {
    const commits: CommitInfo[] = [
      makeCommit('aaa', [null, null]),       // root
      makeCommit('bbb', ['aaa', null]),      // child of aaa
      makeCommit('ccc', ['bbb', null]),      // child of bbb
    ];
    const indices = new Map<string, number>([
      ['aaa', 0],
      ['bbb', 1],
      ['ccc', 2],
    ]);

    assignChildren(commits, indices);

    expect(commits[0].children).toEqual(['bbb']);
    expect(commits[1].children).toEqual(['ccc']);
    expect(commits[2].children).toEqual([]);
  });

  it('handles merge commits (parent with multiple children)', () => {
    // A is root, B and C both have A as parent, D merges B and C
    const commits: CommitInfo[] = [
      makeCommit('aaa', [null, null]),
      makeCommit('bbb', ['aaa', null]),
      makeCommit('ccc', ['aaa', null]),
      makeCommit('ddd', ['bbb', 'ccc']),
    ];
    const indices = new Map<string, number>([
      ['aaa', 0],
      ['bbb', 1],
      ['ccc', 2],
      ['ddd', 3],
    ]);

    assignChildren(commits, indices);

    expect(commits[0].children).toContain('bbb');
    expect(commits[0].children).toContain('ccc');
    expect(commits[1].children).toEqual(['ddd']);
    expect(commits[2].children).toEqual(['ddd']);
    expect(commits[3].children).toEqual([]);
  });

  it('ignores parents not in the index', () => {
    const commits: CommitInfo[] = [
      makeCommit('bbb', ['missing', null]),
    ];
    const indices = new Map<string, number>([['bbb', 0]]);

    assignChildren(commits, indices);

    expect(commits[0].children).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// assignBranchColumns
// ---------------------------------------------------------------------------

describe('assignBranchColumns', () => {
  const settings = BranchSettings.from(BranchSettingsDef.gitFlow());

  function makeVis(orderGroup: number): BranchVis {
    return {
      orderGroup,
      targetOrderGroup: null,
      sourceOrderGroup: null,
      termColor: 0,
      svgColor: 'blue',
      column: null,
    };
  }

  function makeBranch(
    name: string,
    range: [number | null, number | null],
    vis: BranchVis,
  ): BranchInfo {
    return {
      target: 'oid',
      mergeTarget: null,
      sourceBranch: null,
      targetBranch: null,
      name,
      persistence: 0,
      isRemote: false,
      isMerged: false,
      isTag: false,
      visual: vis,
      range,
    };
  }

  it('assigns columns to non-overlapping branches in same group', () => {
    const branches: BranchInfo[] = [
      makeBranch('main', [0, 5], makeVis(0)),
      makeBranch('feature', [6, 10], makeVis(0)),
    ];
    const commits: CommitInfo[] = [];
    const indices = new Map<string, number>();

    assignBranchColumns(commits, indices, branches, settings, true, true);

    // Non-overlapping should share column 0
    expect(branches[0].visual.column).toBe(0);
    expect(branches[1].visual.column).toBe(0);
  });

  it('assigns different columns to overlapping branches in same group', () => {
    const branches: BranchInfo[] = [
      makeBranch('main', [0, 10], makeVis(0)),
      makeBranch('feature', [3, 8], makeVis(0)),
    ];
    const commits: CommitInfo[] = [];
    const indices = new Map<string, number>();

    assignBranchColumns(commits, indices, branches, settings, true, true);

    expect(branches[0].visual.column).not.toEqual(branches[1].visual.column);
  });

  it('assigns columns in different groups with offsets', () => {
    const branches: BranchInfo[] = [
      makeBranch('main', [0, 10], makeVis(0)),
      makeBranch('develop', [0, 10], makeVis(2)),
    ];
    const commits: CommitInfo[] = [];
    const indices = new Map<string, number>();

    assignBranchColumns(commits, indices, branches, settings, true, true);

    // Group 0 gets column 0, group 2 columns start after group 0+1 columns
    expect(branches[0].visual.column).toBe(0);
    // develop is in group 2, its absolute column should be >= 1
    expect(branches[1].visual.column!).toBeGreaterThanOrEqual(1);
  });

  it('skips branches with null range', () => {
    const branches: BranchInfo[] = [
      makeBranch('main', [0, 5], makeVis(0)),
      makeBranch('dead', [null, null], makeVis(0)),
    ];
    const commits: CommitInfo[] = [];
    const indices = new Map<string, number>();

    assignBranchColumns(commits, indices, branches, settings, true, true);

    expect(branches[0].visual.column).toBe(0);
    expect(branches[1].visual.column).toBeNull();
  });

  it('handles three overlapping branches correctly', () => {
    const branches: BranchInfo[] = [
      makeBranch('a', [0, 10], makeVis(0)),
      makeBranch('b', [2, 8], makeVis(0)),
      makeBranch('c', [4, 12], makeVis(0)),
    ];
    const commits: CommitInfo[] = [];
    const indices = new Map<string, number>();

    assignBranchColumns(commits, indices, branches, settings, true, true);

    const cols = branches.map(b => b.visual.column);
    // All should get distinct columns
    expect(new Set(cols).size).toBe(3);
  });
});
