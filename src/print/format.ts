/**
 * Formatting of commits.
 * Port of print/format.rs
 */

import chalk from 'chalk';
import { CommitFormat, CommitFormat as CommitFormatNs } from '../settings';

// Re-export for convenience
export { CommitFormat };
export const commitFormatFromStr = CommitFormatNs.fromStr;

/** Compare CommitFormat for ordering (OneLine < Short < Medium < Full) */
function formatOrd(f: CommitFormat): number {
  switch (f.type) {
    case 'OneLine':
      return 0;
    case 'Short':
      return 1;
    case 'Medium':
      return 2;
    case 'Full':
      return 3;
    case 'Format':
      return -1;
  }
}

// --- Git time type ---

export interface GitTime {
  seconds: number;
  offsetMinutes: number;
}

// --- Commit data type (simplified from isomorphic-git) ---

export interface CommitData {
  oid: string;
  summary: string;
  parentOids: string[];
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
}

// --- Placeholder indices ---

const NEW_LINE = 0;
const HASH = 1;
const HASH_ABBREV = 2;
const PARENT_HASHES = 3;
const PARENT_HASHES_ABBREV = 4;
const REFS = 5;
const SUBJECT = 6;
const AUTHOR = 7;
const AUTHOR_EMAIL = 8;
const AUTHOR_DATE = 9;
const AUTHOR_DATE_SHORT = 10;
const AUTHOR_DATE_RELATIVE = 11;
const COMMITTER = 12;
const COMMITTER_EMAIL = 13;
const COMMITTER_DATE = 14;
const COMMITTER_DATE_SHORT = 15;
const COMMITTER_DATE_RELATIVE = 16;
const BODY = 17;
const BODY_RAW = 18;

const MODE_SPACE = 1;
const MODE_PLUS = 2;
const MODE_MINUS = 3;

const BASE_PLACEHOLDERS = [
  'n',
  'H',
  'h',
  'P',
  'p',
  'd',
  's',
  'an',
  'ae',
  'ad',
  'as',
  'ar',
  'cn',
  'ce',
  'cd',
  'cs',
  'cr',
  'b',
  'B',
];

export const PLACEHOLDERS: string[][] = BASE_PLACEHOLDERS.map((b) => [
  `%${b}`,
  `% ${b}`,
  `%+${b}`,
  `%-${b}`,
]);

// --- Date formatting ---

export function formatDate(
  time: GitTime,
  formatStr: string
): string {
  const offsetMs = time.offsetMinutes * 60 * 1000;
  const date = new Date(time.seconds * 1000 + offsetMs);

  // Build a simple format based on tokens
  // We handle the common patterns used in git
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const offsetSign = time.offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(time.offsetMinutes);
  const offsetHours = Math.floor(absOffset / 60);
  const offsetMins = absOffset % 60;
  const offsetStr = `${offsetSign}${pad(offsetHours)}${pad(offsetMins)}`;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dayOfWeek = date.getUTCDay();

  // Simple token replacement matching common date format patterns
  let result = formatStr;

  // yyyy-MM-dd style (date-fns-like)
  result = result.replace(/yyyy/g, String(year));
  result = result.replace(/MM/g, pad(month));
  result = result.replace(/dd/g, pad(day));
  result = result.replace(/HH/g, pad(hours));
  result = result.replace(/mm/g, pad(minutes));
  result = result.replace(/ss/g, pad(seconds));

  // chrono-style: %F = YYYY-MM-DD, %a = weekday, %b = month, %e = day, %H = hour, %M = min, %S = sec, %Y = year, %z = tz
  result = result.replace(/%F/g, `${year}-${pad(month)}-${pad(day)}`);
  result = result.replace(/%a/g, dayNames[dayOfWeek]);
  result = result.replace(/%b/g, monthNames[month - 1]);
  result = result.replace(/%e/g, String(day).padStart(2, ' '));
  result = result.replace(/%H/g, pad(hours));
  result = result.replace(/%M/g, pad(minutes));
  result = result.replace(/%S/g, pad(seconds));
  result = result.replace(/%Y/g, String(year));
  result = result.replace(/%z/g, offsetStr);

  return result;
}

export function formatRelativeTime(time: GitTime): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = nowSeconds - time.seconds;

  const sec = diff;
  const min = Math.floor(diff / 60);
  const hrs = Math.floor(diff / 3600);
  const days = Math.floor(diff / 86400);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (sec < 60) return `${sec} seconds ago`;
  if (min < 60) return `${min} minutes ago`;
  if (hrs < 24) return `${hrs} hours ago`;
  if (days < 7) return `${days} days ago`;
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months < 12) return `${months} months ago`;
  return `${years} years ago`;
}

// --- Commit formatting ---

function colorHash(text: string, hashColor: number | undefined): string {
  if (hashColor !== undefined) {
    return chalk.ansi256(hashColor)(text);
  }
  return text;
}

export function formatOneline(
  commit: CommitData,
  branches: string,
  wrapping: undefined | number,
  hashColor: number | undefined
): string[] {
  const abbrevHash = commit.oid.slice(0, 7);
  const out = `${colorHash(abbrevHash, hashColor)}${branches} ${commit.summary}`;

  if (wrapping !== undefined) {
    return wrapText(out, wrapping);
  }
  return [out];
}

export function formatCommit(
  format: string,
  commit: CommitData,
  branches: string,
  wrapping: undefined | number,
  hashColor: number | undefined
): string[] {
  // Find all replacements
  const replacements: Array<{
    start: number;
    len: number;
    idx: number;
    mode: number;
  }> = [];

  for (let idx = 0; idx < PLACEHOLDERS.length; idx++) {
    const arr = PLACEHOLDERS[idx];
    let curr = 0;
    while (curr < format.length) {
      let found = false;
      for (let mode = 0; mode < arr.length; mode++) {
        const str = arr[mode];
        const pos = format.indexOf(str, curr);
        if (pos !== -1) {
          replacements.push({ start: pos, len: str.length, idx, mode });
          curr = pos + str.length;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
  }

  replacements.sort((a, b) => a.start - b.start);

  // Generate formatted lines
  const lines: string[] = [];
  let out = '';

  const addLine = () => {
    if (out.length > 0) {
      if (wrapping !== undefined) {
        lines.push(...wrapText(out, wrapping));
      } else {
        lines.push(out);
      }
      out = '';
    }
  };

  const handleMode = (mode: number, hasContent: boolean) => {
    if (mode === MODE_SPACE && hasContent) {
      out += ' ';
    } else if (mode === MODE_PLUS && hasContent) {
      addLine();
    } else if (mode === MODE_MINUS && !hasContent) {
      // Remove trailing empty lines
      while (lines.length > 0 && lines[lines.length - 1] === '') {
        out = lines.pop()!;
      }
      if (lines.length > 0) {
        out = lines.pop()!;
      }
    }
  };

  let curr = 0;
  for (const r of replacements) {
    out += format.slice(curr, r.start);
    formatField(r.idx, r.mode, commit, branches, hashColor, lines, handleMode, addLine, (s: string) => { out += s; });
    curr = r.start + r.len;
  }
  out += format.slice(curr);

  // Finalize tail
  addLine();

  return lines;
}

function formatField(
  idx: number,
  mode: number,
  commit: CommitData,
  branches: string,
  hashColor: number | undefined,
  lines: string[],
  handleMode: (mode: number, hasContent: boolean) => void,
  addLine: () => void,
  push: (s: string) => void
): void {
  switch (idx) {
    case NEW_LINE:
      addLine();
      break;
    case HASH:
      handleMode(mode, true);
      push(colorHash(commit.oid, hashColor));
      break;
    case HASH_ABBREV:
      handleMode(mode, true);
      push(colorHash(commit.oid.slice(0, 7), hashColor));
      break;
    case PARENT_HASHES:
      handleMode(mode, true);
      push(commit.parentOids.join(' '));
      break;
    case PARENT_HASHES_ABBREV:
      handleMode(mode, true);
      push(commit.parentOids.map((p) => p.slice(0, 7)).join(' '));
      break;
    case REFS:
      handleMode(mode, branches.length > 0);
      push(branches);
      break;
    case SUBJECT:
      handleMode(mode, commit.summary.length > 0);
      push(commit.summary);
      break;
    case AUTHOR:
      handleMode(mode, true);
      push(commit.author.name);
      break;
    case AUTHOR_EMAIL:
      handleMode(mode, true);
      push(commit.author.email);
      break;
    case AUTHOR_DATE:
      handleMode(mode, true);
      push(
        formatDate(
          {
            seconds: commit.author.timestamp,
            offsetMinutes: commit.author.timezoneOffset,
          },
          '%a %b %e %H:%M:%S %Y %z'
        )
      );
      break;
    case AUTHOR_DATE_SHORT:
      handleMode(mode, true);
      push(
        formatDate(
          {
            seconds: commit.author.timestamp,
            offsetMinutes: commit.author.timezoneOffset,
          },
          '%F'
        )
      );
      break;
    case AUTHOR_DATE_RELATIVE:
      handleMode(mode, true);
      push(
        formatRelativeTime({
          seconds: commit.author.timestamp,
          offsetMinutes: commit.author.timezoneOffset,
        })
      );
      break;
    case COMMITTER:
      handleMode(mode, true);
      push(commit.committer.name);
      break;
    case COMMITTER_EMAIL:
      handleMode(mode, true);
      push(commit.committer.email);
      break;
    case COMMITTER_DATE:
      handleMode(mode, true);
      push(
        formatDate(
          {
            seconds: commit.committer.timestamp,
            offsetMinutes: commit.committer.timezoneOffset,
          },
          '%a %b %e %H:%M:%S %Y %z'
        )
      );
      break;
    case COMMITTER_DATE_SHORT:
      handleMode(mode, true);
      push(
        formatDate(
          {
            seconds: commit.committer.timestamp,
            offsetMinutes: commit.committer.timezoneOffset,
          },
          '%F'
        )
      );
      break;
    case COMMITTER_DATE_RELATIVE:
      handleMode(mode, true);
      push(
        formatRelativeTime({
          seconds: commit.committer.timestamp,
          offsetMinutes: commit.committer.timezoneOffset,
        })
      );
      break;
    case BODY: {
      const msgLines = commit.message.split('\n');
      const numParts = msgLines.length;
      handleMode(mode, numParts > 2);
      for (let cnt = 0; cnt < msgLines.length; cnt++) {
        if (cnt > 1 && (cnt < numParts - 1 || msgLines[cnt] !== '')) {
          push(msgLines[cnt]);
          addLine();
        }
      }
      break;
    }
    case BODY_RAW: {
      const msgLines = commit.message.split('\n');
      const numParts = msgLines.length;
      handleMode(mode, msgLines.length > 0);
      for (let cnt = 0; cnt < msgLines.length; cnt++) {
        if (cnt < numParts - 1 || msgLines[cnt] !== '') {
          push(msgLines[cnt]);
          addLine();
        }
      }
      break;
    }
  }
}

/** Format a commit for Short/Medium/Full */
export function formatMultiLine(
  commit: CommitData,
  branches: string,
  wrapping: undefined | number,
  hashColor: number | undefined,
  format: CommitFormat
): string[] {
  if (format.type === 'OneLine') {
    return formatOneline(commit, branches, wrapping, hashColor);
  }
  if (format.type === 'Format') {
    return formatCommit(format.value, commit, branches, wrapping, hashColor);
  }

  const outVec: string[] = [];

  // commit <hash><branches>
  let out = `commit ${colorHash(commit.oid, hashColor)}${branches}`;
  appendWrapped(outVec, out, wrapping);

  // Merge line (for merge commits)
  if (commit.parentOids.length > 1) {
    out = `Merge: ${commit.parentOids[0].slice(0, 7)} ${commit.parentOids[1].slice(0, 7)}`;
    appendWrapped(outVec, out, wrapping);
  }

  // Author line
  out = `Author: ${commit.author.name} <${commit.author.email}>`;
  appendWrapped(outVec, out, wrapping);

  // Committer line (Full only)
  if (formatOrd(format) > formatOrd({ type: 'Medium' })) {
    out = `Commit: ${commit.committer.name} <${commit.committer.email}>`;
    appendWrapped(outVec, out, wrapping);
  }

  // Date line (Medium and Full)
  if (formatOrd(format) > formatOrd({ type: 'Short' })) {
    out = `Date:   ${formatDate(
      {
        seconds: commit.author.timestamp,
        offsetMinutes: commit.author.timezoneOffset,
      },
      '%a %b %e %H:%M:%S %Y %z'
    )}`;
    appendWrapped(outVec, out, wrapping);
  }

  // Body
  if (format.type === 'Short') {
    outVec.push('');
    appendWrapped(outVec, `    ${commit.summary}`, wrapping);
    outVec.push('');
  } else {
    outVec.push('');
    const msgLines = (commit.message || '').split('\n');
    let addLineAfter = true;
    for (const line of msgLines) {
      if (line === '') {
        outVec.push(line);
      } else {
        appendWrapped(outVec, `    ${line}`, wrapping);
      }
      addLineAfter = line.trim() !== '';
    }
    if (addLineAfter) {
      outVec.push('');
    }
  }

  return outVec;
}

/** Main format entry point - dispatches to the right formatter */
export function format(
  commitFormat: CommitFormat,
  commit: CommitData,
  branches: string,
  wrapping: undefined | number,
  hashColor: number | undefined
): string[] {
  return formatMultiLine(commit, branches, wrapping, hashColor, commitFormat);
}

// --- Helpers ---

function appendWrapped(
  vec: string[],
  str: string,
  wrapping: undefined | number
): void {
  if (str === '') {
    vec.push(str);
  } else if (wrapping !== undefined) {
    vec.push(...wrapText(str, wrapping));
  } else {
    vec.push(str);
  }
}

function wrapText(text: string, width: number): string[] {
  // Simple word-wrapping implementation
  if (text.length <= width) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > width) {
    let breakAt = remaining.lastIndexOf(' ', width);
    if (breakAt <= 0) {
      breakAt = width;
    }
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining.length > 0) {
    lines.push(remaining);
  }

  return lines;
}
