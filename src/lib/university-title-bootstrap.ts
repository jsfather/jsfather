declare global {
  interface Window {
    __jsfatherUniversityTitle?: {
      sourceTitle: string;
      appliedTitle: string;
      disconnect: () => void;
    };
  }
}

// Runs in the head before the first paint, even while React's bundles are loading.
// Names only enter document.title as text; they never become HTML or JavaScript.
export const universityTitleBootstrap = `(() => {
  const canonical = 'jsfather Personal University';
  let name = 'jsfather';
  try {
    const stored = (localStorage.getItem('jsfather-university-name') || '')
      .replace(/[\\u0000-\\u001f\\u007f]/g, '')
      .replace(/\\s+/g, ' ').trim().slice(0, 40);
    if (stored && stored.toLowerCase() !== 'jsfather') name = stored;
  } catch {}
  const personal = name + ' Personal University';
  const state = { sourceTitle: '', appliedTitle: '', disconnect: () => observer.disconnect() };
  function syncTitle() {
    const title = document.title;
    if (!title || title === state.appliedTitle) return;
    state.sourceTitle = title;
    const suffix = ' — ' + canonical;
    const next = title.endsWith(suffix)
      ? title.slice(0, -suffix.length) + ' — ' + personal
      : title === canonical || title.startsWith(canonical + ' — ')
        ? personal + title.slice(canonical.length)
        : title;
    state.appliedTitle = next;
    if (title !== next) document.title = next;
  }
  const observer = new MutationObserver(syncTitle);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  window.__jsfatherUniversityTitle = state;
  syncTitle();
})();`;
