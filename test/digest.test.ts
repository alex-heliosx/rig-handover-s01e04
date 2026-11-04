import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only; anything we write goes to a temp dir.
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs sorted by job, 1 bad line', () => {
    const d = readNight('runs', '2026-10-28');
    expect(d).not.toBeNull();
    expect(d!.badLines).toBe(1);
    expect(d!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds a job into one row: runs, retries, last status and error, first and last time', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    expect(rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-01-01')).toBeNull();
  });

  it('an empty file gives zero rows', () => {
    expect(readNight(tempRuns({ '2026-01-01.jsonl': '' }), '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
    });
  });

  it('counts lines with the wrong shape as bad, never throws', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T00:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-01T00:01:00+01:00","job":"a","status":"weird","owner":"x"}',
        '[1,2]',
        'not json',
        '',
      ].join('\n'),
    });
    const d = readNight(dir, '2026-01-01')!;
    expect(d.badLines).toBe(3);
    expect(d.rows).toHaveLength(1);
  });
});
