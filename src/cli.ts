#!/usr/bin/env node
/**
 * Command line tool to show clear git graphs arranged for your branching model.
 * Port of main.rs
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Characters, BranchSettings, BranchSettingsDef, BranchOrder, MergePatterns, Settings, CommitFormat } from './settings';
import { createConfig, getAvailableModels, getModel, getModelName, setModel } from './config';
import { commitFormatFromStr } from './print/format';

const REPO_CONFIG_FILE = 'git-graph.toml';

// --- Exported helpers for testing ---

export function parseWrapArgs(
  args: string[]
): [number | null, number | null, number | null] | null {
  if (args.length === 0) {
    return [null, 0, 8];
  }

  if (args[0] === 'none') {
    return null;
  }

  if (args[0] === 'auto') {
    const rest = args.slice(1).map((s) => {
      const n = parseInt(s, 10);
      if (isNaN(n)) {
        throw new Error(
          `ERROR: Can't parse option --wrap '${args.join(' ')}' to integers.`
        );
      }
      return n;
    });
    return [null, rest[0] ?? null, rest[1] ?? null];
  }

  const nums = args.map((s) => {
    const n = parseInt(s, 10);
    if (isNaN(n)) {
      throw new Error(
        `ERROR: Can't parse option --wrap '${args.join(' ')}' to integers.`
      );
    }
    return n;
  });

  return [nums[0] ?? null, nums[1] ?? null, nums[2] ?? null];
}

export function parseColorArgs(
  colorMode: string | boolean | undefined,
  noColor: boolean
): boolean {
  if (noColor) return false;
  if (colorMode === false) return false;

  if (colorMode === undefined || colorMode === true) {
    return process.stdout.isTTY === true;
  }

  switch (colorMode) {
    case 'auto':
      return process.stdout.isTTY === true;
    case 'always':
      return true;
    case 'never':
      return false;
    default:
      throw new Error(
        `Unknown color mode '${colorMode}'. Supports [auto|always|never].`
      );
  }
}

export function parseMaxCount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  if (isNaN(n)) {
    throw new Error(
      `Option max-count must be a positive number, but got '${value}'`
    );
  }
  return n;
}

// --- App config path ---

function getModelsDir(): string {
  // Use env-paths pattern but simpler
  const home = process.env.HOME || process.env.USERPROFILE || '';
  let configDir: string;

  if (process.platform === 'win32') {
    configDir = path.join(
      process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
      'git-graph'
    );
  } else if (process.platform === 'darwin') {
    configDir = path.join(home, 'Library', 'Application Support', 'git-graph');
  } else {
    configDir = path.join(
      process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
      'git-graph'
    );
  }

  return path.join(configDir, 'models');
}

// --- Find git repo ---

function findGitDir(startPath: string): string {
  let current = path.resolve(startPath);
  while (true) {
    const gitDir = path.join(current, '.git');
    if (fs.existsSync(gitDir)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        'ERROR: Not a git repository (or any of the parent directories).\n' +
          '       Navigate into a repository before running git-graph, or use option --path'
      );
    }
    current = parent;
  }
}

// --- Main CLI ---

async function main() {
  const program = new Command();

  program
    .name('git-network-graph')
    .description(
      'Structured Git graphs for your branching model.\n' +
        '    https://github.com/git-bahn/git-graph\n\n' +
        'EXAMPLES:\n' +
        '    git-network-graph                   -> Show graph\n' +
        '    git-network-graph --style round     -> Show graph in a different style\n' +
        '    git-network-graph --model <model>   -> Show graph using a certain <model>\n' +
        '    git-network-graph model --list      -> List available branching models\n' +
        '    git-network-graph model             -> Show repo\'s current branching models\n' +
        '    git-network-graph model <model>     -> Permanently set model <model> for this repo'
    )
    .option('-p, --path <path>', 'Open repository from this path or above. Default "."')
    .option('-m, --model <model>', 'Branching model. Available presets are [simple|git-flow|none].')
    .option('-n, --max-count <n>', 'Maximum number of commits')
    .option(
      '-s, --style <style>',
      'Output style. One of [normal/thin|round|bold|double|ascii].'
    )
    .option(
      '-f, --format <format>',
      'Commit format. One of [oneline|short|medium|full|"<string>"].'
    )
    .option('--color <mode>', 'Specify when colors should be used. [auto|always|never]')
    .option('--no-color', 'Print without colors.')
    .option('-w, --wrap [args...]', 'Line wrapping. [<width>|auto|none[ <indent1>[ <indent2>]]]')
    .option('-r, --reverse', 'Reverse the order of commits.')
    .option('-l, --local', 'Show only local branches, no remotes.')
    .option('--svg', 'Render graph as SVG instead of text-based.')
    .option('--svg-file [path]', 'Write SVG to a file. Default: git-graph.svg in repo dir.')
    .option('--horizontal', 'Render SVG horizontally (left-to-right). Only with --svg/--svg-file.')
    .option('--merges-only', 'Only show dots on merge commits.')
    .option('-S, --sparse', 'Print a less compact graph.')
    .option('-d, --debug', 'Additional debug output and graphics.')
    .option(
      '--skip-repo-owner-validation',
      'Skip owner validation for the repository.'
    );

  // Model subcommand
  program
    .command('model [model]')
    .description('Prints or permanently sets the branching model for a repository.')
    .option('-l, --list', 'List all available branching models.')
    .action(async (modelName: string | undefined, options: { list?: boolean }) => {
      const modelsDir = getModelsDir();
      createConfig(modelsDir);

      if (options.list) {
        const models = getAvailableModels(modelsDir);
        console.log(models.join('\n'));
        return;
      }

      const repoPath = program.opts().path || '.';
      const gitDir = findGitDir(repoPath);
      const gitInternalDir = path.join(gitDir, '.git');

      if (modelName) {
        setModel(gitInternalDir, modelName, REPO_CONFIG_FILE, modelsDir);
        process.stderr.write(`Branching model set to '${modelName}'`);
      } else {
        const current = getModelName(gitInternalDir, REPO_CONFIG_FILE);
        if (current === null) {
          process.stdout.write('No branching model set');
        } else {
          process.stdout.write(current);
        }
      }
    });

  program.action(async (options: Record<string, any>) => {
    const modelsDir = getModelsDir();
    createConfig(modelsDir);

    const repoPath = options.path || '.';
    const gitDir = findGitDir(repoPath);
    const gitInternalDir = path.join(gitDir, '.git');

    // Parse all options
    const includeRemote = !options.local;
    const reverseCommitOrder = !!options.reverse;
    const svg = !!options.svg;
    const horizontal = !!options.horizontal;
    const compact = !options.sparse;
    const debug = !!options.debug;
    const maxCount = parseMaxCount(options.maxCount);

    let style = options.style
      ? Characters.fromStr(options.style)
      : Characters.thin();

    if (reverseCommitOrder) {
      style = style.reverse();
    }

    const modelDef = getModel(
      gitInternalDir,
      options.model || null,
      REPO_CONFIG_FILE,
      modelsDir
    );

    const commitFormat = options.format
      ? commitFormatFromStr(options.format)
      : ({ type: 'OneLine' } as CommitFormat);

    const colored = parseColorArgs(options.color, options.noColor === true);

    const wrapArgs: string[] = options.wrap || [];
    const wrapping = Array.isArray(wrapArgs) && wrapArgs.length === 0
      ? [null, 0, 8] as [number | null, number | null, number | null]
      : (typeof options.wrap === 'boolean'
        ? [null, 0, 8] as [number | null, number | null, number | null]
        : parseWrapArgs(wrapArgs));

    const settings: Settings = {
      reverseCommitOrder,
      debug,
      colored,
      compact,
      includeRemote,
      format: commitFormat,
      wrapping,
      characters: style,
      branchOrder: { type: 'ShortestFirst', forward: true },
      branches: BranchSettings.from(modelDef),
      mergePatterns: MergePatterns.default(),
      mergesOnly: !!options.mergesOnly,
    };

    const svgFile = options.svgFile !== undefined
      ? (typeof options.svgFile === 'string'
        ? options.svgFile
        : path.resolve(gitDir, 'git-graph.svg'))
      : null;

    await run(gitDir, settings, svg, svgFile, horizontal, maxCount);
  });

  await program.parseAsync(process.argv);
}

async function run(
  gitDir: string,
  settings: Settings,
  svg: boolean,
  svgFile: string | null,
  horizontal: boolean,
  maxCount: number | undefined
): Promise<void> {
  // Dynamic import to avoid circular deps and allow tree-shaking
  const { createGitGraph } = await import('./graph');
  const nodeFs = await import('node:fs');

  const now = performance.now();
  const graph = await createGitGraph(
    gitDir,
    nodeFs,
    settings,
    undefined,
    maxCount
  );
  const durationGraph = performance.now() - now;

  if (settings.debug) {
    for (const branch of graph.allBranches) {
      process.stderr.write(
        `${branch.name} (col ${branch.visual.column ?? 99}) (${JSON.stringify(branch.range)}) ${branch.isMerged ? 'm' : ''} s: ${branch.visual.sourceOrderGroup}, t: ${branch.visual.targetOrderGroup}\n`
      );
    }
  }

  const now2 = performance.now();

  if (svg || svgFile) {
    const { printSvg } = await import('./print/svg');
    const svgContent = printSvg(graph, settings, horizontal);

    if (svg) {
      console.log(svgContent);
    }

    if (svgFile) {
      nodeFs.writeFileSync(svgFile, svgContent, 'utf-8');
      process.stderr.write(`SVG written to ${svgFile}\n`);
    }
  } else {
    const { printUnicode } = await import('./print/unicode');
    const [gLines, tLines] = printUnicode(graph, settings);
    for (let i = 0; i < gLines.length; i++) {
      console.log(` ${gLines[i]}  ${tLines[i]}`);
    }
  }

  const durationPrint = performance.now() - now2;

  if (settings.debug) {
    process.stderr.write(
      `Graph construction: ${(durationGraph).toFixed(1)} ms, printing: ${(durationPrint).toFixed(1)} ms (${graph.commits.length} commits)\n`
    );
  }
}

// Run if this is the entry point
if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err.message || err}\n`);
    process.exit(1);
  });
}
