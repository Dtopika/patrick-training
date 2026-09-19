import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

class MemoryStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed))}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}

function baseContext({records={},local={}}={}){
  const localStorage=new MemoryStorage(local),writes=[];
  const PatrickDB={
    async open(){return true},
    async migrateLocalStorage(){return false},
    async getRecord(key){return records[key]},
    async get(key){return records[key]?.value},
    async set(key,value,updatedAt){records[key]={key,value,updatedAt};writes.push({key,value,updatedAt});return updatedAt},
    async setMany(entries){for(const e of entries){records[e.key]={...e};writes.push({...e})}return true},
    async del(key){delete records[key]}
  };
  const document={querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},documentElement:{style:{}}};
  const window={
    PATRICK_COMMANDS:[
      {level:0,cmd:'Patrick',pron:'Pá-trik',meaning:'Nombre',category:'Fundamentos'},
      {level:0,cmd:'Ja!',pron:'Ya',meaning:'Marcador',category:'Fundamentos'},
      {level:0,cmd:'Frei',pron:'Frai',meaning:'Libre',category:'Fundamentos'},
      {level:1,cmd:'Sitz',pron:'Zits',meaning:'Siéntate',category:'Posiciones'}
    ],
    PATRICK_LEVELS:[
      {n:0,title:'Idioma común',goal:'Base',commands:['Patrick','Ja!','Frei']},
      {n:1,title:'Cachorro funcional',goal:'Base',commands:['Sitz']}
    ],
    PatrickDB,
    matchMedia(){return{matches:false,addEventListener(){}}},
    navigator:{}
  };
  const ctx=vm.createContext({
    window,document,localStorage,navigator:window.navigator,console,
    setTimeout,clearTimeout,setInterval,clearInterval,performance,
    scrollTo(){},confirm(){return true},
    SpeechSynthesisUtterance:function(){},Audio:function(){}
  });
  return{ctx,localStorage,records,writes};
}

async function loadCore(env){
  vm.runInContext(read('app-core.js'),env.ctx,{filename:'app-core.js'});
  await env.ctx.window.PATRICK_READY;
  return env;
}

test('storage reconciliation prefers newer local mirror and repairs IndexedDB',async()=>{
  const old='2026-09-18T10:00:00.000Z',fresh='2026-09-19T10:00:00.000Z';
  const env=baseContext({
    records:{patrickProgress:{key:'patrickProgress',value:{Sitz:'No iniciado'},updatedAt:old}},
    local:{
      patrickProgress:JSON.stringify({Sitz:'Consistente'}),
      patrickStorageMetaV2:JSON.stringify({version:2,updatedAt:{patrickProgress:fresh}})
    }
  });
  await loadCore(env);
  assert.equal(vm.runInContext("progress.Sitz",env.ctx),'Consistente');
  assert.equal(env.records.patrickProgress.value.Sitz,'Consistente');
  assert.equal(env.records.patrickProgress.updatedAt,fresh);
});

test('storage reconciliation prefers IndexedDB when legacy local copy has no freshness metadata',async()=>{
  const fresh='2026-09-19T10:00:00.000Z';
  const env=baseContext({
    records:{patrickProgress:{key:'patrickProgress',value:{Sitz:'Consistente'},updatedAt:fresh}},
    local:{patrickProgress:JSON.stringify({Sitz:'No iniciado'})}
  });
  await loadCore(env);
  assert.equal(vm.runInContext("progress.Sitz",env.ctx),'Consistente');
  assert.deepEqual(JSON.parse(env.localStorage.getItem('patrickProgress')),{Sitz:'Consistente'});
});

test('backup parser accepts legacy 5.1 backup and rejects malformed nested data',async()=>{
  const env=await loadCore(baseContext());
  vm.runInContext(read('profile.js'),env.ctx,{filename:'profile.js'});
  const valid=vm.runInContext("normalizeBackup({version:5.1,currentLevel:0,dayType:'Todo el día',progress:{Sitz:'En práctica'},trials:{Sitz:[1,.5,0]},history:[],profile:{name:'Patrick',ageMonths:4},notifications:{enabled:false,time:'19:00'}})",env.ctx);
  assert.equal(valid.profile.name,'Patrick');
  assert.deepEqual(Array.from(valid.trials.Sitz),[1,.5,0]);
  assert.throws(()=>vm.runInContext("normalizeBackup({version:5.6,currentLevel:0,dayType:'Todo el día',trials:{Sitz:['boom']}})",env.ctx));
  assert.throws(()=>vm.runInContext("normalizeBackup({version:5.6,currentLevel:0,dayType:'Todo el día',history:[null]})",env.ctx));
  assert.throws(()=>vm.runInContext("normalizeBackup({version:9,currentLevel:0,dayType:'Todo el día'})",env.ctx));
});

test('rolling state becomes consistent only after enough committed evidence',async()=>{
  const env=await loadCore(baseContext());
  vm.runInContext(read('app-session.js'),env.ctx,{filename:'app-session.js'});
  const state=vm.runInContext("(()=>{const t={},p={};[1,1,1,1,1,1,1,1,0,0].forEach(s=>applyRollingToState(t,p,'Sitz',s));return {trials:t.Sitz,state:p.Sitz}})()",env.ctx);
  assert.equal(state.trials.length,10);
  assert.equal(state.state,'Consistente');
});

test('hardening regressions stay closed',()=>{
  const sw=read('sw.js'),core=read('app-core.js'),session=read('app-session.js');
  assert.match(sw,/startsWith\('patrick-training-'\)/);
  assert.doesNotMatch(sw,/keys\.filter\(k=>k!==CACHE\)/);
  assert.match(core,/cmds\.map\(c=>escapeHtml\(displayCommand\(c\)\)\)/);
  const rate=session.match(/function rateExecution\(outcome\)\{([\s\S]*?)\n\}/)?.[1]||'';
  assert.doesNotMatch(rate,/store\.set/);
  assert.doesNotMatch(rate,/applyRollingToState/);
  assert.match(session,/await store\.setMany\(/);
  assert.match(session,/addEventListener\('cancel'/);
});
