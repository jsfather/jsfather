const storageKey = 'university-install-last-shown';
// A rolling month avoids prompting twice around a calendar-month boundary.
const cooldown = 31 * 24 * 60 * 60 * 1000;

export function claimInstallPrompt(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now = Date.now(),
) {
  try {
    const lastShown = Number(storage.getItem(storageKey));
    if (lastShown > 0 && now - lastShown < cooldown) return false;
    // Record the impression, even if the user never presses "Maybe later".
    storage.setItem(storageKey, String(now));
    return true;
  } catch {
    // Keep quiet when the browser cannot persist the frequency limit.
    return false;
  }
}
