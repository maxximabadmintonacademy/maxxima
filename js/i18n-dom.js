// Penterjemah paparan Portal Admin: teks BM pada skrin ditukar ke bahasa pilihan selepas setiap paparan.
// Kod halaman admin tidak perlu diubah; teks yang belum ada dalam kamus kekal Bahasa Malaysia.
import { getLang } from './i18n.js';
import { AD, PATTERNS, setTrAll } from './i18n-admin.js';

const SKIP = 'textarea,script,style,pre,[data-noi18n],#remindText';
const SEP = /( · | — | – | → | \| )/;
const idx = () => (getLang() === 'en' ? 0 : 1);
export const misses = new Set();

function core(s) {            // satu serpihan tanpa pemisah
  if (s in AD) return AD[s][idx()];
  for (const [re, fn] of PATTERNS) { const m = s.match(re); if (m) { const r = fn(m, getLang(), one); if (r != null) return r; } }
  return null;
}
function one(s) {             // cuba terus, kemudian tanpa tanda baca di tepi
  let r = core(s); if (r != null) return r;
  const m = s.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N})%]*)$/u);
  if (m && m[2] && (m[1] || m[3])) { r = core(m[2]); if (r != null) return m[1] + r + m[3]; }
  return null;
}
export function tr(text) {
  if (getLang() === 'ms' || typeof text !== 'string') return text;
  const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0], s = text.slice(lead.length, text.length - tail.length).replace(/\s+/g, ' ');
  if (!s || !/\p{L}{2}/u.test(s)) return text;
  let r = one(s);
  if (r == null && SEP.test(s)) { let hit = false; r = s.split(SEP).map(p => { if (SEP.test(p)) return p; const x = one(p); if (x != null) { hit = true; return x; } return p; }).join(''); if (!hit) r = null; }
  if (r == null) { if (/[a-z]{3}/.test(s)) misses.add(s); return text; }
  return lead + r + tail;
}
setTrAll(x => tr(x));
const done = new WeakMap();
function node(n) {
  if (done.get(n) === n.nodeValue) return;
  const p = n.parentElement; if (!p || p.closest(SKIP)) return;
  const r = tr(n.nodeValue); if (r !== n.nodeValue) n.nodeValue = r; done.set(n, n.nodeValue);
}
const ATTRS = ['placeholder', 'title', 'aria-label'];
function el(e) {
  if (e.closest?.(SKIP)) return;
  for (const a of ATTRS) { const v = e.getAttribute?.(a); if (v) { const r = tr(v); if (r !== v) e.setAttribute(a, r); } }
}
function walk(root) {
  if (getLang() === 'ms') return;
  if (root.nodeType === 3) return node(root);
  if (root.nodeType !== 1) return;
  el(root); root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) node(n);
}
let obs = null;
export function startDomI18n() {
  if (obs) return; 
  obs = new MutationObserver(list => { if (getLang() === 'ms') return; for (const m of list) { if (m.type === 'characterData') node(m.target); else m.addedNodes.forEach(walk); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  walk(document.body);
}
export function stopDomI18n() { obs?.disconnect(); obs = null; }
