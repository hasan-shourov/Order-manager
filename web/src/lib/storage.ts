const PRIVATE_PREFIX = 'orderBilling:';

export function clearPrivateBrowserState(): void {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(PRIVATE_PREFIX)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
}
