import { describe, it, expect } from 'vitest';
import {
  CommitFormat,
  Characters,
  BranchSettingsDef,
  BranchSettings,
  MergePatterns,
  BranchOrder,
  RepoSettings,
  ColorsDef,
  Settings,
} from '../src/settings';

describe('CommitFormat', () => {
  it('parses "oneline" and "o" to OneLine', () => {
    expect(CommitFormat.fromStr('oneline')).toEqual({ type: 'OneLine' });
    expect(CommitFormat.fromStr('o')).toEqual({ type: 'OneLine' });
  });

  it('parses "short" and "s" to Short', () => {
    expect(CommitFormat.fromStr('short')).toEqual({ type: 'Short' });
    expect(CommitFormat.fromStr('s')).toEqual({ type: 'Short' });
  });

  it('parses "medium" and "m" to Medium', () => {
    expect(CommitFormat.fromStr('medium')).toEqual({ type: 'Medium' });
    expect(CommitFormat.fromStr('m')).toEqual({ type: 'Medium' });
  });

  it('parses "full" and "f" to Full', () => {
    expect(CommitFormat.fromStr('full')).toEqual({ type: 'Full' });
    expect(CommitFormat.fromStr('f')).toEqual({ type: 'Full' });
  });

  it('parses unknown strings as Format with that string', () => {
    expect(CommitFormat.fromStr('%H %s')).toEqual({ type: 'Format', value: '%H %s' });
    expect(CommitFormat.fromStr('custom')).toEqual({ type: 'Format', value: 'custom' });
  });
});

describe('Characters', () => {
  describe('factory methods', () => {
    it('thin() returns 16 characters', () => {
      const chars = Characters.thin();
      expect(chars.chars).toHaveLength(16);
      expect(chars.chars.join('')).toBe(' ●○│─┼└┌┐┘┤├┴┬<>');
    });

    it('round() returns 16 characters', () => {
      const chars = Characters.round();
      expect(chars.chars).toHaveLength(16);
      expect(chars.chars.join('')).toBe(' ●○│─┼╰╭╮╯┤├┴┬<>');
    });

    it('bold() returns 16 characters', () => {
      const chars = Characters.bold();
      expect(chars.chars).toHaveLength(16);
      expect(chars.chars.join('')).toBe(' ●○┃━╋┗┏┓┛┫┣┻┳<>');
    });

    it('double() returns 16 characters', () => {
      const chars = Characters.double();
      expect(chars.chars).toHaveLength(16);
      expect(chars.chars.join('')).toBe(' ●○║═╬╚╔╗╝╣╠╩╦<>');
    });

    it('ascii() returns 16 characters', () => {
      const chars = Characters.ascii();
      expect(chars.chars).toHaveLength(16);
      expect(chars.chars.join('')).toBe(" *o|-+'..'||++<>");
    });
  });

  describe('fromStr', () => {
    it.each([
      ['normal', 'thin'],
      ['thin', 'thin'],
      ['n', 'thin'],
      ['t', 'thin'],
    ])('parses "%s" as thin', (input, _) => {
      const result = Characters.fromStr(input);
      expect(result.chars).toEqual(Characters.thin().chars);
    });

    it.each([['round'], ['r']])('parses "%s" as round', (input) => {
      expect(Characters.fromStr(input).chars).toEqual(Characters.round().chars);
    });

    it.each([['bold'], ['b']])('parses "%s" as bold', (input) => {
      expect(Characters.fromStr(input).chars).toEqual(Characters.bold().chars);
    });

    it.each([['double'], ['d']])('parses "%s" as double', (input) => {
      expect(Characters.fromStr(input).chars).toEqual(Characters.double().chars);
    });

    it.each([['ascii'], ['a']])('parses "%s" as ascii', (input) => {
      expect(Characters.fromStr(input).chars).toEqual(Characters.ascii().chars);
    });

    it('throws for unknown style', () => {
      expect(() => Characters.fromStr('invalid')).toThrow(
        "Unknown characters/style 'invalid'. Must be one of [normal|thin|round|bold|double|ascii]"
      );
    });
  });

  describe('reverse', () => {
    it('swaps correct index pairs', () => {
      const thin = Characters.thin();
      const reversed = thin.reverse();

      // Indices 6,8 swapped (R_U <-> L_D): └┐ -> ┐└
      expect(reversed.chars[6]).toBe(thin.chars[8]);
      expect(reversed.chars[8]).toBe(thin.chars[6]);

      // Indices 7,9 swapped (R_D <-> L_U): ┌┘ -> ┘┌
      expect(reversed.chars[7]).toBe(thin.chars[9]);
      expect(reversed.chars[9]).toBe(thin.chars[7]);

      // Indices 10,11 swapped (VER_L <-> VER_R): ┤├ -> ├┤
      expect(reversed.chars[10]).toBe(thin.chars[11]);
      expect(reversed.chars[11]).toBe(thin.chars[10]);

      // Indices 12,13 swapped (HOR_U <-> HOR_D): ┴┬ -> ┬┴
      expect(reversed.chars[12]).toBe(thin.chars[13]);
      expect(reversed.chars[13]).toBe(thin.chars[12]);

      // Indices 14,15 swapped (ARR_L <-> ARR_R): <> -> ><
      expect(reversed.chars[14]).toBe(thin.chars[15]);
      expect(reversed.chars[15]).toBe(thin.chars[14]);

      // Non-swapped indices remain unchanged
      for (const i of [0, 1, 2, 3, 4, 5]) {
        expect(reversed.chars[i]).toBe(thin.chars[i]);
      }
    });

    it('does not mutate original', () => {
      const thin = Characters.thin();
      const originalChars = [...thin.chars];
      thin.reverse();
      expect(thin.chars).toEqual(originalChars);
    });
  });
});

describe('BranchSettingsDef', () => {
  describe('gitFlow', () => {
    it('has correct persistence patterns', () => {
      const def = BranchSettingsDef.gitFlow();
      expect(def.persistence).toEqual([
        '^(master|main|trunk)$',
        '^(develop|dev)$',
        '^feature.*$',
        '^release.*$',
        '^hotfix.*$',
        '^bugfix.*$',
      ]);
    });

    it('has correct order patterns', () => {
      const def = BranchSettingsDef.gitFlow();
      expect(def.order).toEqual([
        '^(master|main|trunk)$',
        '^(hotfix|release).*$',
        '^(develop|dev)$',
      ]);
    });

    it('has correct terminal colors', () => {
      const def = BranchSettingsDef.gitFlow();
      expect(def.terminalColors.matches).toEqual([
        ['^(master|main|trunk)$', ['bright_blue']],
        ['^(develop|dev)$', ['bright_yellow']],
        ['^(feature|fork/).*$', ['bright_magenta', 'bright_cyan']],
        ['^release.*$', ['bright_green']],
        ['^(bugfix|hotfix).*$', ['bright_red']],
        ['^tags/.*$', ['bright_green']],
      ]);
      expect(def.terminalColors.unknown).toEqual(['white']);
    });

    it('has correct svg colors', () => {
      const def = BranchSettingsDef.gitFlow();
      expect(def.svgColors.matches).toEqual([
        ['^(master|main|trunk)$', ['blue']],
        ['^(develop|dev)$', ['orange']],
        ['^(feature|fork/).*$', ['purple', 'turquoise']],
        ['^release.*$', ['green']],
        ['^(bugfix|hotfix).*$', ['red']],
        ['^tags/.*$', ['green']],
      ]);
      expect(def.svgColors.unknown).toEqual(['gray']);
    });
  });

  describe('simple', () => {
    it('has correct persistence patterns', () => {
      const def = BranchSettingsDef.simple();
      expect(def.persistence).toEqual(['^(master|main|trunk)$']);
    });

    it('has correct order patterns', () => {
      const def = BranchSettingsDef.simple();
      expect(def.order).toEqual(['^tags/.*$', '^(master|main|trunk)$']);
    });

    it('has correct terminal unknown colors', () => {
      const def = BranchSettingsDef.simple();
      expect(def.terminalColors.unknown).toEqual([
        'bright_yellow',
        'bright_green',
        'bright_red',
        'bright_magenta',
        'bright_cyan',
      ]);
    });

    it('has correct svg unknown colors', () => {
      const def = BranchSettingsDef.simple();
      expect(def.svgColors.unknown).toEqual(['orange', 'green', 'red', 'purple', 'turquoise']);
    });
  });

  describe('none', () => {
    it('has empty persistence and order', () => {
      const def = BranchSettingsDef.none();
      expect(def.persistence).toEqual([]);
      expect(def.order).toEqual([]);
    });

    it('has empty color matches', () => {
      const def = BranchSettingsDef.none();
      expect(def.terminalColors.matches).toEqual([]);
      expect(def.svgColors.matches).toEqual([]);
    });

    it('has correct terminal unknown colors', () => {
      const def = BranchSettingsDef.none();
      expect(def.terminalColors.unknown).toEqual([
        'bright_blue',
        'bright_yellow',
        'bright_green',
        'bright_red',
        'bright_magenta',
        'bright_cyan',
      ]);
    });

    it('has correct svg unknown colors', () => {
      const def = BranchSettingsDef.none();
      expect(def.svgColors.unknown).toEqual([
        'blue',
        'orange',
        'green',
        'red',
        'purple',
        'turquoise',
      ]);
    });
  });
});

describe('BranchSettings', () => {
  it('compiles persistence patterns into RegExp', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.persistence).toHaveLength(6);
    expect(settings.persistence[0]).toBeInstanceOf(RegExp);
    expect(settings.persistence[0].test('main')).toBe(true);
    expect(settings.persistence[0].test('master')).toBe(true);
    expect(settings.persistence[0].test('trunk')).toBe(true);
    expect(settings.persistence[0].test('feature/x')).toBe(false);
  });

  it('compiles order patterns into RegExp', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.order).toHaveLength(3);
    expect(settings.order[0].test('main')).toBe(true);
    expect(settings.order[1].test('hotfix/123')).toBe(true);
    expect(settings.order[1].test('release/1.0')).toBe(true);
    expect(settings.order[2].test('develop')).toBe(true);
    expect(settings.order[2].test('dev')).toBe(true);
  });

  it('compiles terminal colors with regex keys', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.terminalColors).toHaveLength(6);
    const [regex, colors] = settings.terminalColors[0];
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('main')).toBe(true);
    expect(colors).toEqual(['bright_blue']);
  });

  it('preserves terminal unknown colors', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.terminalColorsUnknown).toEqual(['white']);
  });

  it('compiles svg colors with regex keys', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.svgColors).toHaveLength(6);
    const [regex, colors] = settings.svgColors[2];
    expect(regex.test('feature/login')).toBe(true);
    expect(colors).toEqual(['purple', 'turquoise']);
  });

  it('preserves svg unknown colors', () => {
    const settings = BranchSettings.from(BranchSettingsDef.gitFlow());
    expect(settings.svgColorsUnknown).toEqual(['gray']);
  });

  it('works with none() definition (empty patterns)', () => {
    const settings = BranchSettings.from(BranchSettingsDef.none());
    expect(settings.persistence).toHaveLength(0);
    expect(settings.order).toHaveLength(0);
    expect(settings.terminalColors).toHaveLength(0);
    expect(settings.svgColors).toHaveLength(0);
  });
});

describe('MergePatterns', () => {
  it('default has 6 patterns', () => {
    const mp = MergePatterns.default();
    expect(mp.patterns).toHaveLength(6);
  });

  it('all patterns are RegExp instances', () => {
    const mp = MergePatterns.default();
    for (const p of mp.patterns) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });

  it('matches "Merge branch \'feature\' into \'main\'"', () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[0].exec("Merge branch 'feature' into 'main'");
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature');
  });

  it('matches "Merge branch \'feature\' into main"', () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[1].exec("Merge branch 'feature' into main");
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature');
  });

  it("matches \"Merge branch 'feature'\"", () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[2].exec("Merge branch 'feature'");
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature');
  });

  it('matches "Merge pull request #42 from user/feature-branch"', () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[3].exec('Merge pull request #42 from user/feature-branch');
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature-branch');
  });

  it("matches \"Merge branch 'feature' of https://...\"", () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[4].exec("Merge branch 'feature' of https://github.com/user/repo");
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature');
  });

  it('matches "Merged in feature-branch (pull request #42)"', () => {
    const mp = MergePatterns.default();
    const match = mp.patterns[5].exec('Merged in feature-branch (pull request #42)');
    expect(match).not.toBeNull();
    expect(match![1]).toBe('feature-branch');
  });
});
