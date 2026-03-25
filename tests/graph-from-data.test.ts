import { describe, it, expect } from 'vitest';
import {
  createGitGraphFromData,
  RawGraphInput,
  RawCommit,
  RawBranch,
  RawTag,
  GitGraph,
  CommitInfo,
  BranchInfo,
} from '../src/graph';
import {
  Settings,
  Characters,
  BranchSettings,
  BranchSettingsDef,
  BranchOrder,
  MergePatterns,
} from '../src/settings';
import { printUnicode } from '../src/print/unicode';
import { loadArbolGraph } from './fixtures/load-graph';

// ---------------------------------------------------------------------------
// Helper: default settings for tests
// ---------------------------------------------------------------------------

function defaultSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    reverseCommitOrder: false,
    debug: false,
    compact: true,
    colored: false,
    includeRemote: true,
    format: { type: 'OneLine' },
    wrapping: null,
    characters: Characters.thin(),
    branchOrder: { type: 'ShortestFirst', forward: true },
    branches: BranchSettings.from(BranchSettingsDef.gitFlow()),
    mergePatterns: MergePatterns.default(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: make a simple commit
// ---------------------------------------------------------------------------

function makeCommit(
  oid: string,
  parentOids: string[],
  message: string,
  timestamp: number = 1000,
): RawCommit {
  return {
    oid,
    parentOids,
    message,
    author: { name: 'Test', email: 'test@test.com', timestamp, timezoneOffset: 0 },
    committer: { name: 'Test', email: 'test@test.com', timestamp, timezoneOffset: 0 },
  };
}

// ---------------------------------------------------------------------------
// createGitGraphFromData
// ---------------------------------------------------------------------------

describe('createGitGraphFromData', () => {
  // -----------------------------------------------------------------------
  // Basic: linear history
  // -----------------------------------------------------------------------

  describe('linear history', () => {
    it('creates a graph from 3 linear commits', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Third commit', 3000),
          makeCommit('bbb', ['ccc'], 'Second commit', 2000),
          makeCommit('ccc', [], 'Initial commit', 1000),
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      expect(graph.commits.length).toBe(3);
      expect(graph.allBranches.length).toBeGreaterThanOrEqual(1);
      expect(graph.head.oid).toBe('aaa');
      expect(graph.head.name).toBe('main');

      // All commits should be on the same branch
      const traces = new Set(graph.commits.map(c => c.branchTrace));
      expect(traces.size).toBe(1);

      // Verify indices map
      for (let i = 0; i < graph.commits.length; i++) {
        expect(graph.indices.get(graph.commits[i].oid)).toBe(i);
      }
    });

    it('renders a linear history via printUnicode', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Third commit', 3000),
          makeCommit('bbb', ['ccc'], 'Second commit', 2000),
          makeCommit('ccc', [], 'Initial commit', 1000),
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());
      const [gLines, tLines] = printUnicode(graph, defaultSettings());

      expect(gLines.length).toBe(3);
      // Each line should have content (graph characters)
      for (const line of gLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Branching: merge commit
  // -----------------------------------------------------------------------

  describe('merge commits', () => {
    it('handles a feature branch merge', () => {
      const input: RawGraphInput = {
        head: { oid: 'merge', name: 'main', isBranch: true },
        commits: [
          makeCommit('merge', ['main2', 'feat2'], "Merge branch 'feature'", 5000),
          makeCommit('feat2', ['feat1'], 'More feature work', 4000),
          makeCommit('main2', ['base'], 'Main work', 3000),
          makeCommit('feat1', ['base'], 'Add feature', 2000),
          makeCommit('base', [], 'Initial commit', 1000),
        ],
        branches: [
          { name: 'main', oid: 'merge' },
          { name: 'feature', oid: 'feat2' },
        ],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      // Should have more than one branch
      expect(graph.allBranches.length).toBeGreaterThan(1);

      // The merge commit should be identified
      const mergeCommit = graph.commits.find(c => c.oid === 'merge');
      expect(mergeCommit).toBeDefined();
      expect(mergeCommit!.isMerge).toBe(true);
    });

    it('renders a merge graph via printUnicode', () => {
      const input: RawGraphInput = {
        head: { oid: 'merge', name: 'main', isBranch: true },
        commits: [
          makeCommit('merge', ['main2', 'feat2'], "Merge branch 'feature'", 5000),
          makeCommit('feat2', ['feat1'], 'More feature work', 4000),
          makeCommit('main2', ['base'], 'Main work', 3000),
          makeCommit('feat1', ['base'], 'Add feature', 2000),
          makeCommit('base', [], 'Initial commit', 1000),
        ],
        branches: [
          { name: 'main', oid: 'merge' },
          { name: 'feature', oid: 'feat2' },
        ],
      };

      const graph = createGitGraphFromData(input, defaultSettings());
      const [gLines, tLines] = printUnicode(graph, defaultSettings());

      // Should have at least 5 lines (one per commit, possibly more for merge connectors)
      expect(gLines.length).toBeGreaterThanOrEqual(5);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles a single commit', () => {
      const input: RawGraphInput = {
        head: { oid: 'only', name: 'main', isBranch: true },
        commits: [
          makeCommit('only', [], 'Initial commit', 1000),
        ],
        branches: [{ name: 'main', oid: 'only' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      expect(graph.commits.length).toBe(1);
      expect(graph.commits[0].oid).toBe('only');
      expect(graph.head.oid).toBe('only');
    });

    it('handles detached HEAD', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'HEAD', isBranch: false },
        commits: [
          makeCommit('aaa', ['bbb'], 'Second commit', 2000),
          makeCommit('bbb', [], 'Initial commit', 1000),
        ],
        branches: [{ name: 'main', oid: 'bbb' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      expect(graph.head.isBranch).toBe(false);
      expect(graph.head.name).toBe('HEAD');
    });

    it('handles tags', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Second commit', 2000),
          makeCommit('bbb', [], 'Initial commit', 1000),
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
        tags: [{ name: 'v1.0', oid: 'bbb' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      // The tag should be represented in allBranches
      const tagBranch = graph.allBranches.find(b => b.isTag);
      expect(tagBranch).toBeDefined();
      expect(tagBranch!.name).toBe('tags/v1.0');
    });

    it('handles remote branches', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Second commit', 2000),
          makeCommit('bbb', [], 'Initial commit', 1000),
        ],
        branches: [
          { name: 'main', oid: 'aaa' },
          { name: 'origin/main', oid: 'bbb', isRemote: true },
        ],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      const remoteBranch = graph.allBranches.find(b => b.isRemote);
      expect(remoteBranch).toBeDefined();
      expect(remoteBranch!.name).toBe('origin/main');
    });

    it('handles commits without author/committer metadata', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          { oid: 'aaa', parentOids: [], message: 'Minimal commit' },
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());
      expect(graph.commits.length).toBe(1);
      expect(graph.commits[0].data?.summary).toBe('Minimal commit');
    });
  });

  // -----------------------------------------------------------------------
  // Data integrity
  // -----------------------------------------------------------------------

  describe('data integrity', () => {
    it('populates CommitData correctly', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Hello world\n\nFull body here', 3000),
          makeCommit('bbb', [], 'Initial', 1000),
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());
      const first = graph.commits[0];

      expect(first.data).toBeDefined();
      expect(first.data!.oid).toBe('aaa');
      expect(first.data!.summary).toBe('Hello world');
      expect(first.data!.message).toBe('Hello world\n\nFull body here');
      expect(first.data!.author.name).toBe('Test');
      expect(first.data!.author.email).toBe('test@test.com');
    });

    it('assigns children correctly', () => {
      const input: RawGraphInput = {
        head: { oid: 'aaa', name: 'main', isBranch: true },
        commits: [
          makeCommit('aaa', ['bbb'], 'Third', 3000),
          makeCommit('bbb', ['ccc'], 'Second', 2000),
          makeCommit('ccc', [], 'First', 1000),
        ],
        branches: [{ name: 'main', oid: 'aaa' }],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      // Find commit 'bbb' in the output — should have 'aaa' as child
      const bbb = graph.commits.find(c => c.oid === 'bbb');
      expect(bbb).toBeDefined();
      expect(bbb!.children).toContain('aaa');
    });

    it('assigns branch columns', () => {
      const input: RawGraphInput = {
        head: { oid: 'merge', name: 'main', isBranch: true },
        commits: [
          makeCommit('merge', ['main2', 'feat1'], "Merge branch 'feature'", 4000),
          makeCommit('main2', ['base'], 'Main work', 3000),
          makeCommit('feat1', ['base'], 'Feature work', 2000),
          makeCommit('base', [], 'Initial', 1000),
        ],
        branches: [
          { name: 'main', oid: 'merge' },
          { name: 'feature', oid: 'feat1' },
        ],
      };

      const graph = createGitGraphFromData(input, defaultSettings());

      // All branches should have non-null columns
      for (const branch of graph.allBranches) {
        expect(branch.visual.column).not.toBeNull();
      }
    });
  });
});
