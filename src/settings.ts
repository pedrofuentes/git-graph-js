// ---- RepoSettings ----

export interface RepoSettings {
  model: string;
}

// ---- BranchOrder ----

export type BranchOrder =
  | { type: 'ShortestFirst'; forward: boolean }
  | { type: 'LongestFirst'; forward: boolean };

// ---- CommitFormat ----

export type CommitFormat =
  | { type: 'OneLine' }
  | { type: 'Short' }
  | { type: 'Medium' }
  | { type: 'Full' }
  | { type: 'Format'; value: string };

export const CommitFormat = {
  fromStr(str: string): CommitFormat {
    switch (str) {
      case 'oneline':
      case 'o':
        return { type: 'OneLine' };
      case 'short':
      case 's':
        return { type: 'Short' };
      case 'medium':
      case 'm':
        return { type: 'Medium' };
      case 'full':
      case 'f':
        return { type: 'Full' };
      default:
        return { type: 'Format', value: str };
    }
  },
};

// ---- Characters ----

export class Characters {
  readonly chars: string[];

  constructor(chars: string[]) {
    this.chars = chars;
  }

  static thin(): Characters {
    return new Characters([...' ●○│─┼└┌┐┘┤├┴┬<>']);
  }

  static round(): Characters {
    return new Characters([...' ●○│─┼╰╭╮╯┤├┴┬<>']);
  }

  static bold(): Characters {
    return new Characters([...' ●○┃━╋┗┏┓┛┫┣┻┳<>']);
  }

  static double(): Characters {
    return new Characters([...' ●○║═╬╚╔╗╝╣╠╩╦<>']);
  }

  static ascii(): Characters {
    return new Characters([..." *o|-+'..'||++<>"]);
  }

  static fromStr(str: string): Characters {
    switch (str) {
      case 'normal':
      case 'thin':
      case 'n':
      case 't':
        return Characters.thin();
      case 'round':
      case 'r':
        return Characters.round();
      case 'bold':
      case 'b':
        return Characters.bold();
      case 'double':
      case 'd':
        return Characters.double();
      case 'ascii':
      case 'a':
        return Characters.ascii();
      default:
        throw new Error(
          `Unknown characters/style '${str}'. Must be one of [normal|thin|round|bold|double|ascii]`
        );
    }
  }

  reverse(): Characters {
    const chars = [...this.chars];
    swap(chars, 6, 8);
    swap(chars, 7, 9);
    swap(chars, 10, 11);
    swap(chars, 12, 13);
    swap(chars, 14, 15);
    return new Characters(chars);
  }
}

function swap<T>(arr: T[], i: number, j: number): void {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

// ---- ColorsDef ----

export interface ColorsDef {
  matches: [string, string[]][];
  unknown: string[];
}

// ---- BranchSettingsDef ----

export interface BranchSettingsDef {
  persistence: string[];
  order: string[];
  terminalColors: ColorsDef;
  svgColors: ColorsDef;
}

export const BranchSettingsDef = {
  gitFlow(): BranchSettingsDef {
    return {
      persistence: [
        '^(master|main|trunk)$',
        '^(develop|dev)$',
        '^feature.*$',
        '^release.*$',
        '^hotfix.*$',
        '^bugfix.*$',
      ],
      order: [
        '^(master|main|trunk)$',
        '^(hotfix|release).*$',
        '^(develop|dev)$',
      ],
      terminalColors: {
        matches: [
          ['^(master|main|trunk)$', ['bright_blue']],
          ['^(develop|dev)$', ['bright_yellow']],
          ['^(feature|fork/).*$', ['bright_magenta', 'bright_cyan']],
          ['^release.*$', ['bright_green']],
          ['^(bugfix|hotfix).*$', ['bright_red']],
          ['^tags/.*$', ['bright_green']],
        ],
        unknown: ['white'],
      },
      svgColors: {
        matches: [
          ['^(master|main|trunk)$', ['blue']],
          ['^(develop|dev)$', ['orange']],
          ['^(feature|fork/).*$', ['purple', 'turquoise']],
          ['^release.*$', ['green']],
          ['^(bugfix|hotfix).*$', ['red']],
          ['^tags/.*$', ['green']],
        ],
        unknown: ['gray'],
      },
    };
  },

  simple(): BranchSettingsDef {
    return {
      persistence: ['^(master|main|trunk)$'],
      order: ['^tags/.*$', '^(master|main|trunk)$'],
      terminalColors: {
        matches: [
          ['^(master|main|trunk)$', ['bright_blue']],
          ['^tags/.*$', ['bright_green']],
        ],
        unknown: ['bright_yellow', 'bright_green', 'bright_red', 'bright_magenta', 'bright_cyan'],
      },
      svgColors: {
        matches: [
          ['^(master|main|trunk)$', ['blue']],
          ['^tags/.*$', ['green']],
        ],
        unknown: ['orange', 'green', 'red', 'purple', 'turquoise'],
      },
    };
  },

  none(): BranchSettingsDef {
    return {
      persistence: [],
      order: [],
      terminalColors: {
        matches: [],
        unknown: ['bright_blue', 'bright_yellow', 'bright_green', 'bright_red', 'bright_magenta', 'bright_cyan'],
      },
      svgColors: {
        matches: [],
        unknown: ['blue', 'orange', 'green', 'red', 'purple', 'turquoise'],
      },
    };
  },
};

// ---- BranchSettings ----

export class BranchSettings {
  readonly persistence: RegExp[];
  readonly order: RegExp[];
  readonly terminalColors: [RegExp, string[]][];
  readonly terminalColorsUnknown: string[];
  readonly svgColors: [RegExp, string[]][];
  readonly svgColorsUnknown: string[];

  constructor(
    persistence: RegExp[],
    order: RegExp[],
    terminalColors: [RegExp, string[]][],
    terminalColorsUnknown: string[],
    svgColors: [RegExp, string[]][],
    svgColorsUnknown: string[],
  ) {
    this.persistence = persistence;
    this.order = order;
    this.terminalColors = terminalColors;
    this.terminalColorsUnknown = terminalColorsUnknown;
    this.svgColors = svgColors;
    this.svgColorsUnknown = svgColorsUnknown;
  }

  static from(def: BranchSettingsDef): BranchSettings {
    return new BranchSettings(
      def.persistence.map((p) => new RegExp(p)),
      def.order.map((p) => new RegExp(p)),
      def.terminalColors.matches.map(([p, c]) => [new RegExp(p), c]),
      def.terminalColors.unknown,
      def.svgColors.matches.map(([p, c]) => [new RegExp(p), c]),
      def.svgColors.unknown,
    );
  }
}

// ---- MergePatterns ----

export class MergePatterns {
  readonly patterns: RegExp[];

  constructor(patterns: RegExp[]) {
    this.patterns = patterns;
  }

  static default(): MergePatterns {
    return new MergePatterns([
      /^Merge branch '(.+)' into '.+'$/,
      /^Merge branch '(.+)' into .+$/,
      /^Merge branch '(.+)'$/,
      /^Merge pull request #[0-9]+ from .[^/]+\/(.+)$/,
      /^Merge branch '(.+)' of .+$/,
      /^Merged in (.+) \(pull request #[0-9]+\)$/,
    ]);
  }
}

// ---- Settings ----

export interface Settings {
  reverseCommitOrder: boolean;
  debug: boolean;
  compact: boolean;
  colored: boolean;
  includeRemote: boolean;
  format: CommitFormat;
  wrapping: [number | null, number | null, number | null] | null;
  characters: Characters;
  branchOrder: BranchOrder;
  branches: BranchSettings;
  mergePatterns: MergePatterns;
}
