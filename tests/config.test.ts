import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BranchSettingsDef } from '../src/settings';
import {
  createConfig,
  getAvailableModels,
  getModelName,
  getModel,
  setModel,
  readModel,
} from '../src/config';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-test-'));
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('createConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('creates the models directory if it does not exist', () => {
    const modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);
    expect(fs.existsSync(modelsPath)).toBe(true);
    expect(fs.statSync(modelsPath).isDirectory()).toBe(true);
  });

  it('writes built-in model files', () => {
    const modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);

    expect(fs.existsSync(path.join(modelsPath, 'git-flow.toml'))).toBe(true);
    expect(fs.existsSync(path.join(modelsPath, 'simple.toml'))).toBe(true);
    expect(fs.existsSync(path.join(modelsPath, 'none.toml'))).toBe(true);
  });

  it('written model files are valid TOML that round-trips to BranchSettingsDef', () => {
    const modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);

    const gitFlowModel = readModel('git-flow', modelsPath);
    expect(gitFlowModel).toEqual(BranchSettingsDef.gitFlow());

    const simpleModel = readModel('simple', modelsPath);
    expect(simpleModel).toEqual(BranchSettingsDef.simple());

    const noneModel = readModel('none', modelsPath);
    expect(noneModel).toEqual(BranchSettingsDef.none());
  });

  it('does not throw if models directory already exists', () => {
    const modelsPath = path.join(tmpDir, 'models');
    fs.mkdirSync(modelsPath, { recursive: true });
    expect(() => createConfig(modelsPath)).not.toThrow();
  });
});

describe('getAvailableModels', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns names of all .toml files without extension', () => {
    const modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);

    const models = getAvailableModels(modelsPath);
    expect(models).toContain('git-flow');
    expect(models).toContain('simple');
    expect(models).toContain('none');
    expect(models).toHaveLength(3);
  });

  it('ignores non-toml files', () => {
    const modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);
    fs.writeFileSync(path.join(modelsPath, 'readme.txt'), 'not a model');

    const models = getAvailableModels(modelsPath);
    expect(models).not.toContain('readme');
    expect(models).toHaveLength(3);
  });

  it('returns empty array if directory does not exist', () => {
    const modelsPath = path.join(tmpDir, 'nonexistent');
    const models = getAvailableModels(modelsPath);
    expect(models).toEqual([]);
  });
});

describe('getModelName', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns model name from config file', () => {
    const repoPath = path.join(tmpDir, 'repo');
    const gitDir = path.join(repoPath, '.git');
    fs.mkdirSync(gitDir, { recursive: true });

    const configFile = 'git-graph.toml';
    fs.writeFileSync(
      path.join(gitDir, configFile),
      'model = "simple"\n'
    );

    const name = getModelName(repoPath, configFile);
    expect(name).toBe('simple');
  });

  it('returns null if config file does not exist', () => {
    const repoPath = path.join(tmpDir, 'repo');
    fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });

    const name = getModelName(repoPath, 'git-graph.toml');
    expect(name).toBeNull();
  });
});

describe('getModel', () => {
  let tmpDir: string;
  let modelsPath: string;
  let repoPath: string;
  const configFile = 'git-graph.toml';

  beforeEach(() => {
    tmpDir = makeTempDir();
    modelsPath = path.join(tmpDir, 'models');
    repoPath = path.join(tmpDir, 'repo');
    fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });
    createConfig(modelsPath);
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns the specified model when modelName is provided', () => {
    const model = getModel(repoPath, 'simple', configFile, modelsPath);
    expect(model).toEqual(BranchSettingsDef.simple());
  });

  it('reads model name from repo config if modelName is null', () => {
    fs.writeFileSync(
      path.join(repoPath, '.git', configFile),
      'model = "none"\n'
    );

    const model = getModel(repoPath, null, configFile, modelsPath);
    expect(model).toEqual(BranchSettingsDef.none());
  });

  it('falls back to git-flow when no config exists and modelName is null', () => {
    const model = getModel(repoPath, null, configFile, modelsPath);
    expect(model).toEqual(BranchSettingsDef.gitFlow());
  });
});

describe('setModel', () => {
  let tmpDir: string;
  let modelsPath: string;
  let repoPath: string;
  const configFile = 'git-graph.toml';

  beforeEach(() => {
    tmpDir = makeTempDir();
    modelsPath = path.join(tmpDir, 'models');
    repoPath = path.join(tmpDir, 'repo');
    fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });
    createConfig(modelsPath);
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('writes model name to repo config file', () => {
    setModel(repoPath, 'simple', configFile, modelsPath);

    const content = fs.readFileSync(
      path.join(repoPath, '.git', configFile),
      'utf-8'
    );
    expect(content).toContain('model');
    expect(content).toContain('simple');

    // Verify it can be read back
    const name = getModelName(repoPath, configFile);
    expect(name).toBe('simple');
  });

  it('throws if model does not exist', () => {
    expect(() =>
      setModel(repoPath, 'nonexistent', configFile, modelsPath)
    ).toThrow();
  });
});

describe('readModel', () => {
  let tmpDir: string;
  let modelsPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    modelsPath = path.join(tmpDir, 'models');
    createConfig(modelsPath);
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('reads and parses a model file correctly', () => {
    const model = readModel('git-flow', modelsPath);
    expect(model.persistence).toEqual(BranchSettingsDef.gitFlow().persistence);
    expect(model.order).toEqual(BranchSettingsDef.gitFlow().order);
    expect(model.terminalColors).toEqual(BranchSettingsDef.gitFlow().terminalColors);
    expect(model.svgColors).toEqual(BranchSettingsDef.gitFlow().svgColors);
  });

  it('throws for nonexistent model', () => {
    expect(() => readModel('does-not-exist', modelsPath)).toThrow();
  });

  it('correctly handles the none model with empty arrays', () => {
    const model = readModel('none', modelsPath);
    expect(model.persistence).toEqual([]);
    expect(model.order).toEqual([]);
    expect(model.terminalColors.matches).toEqual([]);
    expect(model.svgColors.matches).toEqual([]);
  });
});
