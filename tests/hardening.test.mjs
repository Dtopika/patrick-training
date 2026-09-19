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
  let ctx;
  const scripts=[];
  const document={
    scripts,
    querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},
    createElement(tag){
      if(tag!=='script')return{};
      const listeners={};
      return{src:'',async:true,addEventListener(type,fn){listeners[type]=fn},_listeners:listeners};
    },
    head:{appendChild(node){
      scripts.push(node);
      try{const file=String(node.src).split('?')[0];vm.runInContext(read(file),ctx,{filename:file});node.onload?.();node._listeners?.load?.()}
      catch(e){node.onerror?.(e);node._listeners?.error?.(e)}
      return node;
    }},
    documentElement:{style:{}},body:{classList:{toggle(){},add(){},remove(){}}}
  };
  ctx=vm.createContext({
    console,localStorage,document,PatrickDB,
    navigator:{onLine:true},
    setTimeout,clearTimeout,setInterval,clearInterval,performance,
    scrollTo(){},confirm(){return true},requestAnimationFrame(fn){fn()},
    SpeechSynthesisUtterance:function(){},Audio:function(){},
    matchMedia(){return{matches:false,addEventListener(){}}}
  });
  ctx.window=ctx;
  ctx.PATRICK_COMMANDS=[
    {level:0,cmd:'Patrick',pron:'Pá-trik',meaning:'Nombre',category:'Fundamentos'},
    {level:0,cmd:'Ja!',pron:'Ya',meaning:'Marcador',category:'Fundamentos'},
    {level:0,cmd:'Frei',pron:'Frai',meaning:'Libre',category:'Fundamentos'},
    {level:1,cmd:'Sitz',pron:'Zits',meaning:'Siéntate',category:'Posiciones'},
    {level:9,cmd:'Hinter',pron:'Hín-ta',meaning:'Detrás',category:'Control defensivo'},
    {level:10,cmd:'Hopp',pron:'Hop',meaning:'Salto',category:'Avanzado'}
  ];
  ctx.PATRICK_LEVELS=[
    {n:0,title:'Idioma común',goal:'Base',commands:['Patrick','Ja!','Frei']},
    {n:1,title:'Cachorro funcional',goal:'Base',commands:['Sitz']},
    {n:9,title:'Control defensivo',goal:'Seguridad',commands:['Hinter']},
    {n:10,title:'Avanzado',goal:'Avanzado',commands:['Hopp']}
  ];
  return{ctx,localStorage,records,writes,scripts};
}

function loadArchitecture(ctx){
  for(const file of ['config.js','training-engine.js','backup-schema.js'])vm.runInContext(read(file),ctx,{filename:file});
}
async function loadCore(env){
  loadArchitecture(env.ctx);
  vm.runInContext(read('app-core.js'),env.ctx,{filename:'app-core.js'});
  await env.ctx.PATRICK_READY;
  return env;
}

test('v6 bootstraps its dependencies when an older HTML shell loads newer JavaScript',async()=>{
  const env=baseContext();
  vm.runInContext(read('app-core.js'),env.ctx,{filename:'app-core.js'});
  await env.ctx.PATRICK_READY;
  assert.equal(vm.runInContext("CONFIG.APP_VERSION",env.ctx),'6.0.0');
  assert.equal(vm.runInContext("typeof ENGINE.focusForLevel",env.ctx),'function');
  assert.equal(vm.runInContext("typeof BACKUP_SCHEMA.normalize",env.ctx),'function');
  assert.deepEqual(env.scripts.map(s=>s.src),['config.js?v600-r2','training-engine.js?v600-r2','backup-schema.js?v600-r2']);
});

test('navigation and settings click wiring remain collection-safe',()=>{
  const core=read('app-core.js'),session=read('app-session.js'),profile=read('profile.js');
  assert.ok(core.includes("function setView(id){$$('.view').forEach"),'setView must iterate all views');
  assert.ok(core.includes("$$('.bottomNav button').forEach"),'setView must iterate all nav buttons');
  assert.ok(session.includes("$$('.bottomNav button').forEach"),'bottom-nav handlers must bind to all buttons');
  assert.ok(profile.includes("$('#settingsAvatarBtn').onclick=openSettingsDrawer"),'settings avatar handler missing');
  for(const [name,source] of [['app-core.js',core],['app-session.js',session],['profile.js',profile],['progress.js',read('progress.js')],['app-media.js',read('app-media.js')]]){
    const accidental=[...source.matchAll(/(?<!\$)\$\('[^']+'\)\.forEach/g)].map(m=>m[0]);
    assert.deepEqual(accidental,[],name+' has single-node selector used as a collection: '+accidental.join(', '));
  }
});

test('v6 configuration centralizes public and schema versions',()=>{
  const env=baseContext();loadArchitecture(env.ctx);
  assert.equal(env.ctx.PATRICK_CONFIG.APP_VERSION,'6.0.0');
  assert.equal(env.ctx.PATRICK_CONFIG.BACKUP_SCHEMA_VERSION,6);
  assert.equal(env.ctx.PATRICK_CONFIG.SESSION_SCHEMA_VERSION,6);
  assert.equal(env.ctx.PATRICK_CONFIG.CACHE_NAME,'patrick-training-v6.0.0-r2');
});

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

test('storage reconciliation prefers IndexedDB over legacy local data without freshness metadata',async()=>{
  const fresh='2026-09-19T10:00:00.000Z';
  const env=baseContext({
    records:{patrickProgress:{key:'patrickProgress',value:{Sitz:'Consistente'},updatedAt:fresh}},
    local:{patrickProgress:JSON.stringify({Sitz:'No iniciado'})}
  });
  await loadCore(env);
  assert.equal(vm.runInContext("progress.Sitz",env.ctx),'Consistente');
  assert.deepEqual(JSON.parse(env.localStorage.getItem('patrickProgress')),{Sitz:'Consistente'});
});

test('backup schema accepts 5.x backups, v6 schema, and rejects malformed nested data',()=>{
  const env=baseContext();loadArchitecture(env.ctx);
  const schema=env.ctx.PatrickBackupSchema,opts={commands:env.ctx.PATRICK_COMMANDS,states:['No iniciado','En práctica','Consistente','Generalizando','Dominado'],currentProfile:{name:'Patrick'},maxSchemaVersion:6};
  const legacy=schema.normalize({version:5.1,currentLevel:1,dayType:'Todo el día',progress:{Sitz:'En práctica'},trials:{Sitz:[1,.5,0]},history:[],profile:{name:'Patrick',ageMonths:4},notifications:{enabled:false,time:'19:00'}},opts);
  assert.equal(legacy.profile.name,'Patrick');
  assert.deepEqual(Array.from(legacy.trials.Sitz),[1,.5,0]);
  const current=schema.normalize({schemaVersion:6,appVersion:'6.0.0',currentLevel:0,dayType:'Solo noche',history:[]},opts);
  assert.equal(current.dayType,'Solo noche');
  assert.throws(()=>schema.normalize({schemaVersion:6,currentLevel:0,dayType:'Todo el día',trials:{Sitz:['boom']}},opts));
  assert.throws(()=>schema.normalize({schemaVersion:6,currentLevel:0,dayType:'Todo el día',history:[null]},opts));
  assert.throws(()=>schema.normalize({schemaVersion:7,currentLevel:0,dayType:'Todo el día'},opts));
});

test('age-aware engine defers Hopp from adaptive sessions for a young puppy',()=>{
  const env=baseContext();loadArchitecture(env.ctx);
  const engine=env.ctx.PatrickTrainingEngine,profile={ageMonths:4,ageUpdatedAt:new Date().toISOString()};
  const safety=engine.safetyForCommand({cmd:'Hopp'},profile);
  assert.equal(safety.deferFromAdaptive,true);
  const focus=engine.focusForLevel(
    [{level:9,cmd:'Hinter',category:'Control defensivo'},{level:10,cmd:'Hopp',category:'Avanzado'}],
    10,{dayType:'Todo el día',trials:{},history:[],progress:{},stateScore:{'No iniciado':0,'En práctica':1,'Consistente':2},profile}
  );
  assert.equal(focus.some(c=>c.cmd==='Hopp'),false);
  assert.equal(focus[0].cmd,'Hinter');
});

test('adaptive focus always returns command objects, never score wrappers',async()=>{
  const env=await loadCore(baseContext());
  const result=vm.runInContext("focusForLevel(0)",env.ctx);
  assert.ok(result.length>0);
  assert.equal(typeof result[0].cmd,'string');
  assert.equal('c' in result[0],false);
});

test('session evidence is committed only at session completion',async()=>{
  const env=await loadCore(baseContext());
  const sessionLogic=read('app-session.js').replace(/window\.PATRICK_READY\.then\([\s\S]*$/,'');
  vm.runInContext(sessionLogic,env.ctx,{filename:'app-session.js'});
  const state=vm.runInContext("(()=>{const t={},p={};[1,1,1,1,1,1,1,1,0,0].forEach(s=>applyRollingToState(t,p,'Sitz',s));return {trials:t.Sitz,state:p.Sitz}})()",env.ctx);
  assert.equal(state.trials.length,10);
  assert.equal(state.state,'Consistente');
  const rate=sessionLogic.match(/function rateExecution\(outcome\)\{([\s\S]*?)\n\}/)?.[1]||'';
  assert.doesNotMatch(rate,/store\.set/);
  assert.doesNotMatch(rate,/applyRollingToState/);
  assert.match(sessionLogic,/await store\.setMany\(/);
  assert.match(sessionLogic,/addEventListener\('cancel'/);
});

test('all 41 commands map one-to-one to levels and curated videos',()=>{
  const commandText=['commands-1.js','commands-2.js','commands-3.js','commands-4.js'].map(read).join('\n');
  const commands=[...commandText.matchAll(/"cmd":\s*"([^"]+)"/g)].map(m=>m[1]);
  const levels=read('levels.js');
  const levelCommands=[...levels.matchAll(/"commands":\s*\[([^\]]*)\]/g)].flatMap(m=>[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]));
  const videos=read('videos.js'),videoCommands=[...videos.matchAll(/^\s*"([^"]+)":\{/gm)].map(m=>m[1]);
  assert.equal(commands.length,41);
  assert.equal(new Set(commands).size,41);
  assert.deepEqual(new Set(levelCommands),new Set(commands));
  assert.deepEqual(new Set(videoCommands),new Set(commands));
});

test('v6 upgrade contract cache-busts every critical browser asset from v5.6.3',()=>{
  const index=read('index.html'),styles=read('styles.css'),pwa=read('pwa.js'),sw=read('sw.js');
  const tag='v600-r2';
  const scriptSrc=[...index.matchAll(/<script src="([^"]+\.js\?[^"]+)"><\/script>/g)].map(m=>m[1]);
  assert.ok(scriptSrc.length>=10,'expected versioned script URLs');
  assert.ok(scriptSrc.every(src=>src.endsWith('?'+tag)));
  assert.match(index,new RegExp('styles\\.css\\?'+tag));
  assert.match(index,new RegExp('manifest\\.webmanifest\\?'+tag));
  const imports=[...styles.matchAll(/@import url\("\.\/([^"]+)"\);/g)].map(m=>m[1]);
  assert.ok(imports.length>=10,'expected versioned CSS imports');
  assert.ok(imports.every(src=>src.endsWith('?'+tag)));
  assert.match(pwa,new RegExp("serviceWorker\\.register\\('\\.\\/sw\\.js\\?"+tag+"'\\)"));
  assert.match(sw,new RegExp("importScripts\\('\\.\\/config\\.js\\?"+tag+"'\\)"));
  const staleCache=new Set(['app-core.js','profile.js','progress.js','styles.css','styles-ui.css','pwa.js']);
  for(const src of [...scriptSrc,...imports,'styles.css?'+tag])assert.equal(staleCache.has(src),false,'versioned asset collided with stale cache: '+src);
});

test('v6 privacy, CSP, accessibility and PWA regressions stay closed',()=>{
  const index=read('index.html'),core=read('app-core.js'),profile=read('profile.js'),pwa=read('pwa.js'),sw=read('sw.js'),manifest=JSON.parse(read('manifest.webmanifest'));
  assert.match(index,/Content-Security-Policy/);
  assert.match(index,/script-src 'self'/);
  assert.match(index,/aria-labelledby="sessionCommandTitle"/);
  assert.match(index,/aria-labelledby="finishDialogTitle"/);
  assert.match(index,/referrerpolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(index,/accelerometer|clipboard-write|gyroscope|web-share/);
  assert.match(profile,/role="dialog" aria-modal="true"/);
  assert.match(profile,/handleSettingsKeydown/);
  assert.doesNotMatch(core,/translate\.google\.com/);
  assert.doesNotMatch(pwa,/location\.replace|location\.reload/);
  assert.doesNotMatch(sw,/client\.navigate|location\.replace/);
  assert.match(sw,/startsWith\('patrick-training-'\)/);
  assert.match(sw,/caches\.match\(e\.request\)\.then\(cached=>cached\|\|networkAndCache/);
  assert.equal(manifest.background_color,'#2da8f5');
});

test('production JavaScript parses and CSS override debt stays bounded',()=>{
  const files=['config.js','training-engine.js','backup-schema.js','db.js','app-core.js','profile.js','progress.js','app-media.js','app-session.js','pwa.js','sw.js','commands-1.js','commands-2.js','commands-3.js','commands-4.js','levels.js','videos.js','splash.js'];
  for(const file of files)assert.doesNotThrow(()=>new Function(read(file)),file);
  const important=(read('styles-polish.css').match(/!important/g)||[]).length;
  assert.ok(important<=12,'styles-polish.css !important count='+important);
});
