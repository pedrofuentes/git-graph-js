# git-network-graph

A TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) (v0.7.0) by Martin Lange.

Clear git graphs arranged for your branching model. Renders structured, readable commit graphs in the terminal or as SVG.

## Installation

```bash
npm install -g git-network-graph
```

Or run directly with npx:

```bash
npx git-network-graph
```

## Usage

Run inside any git repository:

```bash
git-network-graph
```

Or point to a repo:

```bash
git-network-graph --path /path/to/repo
```

### Example output

```
 ●       4a6fe1b (HEAD -> main) [v1.0] After merge
 ○<┐     a8da1d8 Merge branch 'feature'
 │ ●     6874821 (feature) More feature work
 │ ●     a92071e Add feature
 ● │     18281f7 Main work
 ├─┘
 ●       f41a216 Second commit
 ●       4d6cd76 Initial commit
```

## CLI Options

| Option | Description |
|--------|-------------|
| `-p, --path <dir>` | Path to git repository (default: current directory) |
| `-m, --model <model>` | Branching model: `simple`, `git-flow`, `none`, or a custom model name |
| `-n, --max-count <n>` | Maximum number of commits to show |
| `-f, --format <fmt>` | Commit format: `oneline`, `short`, `medium`, `full`, or custom `"<string>"` |
| `--color <mode>` | Color mode: `auto`, `always`, `never` |
| `--no-color` | Print without colors |
| `-s, --style <style>` | Graph style: `normal`, `round`, `bold`, `double`, `ascii` |
| `-r, --reverse` | Reverse the order of commits |
| `-l, --local` | Show only local branches (no remotes) |
| `--svg` | Render graph as SVG (stdout) |
| `--svg-file [path]` | Write SVG to a file (default: `git-graph.svg` in repo dir) |
| `--horizontal` | Render SVG horizontally (left-to-right). Use with `--svg`/`--svg-file` |
| `--merges-only` | Only show dots on merge commits (○), hide dots on regular commits |
| `-S, --sparse` | Less compact graph layout |
| `-d, --debug` | Debug output with timing info |
| `-w, --wrap [args]` | Line wrapping: `<width>|auto|none [<indent1> [<indent2>]]` |

### Branching Models

Configure branch display order, colors, and persistence:

```bash
# List available models
git-network-graph model --list

# Set a model for the current repo
git-network-graph model <name>

# Show current model
git-network-graph model
```

### Custom Format Strings

Use `%` placeholders in custom format strings:

```bash
git-network-graph -f "%h %s (%an)"
```

| Placeholder | Description |
|-------------|-------------|
| `%H` | Full commit hash |
| `%h` | Abbreviated commit hash |
| `%s` | Subject (first line of message) |
| `%b` | Body (rest of message) |
| `%an` | Author name |
| `%ae` | Author email |
| `%ad` | Author date |
| `%cn` | Committer name |
| `%ce` | Committer email |
| `%cd` | Committer date |
| `%p` | Parent hashes |
| `%n` | Newline |

## Library Usage

Use git-network-graph as a library to render graphs programmatically:

```bash
npm install git-network-graph
```

### From a git repository

```typescript
import * as fs from 'fs';
import { createGitGraph, printUnicode, Characters, BranchSettings, BranchSettingsDef, MergePatterns } from 'git-network-graph';
import type { Settings } from 'git-network-graph';

const settings: Settings = {
  reverseCommitOrder: false,
  debug: false,
  compact: true,
  colored: true,
  includeRemote: true,
  format: { type: 'OneLine' },
  wrapping: null,
  characters: Characters.thin(),
  branchOrder: { type: 'ShortestFirst', forward: true },
  branches: BranchSettings.from(BranchSettingsDef.gitFlow()),
  mergePatterns: MergePatterns.default(),
};

const graph = await createGitGraph('/path/to/repo', fs, settings);
const [graphLines, textLines] = printUnicode(graph, settings);
graphLines.forEach((g, i) => console.log(` ${g}  ${textLines[i]}`));
```

### From raw data (no git repo needed)

You can also build graphs from raw commit data — useful for APIs, databases, or custom data sources:

```typescript
import { createGitGraphFromData, printUnicode, printSvg, Characters, BranchSettings, BranchSettingsDef, MergePatterns } from 'git-network-graph';
import type { RawGraphInput, Settings } from 'git-network-graph';

const settings: Settings = {
  reverseCommitOrder: false,
  debug: false,
  compact: true,
  colored: true,
  includeRemote: false,
  format: { type: 'OneLine' },
  wrapping: null,
  characters: Characters.thin(),
  branchOrder: { type: 'ShortestFirst', forward: true },
  branches: BranchSettings.from(BranchSettingsDef.gitFlow()),
  mergePatterns: MergePatterns.default(),
};

const input: RawGraphInput = {
  head: { oid: 'abc123', name: 'main', isBranch: true },
  commits: [
    {
      oid: 'abc123',
      parentOids: ['def456'],
      message: 'Latest commit',
      author: { name: 'Alice', email: 'alice@example.com', timestamp: 1700000000, timezoneOffset: 0 },
      committer: { name: 'Alice', email: 'alice@example.com', timestamp: 1700000000, timezoneOffset: 0 },
    },
    {
      oid: 'def456',
      parentOids: [],
      message: 'Initial commit',
      author: { name: 'Alice', email: 'alice@example.com', timestamp: 1699999000, timezoneOffset: 0 },
      committer: { name: 'Alice', email: 'alice@example.com', timestamp: 1699999000, timezoneOffset: 0 },
    },
  ],
  branches: [{ name: 'main', oid: 'abc123' }],
  tags: [{ name: 'v1.0', oid: 'def456' }],
};

// Render as terminal text
const graph = createGitGraphFromData(input, settings);
const [graphLines, textLines] = printUnicode(graph, settings);

// Or render as SVG
const svgContent = printSvg(graph, settings, false); // false = vertical, true = horizontal
```

Commits should be in newest-first order (by committer timestamp). The `author` and `committer` fields are optional but recommended for full formatting support.

## Credits

This is a TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) (v0.7.0), originally written in Rust by [Martin Lange](https://github.com/git-bahn). The original project is licensed under the MIT License.

## License

[MIT](LICENSE) — see the license file for full details.
