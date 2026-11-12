// Penjana cabutan kalah-mati (single elimination) — fungsi tulen, tiada kebergantungan.
// Pemain seeded diletakkan mengikut kedudukan piawai (seed 1 & 2 hanya bertemu di akhir),
// "bye" diberikan kepada seed teratas dan dilangsaikan secara automatik (walkover).

export function seedPositions(size) {
  let a = [1, 2];
  while (a.length < size) {
    const n = a.length * 2, b = [];
    a.forEach(s => { b.push(s); b.push(n + 1 - s); });
    a = b;
  }
  return a;
}

export const roundLabel = players =>
  players === 2 ? 'Akhir' : players === 4 ? 'Separuh Akhir' : players === 8 ? 'Suku Akhir' : `Pusingan ${players}`;

/** Slot dalam perlawanan pusingan seterusnya yang akan diisi oleh pemenang. */
export const nextSlot = m => ({ round_no: m.round_no + 1, match_no: Math.ceil(m.match_no / 2), slot: m.match_no % 2 === 1 ? 'entry_a' : 'entry_b' });

/**
 * @param {{id:string, seed?:number|null}[]} entries
 * @returns senarai perlawanan (semua pusingan) dengan bye sudah diselesaikan
 */
export function buildDraw(entries, shuffle = true) {
  const n = entries.length;
  if (n < 2) throw new Error('Cabutan memerlukan sekurang-kurangnya 2 peserta.');
  let size = 2; while (size < n) size *= 2;

  const seeded = entries.filter(e => e.seed != null).sort((a, b) => a.seed - b.seed);
  const rest = entries.filter(e => e.seed == null);
  if (shuffle) for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const ranked = [...seeded, ...rest];
  const pos = seedPositions(size);

  const rounds = Math.log2(size), matches = [];
  for (let r = 1; r <= rounds; r++) {
    for (let m = 1; m <= size / 2 ** r; m++) {
      matches.push({ round_no: r, round_label: roundLabel(size / 2 ** (r - 1)), match_no: m, entry_a: null, entry_b: null, winner: null, status: 'pending', score_text: null });
    }
  }
  const get = (r, m) => matches.find(x => x.round_no === r && x.match_no === m);
  for (let m = 1; m <= size / 2; m++) {
    const mm = get(1, m);
    mm.entry_a = ranked[pos[2 * m - 2] - 1]?.id ?? null;
    mm.entry_b = ranked[pos[2 * m - 1] - 1]?.id ?? null;
  }
  // Selesaikan bye pusingan 1
  for (const mm of matches.filter(x => x.round_no === 1)) {
    if ((mm.entry_a && !mm.entry_b) || (!mm.entry_a && mm.entry_b)) {
      mm.winner = mm.entry_a || mm.entry_b; mm.status = 'walkover';
      const nx = nextSlot(mm); const target = get(nx.round_no, nx.match_no);
      if (target) target[nx.slot] = mm.winner;
    }
  }
  return matches;
}
