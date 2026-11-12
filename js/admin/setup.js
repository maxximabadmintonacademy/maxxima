// Persediaan: rantaian data supaya admin tidak memasukkan data berulang kali.
// Lokasi + Coach -> Kelas -> Pakej (ikut program) -> Pelajar -> Invois automatik.
import { VIEWS } from '../registry.js';
import { ic, esc, pageHead } from '../ui.js';
import { setupChain } from './helpers.js';

VIEWS.persediaan = () => {
  const steps = setupChain(), done = steps.filter(s => s.ok && !s.issues.length).length;
  return `
  ${pageHead('Persediaan', 'Masukkan data mengikut turutan ini sekali sahaja. Selepas itu, pendaftaran dan invois berjalan hampir sendiri.')}
  <div class="card card-pad mb">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>${done} / ${steps.length} langkah lengkap</b><span class="muted" style="font-size:12.5px">Invois pembaharuan dijana automatik apabila baki pakej pelajar tinggal 1 sesi.</span></div>
    <div class="bar lg" style="margin-top:10px"><span style="width:${Math.round(done / steps.length * 100)}%;background:var(--ok)"></span></div>
  </div>
  <div class="card">
    <ul class="list">${steps.map(s => {
      const good = s.ok && !s.issues.length;
      return `<li class="list-item" style="align-items:flex-start;flex-wrap:wrap">
        <div class="kpi-ico ${good ? 't-ok' : s.count ? 't-warn' : 't-info'}" style="display:grid;width:34px;height:34px;flex:none">${good ? ic('tick', 'sm') : `<b>${s.n}</b>`}</div>
        <div class="li-main" style="min-width:220px"><div class="li-title">${s.n}. ${esc(s.title)} <span class="badge b-${good ? 'ok' : s.count ? 'warn' : 'muted'}">${s.count} ${esc(s.unit)}</span></div>
          <div class="li-sub">${esc(s.hint)}</div>
          ${s.issues.map(i => `<div class="li-sub" style="color:var(--bad);margin-top:3px">⚠ ${esc(i)}</div>`).join('')}</div>
        <a class="btn sm ${good ? '' : 'primary'}" href="#${s.href}">${good ? 'Urus' : 'Tetapkan'} ${ic('arrow', 'sm')}</a></li>`;
    }).join('')}</ul>
  </div>
  <div class="card card-pad mt" style="font-size:13px;color:var(--muted)"><b style="color:var(--ink)">Bagaimana ia bersambung</b><br>
    <b>Kelas</b> memilih lokasi, coach, hari/masa dan <b>program</b>. <b>Pakej</b> juga dipautkan kepada <b>program</b> — jadi semua kelas Foundation menggunakan pakej Foundation. Semasa mendaftar pelajar, anda hanya pilih pakej dan kelas; invois, baki sesi dan invois pembaharuan dijana sendiri.</div>`;
};
