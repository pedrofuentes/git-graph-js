# git-graph-js

A TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) (v0.7.0) by Martin Lange.

Clear git graphs arranged for your branching model. Renders structured, readable commit graphs in the terminal or as SVG.

## Installation

```bash
npm install -g git-graph-js
```

Or run directly with npx:

```bash
npx git-graph-js
```

## Usage

Run inside any git repository:

```bash
git-graph-js
```

Or point to a repo:

```bash
git-graph-js --path /path/to/repo
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
| `--path <dir>` | Path to git repository (default: current directory) |
| `-n, --max-count <n>` | Maximum number of commits to show |
| `-f, --format <fmt>` | Commit format: `oneline`, `short`, `medium`, `full`, or custom `"<string>"` |
| `--color <mode>` | Color mode: `auto`, `always`, `never` |
| `--no-color` | Print without colors |
| `-s, --style <style>` | Graph style: `normal`, `round`, `bold`, `double`, `ascii` |
| `-r, --reverse` | Reverse the order of commits |
| `-l, --local` | Show only local branches (no remotes) |
| `--svg` | Render graph as SVG |
| `-S, --sparse` | Less compact graph layout |
| `-d, --debug` | Debug output with timing info |
| `-w, --wrap [args]` | Line wrapping: `<width>|auto|none [<indent1> [<indent2>]]` |

### Branching Models

Configure branch display order, colors, and persistence:

```bash
# List available models
git-graph-js model list

# Set a model for the current repo
git-graph-js model set <name>

# Show current model
git-graph-js model get
```

### Custom Format Strings

Use `%` placeholders in custom format strings:

```bash
git-graph-js -f "%h %s (%an)"
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

```typescript
import { createGitGraph } from 'git-graph-js';
import { printUnicode } from 'git-graph-js/print/unicode';

const graph = await createGitGraph('/path/to/repo', fs, settings);
const [graphLines, textLines] = printUnicode(graph, settings);
```

## Credits

This is a TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) (v0.7.0), originally written in Rust by [Martin Lange](https://github.com/git-bahn). The original project is licensed under the MIT License.

## License

[MIT](LICENSE) — see the license file for full details.
