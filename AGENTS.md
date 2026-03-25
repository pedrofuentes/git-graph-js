# AGENTS.md

## Project Overview

TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) (v0.7.0) by Martin Lange. Renders clear git commit graphs in the terminal or as SVG, arranged for your branching model.

## Development Methodology

**Always use Test-Driven Development (TDD).** Write tests first, then implement. No code changes without corresponding test coverage. Run `npm test` before and after every change.

## Tech Stack

- **Language:** TypeScript (strict mode), compiled to CommonJS
- **Runtime:** Node.js 18+
- **Git access:** isomorphic-git (pure JS, no native dependencies)
- **CLI:** commander.js
- **Colors:** chalk v4 (not v5+ which is ESM-only)
- **TOML:** smol-toml
- **Text wrapping:** wrap-ansi v7 (not v8+ which is ESM-only)
- **Testing:** vitest
- **Build:** tsup
- **Dev runner:** tsx

## Commands

- `npm test` — run all tests (vitest)
- `npm run build` — build to `dist/` (tsup)
- `npm run dev` — run CLI in dev mode (tsx)
- `npx tsc --noEmit` — type-check without emitting

## Project Structure

```
src/
  cli.ts              # CLI entry point (commander.js)
  config.ts           # TOML branching model config I/O
  graph.ts            # Core graph construction (isomorphic-git + raw data)
  index.ts            # Library entry point (re-exports)
  settings.ts         # All types: Settings, BranchSettings, Characters, etc.
  print/
    colors.ts         # ANSI 256-color palette mapping
    font-data.ts      # Embedded Kreative Square SM font (base64 WOFF2)
    format.ts         # Commit formatting with %placeholder system
    index.ts          # Print module entry (getDeviateIndex helper)
    svg.ts            # SVG graph renderer (vertical + horizontal)
    unicode.ts        # Unicode terminal graph renderer (Grid, vline, hline, zigzag)
scripts/
  subset-font.js      # Subset Kreative Square SM font for SVG embedding
fonts/
  KreativeSquareSM.ttf           # Full source font
  KreativeSquareSM-subset.woff2  # Subsetted WOFF2 for SVG embedding
samples/
  *.svg               # Sample SVG output (generated, not hand-edited)
tests/
  *.test.ts           # One test file per source module
  graph-from-data.test.ts  # Tests for createGitGraphFromData
  fixtures/
    arbol-graph.json  # Serialized GitGraph fixture for snapshot tests
    load-graph.ts     # Loader that reconstructs GitGraph from JSON
  __snapshots__/
    svg-*.svg         # SVG snapshot files for regression testing
```

## Architecture Notes

- **CommitInfo.data** stores full commit metadata (author, message, etc.) populated during graph construction — the renderer doesn't need repo access.
- **BranchInfo.visual.column** is assigned during graph construction. The renderers read it to position branches.
- **Settings types** live in `settings.ts`. `CommitFormat` is defined there and re-exported by `format.ts`.
- **TOML config** uses snake_case keys; TypeScript uses camelCase. `config.ts` has conversion helpers.
- **chalk v4 and wrap-ansi v7** are used because v5+/v8+ are ESM-only and this project is CommonJS.
- **Two graph construction entry points:**
  - `createGitGraph(dir, fs, settings)` — reads from a git repo via isomorphic-git
  - `createGitGraphFromData(input, settings)` — builds from raw data (`RawGraphInput`: commits, branches, tags, head). No git repo or filesystem needed. The renderers (`printUnicode`, `printSvg`) work identically on graphs from either function.
- **Input types for `createGitGraphFromData`:** `RawCommit`, `RawBranch`, `RawTag`, `RawGraphInput` — all defined in `graph.ts` and re-exported from `index.ts`.

## SVG Rendering Architecture

### Grid-Based Pipeline (used by both vertical and horizontal)

The SVG renderer is built on a **character grid** — a 2D matrix of box-drawing characters:

1. **`buildUnicodeGrid()`** (in `unicode.ts`) constructs the grid:
   - x-axis = branch columns (each branch at `col * 2`, with spacer columns between)
   - y-axis = commit rows (top = newest, bottom = oldest)
   - Each cell stores `{character, color, pers}` where `character` is an index into the character set (SPACE=0, DOT=1, VER=3 `│`, HOR=4 `─`, etc.)
   - Commits are placed as dots, vertical lines connect same-branch commits, zigzag lines connect cross-branch merges

2. **Vertical SVG** (`printSvgVertical`): renders the grid directly as `<text>` elements using Kreative Square SM font. Commit text is rendered alongside in a separate column using a standard monospace font.

3. **Horizontal SVG** (`printSvgHorizontal`): rotates the grid 90° then renders. No commit SHA or text — graph only.

### Horizontal Rotation

Horizontal SVG uses **matrix rotation** (not transposition) to convert the vertical grid:

- **Normal** (`rotateGridCW`): 90° clockwise rotation. Maps `(x,y) → (H-1-y, x)`. Time flows left(oldest) → right(newest).
- **Reversed** (`rotateGridCCW`): 90° CCW rotation. Maps `(x,y) → (y, W-1-x)`. Time flows left(newest) → right(oldest).

Both rotations remap box-drawing characters to preserve visual meaning after the axis swap:
- `VER ↔ HOR` (vertical line becomes horizontal)
- Corners rotate: `R_U(└) → R_D(┌) → L_D(┐) → L_U(┘)` (CW cycle)
- Junctions rotate similarly
- **CW and CCW use the same corner/junction mappings** (branches keep the same vertical order in both directions)
- **Arrows are swapped in CCW only** (`⌃ ↔ ⌄`) since merge direction reverses with time

### Kreative Square SM Font

SVG output embeds a subsetted **Kreative Square SM** font (SIL OFL licensed, 1:1 square monospace). This ensures box-drawing characters render as perfect square cells regardless of the viewer's installed fonts.

- **Source:** `fonts/KreativeSquareSM.ttf`
- **Subset script:** `scripts/subset-font.js` — run with `node scripts/subset-font.js` to regenerate
- **Embedded as:** base64 WOFF2 in `src/print/font-data.ts`
- **ALL SVG characters must be in the font subset.** Current coverage includes:
  - ASCII (U+0020–U+007E)
  - Box Drawing (U+2500–U+257F) — full block
  - Geometric Shapes (U+25A0–U+25FF) — includes `●` `○`
  - Misc Symbols (U+2600–U+26FF) — includes `⚫` `⚪` (SVG overrides for dots)
  - Misc Technical (U+2300–U+23FF) — includes `⌃` `⌄` (horizontal arrows)
  - Arrows, Math Operators, Latin-1, Modifier Letters, Block Elements, Dingbats, PUA

**When adding new characters to SVG output**, verify they exist in the font subset. If not, add the Unicode block to `scripts/subset-font.js` and re-run it, then update `src/print/font-data.ts` with the new base64.

### SVG Character Overrides

Two override maps control character substitution in SVG:

- **`SVG_CHAR_OVERRIDE`** — maps terminal characters to Kreative Square SM glyphs (e.g., `●` → `⚫`). Applied to both vertical and horizontal.
- **`SVG_HORIZONTAL_OVERRIDE`** — additional overrides for horizontal mode by character index (e.g., `ARR_L` → `⌃`, `ARR_R` → `⌄`). Rotates the arrow direction for the horizontal layout.

## Generating Samples

Generate sample SVGs in the `samples/` directory from the test fixture:

```bash
npx tsx scripts/generate-samples.ts
```

This generates 20 SVG files (5 styles × 4 variants: vertical, vertical-reverse, horizontal, horizontal-reverse).

## Regenerating the Test Fixture

The snapshot tests use a serialized GitGraph stored in `tests/fixtures/arbol-graph.json`. To regenerate from a git repository:

```typescript
// regen-fixture.ts
import { createGitGraph } from './src/graph';
import { Characters, BranchSettings, BranchSettingsDef, MergePatterns } from './src/settings';
import type { Settings } from './src/settings';
import * as fs from 'fs';

async function main() {
  const settings: Settings = {
    reverseCommitOrder: false, debug: false, compact: true, colored: true,
    includeRemote: true, format: { type: 'OneLine' }, wrapping: null,
    characters: Characters.thin(),
    branchOrder: { type: 'ShortestFirst', forward: true },
    branches: BranchSettings.from(BranchSettingsDef.gitFlow()),
    mergePatterns: MergePatterns.default(),
  };
  const graph = await createGitGraph('<path-to-repo>', fs, settings);
  const data = {
    commits: graph.commits,
    indices: [...graph.indices.entries()],
    allBranches: graph.allBranches,
    head: graph.head,
  };
  fs.writeFileSync('tests/fixtures/arbol-graph.json', JSON.stringify(data, null, 2));
}
main();
```

Run with `npx tsx regen-fixture.ts`, then delete `tests/__snapshots__/*.svg` and run `npm test` to regenerate snapshots. **Settings must match** `tests/svg-snapshot.test.ts` (`compact: true`, `includeRemote: true`). Remember to anonymize any sensitive data (commit messages, author info, branch names) in the fixture before committing.

## Conventions

- Module structure mirrors the original Rust codebase.
- Use `import type` for type-only imports.
- Only comment code that needs clarification — don't over-comment.
- Keep test files in `tests/` with the naming pattern `<module>.test.ts`.
- Run `npx tsc --noEmit` to verify types compile cleanly.
- Generate sample SVGs in `samples/` when making SVG-related changes.

## Origin

Ported from [git-bahn/git-graph](https://github.com/git-bahn/git-graph) v0.7.0 (Rust, MIT License by Martin Lange). The `baseline/v0.7.0` branch preserves the faithful port state for future sync with upstream versions.
