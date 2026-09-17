import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// jsdom ships a localStorage, but the progress and telemetry modules want a
// clean one per test, and a plain object keeps failures readable.
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] ?? null;
  },
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// The guest id and session ids come from crypto.randomUUID. Older jsdom
// builds omit it, so fall back to a counter rather than failing the run.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let n = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    },
    writable: true,
  });
}

beforeEach(() => {
  localStorageMock.clear();
});
