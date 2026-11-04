import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const line = (job: string, status: string, owner: string | null = 'x') =>
  JSON.stringify({ at: '2026-01-01T00:00:00+01:00', job, status, owner });

// runs/ is read-only; every night under test is written to a fresh temp dir.
function appWith(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(runsDir, name), text);
  return createApp({ ...base, runsDir });
}

// Job names in table order: the first cell of each body row.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]!);
}

async function both(app: ReturnType<typeof createApp>, night: string) {
  const page = await app.request(`/digest/${night}`);
  const api = await app.request(`/api/digest/${night}`);
  return { page, api };
}

describe('digest routes', () => {
  it('200 for a night with a file, on both routes', async () => {
    const app = appWith({ '2026-01-01.jsonl': [line('b', 'ok'), line('a', 'fail')].join('\n') + '\n' });
    const { page, api } = await both(app, '2026-01-01');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<table>');
    expect(api.status).toBe(200);
    const json = (await api.json()) as NightDigest;
    expect(json.night).toBe('2026-01-01');
    expect(json.badLines).toBe(0);
  });

  it('404 for a night with no file or a malformed night, on both routes', async () => {
    const app = appWith({});
    for (const night of ['2026-01-02', 'nope', '..%2Fx']) {
      const { page, api } = await both(app, night);
      expect(page.status).toBe(404);
      expect(api.status).toBe(404);
    }
  });

  it('the empty night: page says nothing ran, JSON has rows []', async () => {
    const app = appWith({ '2026-01-01.jsonl': '' });
    const { page, api } = await both(app, '2026-01-01');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('a night with a bad line still renders: page shows the parse count, JSON badLines is 1', async () => {
    const app = appWith({ '2026-01-01.jsonl': [line('a', 'ok'), 'not json', line('b', 'ok')].join('\n') });
    const { page, api } = await both(app, '2026-01-01');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/1 line didn(&#39;|')t parse/);
    expect(pageJobs(html)).toEqual(['a', 'b']);
    expect(api.status).toBe(200);
    const json = (await api.json()) as NightDigest;
    expect(json.badLines).toBe(1);
    expect(json.rows.map((r) => r.job)).toEqual(['a', 'b']);
  });

  it('page and JSON agree: same jobs in the same order', async () => {
    const app = appWith({
      '2026-01-01.jsonl': [line('zeta', 'ok'), line('alpha', 'retry'), line('mid/job', 'fail', null), line('alpha', 'ok')].join('\n'),
    });
    const { page, api } = await both(app, '2026-01-01');
    const json = (await api.json()) as NightDigest;
    expect(json.rows.map((r) => r.job)).toEqual(['alpha', 'mid/job', 'zeta']);
    expect(pageJobs(await page.text())).toEqual(json.rows.map((r) => r.job));
  });

  it('page and JSON agree on the real night 2026-10-28', async () => {
    const app = createApp(base);
    const { page, api } = await both(app, '2026-10-28');
    expect(page.status).toBe(200);
    const json = (await api.json()) as NightDigest;
    expect(json.rows).toHaveLength(5);
    expect(json.badLines).toBe(1);
    expect(pageJobs(await page.text())).toEqual(json.rows.map((r) => r.job));
  });
});
