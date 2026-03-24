import { describe, it, expect } from 'vitest';
import {
  CommitFormat,
  commitFormatFromStr,
  formatDate,
  formatRelativeTime,
  formatCommit,
  formatOneline,
  formatMultiLine,
  PLACEHOLDERS,
} from '../src/print/format';

describe('CommitFormat', () => {
  describe('fromStr', () => {
    it('parses "oneline" and abbreviation "o"', () => {
      expect(commitFormatFromStr('oneline')).toEqual({ type: 'OneLine' });
      expect(commitFormatFromStr('o')).toEqual({ type: 'OneLine' });
    });

    it('parses "short" and abbreviation "s"', () => {
      expect(commitFormatFromStr('short')).toEqual({ type: 'Short' });
      expect(commitFormatFromStr('s')).toEqual({ type: 'Short' });
    });

    it('parses "medium" and abbreviation "m"', () => {
      expect(commitFormatFromStr('medium')).toEqual({ type: 'Medium' });
      expect(commitFormatFromStr('m')).toEqual({ type: 'Medium' });
    });

    it('parses "full" and abbreviation "f"', () => {
      expect(commitFormatFromStr('full')).toEqual({ type: 'Full' });
      expect(commitFormatFromStr('f')).toEqual({ type: 'Full' });
    });

    it('parses custom format strings', () => {
      expect(commitFormatFromStr('%h %s')).toEqual({
        type: 'Format',
        value: '%h %s',
      });
    });
  });
});

describe('PLACEHOLDERS', () => {
  it('has 19 placeholder entries', () => {
    expect(PLACEHOLDERS.length).toBe(19);
  });

  it('each placeholder has 4 variants (normal, space, plus, minus)', () => {
    for (const entry of PLACEHOLDERS) {
      expect(entry.length).toBe(4);
    }
  });

  it('first placeholder is newline %n', () => {
    expect(PLACEHOLDERS[0][0]).toBe('%n');
    expect(PLACEHOLDERS[0][1]).toBe('% n');
    expect(PLACEHOLDERS[0][2]).toBe('%+n');
    expect(PLACEHOLDERS[0][3]).toBe('%-n');
  });
});

describe('formatDate', () => {
  it('formats a date with a given format string', () => {
    // Unix timestamp 1609459200 = 2021-01-01 00:00:00 UTC
    const result = formatDate(
      { seconds: 1609459200, offsetMinutes: 0 },
      'yyyy-MM-dd'
    );
    expect(result).toBe('2021-01-01');
  });

  it('handles timezone offset', () => {
    // UTC+5:30 (330 minutes)
    const result = formatDate(
      { seconds: 1609459200, offsetMinutes: 330 },
      'yyyy-MM-dd HH:mm'
    );
    expect(result).toBe('2021-01-01 05:30');
  });
});

describe('formatRelativeTime', () => {
  it('returns "X seconds ago" for recent times', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({ seconds: now - 30, offsetMinutes: 0 });
    expect(result).toBe('30 seconds ago');
  });

  it('returns "X minutes ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 5 * 60,
      offsetMinutes: 0,
    });
    expect(result).toBe('5 minutes ago');
  });

  it('returns "X hours ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 3 * 3600,
      offsetMinutes: 0,
    });
    expect(result).toBe('3 hours ago');
  });

  it('returns "X days ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 3 * 86400,
      offsetMinutes: 0,
    });
    expect(result).toBe('3 days ago');
  });

  it('returns "X weeks ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 14 * 86400,
      offsetMinutes: 0,
    });
    expect(result).toBe('2 weeks ago');
  });

  it('returns "X months ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 90 * 86400,
      offsetMinutes: 0,
    });
    expect(result).toBe('3 months ago');
  });

  it('returns "X years ago"', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime({
      seconds: now - 400 * 86400,
      offsetMinutes: 0,
    });
    expect(result).toBe('1 years ago');
  });
});

describe('formatOneline', () => {
  it('formats a commit in oneline format', () => {
    const commit = {
      oid: 'abcdef1234567890abcdef1234567890abcdef12',
      summary: 'Initial commit',
      parentOids: [],
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@test.com', timestamp: 1609459200, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@test.com', timestamp: 1609459200, timezoneOffset: 0 },
    };
    const lines = formatOneline(commit, ' (main)', undefined, undefined);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('abcdef1');
    expect(lines[0]).toContain('(main)');
    expect(lines[0]).toContain('Initial commit');
  });
});

describe('formatCommit', () => {
  const commit = {
    oid: 'abcdef1234567890abcdef1234567890abcdef12',
    summary: 'Fix bug in parser',
    parentOids: ['1111111111111111111111111111111111111111'],
    message: 'Fix bug in parser\n\nDetailed description here.',
    author: { name: 'Alice', email: 'alice@example.com', timestamp: 1609459200, timezoneOffset: 0 },
    committer: { name: 'Bob', email: 'bob@example.com', timestamp: 1609459200, timezoneOffset: 0 },
  };

  it('replaces %H with full hash', () => {
    const lines = formatCommit('%H', commit, '', undefined, undefined);
    expect(lines[0]).toBe(commit.oid);
  });

  it('replaces %h with abbreviated hash', () => {
    const lines = formatCommit('%h', commit, '', undefined, undefined);
    expect(lines[0]).toBe('abcdef1');
  });

  it('replaces %s with subject', () => {
    const lines = formatCommit('%s', commit, '', undefined, undefined);
    expect(lines[0]).toBe('Fix bug in parser');
  });

  it('replaces %an with author name', () => {
    const lines = formatCommit('%an', commit, '', undefined, undefined);
    expect(lines[0]).toBe('Alice');
  });

  it('replaces %ae with author email', () => {
    const lines = formatCommit('%ae', commit, '', undefined, undefined);
    expect(lines[0]).toBe('alice@example.com');
  });

  it('replaces %cn with committer name', () => {
    const lines = formatCommit('%cn', commit, '', undefined, undefined);
    expect(lines[0]).toBe('Bob');
  });

  it('replaces %ce with committer email', () => {
    const lines = formatCommit('%ce', commit, '', undefined, undefined);
    expect(lines[0]).toBe('bob@example.com');
  });

  it('replaces %d with refs/branches', () => {
    const lines = formatCommit('%d', commit, ' (main)', undefined, undefined);
    expect(lines[0]).toBe(' (main)');
  });

  it('handles multiple placeholders', () => {
    const lines = formatCommit('%h %s', commit, '', undefined, undefined);
    expect(lines[0]).toBe('abcdef1 Fix bug in parser');
  });

  it('handles %n newline', () => {
    const lines = formatCommit('%h%n%s', commit, '', undefined, undefined);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('abcdef1');
    expect(lines[1]).toBe('Fix bug in parser');
  });
});

describe('formatMultiLine', () => {
  const commit = {
    oid: 'abcdef1234567890abcdef1234567890abcdef12',
    summary: 'Fix bug',
    parentOids: ['1111111111111111111111111111111111111111', '2222222222222222222222222222222222222222'],
    message: 'Fix bug\n\nBody line 1\nBody line 2\n',
    author: { name: 'Alice', email: 'alice@example.com', timestamp: 1609459200, timezoneOffset: 0 },
    committer: { name: 'Bob', email: 'bob@example.com', timestamp: 1609459200, timezoneOffset: 0 },
  };

  it('formats Short with commit hash, author, and subject', () => {
    const lines = formatMultiLine(commit, '', undefined, undefined, { type: 'Short' });
    expect(lines[0]).toContain('commit');
    expect(lines[0]).toContain('abcdef1234567890');
    const authorLine = lines.find(l => l.startsWith('Author:'));
    expect(authorLine).toContain('Alice');
    expect(authorLine).toContain('alice@example.com');
  });

  it('formats Medium with date', () => {
    const lines = formatMultiLine(commit, '', undefined, undefined, { type: 'Medium' });
    const dateLine = lines.find(l => l.startsWith('Date:'));
    expect(dateLine).toBeDefined();
  });

  it('formats Full with committer', () => {
    const lines = formatMultiLine(commit, '', undefined, undefined, { type: 'Full' });
    const committerLine = lines.find(l => l.startsWith('Commit:'));
    expect(committerLine).toContain('Bob');
  });

  it('includes Merge line for merge commits', () => {
    const lines = formatMultiLine(commit, '', undefined, undefined, { type: 'Short' });
    const mergeLine = lines.find(l => l.startsWith('Merge:'));
    expect(mergeLine).toContain('1111111');
    expect(mergeLine).toContain('2222222');
  });
});
