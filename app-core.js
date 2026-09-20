const COMMANDS=window.PATRICK_COMMANDS;
const LEVELS=window.PATRICK_LEVELS;
let CONFIG=window.PATRICK_CONFIG||null;
let ENGINE=window.PatrickTrainingEngine||null;
let BACKUP_SCHEMA=window.PatrickBackupSchema||null;
const V6_ASSET_TAG='v732-r1';

function loadPatrickDependency(src,isReady){
  if(isReady())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>{const clean=String(s.src||'').split('?')[0];return clean===src||clean.endsWith('/'+src)});
    if(existing){
      existing.addEventListener('load',()=>isReady()?resolve():reject(new Error(src+' loaded without expected global')),{once:true});
      existing.addEventListener('error',()=>reject(new Error('Could not load '+src)),{once:true});
      return;
    }
    const script=document.createElement('script');script.src=src+'?'+V6_ASSET_TAG;script.async=false;
    script.onload=()=>isReady()?resolve():reject(new Error(src+' loaded without expected global'));
    script.onerror=()=>reject(new Error('Could not load '+src));
    document.head.appendChild(script);
  });
}
async function ensureV6Dependencies(){
  await loadPatrickDependency('config.js',()=>!!window.PATRICK_CONFIG);
  await loadPatrickDependency('training-engine.js',()=>!!window.PatrickTrainingEngine);
  await loadPatrickDependency('backup-schema.js',()=>!!window.PatrickBackupSchema);
  CONFIG=window.PATRICK_CONFIG;ENGINE=window.PatrickTrainingEngine;BACKUP_SCHEMA=window.PatrickBackupSchema;
  if(!CONFIG||!ENGINE||!BACKUP_SCHEMA)throw new Error('Patrick v6 dependencies unavailable');
}
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
    chart:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    steps:'<path d="M6 7h13M6 12h13M6 17h13"/><circle cx="3" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="17" r=".8" fill="currentColor" stroke="none"/>',
    reward:'<path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9z"/>',
    download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
    upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 4h16"/>',
    dog:'<path d="M7 9 4 5v7c0 5 3 8 8 8s8-3 8-8V5l-3 4"/><path d="M9 13h.01M15 13h.01"/><path d="M10 16c1 .7 3 .7 4 0"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    flame:'<path d="M12 22c4 0 7-3 7-7 0-5-4-7-3-12-4 2-7 6-7 10-1-1-2-3-2-4-2 2-3 4-3 7 0 3 3 6 8 6z"/><path d="M12 20c2 0 3.5-1.5 3.5-3.5 0-2-1.5-3-2-5-2 1-3.5 3-3.5 5 0 2 1 3.5 2 3.5z"/>',
    help:'<path d="M9.5 9a2.8 2.8 0 1 1 4.5 2.2c-1.2.8-2 1.4-2 2.8"/><path d="M12 18h.01"/>',
    install:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13.5a7.6 7.6 0 0 0 .05-3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L13.7 2h-4l-.4 3a8 8 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 3h4l.4-3a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
    palette:'<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h4a5 5 0 0 0 0-10z"/><circle cx="7.5" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="14" cy="7" r=".8" fill="currentColor" stroke="none"/>',
    database:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    github:'<path d="M9 19c-4 1.5-4-2.5-6-3"/><path d="M15 22v-3.9c0-1.1.1-1.8-.5-2.5 2.8-.3 5.7-1.4 5.7-6.2 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.6-.1-3.3 0 0-1.1-.3-3.5 1.3a12 12 0 0 0-6.4 0C6.5 2.4 5.4 2.7 5.4 2.7c-.7 1.7-.2 3-.1 3.3A4.8 4.8 0 0 0 4 9.4c0 4.8 2.9 5.9 5.7 6.2-.4.4-.7.9-.8 1.8V22"/>'
  };
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.check}</svg>`;
}

const STORAGE_DEFAULTS={
  patrickProgress:{},
  patrickTrials:{},
  patrickHistory:[],
  patrickCurrentLevel:0,
  patrickDayType:'Todo el día',
  patrickDogProfile:null,
  patrickTrainingContext:{environment:'Casa',distraction:'Baja'},
  patrickTheme:'system',
  patrickHistoryArchive:{version:1,totalSessions:0,months:{}},
  patrickTeachingOnboardingVersion:0,
  patrickSetupWizardVersion:0,
  patrickGermanVoice:'auto'
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

let progress={},trials={},history=[],historyArchive={version:1,totalSessions:0,months:{}},currentLevel=0,dayType='Todo el día',filter='Todos';
let dogProfile={name:'',breed:'Pastor Alemán'};
let trainingContext={environment:'Casa',distraction:'Baja'},germanVoicePreference='auto';
let session=null,toastTimer=null;

function emptyHistoryArchive(){return{version:1,totalSessions:0,months:{}}}
function normalizeHistoryArchive(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return emptyHistoryArchive();
  const months=value.months&&typeof value.months==='object'&&!Array.isArray(value.months)?value.months:{};
  return{version:1,totalSessions:Math.max(0,Number(value.totalSessions)||0),months};
}
function archiveMonthKey(at){const d=new Date(at);return Number.isNaN(d.getTime())?'unknown':d.toISOString().slice(0,7)}
function archiveSessionInto(archive,item){
  const next=normalizeHistoryArchive(JSON.parse(JSON.stringify(archive||emptyHistoryArchive()))),key=archiveMonthKey(item?.at);
  const month=next.months[key]||{sessions:0,score:0,total:0,contexts:{},commands:{}};
  month.sessions++;
  const context=ENGINE?.contextLabel?ENGINE.contextLabel(item?.context||{}):'Casa · distracción baja';month.contexts[context]=(month.contexts[context]||0)+1;
  for(const [cmd,result] of Object.entries(item?.results||{})){
    const score=Number(result?.score)||0,total=Number(result?.total)||0;month.score+=score;month.total+=total;
    const command=month.commands[cmd]||{sessions:0,score:0,total:0,timedSessions:0,seconds:0};command.sessions++;command.score+=score;command.total+=total;
    if(item?.timingMode==='cue-to-rating'&&Number(result?.avgSeconds)>0){command.timedSessions++;command.seconds+=Number(result.avgSeconds)}
    month.commands[cmd]=command;
  }
  next.months[key]=month;next.totalSessions++;return next;
}
function compactHistory(candidate,archive=historyArchive,limit=200){
  const rows=[...(candidate||[])];let nextArchive=normalizeHistoryArchive(archive);
  for(const item of rows.slice(limit))nextArchive=archiveSessionInto(nextArchive,item);
  return{history:rows.slice(0,limit),archive:nextArchive};
}
function archivedSessionCount(){return Number(historyArchive?.totalSessions)||0}
function allSessionCount(){return history.length+archivedSessionCount()}

function dogName(){return String(dogProfile?.name||'').trim()||'Patrick'}
function displayCommand(c){const raw=typeof c==='string'?c:c?.cmd||'';return raw==='Patrick'?dogName():raw}
function displayPron(c){return c?.cmd==='Patrick'?dogName():c?.pron||''}
function stateOf(cmd){return progress[cmd]||'No iniciado'}
function commandBy(name){return COMMANDS.find(c=>c.cmd===name)||(name===dogName()?COMMANDS.find(c=>c.cmd==='Patrick'):undefined)}
function levelBy(n){return LEVELS.find(l=>l.n===n)}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}
function germanVoices(){
  if(!('speechSynthesis'in window))return[];
  return window.speechSynthesis.getVoices().filter(v=>String(v.lang||'').toLowerCase().startsWith('de')).sort((a,b)=>{
    const aDE=String(a.lang||'').toLowerCase()==='de-de'?0:1,bDE=String(b.lang||'').toLowerCase()==='de-de'?0:1;
    return aDE-bDE||String(a.name||'').localeCompare(String(b.name||''));
  });
}
function selectedGermanVoice(){
  const voices=germanVoices();
  if(germanVoicePreference&&germanVoicePreference!=='auto'){
    const selected=voices.find(v=>v.voiceURI===germanVoicePreference||v.name===germanVoicePreference);
    if(selected)return selected;
  }
  return voices.find(v=>String(v.lang||'').toLowerCase()==='de-de')||voices[0]||null;
}
function germanVoiceLabel(voice){return voice?(String(voice.name||'Voz alemana')+' · '+String(voice.lang||'de-DE')):'Voz alemana del sistema'}
function localGermanSpeech(text){return new Promise((resolve,reject)=>{if(!('speechSynthesis'in window)){reject(new Error('speechSynthesis unavailable'));return}try{const synth=window.speechSynthesis;synth.cancel();synth.resume();const de=selectedGermanVoice();const u=new SpeechSynthesisUtterance(text);u.lang=de?.lang||'de-DE';u.rate=.72;u.pitch=1;if(de)u.voice=de;u.onend=()=>resolve();u.onerror=e=>reject(e);synth.speak(u)}catch(e){reject(e)}})}
async function speak(c){const text=displayCommand(c).replace(/!/g,'').trim();if(!text)return;try{await localGermanSpeech(text)}catch(e){console.warn('Local German TTS failed',e);toast('No pude reproducir el audio. Instala o activa una voz alemana en el teléfono.')}}
function levelProgressFrom(n,source=progress){const level=levelBy(n),cmds=level?.commands||[];if(!cmds.length)return 0;return Math.round(cmds.reduce((a,x)=>a+STATE_SCORE[source[x]||'No iniciado']/4,0)/cmds.length*100)}
function levelProgress(n){return levelProgressFrom(n,progress)}
function levelReadyFrom(n,source=progress){const level=levelBy(n);return !!level&&level.commands.every(x=>STATE_SCORE[source[x]||'No iniciado']>=2)}
function levelReady(n){return levelReadyFrom(n,progress)}
function maxUnlockedLevelFrom(source=progress){
  const ordered=[...LEVELS].sort((a,b)=>a.n-b.n);if(!ordered.length)return 0;
  let unlocked=ordered[0].n;
  for(let i=0;i<ordered.length-1;i++){if(!levelReadyFrom(ordered[i].n,source))break;unlocked=ordered[i+1].n}
  return unlocked;
}
function maxUnlockedLevel(){return maxUnlockedLevelFrom(progress)}
function canActivateLevel(n){return Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=maxUnlockedLevel()&&!!levelBy(Number(n))}
function activateLevel(n,{silent=false}={}){
  const next=Number(n);
  if(!canActivateLevel(next)){if(!silent)toast('Completa el nivel anterior para desbloquear este nivel.');return false}
  currentLevel=next;store.set('patrickCurrentLevel',currentLevel);renderAll();if(!silent)toast(`Nivel ${currentLevel} activado`);return true;
}
function repairCurrentLevel({persist=true}={}){
  const unlocked=maxUnlockedLevel();
  if(levelBy(currentLevel)&&currentLevel<=unlocked)return false;
  currentLevel=unlocked;if(persist)store.set('patrickCurrentLevel',currentLevel);return true;
}
function totalProgress(){return Math.round(COMMANDS.reduce((a,c)=>a+STATE_SCORE[stateOf(c.cmd)]/4,0)/COMMANDS.length*100)}
function currentLevelSolidCount(){const level=levelBy(currentLevel);return (level?.commands||[]).filter(cmd=>STATE_SCORE[stateOf(cmd)]>=2).length}
function solidCount(){return COMMANDS.filter(c=>STATE_SCORE[stateOf(c.cmd)]>=2).length}
function commandLastPracticeMs(cmd){return ENGINE.lastPracticeMs(history,cmd)}
function commandRecentAverage(cmd){return ENGINE.recentAverage(trials,cmd)}
function trainingSafety(c){return ENGINE.safetyForCommand(c,dogProfile)}
function adaptivePriority(c,n){return ENGINE.adaptivePriority(c,n,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})}
function commandPriorityDetails(c,n=currentLevel){return ENGINE.priorityDetails(c,n,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})}
function commandContextEvidence(cmd){return ENGINE.commandContextEvidence(history,cmd)}
function recommendedTrainingContext(c){return ENGINE.recommendedContext(c,{progress,history,stateScore:STATE_SCORE})}
function focusForLevel(n){return ENGINE.focusForLevel(COMMANDS,n,{dayType,trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})}
function microPlan(){const focus=focusForLevel(currentLevel);return ENGINE.microPlan(COMMANDS,currentLevel,{dayType,progress,stateScore:STATE_SCORE,focus,profile:dogProfile})}
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});if(id==='progress')renderProgress();if(id==='commands')renderCommands();if(id==='levels')renderLevels()}
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
  repairCurrentLevel();const l=levelBy(currentLevel),ready=levelReady(currentLevel);renderDogIdentity();
  $('#headerLevel').textContent=`Nivel ${currentLevel} · ${l.title}`;
  $('#todaySummary').textContent=allSessionCount()===0?'Tu primera misión será corta. La constancia vale más que la duración.':dayType==='Solo noche'?'Una misión compacta con lo que más necesita refuerzo.':'Abre, entrena la misión y deja que el motor ajuste el resto.';
  $('#dayType').value=dayType;$('#levelBadge').textContent=`Nivel ${currentLevel}`;$('#readinessBadge').textContent=ready&&currentLevel<10?'Listo para avanzar':'En curso';$('#readinessBadge').classList.toggle('ready',ready);$('#sessionTitle').textContent=l.title;$('#sessionGoal').textContent=l.goal;
  const focus=focusForLevel(currentLevel).filter(c=>c&&String(c.cmd||'').trim());$('#focusCommands').innerHTML=focus.map(focusChipHtml).filter(Boolean).join('');
  const guidance=ENGINE.ageGuidance(dogProfile),ageBox=$('#ageGuidance');
  if(ageBox){ageBox.hidden=!guidance;if(guidance)ageBox.innerHTML=`<strong>${escapeHtml(guidance.label)}</strong><span>${escapeHtml(guidance.message)}</span>`}
  $('#metricProgress').textContent=levelProgress(currentLevel)+'%';$('#metricSolid').textContent=currentLevelSolidCount();$('#metricSessions').textContent=allSessionCount();
  $('#todayPlan').innerHTML=microPlan().map(([name,dur,goal,cmds],i)=>`<article class="planItem"><span class="planNumber">${i+1}</span><div><strong>${escapeHtml(name)} · ${escapeHtml(goal)}</strong><p>${cmds.map(c=>escapeHtml(displayCommand(c))).join(' · ')||'Juego y vínculo'}</p></div><small>${escapeHtml(dur)}</small></article>`).join('');
  $('#advanceCard').hidden=!(ready&&currentLevel<10);if(typeof renderSmartDailyPlan==='function')renderSmartDailyPlan();
}
function renderLevels(){
  const unlocked=maxUnlockedLevel();
  $('#levelList').innerHTML=LEVELS.map(l=>{
    const p=levelProgress(l.n),active=currentLevel===l.n,locked=l.n>unlocked,ready=levelReady(l.n);
    const status=active?'En curso':locked?'Bloqueado':ready?'Completado':'Disponible';
    const statusIcon=locked?icon('lock'):ready?icon('check'):active?icon('play'):icon('chevron');
    const preview=l.commands.slice(0,3).map(n=>{const c=commandBy(n);return `<span class="levelCommandChip"><b>${escapeHtml(displayCommand(c))}</b></span>`}).join('');
    const rest=Math.max(0,l.commands.length-3),more=rest?`<span class="levelCommandMore">+${rest}</span>`:'';
    const controls=locked
      ?'<span class="levelLocked" aria-label="Nivel bloqueado">'+icon('lock')+' Completa el anterior</span>'
      :`<button class="levelStartBtn" data-start-level="${l.n}" type="button">${icon('play')}<span>Iniciar</span></button>${active?'':`<button class="setLevelBtn" data-set-level="${l.n}" type="button">Usar como foco</button>`}`;
    return `<article class="levelCard levelCardV2 compactLevelCard ${active?'activeLevel':''} ${locked?'lockedLevel':''} ${ready?'completedLevel':''} ${!locked&&!active&&!ready?'availableLevel':''}">
      <div class="levelRouteHead"><span class="levelIndex">${l.n}</span><div class="levelTitleWrap"><small class="levelEyebrow">PASO ${l.n}</small><strong>${escapeHtml(l.title)}</strong><p>${escapeHtml(l.goal)}</p></div><span class="levelStatePill">${statusIcon}<b>${status}</b></span></div>
      <div class="levelCompactProgress"><div class="miniBar"><div style="width:${p}%"></div></div><strong>${p}%</strong></div>
      <div class="levelCompactBottom"><div class="levelCommandPreview">${preview}${more}</div><div class="levelActions">${controls}</div></div>
    </article>`;
  }).join('');
  $$('[data-set-level]').forEach(b=>b.onclick=()=>activateLevel(+b.dataset.setLevel));
  $$('[data-start-level]').forEach(b=>b.onclick=()=>{const n=+b.dataset.startLevel,commands=commandsForLevelStart(n),level=levelBy(n);openStartChoice(commands,{level:n,label:level?.title||'este nivel'})});
}
function categories(){return ['Todos',...new Set(COMMANDS.map(c=>c.category))]}
function commandCard(c){
  const shown=displayCommand(c),pron=displayPron(c),safety=trainingSafety(c);
  const safetyChip=safety?`<span class="tinyChip safetyChip">${escapeHtml(safety.label)}</span>`:'';
  const safetyRow=safety?`<div class="detailRow safetyDetail ${safety.deferFromAdaptive?'deferred':''}"><strong>Seguridad / etapa</strong><p>${escapeHtml(safety.message)}</p></div>`:'';
  return `<article class="commandCard" data-command="${escapeHtml(c.cmd)}"><div class="commandSummary"><div><div class="commandTitle"><strong>${escapeHtml(shown)}</strong><span class="pronunciation">${escapeHtml(pron)}</span></div><div class="commandMeaning">${escapeHtml(c.meaning)}</div><div class="commandMeta"><span class="tinyChip">Nivel ${c.level}</span><span class="tinyChip">${escapeHtml(c.category)}</span>${safetyChip}</div></div><div class="commandActions"><button class="audioBtn" data-audio="${escapeHtml(c.cmd)}" aria-label="Escuchar pronunciación de ${escapeHtml(shown)}">${icon('volume')}</button><button class="practiceBtn" data-practice="${escapeHtml(c.cmd)}" aria-label="Practicar ${escapeHtml(shown)}">${icon('play')}</button></div></div><button class="commandToggle" data-toggle="${escapeHtml(c.cmd)}" aria-expanded="false">Ver cómo enseñarlo <span>${icon('chevron')}</span></button><div class="commandDetails">${safetyRow}<div class="detailRow"><strong>Señal / gesto</strong><p>${escapeHtml(c.signal)}</p></div><div class="detailRow"><strong>Qué debe hacer</strong><p>${escapeHtml(c.action)}</p></div><div class="detailRow"><strong>Paso a paso</strong><p>${escapeHtml(c.how)}</p></div><div class="detailRow"><strong>Premio</strong><p>${escapeHtml(c.reward)}</p></div><div class="detailRow"><strong>Criterio de avance</strong><p>Primero necesita 8/10 puntos recientes para ser consistente. Después debe repetir buenos resultados en contextos y dificultades diferentes para generalizar y dominar.</p></div></div></article>`;
}
function renderCommands(){const q=$('#search').value.trim().toLowerCase();$('#filters').innerHTML=categories().map(x=>`<button class="filterBtn ${filter===x?'active':''}" data-filter="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');const arr=COMMANDS.filter(c=>(filter==='Todos'||c.category===filter)&&(`${displayCommand(c)} ${displayPron(c)} ${c.meaning} ${c.category}`).toLowerCase().includes(q));$('#commandList').innerHTML=arr.map(commandCard).join('')||'<p class="muted">No encontré comandos con ese filtro.</p>';$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderCommands()});$$('[data-audio]').forEach(b=>b.onclick=()=>speak(commandBy(b.dataset.audio)));$$('[data-practice]').forEach(b=>b.onclick=()=>{const command=commandBy(b.dataset.practice);openStartChoice([command],{label:displayCommand(command)})});$$('[data-toggle]').forEach(b=>b.onclick=()=>{const card=b.closest('.commandCard');card.classList.toggle('open');b.setAttribute('aria-expanded',String(card.classList.contains('open')))})}

window.PATRICK_READY=(async()=>{
  await ensureV6Dependencies();
  await store.hydrate();progress=store.get('patrickProgress',{})||{};trials=store.get('patrickTrials',{})||{};history=store.get('patrickHistory',[])||[];historyArchive=normalizeHistoryArchive(store.get('patrickHistoryArchive',emptyHistoryArchive()));currentLevel=Number(store.get('patrickCurrentLevel',0))||0;dayType=store.get('patrickDayType','Todo el día')||'Todo el día';dogProfile=store.get('patrickDogProfile',null)||{name:'',breed:'Pastor Alemán'};trainingContext=ENGINE.normalizeContext(store.get('patrickTrainingContext',trainingContext));germanVoicePreference=String(store.get('patrickGermanVoice','auto')||'auto');
  if(repairCurrentLevel({persist:false}))await store.set('patrickCurrentLevel',currentLevel)
  const hasExistingData=Object.keys(progress).length>0||Object.keys(trials).length>0||history.length>0||currentLevel>0;
  if(!String(dogProfile?.name||'').trim()&&hasExistingData){dogProfile={...dogProfile,name:'Patrick',breed:'Pastor Alemán'};store.set('patrickDogProfile',dogProfile)}
})();
