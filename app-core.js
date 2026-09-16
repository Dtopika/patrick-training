const COMMANDS=window.PATRICK_COMMANDS;
const LEVELS=window.PATRICK_LEVELS;
const STATES=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
const STATE_SCORE={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const STORAGE_DEFAULTS={
  patrickProgress:{},
  patrickTrials:{},
  patrickHistory:[],
  patrickCurrentLevel:0,
  patrickDayType:'Todo el día',
  patrickDark:false,
  patrickDogProfile:null
};
const memoryStore={};
let storageMode='pending';
const store={
  async hydrate(){
    try{
      await window.PatrickDB.open();
      await window.PatrickDB.migrateLocalStorage(Object.keys(STORAGE_DEFAULTS));
      for(const [key,fallback] of Object.entries(STORAGE_DEFAULTS)){
        const value=await window.PatrickDB.get(key);
        memoryStore[key]=value===undefined?fallback:value;
      }
      storageMode='indexeddb';
    }catch(e){
      console.warn('IndexedDB unavailable; using localStorage fallback',e);
      for(const [key,fallback] of Object.entries(STORAGE_DEFAULTS)){
        try{memoryStore[key]=JSON.parse(localStorage.getItem(key))??fallback}catch{memoryStore[key]=fallback}
      }
      storageMode='localStorage';
    }
  },
  get(k,d){return Object.prototype.hasOwnProperty.call(memoryStore,k)?memoryStore[k]:d},
  set(k,v){
    memoryStore[k]=v;
    if(storageMode==='indexeddb')window.PatrickDB.set(k,v).catch(e=>{console.warn('IndexedDB write failed; mirroring to localStorage',e);try{localStorage.setItem(k,JSON.stringify(v))}catch{}});
    else try{localStorage.setItem(k,JSON.stringify(v))}catch{}
  },
  remove(k){
    delete memoryStore[k];
    if(storageMode==='indexeddb')window.PatrickDB.del(k).catch(console.warn);
    try{localStorage.removeItem(k)}catch{}
  }
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
async function speak(c){const text=displayCommand(c).replace(/!/g,'').trim();if(!text)return;try{if(navigator.onLine){await remoteGermanSpeech(text);return}}catch(e){console.warn('Remote German TTS failed, using local voice',e)}try{await localGermanSpeech(text)}catch(e){console.warn('German TTS unavailable',e);toast('No pude reproducir el audio. Revisa volumen o voz alemana del teléfono.')}}
function levelProgress(n){const cmds=levelBy(n).commands;if(!cmds.length)return 0;return Math.round(cmds.reduce((a,x)=>a+STATE_SCORE[stateOf(x)]/4,0)/cmds.length*100)}
function levelReady(n){return levelBy(n).commands.every(x=>STATE_SCORE[stateOf(x)]>=2)}
function totalProgress(){return Math.round(COMMANDS.reduce((a,c)=>a+STATE_SCORE[stateOf(c.cmd)]/4,0)/COMMANDS.length*100)}
function solidCount(){return COMMANDS.filter(c=>STATE_SCORE[stateOf(c.cmd)]>=2).length}
function focusForLevel(n){const names=levelBy(n).commands;const pending=names.map(commandBy).filter(c=>STATE_SCORE[stateOf(c.cmd)]<2);return (pending.length?pending:names.map(commandBy)).slice(0,dayType==='Solo noche'?2:3)}
function microPlan(){const f=focusForLevel(currentLevel);const known=COMMANDS.filter(c=>c.level<currentLevel&&STATE_SCORE[stateOf(c.cmd)]>=2).slice(-2);if(dayType==='Solo noche')return[
['Al llegar','4–5 min','Nuevo + fácil',[f[0],known.at(-1)].filter(Boolean)],
['Más tarde','4–5 min','Segundo foco + repaso',[f[1]||f[0],known.at(-2)].filter(Boolean)],
['Antes de dormir','1–2 min','Una victoria fácil',[known.at(-1)||f[0]].filter(Boolean)]
];return[
['Mañana','3–5 min','Foco principal',[f[0],known.at(-1)].filter(Boolean)],
['Mediodía','3–5 min','Control / calma',[f.find(c=>['Control','Autocontrol','Casa'].includes(c.category))||f[1]||f[0]].filter(Boolean)],
['Tarde','3–5 min','Segundo foco',[f[1]||f[0]].filter(Boolean)],
['Noche','2–4 min','Repaso fácil + juego',[known.at(-1)||f.at(-1)].filter(Boolean)]
]}
function setView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));scrollTo({top:0,behavior:'smooth'});if(id==='progress')renderProgress();if(id==='commands')renderCommands();if(id==='levels')renderLevels()}
function renderDogIdentity(){
  const name=dogName();
  if($('#dogNameHeader'))$('#dogNameHeader').textContent=name;
  if($('#todayHeading'))$('#todayHeading').textContent=`Hoy con ${name}`;
  if($('#advanceTitle'))$('#advanceTitle').textContent=`${name} está listo para avanzar`;
  if($('#dogProfileName'))$('#dogProfileName').textContent=name;
  if($('#storageModeLabel'))$('#storageModeLabel').textContent=storageMode==='indexeddb'?'IndexedDB':'almacenamiento local';
}
function renderToday(){const l=levelBy(currentLevel),ready=levelReady(currentLevel);renderDogIdentity();$('#headerLevel').textContent=`Nivel ${currentLevel} · ${l.title}`;$('#todaySummary').textContent=dayType==='Solo noche'?'Plan corto para cuando llegas en la noche.':'Micro-sesiones repartidas durante el día.';$('#dayType').value=dayType;$('#levelBadge').textContent=`Nivel ${currentLevel}`;$('#readinessBadge').textContent=ready&&currentLevel<10?'Listo para avanzar':'En curso';$('#readinessBadge').classList.toggle('ready',ready);$('#sessionTitle').textContent=l.title;$('#sessionGoal').textContent=l.goal;const focus=focusForLevel(currentLevel);$('#focusCommands').innerHTML=focus.map(c=>`<span class="focusChip">${escapeHtml(displayCommand(c))} <small>${escapeHtml(displayPron(c))}</small></span>`).join('');$('#metricProgress').textContent=totalProgress()+'%';$('#metricSolid').textContent=solidCount();$('#metricSessions').textContent=history.length;$('#todayPlan').innerHTML=microPlan().map(([name,dur,goal,cmds],i)=>`<article class="planItem"><span class="planNumber">${i+1}</span><div><strong>${name} · ${goal}</strong><p>${cmds.map(c=>displayCommand(c)).join(' · ')||'Juego y vínculo'}</p></div><small>${dur}</small></article>`).join('');const adv=$('#advanceCard');adv.hidden=!(ready&&currentLevel<10)}
function renderLevels(){$('#levelList').innerHTML=LEVELS.map(l=>{const p=levelProgress(l.n);return `<article class="levelCard ${currentLevel===l.n?'activeLevel':''}"><div class="levelTop"><span class="levelIndex">${l.n}</span><div class="levelTitleWrap"><strong>${escapeHtml(l.title)}</strong><small>${escapeHtml(l.goal)}</small></div><span class="levelProgress">${p}%</span></div><div class="miniBar"><div style="width:${p}%"></div></div><div class="levelCommands">${l.commands.map(n=>{const c=commandBy(n);return `<span class="tinyChip">${escapeHtml(displayCommand(c))} · ${escapeHtml(displayPron(c))}</span>`}).join('')}</div><div class="levelActions">${currentLevel===l.n?'<span class="badge">Nivel activo</span>':`<button class="setLevelBtn" data-set-level="${l.n}">Trabajar este nivel</button>`}</div></article>`}).join('');$$('[data-set-level]').forEach(b=>b.onclick=()=>{currentLevel=+b.dataset.setLevel;store.set('patrickCurrentLevel',currentLevel);renderAll();toast(`Nivel ${currentLevel} activado`)})}
function categories(){return ['Todos',...new Set(COMMANDS.map(c=>c.category))]}
function commandCard(c){const shown=displayCommand(c),pron=displayPron(c);return `<article class="commandCard" data-command="${escapeHtml(c.cmd)}"><div class="commandSummary"><div><div class="commandTitle"><strong>${escapeHtml(shown)}</strong><span class="pronunciation">${escapeHtml(pron)}</span></div><div class="commandMeaning">${escapeHtml(c.meaning)}</div><div class="commandMeta"><span class="tinyChip">Nivel ${c.level}</span><span class="tinyChip">${escapeHtml(c.category)}</span></div></div><div class="commandActions"><button class="audioBtn" data-audio="${escapeHtml(c.cmd)}" aria-label="Escuchar ${escapeHtml(shown)}">🔊</button><button class="practiceBtn" data-practice="${escapeHtml(c.cmd)}" aria-label="Practicar ${escapeHtml(shown)}">▶</button></div></div><button class="commandToggle" data-toggle="${escapeHtml(c.cmd)}">Ver cómo enseñarlo <span>＋</span></button><div class="commandDetails"><div class="detailRow"><strong>Señal / gesto</strong><p>${escapeHtml(c.signal)}</p></div><div class="detailRow"><strong>Qué debe hacer</strong><p>${escapeHtml(c.action)}</p></div><div class="detailRow"><strong>Paso a paso</strong><p>${escapeHtml(c.how)}</p></div><div class="detailRow"><strong>Premio</strong><p>${escapeHtml(c.reward)}</p></div><div class="detailRow"><strong>Criterio de avance</strong><p>Acumula al menos 8 aciertos en las últimas 10 repeticiones antes de subir dificultad.</p></div></div></article>`}
function renderCommands(){const q=$('#search').value.trim().toLowerCase();$('#filters').innerHTML=categories().map(x=>`<button class="filterBtn ${filter===x?'active':''}" data-filter="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');const arr=COMMANDS.filter(c=>(filter==='Todos'||c.category===filter)&&(`${displayCommand(c)} ${displayPron(c)} ${c.meaning} ${c.category}`).toLowerCase().includes(q));$('#commandList').innerHTML=arr.map(commandCard).join('')||'<p class="muted">No encontré comandos con ese filtro.</p>';$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderCommands()});$$('[data-audio]').forEach(b=>b.onclick=()=>speak(commandBy(b.dataset.audio)));$$('[data-practice]').forEach(b=>b.onclick=()=>startSession([commandBy(b.dataset.practice)]));$$('[data-toggle]').forEach(b=>b.onclick=()=>{const card=b.closest('.commandCard');card.classList.toggle('open');b.querySelector('span').textContent=card.classList.contains('open')?'−':'＋'})}

window.PATRICK_READY=(async()=>{
  await store.hydrate();
  progress=store.get('patrickProgress',{})||{};
  trials=store.get('patrickTrials',{})||{};
  history=store.get('patrickHistory',[])||[];
  currentLevel=Number(store.get('patrickCurrentLevel',0))||0;
  dayType=store.get('patrickDayType','Todo el día')||'Todo el día';
  dogProfile=store.get('patrickDogProfile',null)||{name:'',breed:'Pastor Alemán'};
  const hasExistingData=Object.keys(progress).length>0||Object.keys(trials).length>0||history.length>0||currentLevel>0;
  if(!String(dogProfile?.name||'').trim()&&hasExistingData){dogProfile={name:'Patrick',breed:'Pastor Alemán'};store.set('patrickDogProfile',dogProfile)}
})();
