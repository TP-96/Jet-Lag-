// Shared with the server-rendered layout, so this module must not be a client module.
export const THEME_KEY = 'hs-theme';

/** Inline script for <head>: applies the saved theme before first paint so there's no flash. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
