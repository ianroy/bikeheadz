import { describe, it, expect, beforeEach } from 'vitest';

// In-memory path only — DATABASE_URL must be unset before importing.
delete process.env.DATABASE_URL;

const { designStore } = await import('../../server/design-store.js');

describe('designStore (memory mode)', () => {
  beforeEach(async () => {
    // No reset hook — tests use unique IDs to avoid cross-talk.
  });

  it('save() then get() round-trips bytes + filename', async () => {
    const id = `test-${Date.now()}`;
    const stl = Buffer.from('solid test\nendsolid', 'utf8');
    await designStore.save({ id, stl, filename: 'foo.stl', settings: { headTilt: 5 }, photoName: 'p.png' });
    const got = await designStore.get(id);
    expect(got).not.toBeNull();
    expect(got.filename).toBe('foo.stl');
    expect(got.settings).toEqual({ headTilt: 5 });
    expect(Buffer.isBuffer(got.stl)).toBe(true);
    expect(got.stl.toString('utf8')).toContain('solid test');
  });

  it('exists() returns true for saved ids and false otherwise', async () => {
    const id = `exists-${Date.now()}`;
    expect(await designStore.exists(id)).toBe(false);
    await designStore.save({ id, stl: Buffer.from('x'), filename: 'x.stl' });
    expect(await designStore.exists(id)).toBe(true);
    expect(await designStore.exists('definitely-not-saved')).toBe(false);
  });

  it('get() returns null for unknown ids', async () => {
    expect(await designStore.get('does-not-exist-anywhere')).toBeNull();
  });
});
