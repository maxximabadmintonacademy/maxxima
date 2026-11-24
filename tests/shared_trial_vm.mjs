// Runs against the real shared-trial entry module with a tiny DOM and RPC transport fixture.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const entry = readFileSync(new URL('../js/shared-trial.js', import.meta.url), 'utf-8')
  .replace(/^import .*;\n/gm, '')
  .replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')", '({createClient: () => clientStub})');
const tick = () => new Promise(resolve => setImmediate(resolve));
const el = (value = '') => ({value, validity:{valid:true}, disabled:false, textContent:'', innerHTML:'', handlers:{}, addEventListener(key,f){this.handlers[key]=f;}});
const fields = ['birth','venue','level','child','guardian','phone','consent'].map(() => el());
Object.assign(fields, Object.fromEntries(['birth','venue','level','child','guardian','phone','consent'].map((k,i) => [k,fields[i]])));
let picked = null;
const ids = Object.fromEntries(['shared-trial','trial-slots','trial-error','refresh','copy-portal'].map(k=>[k,el()]));
const submit=el();
Object.assign(ids['shared-trial'], {elements:fields, querySelector: s=>s==='[type=submit]' ? submit : picked});
const reg=el();
const date='2099-01-13';
const junior={class_id:'j',date,start:'08:00',end:'10:00',programme:'Foundation',venue:'Forum SBA'};
const adult={class_id:'a',date,start:'16:00',end:'18:00',programme:'Adult',venue:'GoTeam'};
let portal, token, attempts=0, staleResolve;
const location={hash:''};
const context={
  CONFIG:{SUPABASE_URL:'test',SUPABASE_ANON_KEY:'test'},
  document:{querySelector:()=>reg,getElementById:i=>ids[i],documentElement:{}},
  location, URLSearchParams, Intl, crypto:webcrypto,
  history:{replaceState:(_s,_t,url)=>{location.hash=url;}},
  clientStub:{rpc:async (name,data) => {
    if(name==='shared_trial_venues') return {data:[{id:'forum',name:'Forum SBA'},{id:'goteam',name:'GoTeam'}]};
    if(name==='shared_trial_slots') {
      if(data.p_venue==='forum' && data.p_level==='match') return new Promise(resolve=>{staleResolve=resolve;});
      if(data.p_venue==='forum' && data.p_birth==='2015-01-01' && data.p_level==='new') return {data:[junior]};
      if(data.p_venue==='goteam' && data.p_birth==='1995-01-01' && data.p_level==='new') return {data:[adult]};
      return {data:[]};
    }
    if(name==='shared_trial_book') {
      const p=data.p;
      assert.equal(p.class_id,'a');
      assert.equal(p.child,'Example Player');
      assert.equal(p.guardian,'Example Guardian');
      assert.equal(p.birth,'1995-01-01');
      assert.equal(p.venue,'goteam');
      assert.equal(p.level,'new');
      assert.equal(p.consent,true);
      assert.match(p.token,/^[a-f0-9]{64}$/);
      if(token) assert.equal(p.token,token);
      token=p.token;
      if(!attempts++) return {data:{ok:false,code:'slot_unavailable'}};
      portal={status:'confirmed',...adult,court:'4'};
      return {data:{ok:true}};
    }
    if(name==='shared_trial_portal') return {data:data.p_token===token ? portal:null};
    throw new Error(name);
  }}
};
const run=()=>vm.runInNewContext(entry,{...context});
const slots=ids['trial-slots'], form=ids['shared-trial'], warning=ids['trial-error'];
await run();
assert.match(reg.innerHTML,/Book a Free Group Trial/);
assert.match(reg.innerHTML,/Enter all three/);
Object.assign(fields.birth,{value:'2015-01-01'}); fields.venue.value='forum'; fields.level.value='new';
await fields.level.handlers.change();
assert.match(slots.innerHTML,/Foundation · Forum SBA/);
picked={value:'0'};
slots.handlers.change();
assert.equal(submit.disabled,false);
fields.level.value='match';
const stale=fields.level.handlers.change();
assert.equal(submit.disabled,true);
fields.birth.value='1995-01-01'; fields.venue.value='goteam'; fields.level.value='new';
await fields.venue.handlers.change();
staleResolve({data:[junior]});
await stale;
assert.match(slots.innerHTML,/Adult · GoTeam/);
assert.doesNotMatch(slots.innerHTML,/Foundation/);
fields.child.value='Example Player'; fields.guardian.value='Example Guardian'; fields.phone.value='0123456789'; fields.consent.checked=true;
await form.onsubmit({preventDefault(){}});
assert.match(warning.textContent,/no longer available/);
assert.equal(submit.disabled,true);
await form.onsubmit({preventDefault(){}});
assert.match(location.hash,/^#reservation=[a-f0-9]{64}$/);
assert.match(reg.innerHTML,/<dt>Court<\/dt><dd>4<\/dd>/);
assert.doesNotMatch(reg.innerHTML,/Example (Player|Guardian)/);
portal={...portal,status:'cancelled'};
await ids.refresh.onclick();
assert.match(reg.innerHTML,/Please do not travel/);
assert.doesNotMatch(reg.innerHTML,/<dt>Court/);
location.hash='#reservation='+'8'.repeat(64);
await run();
await tick();
assert.match(reg.innerHTML,/invalid or has expired/);
console.log('PASS: generic trial entry, age/venue/level combination, delayed-response race, full-slot retry, verified token, portal privacy, court, cancellation and wrong token');
