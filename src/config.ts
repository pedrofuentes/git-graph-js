import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'smol-toml';
import type { BranchSettingsDef, ColorsDef, RepoSettings } from './settings';
import { BranchSettingsDef as BranchSettingsDefFactory } from './settings';

// ---- TOML snake_case <-> JS camelCase helpers ----

interface ColorsDefToml {
  matches: [string, string[]][];
  unknown: string[];
}

interface BranchSettingsDefToml {
  persistence: string[];
  order: string[];
  terminal_colors: ColorsDefToml;
  svg_colors: ColorsDefToml;
}

function branchSettingsDefToToml(def: BranchSettingsDef): BranchSettingsDefToml {
  return {
    persistence: def.persistence,
    order: def.order,
    terminal_colors: def.terminalColors,
    svg_colors: def.svgColors,
  };
}

function branchSettingsDefFromToml(raw: BranchSettingsDefToml): BranchSettingsDef {
  return {
    persistence: raw.persistence,
    order: raw.order,
    terminalColors: raw.terminal_colors,
    svgColors: raw.svg_colors,
  };
}

// ---- Serialization ----

function serializeModel(def: BranchSettingsDef): string {
  return toml.stringify(branchSettingsDefToToml(def));
}

function deserializeModel(content: string): BranchSettingsDef {
  const raw = toml.parse(content) as unknown as BranchSettingsDefToml;
  return branchSettingsDefFromToml(raw);
}

function serializeRepoSettings(settings: RepoSettings): string {
  return toml.stringify(settings);
}

function deserializeRepoSettings(content: string): RepoSettings {
  return toml.parse(content) as unknown as RepoSettings;
}

// ---- Built-in models ----

const BUILT_IN_MODELS: Record<string, () => BranchSettingsDef> = {
  'git-flow': BranchSettingsDefFactory.gitFlow,
  'simple': BranchSettingsDefFactory.simple,
  'none': BranchSettingsDefFactory.none,
};

// ---- Public API ----

/**
 * Creates the models directory if needed and writes built-in model files.
 */
export function createConfig(appModelPath: string): void {
  fs.mkdirSync(appModelPath, { recursive: true });

  for (const [name, factory] of Object.entries(BUILT_IN_MODELS)) {
    const filePath = path.join(appModelPath, `${name}.toml`);
    fs.writeFileSync(filePath, serializeModel(factory()), 'utf-8');
  }
}

/**
 * Lists all available model names (`.toml` files without extension).
 */
export function getAvailableModels(appModelPath: string): string[] {
  if (!fs.existsSync(appModelPath)) {
    return [];
  }

  return fs
    .readdirSync(appModelPath)
    .filter((f) => f.endsWith('.toml'))
    .map((f) => f.replace(/\.toml$/, ''));
}

/**
 * Reads the model name from a repo's config file.
 * Returns null if the file doesn't exist.
 */
export function getModelName(repoPath: string, fileName: string): string | null {
  const configPath = path.join(repoPath, '.git', fileName);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const settings = deserializeRepoSettings(content);
  return settings.model;
}

/**
 * Gets the BranchSettingsDef for a model.
 * If modelName is given, reads that model.
 * If null, reads the repo's config. Falls back to git-flow.
 */
export function getModel(
  repoPath: string,
  modelName: string | null,
  repoConfigFile: string,
  appModelPath: string
): BranchSettingsDef {
  const name = modelName ?? getModelName(repoPath, repoConfigFile) ?? 'git-flow';
  return readModel(name, appModelPath);
}

/**
 * Writes the model name to the repo's config file.
 * Validates the model exists first.
 */
export function setModel(
  repoPath: string,
  modelName: string,
  repoConfigFile: string,
  appModelPath: string
): void {
  const available = getAvailableModels(appModelPath);
  if (!available.includes(modelName)) {
    throw new Error(
      `Model '${modelName}' not found. Available models: ${available.join(', ')}`
    );
  }

  const configPath = path.join(repoPath, '.git', repoConfigFile);
  const settings: RepoSettings = { model: modelName };
  fs.writeFileSync(configPath, serializeRepoSettings(settings), 'utf-8');
}

/**
 * Reads and parses a model TOML file. Errors if not found.
 */
export function readModel(modelName: string, appModelPath: string): BranchSettingsDef {
  const filePath = path.join(appModelPath, `${modelName}.toml`);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Model file not found: ${filePath}`
    );
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return deserializeModel(content);
}
