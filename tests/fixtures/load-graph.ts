/**
 * Loads the Arbol graph fixture from JSON and reconstructs a GitGraph object.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GitGraph } from '../../src/graph';

let cached: GitGraph | null = null;

export function loadArbolGraph(): GitGraph {
  if (cached) return cached;

  const jsonPath = path.join(__dirname, 'arbol-graph.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  cached = {
    commits: data.commits,
    indices: new Map(data.indices),
    allBranches: data.allBranches,
    head: data.head,
  };

  return cached;
}
