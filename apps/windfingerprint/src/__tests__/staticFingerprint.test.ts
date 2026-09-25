import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadFingerprintPayload } from '@/lib/windFingerprint/staticFingerprint';

describe('loadFingerprintPayload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for a real 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));

    await expect(loadFingerprintPayload('NL00448', 'NO2')).resolves.toBeNull();
  });

  it('returns null instead of throwing when a missing export is answered with a 200 HTML fallback page', async () => {
    // Some hosting setups (SPA/portal fallback) answer a missing static
    // file with `text/html` and status 200 instead of a real 404.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!DOCTYPE html><html></html>', { status: 200 }))
    );

    await expect(loadFingerprintPayload('NL00448', 'NO2')).resolves.toBeNull();
  });
});
