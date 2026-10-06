import { createSafeStorage, type KeyValueStorage } from '../storage';

const blocked: KeyValueStorage = {
  getItem: () => Promise.reject(new Error('SecurityError: blocked')),
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => Promise.reject(new Error('blocked')),
};

function memoryBackend(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

describe('Speicher ohne Absturz', () => {
  it('arbeitet bei blockiertem Gerätespeicher im Arbeitsspeicher weiter', async () => {
    const storage = createSafeStorage(blocked);
    await expect(storage.getItem('a')).resolves.toBeNull();
    await expect(storage.setItem('a', '1')).resolves.toBeUndefined();
    await expect(storage.getItem('a')).resolves.toBe('1');
    await storage.removeItem('a');
    await expect(storage.getItem('a')).resolves.toBeNull();
  });

  it('nutzt den Gerätespeicher, solange er funktioniert', async () => {
    const backend = memoryBackend();
    backend.data.set('pref', 'dunkel');
    const storage = createSafeStorage(backend);
    await expect(storage.getItem('pref')).resolves.toBe('dunkel');
    await storage.setItem('neu', 'x');
    expect(backend.data.get('neu')).toBe('x');
  });
});
