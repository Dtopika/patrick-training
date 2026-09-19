const COMMANDS=window.PATRICK_COMMANDS;
const LEVELS=window.PATRICK_LEVELS;
const CONFIG=window.PATRICK_CONFIG;
const ENGINE=window.PatrickTrainingEngine;
const BACKUP_SCHEMA=window.PatrickBackupSchema;
const STATES=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
const STATE_SCORE={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function icon(name,cls='uiIcon'){
  const paths={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    levels:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    play:'<path d="m8 5 11 7-11 7z"/>',
    volume:'<path d="M5 10v4h4l5 4V6l-5 4z"/><path d="M17 9a5 5 0 0 1 0 6"/><path d="M19 6a9 9 0 0 1 0 12"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    x:'<path d="m6 6 12 12M18 6 6 18"/>',
    signal:'<path d="M6 21V4"/><path d="M6 5h11l-2 4 2 4H6"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    steps:'<path d="M6 7h13M6 12h13M6 17h13"/><circle cx="3" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="17" r=".8" fill="currentColor" stroke="none"/>',
    reward:'<path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9z"/>',
    download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
    upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 4h16"/>',
    dog:'<path d="M7 9 4 5v7c0 5 3 8 8 8s8-3 8-8V5l-3 4"/><path d="M9 13h.01M15 13h.01"/><path d="M10 16c1 .7 3 .7 4 0"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    flame:'<path d="M12 22c4 0 7-3 7-7 0-5-4-7-3-12-4 2-7 6-7 10-1-1-2-3-2-4-2 2-3 4-3 7 0 3 3 6 8 6z"/><path d="M12 20c2 0 3.5-1.5 3.5-3.5 0-2-1.5-3-2-5-2 1-3.5 3-3.5 5 0 2 1 3.5 2 3.5z"/>',
    help:'<path d="M9.5 9a2.8 2.8 0 1 1 4.5 2.2c-1.2.8-2 1.4-2 2.8"/><path d="M12 18h.01"/>',
    install:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'
  };
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.check}</svg>`;
}

const STORAGE_DEFAULTS={
  patrickProgress:{},
  patrickTrials:{},
  patrickHistory:[],
  patrickCurrentLevel:0,
  patrickDayType:'Todo el día',
  patrickDogProfile:null
};
const STORAGE_META_KEY='patrickStorageMetaV2';
const memoryStore={};
let storageMode='pending';

function readStorageMeta(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_META_KEY)||'null');
    return parsed&&typeof parsed==='object'&&parsed.updatedAt&&typeof parsed.updatedAt==='object'?parsed:{version:2,updatedAt:{}};
  }catch{return{version:2,updatedAt:{}}}
}
function writeStorageMeta(meta){try{localStorage.setItem(STORAGE_META_KEY,JSON.stringify(meta))}catch{}}
function parseLocalValue(key,fallback){
  try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}
}
function localTimestamp(meta,key){const n=Date.parse(meta?.updatedAt?.[key]||'');return Number.isFinite(n)?n:0}
function writeLocalValue(key,value,updatedAt,meta=readStorageMeta()){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
  meta.updatedAt[key]=updatedAt;writeStorageMeta(meta);return meta;
}
function removeLocalValue(key){
  const meta=readStorageMeta();delete meta.updatedAt[key];writeStorageMeta(meta);
  try{localStorage.removeItem(key)}catch{}
}

const store={
  async hydrate(){
    const meta=readStorageMeta();
    try{
      await window.PatrickDB.open();
      await window.PatrickDB.migrateLocalStorage(Object.keys(STORAGE_DEFAULTS));
      for(const [key,fallback] of Object.entries(STORAGE_DEFAULTS)){
        const record=await window.PatrickDB.getRecord(key),dbTs=Date.parse(record?.updatedAt||'')||0;
        const raw=localStorage.getItem(key),localTs=localTimestamp(meta,key);
        let value,updatedAt;
        if(raw!==null&&localTs>dbTs){
          value=parseLocalValue(key,fallback);updatedAt=meta.updatedAt[key];
          await window.PatrickDB.set(key,value,updatedAt);
        }else if(record){
          value=record.value===undefined?fallback:record.value;updatedAt=record.updatedAt||new Date().toISOString();
          try{localStorage.setItem(key,JSON.stringify(value))}catch{}
          meta.updatedAt[key]=updatedAt;
        }else if(raw!==null){
          value=parseLocalValue(key,fallback);updatedAt=meta.updatedAt[key]||new Date().toISOString();
          await window.PatrickDB.set(key,value,updatedAt);meta.updatedAt[key]=updatedAt;
        }else{
          value=fallback;
        }
        memoryStore[key]=value;
      }
      writeStorageMeta(meta);storageMode='indexeddb';
    }catch(e){
      console.warn('IndexedDB unavailable; using localStorage fallback',e);
      for(const [key,fallback] of Object.entries(STORAGE_DEFAULTS))memoryStore[key]=parseLocalValue(key,fallback);
      storageMode='localStorage';
    }
  },
  get(k,d){return Object.prototype.hasOwnProperty.call(memoryStore,k)?memoryStore[k]:d},
  set(k,v){
    memoryStore[k]=v;const updatedAt=new Date().toISOString();writeLocalValue(k,v,updatedAt);
    if(storageMode==='indexeddb')return window.PatrickDB.set(k,v,updatedAt).then(()=>true).catch(e=>{console.warn('IndexedDB write failed; local mirror kept current',e);return false});
    return Promise.resolve(true);
  },
  setMany(values){
    const updatedAt=new Date().toISOString(),meta=readStorageMeta(),entries=[];
    for(const [key,value] of Object.entries(values)){memoryStore[key]=value;try{localStorage.setItem(key,JSON.stringify(value))}catch{}meta.updatedAt[key]=updatedAt;entries.push({key,value,updatedAt})}
    writeStorageMeta(meta);
    if(storageMode==='indexeddb')return window.PatrickDB.setMany(entries).then(()=>true).catch(e=>{console.warn('IndexedDB batch write failed; local mirror kept current',e);return false});
    return Promise.resolve(true);
  },
  remove(k){delete memoryStore[k];removeLocalValue(k);if(storageMode==='indexeddb')window.PatrickDB.del(k).catch(console.warn)}
};

let progress={},trials={},history=[],currentLevel=0,dayType='Todo el día',filter='Todos';
let dogProfile={name:'',breed:'Pastor Alemán'};
let session=null,toastTimer=null,commandAudio=null;

function dogName(){return String(dogProfile?.name||'').trim()||'Patrick'}
function displayCommand(c){const raw=typeof c==='string'?c:c?.cmd||'';return raw==='Patrick'?dogName():raw}
function displayPron(c){return c?.cmd==='Patrick'?dogName():c?.pron||''}
function stateOf(cmd){return progress[cmd]||'No iniciado'}
function commandBy(name){return COMMANDS.find(c=>c.cmd===name)||(name===dogName()?COMMANDS.find(c=>c.cmd==='Patrick'):undefined)}
function levelBy(n){return LEVELS.find(l=>l.n===n)}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}
function localGermanSpeech(text){return new Promise((resolve,reject)=>{if(!('speechSynthesis'in window)){reject(new Error('speechSynthesis unavailable'));return}try{const synth=window.speechSynthesis;synth.cancel();synth.resume();const voices=synth.getVoices();const de=voices.find(v=>v.lang?.toLowerCase().startsWith('de'));const u=new SpeechSynthesisUtterance(text);u.lang=de?.lang||'de-DE';u.rate=.72;u.pitch=1;if(de)u.voice=de;u.onend=()=>resolve();u.onerror=e=>reject(e);synth.speak(u)}catch(e){reject(e)}})}
async function remoteGermanSpeech(text){if(commandAudio){commandAudio.pause();commandAudio.src=''}const url=`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=de&q=${encodeURIComponent(text)}`;commandAudio=new Audio(url);commandAudio.preload='auto';commandAudio.volume=1;await commandAudio.play()}
async function speak(c){const text=displayCommand(c).replace(/!/g,'').trim();if(!text)return;try{await localGermanSpeech(text);return}catch(e){console.warn('Local German TTS failed, trying remote voice',e)}try{if(navigator.onLine){await remoteGermanSpeech(text);return}}catch(e){console.warn('Remote German TTS failed',e)}toast('No pude reproducir el audio. Revisa volumen o voz alemana del teléfono.')}
function levelProgress(n){const cmds=levelBy(n).commands;if(!cmds.length)return 0;return Math.round(cmds.reduce((a,x)=>a+STATE_SCORE[stateOf(x)]/4,0)/cmds.length*100)}
function levelReady(n){return levelBy(n).commands.every(x=>STATE_SCORE[stateOf(x)]>=2)}
function totalProgress(){return Math.round(COMMANDS.reduce((a,c)=>a+STATE_SCORE[stateOf(c.cmd)]/4,0)/COMMANDS.length*100)}
function solidCount(){return COMMANDS.filter(c=>STATE_SCORE[stateOf(c.cmd)]>=2).length}
function commandLastPracticeMs(cmd){return ENGINE.lastPracticeMs(history,cmd)}
function commandRecentAverage(cmd){return ENGINE.recentAverage(trials,cmd)}
function trainingSafety(c){return ENGINE.safetyForCommand(c,dogProfile)}
function adaptivePriority(c,n){return ENGINE.adaptivePriority(c,n,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})}
function focusForLevel(n){return ENGINE.focusForLevel(COMMANDS,n,{dayType,trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})}
function microPlan(){const focus=focusForLevel(currentLevel);return ENGINE.microPlan(COMMANDS,currentLevel,{dayType,progress,stateScore:STATE_SCORE,focus,profile:dogProfile})}
function setView(id){$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});if(id==='progress')renderProgress();if(id==='commands')renderCommands();if(id==='levels')renderLevels()}
function renderDogIdentity(){const name=dogName();if($('#dogNameHeader'))$('#dogNameHeader').textContent=name;if($('#todayHeading'))$('#todayHeading').textContent=`Hoy con ${name}`;if($('#advanceTitle'))$('#advanceTitle').textContent=`${name} está listo para avanzar`;if($('#dogProfileName'))$('#dogProfileName').textContent=name;if($('#storageModeLabel'))$('#storageModeLabel').textContent=storageMode==='indexeddb'?'IndexedDB':'almacenamiento local'}
function focusChipHtml(c){
  if(!c||typeof c!=='object')return'';
  const raw=String(c.cmd||'').trim();if(!raw)return'';
  const label=raw==='Patrick'?dogName():raw;
  const pron=raw==='Patrick'?(String(c.pron||'Pá-trik').trim()):(String(c.pron||'').trim());
  if(!label)return'';
  return `<span class="focusChip">${escapeHtml(label)}${pron?` <small>${escapeHtml(pron)}</small>`:''}</span>`;
}
function renderToday(){
  const l=levelBy(currentLevel),ready=levelReady(currentLevel);renderDogIdentity();
  $('#headerLevel').textContent=`Nivel ${currentLevel} · ${l.title}`;
  $('#todaySummary').textContent=history.length===0?'Tu primera sesión puede durar apenas unos minutos. La constancia vale más que la duración.':dayType==='Solo noche'?'Plan adaptativo compacto: prioriza lo que más necesita refuerzo.':'Plan adaptativo: combina nivel actual, rendimiento reciente y repaso espaciado.';
  $('#dayType').value=dayType;$('#levelBadge').textContent=`Nivel ${currentLevel}`;$('#readinessBadge').textContent=ready&&currentLevel<10?'Listo para avanzar':'En curso';$('#readinessBadge').classList.toggle('ready',ready);$('#sessionTitle').textContent=l.title;$('#sessionGoal').textContent=l.goal;
  const focus=focusForLevel(currentLevel).filter(c=>c&&String(c.cmd||'').trim());$('#focusCommands').innerHTML=focus.map(focusChipHtml).filter(Boolean).join('');
  $('#metricProgress').textContent=totalProgress()+'%';$('#metricSolid').textContent=solidCount();$('#metricSessions').textContent=history.length;
  $('#todayPlan').innerHTML=microPlan().map(([name,dur,goal,cmds],i)=>`<article class="planItem"><span class="planNumber">${i+1}</span><div><strong>${escapeHtml(name)} · ${escapeHtml(goal)}</strong><p>${cmds.map(c=>escapeHtml(displayCommand(c))).join(' · ')||'Juego y vínculo'}</p></div><small>${escapeHtml(dur)}</small></article>`).join('');
  $('#advanceCard').hidden=!(ready&&currentLevel<10);
}
function renderLevels(){$('#levelList').innerHTML=LEVELS.map(l=>{const p=levelProgress(l.n);return `<article class="levelCard ${currentLevel===l.n?'activeLevel':''}"><div class="levelTop"><span class="levelIndex">${l.n}</span><div class="levelTitleWrap"><strong>${escapeHtml(l.title)}</strong><small>${escapeHtml(l.goal)}</small></div><span class="levelProgress">${p}%</span></div><div class="miniBar"><div style="width:${p}%"></div></div><div class="levelCommands">${l.commands.map(n=>{const c=commandBy(n);return `<span class="tinyChip">${escapeHtml(displayCommand(c))} · ${escapeHtml(displayPron(c))}</span>`}).join('')}</div><div class="levelActions">${currentLevel===l.n?'<span class="badge">Nivel activo</span>':`<button class="setLevelBtn" data-set-level="${l.n}">Trabajar este nivel</button>`}</div></article>`}).join('');$$('[data-set-level]').forEach(b=>b.onclick=()=>{currentLevel=+b.dataset.setLevel;store.set('patrickCurrentLevel',currentLevel);renderAll();toast(`Nivel ${currentLevel} activado`)})}
function categories(){return ['Todos',...new Set(COMMANDS.map(c=>c.category))]}
function commandCard(c){const shown=displayCommand(c),pron=displayPron(c);return `<article class="commandCard" data-command="${escapeHtml(c.cmd)}"><div class="commandSummary"><div><div class="commandTitle"><strong>${escapeHtml(shown)}</strong><span class="pronunciation">${escapeHtml(pron)}</span></div><div class="commandMeaning">${escapeHtml(c.meaning)}</div><div class="commandMeta"><span class="tinyChip">Nivel ${c.level}</span><span class="tinyChip">${escapeHtml(c.category)}</span></div></div><div class="commandActions"><button class="audioBtn" data-audio="${escapeHtml(c.cmd)}" aria-label="Escuchar pronunciación de ${escapeHtml(shown)}">${icon('volume')}</button><button class="practiceBtn" data-practice="${escapeHtml(c.cmd)}" aria-label="Practicar ${escapeHtml(shown)}">${icon('play')}</button></div></div><button class="commandToggle" data-toggle="${escapeHtml(c.cmd)}" aria-expanded="false">Ver cómo enseñarlo <span>${icon('chevron')}</span></button><div class="commandDetails"><div class="detailRow"><strong>Señal / gesto</strong><p>${escapeHtml(c.signal)}</p></div><div class="detailRow"><strong>Qué debe hacer</strong><p>${escapeHtml(c.action)}</p></div><div class="detailRow"><strong>Paso a paso</strong><p>${escapeHtml(c.how)}</p></div><div class="detailRow"><strong>Premio</strong><p>${escapeHtml(c.reward)}</p></div><div class="detailRow"><strong>Criterio de avance</strong><p>En las últimas 10 ejecuciones: Logrado = 1 punto, Con ayuda = 0,5 y No logrado = 0. Al llegar a 8 puntos pasa a consistente.</p></div></div></article>`}
function renderCommands(){const q=$('#search').value.trim().toLowerCase();$('#filters').innerHTML=categories().map(x=>`<button class="filterBtn ${filter===x?'active':''}" data-filter="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');const arr=COMMANDS.filter(c=>(filter==='Todos'||c.category===filter)&&(`${displayCommand(c)} ${displayPron(c)} ${c.meaning} ${c.category}`).toLowerCase().includes(q));$('#commandList').innerHTML=arr.map(commandCard).join('')||'<p class="muted">No encontré comandos con ese filtro.</p>';$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderCommands()});$$('[data-audio]').forEach(b=>b.onclick=()=>speak(commandBy(b.dataset.audio)));$$('[data-practice]').forEach(b=>b.onclick=()=>startSession([commandBy(b.dataset.practice)]));$$('[data-toggle]').forEach(b=>b.onclick=()=>{const card=b.closest('.commandCard');card.classList.toggle('open');b.setAttribute('aria-expanded',String(card.classList.contains('open')))})}

window.PATRICK_READY=(async()=>{
  await store.hydrate();progress=store.get('patrickProgress',{})||{};trials=store.get('patrickTrials',{})||{};history=store.get('patrickHistory',[])||[];currentLevel=Number(store.get('patrickCurrentLevel',0))||0;dayType=store.get('patrickDayType','Todo el día')||'Todo el día';dogProfile=store.get('patrickDogProfile',null)||{name:'',breed:'Pastor Alemán'};
  const hasExistingData=Object.keys(progress).length>0||Object.keys(trials).length>0||history.length>0||currentLevel>0;
  if(!String(dogProfile?.name||'').trim()&&hasExistingData){dogProfile={...dogProfile,name:'Patrick',breed:'Pastor Alemán'};store.set('patrickDogProfile',dogProfile)}
})();
