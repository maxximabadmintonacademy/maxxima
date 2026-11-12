// Logik kejohanan dikongsi (admin & halaman awam): kumpulan rawak, jadual round robin, kedudukan.

/** Kocok (Fisher–Yates) dengan penjana rawak ber-seed supaya cabutan boleh diaudit. */
export function seededRandom(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
/** Bahagikan peserta kepada kumpulan. Seed diagih dahulu (1 seed setiap kumpulan), selebihnya rawak. */
export function makeGroups(entries, size, seedText) {
  const rnd = seededRandom(seedText), G = Math.max(1, Math.ceil(entries.length / Math.max(2, size)));
  const seeded = entries.filter(e => e.seed != null).sort((a, b) => a.seed - b.seed), rest = entries.filter(e => e.seed == null);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const groups = Array.from({ length: G }, () => []);
  [...seeded, ...rest].forEach((e, i) => { const round = Math.floor(i / G), pos = i % G; groups[round % 2 ? G - 1 - pos : pos].push(e.id); });   // susunan "snake"
  return groups;
}
/** Jadual round robin (kaedah bulatan). Pulangkan [{round_no, match_no, entry_a, entry_b}] */
export function roundRobin(ids) {
  const p = ids.slice(); if (p.length % 2) p.push(null);
  const n = p.length, out = []; let k = 0;
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) { const a = p[i], b = p[n - 1 - i]; if (a && b) out.push({ round_no: r + 1, match_no: ++k, entry_a: a, entry_b: b }); }
    p.splice(1, 0, p.pop());
  }
  return out;
}
/** Kedudukan kumpulan: menang → keputusan bersemuka (seri 2 pemain) → beza mata → mata dijaringkan. */
export function standings(ids, matches) {
  const row = id => ({ id, p: 0, w: 0, l: 0, pf: 0, pa: 0 }), T = new Map(ids.map(id => [id, row(id)]));
  for (const m of matches) {
    if (m.status === 'pending' || !m.winner) continue;
    const A = T.get(m.entry_a), B = T.get(m.entry_b); if (!A || !B) continue;
    A.p++; B.p++; const sa = Number(m.score_a) || 0, sb = Number(m.score_b) || 0;
    A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
    if (m.winner === m.entry_a) { A.w++; B.l++; } else { B.w++; A.l++; }
  }
  const list = [...T.values()];
  const h2h = (a, b) => { const m = matches.find(x => x.winner && ((x.entry_a === a.id && x.entry_b === b.id) || (x.entry_a === b.id && x.entry_b === a.id))); return m ? (m.winner === a.id ? -1 : 1) : 0; };
  list.sort((a, b) => b.w - a.w || (list.filter(x => x.w === a.w).length === 2 ? h2h(a, b) : 0) || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf);
  return list;
}
export const GROUP_NAMES = 'ABCDEFGHIJKLMNOP'.split('');
