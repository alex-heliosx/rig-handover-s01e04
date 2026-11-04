import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

describe('GET /api/digest/:night', () => {
  const config = { adapter: '', installed: '', beatEverySeconds: 1, runsDir: 'runs' };

  it('returns exactly what readNight returns; 404 for unknown or malformed nights', async () => {
    const app = createApp(config);
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(readNight('runs', '2026-10-28'))));
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/..%2Fx')).status).toBe(404);
  });
});
