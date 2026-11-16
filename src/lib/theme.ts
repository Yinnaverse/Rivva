export type ThemePref = 'dark' | 'light' | 'system';
export const THEME_KEY = 'rivva:theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* storage unavailable */ }
  return 'dark';
}

export function applyTheme(pref: ThemePref) {
  const resolved = pref === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = resolved;
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage unavailable */ }
}

/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){}})()`;
