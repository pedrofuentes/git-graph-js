import { describe, it, expect } from 'vitest';
import { getDeviateIndex } from '../src/print/index';

describe('getDeviateIndex', () => {
  it('returns par_index - 1 for non-merge commits', () => {
    // Non-merge commit at index 2 with parent at index 5
    // Same column, no siblings
    const graph = {
      commits: [
        { oid: 'a', isMerge: false, parents: [null, null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'b', isMerge: false, parents: [null, null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'c', isMerge: false, parents: ['e', null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'd', isMerge: false, parents: [null, null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'e', isMerge: false, parents: [null, null] as [string | null, string | null], children: ['c'], branches: [], tags: [], branchTrace: 1 },
      ],
      indices: new Map([['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]]),
      allBranches: [
        { visual: { column: 0 } },
        { visual: { column: 1 } },
      ],
    } as any;

    // For non-merge: returns par_index - 1
    const result = getDeviateIndex(graph, 2, 4);
    expect(result).toBe(3); // 4 - 1 = 3
  });

  it('returns max(index, min_split_idx) for merge commits', () => {
    // Merge commit at index 1, parent at index 4
    // Parent has sibling at index 3 on same column
    const graph = {
      commits: [
        { oid: 'a', isMerge: false, parents: [null, null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'b', isMerge: true, parents: ['a', 'e'] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'c', isMerge: false, parents: [null, null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'd', isMerge: false, parents: ['e', null] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 1 },
        { oid: 'e', isMerge: false, parents: [null, null] as [string | null, string | null], children: ['b', 'd'], branches: [], tags: [], branchTrace: 1 },
      ],
      indices: new Map([['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]]),
      allBranches: [
        { visual: { column: 0 } },
        { visual: { column: 1 } },
      ],
    } as any;

    // For merge: returns max(index, min_split_idx)
    // Sibling 'd' at index 3 is on same column as parent's branch (column 1)
    // So min_split_idx = 3, max(1, 3) = 3
    const result = getDeviateIndex(graph, 1, 4);
    expect(result).toBe(3);
  });

  it('returns index when no siblings push it further', () => {
    const graph = {
      commits: [
        { oid: 'a', isMerge: true, parents: ['c', 'b'] as [string | null, string | null], children: [], branches: [], tags: [], branchTrace: 0 },
        { oid: 'b', isMerge: false, parents: [null, null] as [string | null, string | null], children: ['a'], branches: [], tags: [], branchTrace: 1 },
      ],
      indices: new Map([['a', 0], ['b', 1]]),
      allBranches: [
        { visual: { column: 0 } },
        { visual: { column: 1 } },
      ],
    } as any;

    // Merge at index 0, parent at index 1
    // No siblings on same column -> min_split_idx stays at 0
    // max(0, 0) = 0
    const result = getDeviateIndex(graph, 0, 1);
    expect(result).toBe(0);
  });
});
