/**
 * git-graph-js - Command line tool to show clear git graphs arranged for your branching model.
 *
 * Library entry point.
 * Port of lib.rs
 */

// Core types and graph construction
export { GitGraph, CommitInfo, BranchInfo, BranchVis, HeadInfo, createGitGraph, parseMergeSummary, branchOrder, branchColor, assignChildren, assignBranchColumns } from './graph';

// Settings and configuration types
export {
  Settings,
  BranchSettings,
  BranchSettingsDef,
  BranchOrder,
  Characters,
  MergePatterns,
  CommitFormat,
  RepoSettings,
  ColorsDef,
} from './settings';

// Config management
export {
  createConfig,
  getAvailableModels,
  getModelName,
  getModel,
  setModel,
} from './config';

// Print module
export { getDeviateIndex } from './print/index';
export { printSvg } from './print/svg';
export { printUnicode, formatBranches } from './print/unicode';
export type { UnicodeGraphInfo } from './print/unicode';

// Format
export {
  formatOneline,
  formatCommit,
  formatMultiLine,
  format,
  formatDate,
  formatRelativeTime,
  commitFormatFromStr,
  PLACEHOLDERS,
} from './print/format';
export type { CommitData, GitTime } from './print/format';

// Colors
export { toTerminalColor, NAMED_COLORS } from './print/colors';
