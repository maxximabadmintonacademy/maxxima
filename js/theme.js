// Tema paparan: 'light' | 'dark' | 'auto' (ikut peranti). Disimpan pada peranti ini.
import { t } from './i18n.js';
const KEY = 'mx_theme';
let theme = 'light';
try { const v = localStorage.getItem(KEY); if (['light', 'dark', 'auto'].includes(v)) theme = v; } catch { /* storan tidak tersedia */ }
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const apply = () => { const d = theme === 'dark' || (theme === 'auto' && mq?.matches); document.documentElement.dataset.theme = d ? 'dark' : 'light'; document.querySelector('meta[name=theme-color]')?.setAttribute('content', d ? '#0B1220' : '#0B2545'); };
mq?.addEventListener?.('change', apply);
apply();
export const getTheme = () => theme;
export const setTheme = v => { if (!['light', 'dark', 'auto'].includes(v)) return; theme = v; try { localStorage.setItem(KEY, v); } catch { /* abaikan */ } apply(); };
export const themeSwitch = () => `<div class="langsw" role="group">${[['light', 'Cerah'], ['dark', 'Gelap'], ['auto', 'Auto']].map(([c, l]) => `<button type="button" class="${c === theme ? 'on' : ''}" data-action="set-theme" data-id="${c}">${t(l)}</button>`).join('')}</div>`;
