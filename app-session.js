const EXECUTIONS_PER_COMMAND=5;
let executionTimerId=null,executionStartedAt=0,executionElapsedMs=0,sessionAdvancing=false;

function renderProgress(){const pct=totalProgress();renderDogIdentity();$('#progressPct').textContent=pct+'%';$('#progressRing').style.setProperty('--p',pct);$('#progressHeadline').textContent=pct===0?'Empezando':pct<35?'Construyendo bases':pct<70?'Buen progreso':'Obediencia avanzada';$('#progressText').textContent=`${solidCount()} de ${COMMANDS.length} comandos están consistentes o mejor.`;$('#progressList').innerHTML=COMMANDS.map(c=>`<article class="progressRow"><div><strong>${escapeHtml(displayCommand(c))} · <span class="pronunciation">${escapeHtml(displayPron(c))}</span></strong><small>Nivel ${c.level} · ${escapeHtml(c.meaning)}</small></div><select data-state="${escapeHtml(c.cmd)}">${STATES.map(s=>`<option ${stateOf(c.cmd)===s?'selected':''}>${s}</option>`).join('')}</select></article>`).join('');$$('[data-state]').forEach(s=>s.onchange=()=>{progress[s.dataset.state]=s.value;store.set('patrickProgress',progress);renderAll()})}
function updateRolling(cmd,correct){const arr=trials[cmd]||[];arr.push(correct?1:0);trials[cmd]=arr.slice(-10);store.set('patrickTrials',trials);if(stateOf(cmd)==='No iniciado'){progress[cmd]='En práctica'}if(trials[cmd].length>=10&&trials[cmd].reduce((a,b)=>a+b,0)>=8&&STATE_SCORE[stateOf(cmd)]<2){progress[cmd]='Consistente'}store.set('patrickProgress',progress)}
function ensureExecutionUI(){if($('#executionCoach'))return;const target=$('#sessionMeaning');const box=document.createElement('section');box.id='executionCoach';box.className='executionCoach';box.innerHTML='<div class="executionTop"><div><small id="executionLabel">EJECUCIÓN 1 DE 5</small><strong id="executionTimer">00:00.0</strong></div><span id="executionState" class="executionState">En curso</span></div><div id="executionDots" class="executionDots" aria-label="Progreso de ejecuciones"></div><p id="executionHint" class="executionHint"></p>';target.insertAdjacentElement('afterend',box);$('#correctBtn').textContent='✓ Hecho';$('#retryBtn').textContent='↺ Repetir'}
function formatExecutionTime(ms){const total=Math.max(0,ms)/1000;const min=Math.floor(total/60);const sec=Math.floor(total%60);const tenth=Math.floor((total%1)*10);return`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}`}
function stopExecutionTimer(){if(executionTimerId){clearInterval(executionTimerId);executionTimerId=null}if(executionStartedAt)executionElapsedMs=performance.now()-executionStartedAt}
function updateExecutionClock(){if(!executionStartedAt)return;executionElapsedMs=performance.now()-executionStartedAt;const el=$('#executionTimer');if(el)el.textContent=formatExecutionTime(executionElapsedMs)}
function startExecutionTimer(){stopExecutionTimer();executionElapsedMs=0;executionStartedAt=performance.now();updateExecutionClock();executionTimerId=setInterval(updateExecutionClock,100)}
function updateExecutionUI(){ensureExecutionUI();const current=Math.min(session.trial+1,EXECUTIONS_PER_COMMAND);$('#executionLabel').textContent=`EJECUCIÓN ${current} DE ${EXECUTIONS_PER_COMMAND}`;$('#trialCounter').textContent=`${current}/${EXECUTIONS_PER_COMMAND}`;$('#executionState').textContent='En curso';$('#executionState').classList.remove('done');$('#executionDots').innerHTML=Array.from({length:EXECUTIONS_PER_COMMAND},(_,i)=>`<span class="${i<session.trial?'done':i===session.trial?'current':''}">${i<session.trial?'✓':i+1}</span>`).join('');$('#executionHint').textContent=`El cronómetro empieza solo. Haz el ejercicio con ${dogName()} y toca ✓ Hecho cuando termine bien.`}
function startSession(cmds=focusForLevel(currentLevel)){if(!cmds.length)return;stopExecutionTimer();sessionAdvancing=false;session={commands:cmds,index:0,trial:0,results:{},timings:{}};cmds.forEach(c=>{session.results[c.cmd]=[];session.timings[c.cmd]=[]});$('#sessionDialog').showModal();renderSessionStep()}
function renderSessionStep(){const c=session.commands[session.index];const total=session.commands.length;$('#sessionCounter').textContent=`Comando ${session.index+1} de ${total}`;$('#sessionCommandTitle').textContent=displayCommand(c);$('#sessionCategory').textContent=`Nivel ${c.level} · ${c.category}`;$('#sessionPron').textContent=displayPron(c);$('#sessionMeaning').textContent=c.meaning;$('#sessionSignal').textContent=c.signal;$('#sessionAction').textContent=c.action;$('#sessionHow').textContent=c.how;$('#sessionReward').textContent=c.reward;const done=session.index*EXECUTIONS_PER_COMMAND+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/(total*EXECUTIONS_PER_COMMAND)*100)}%`;$('#sessionAudioBtn').onclick=()=>speak(c);updateExecutionUI();startExecutionTimer();sessionAdvancing=false;$('#correctBtn').disabled=false;$('#retryBtn').disabled=false}
function repeatExecution(){if(!session||sessionAdvancing)return;const c=session.commands[session.index];stopExecutionTimer();session.results[c.cmd].push(false);updateRolling(c.cmd,false);$('#executionState').textContent='Reintentando';toast('No cuenta como ejecución completada');startExecutionTimer()}
function completeExecution(){if(!session||sessionAdvancing)return;sessionAdvancing=true;$('#correctBtn').disabled=true;$('#retryBtn').disabled=true;stopExecutionTimer();const c=session.commands[session.index];session.results[c.cmd].push(true);session.timings[c.cmd].push(executionElapsedMs);updateRolling(c.cmd,true);session.trial++;$('#executionTimer').textContent=formatExecutionTime(executionElapsedMs);$('#executionState').textContent='✓ Hecho';$('#executionState').classList.add('done');$('#executionDots').innerHTML=Array.from({length:EXECUTIONS_PER_COMMAND},(_,i)=>`<span class="${i<session.trial?'done':i===session.trial?'current':''}">${i<session.trial?'✓':i+1}</span>`).join('');const done=session.index*EXECUTIONS_PER_COMMAND+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/(session.commands.length*EXECUTIONS_PER_COMMAND)*100)}%`;setTimeout(()=>{if(session.trial>=EXECUTIONS_PER_COMMAND){toast(`✓ ${displayCommand(c)} completado`);session.index++;session.trial=0;if(session.index>=session.commands.length){finishSession();return}}renderSessionStep()},420)}
function finishSession(){stopExecutionTimer();const finishedLevel=currentLevel;const stamp={at:new Date().toISOString(),level:finishedLevel,dogName:dogName(),results:{},timings:session.timings};Object.entries(session.results).forEach(([cmd,arr])=>{const times=session.timings[cmd]||[];stamp.results[cmd]={correct:arr.filter(Boolean).length,total:arr.length,avgSeconds:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length/100)/10:0}});history.unshift(stamp);history=history.slice(0,100);store.set('patrickHistory',history);$('#sessionDialog').close();let advanced=false;if(levelReady(finishedLevel)&&finishedLevel<10&&currentLevel===finishedLevel){currentLevel=finishedLevel+1;store.set('patrickCurrentLevel',currentLevel);advanced=true}$('#finishSummary').textContent=advanced?`Nivel ${finishedLevel} completado. Nivel ${currentLevel} desbloqueado automáticamente.`:`Guardé la sesión de ${dogName()}. Cuando todos los comandos del nivel estén consistentes, la app avanzará sola al siguiente nivel.`;$('#finishResults').innerHTML=Object.entries(stamp.results).map(([cmd,r])=>{const c=commandBy(cmd);return `<div class="finishResult"><strong>${escapeHtml(displayCommand(c||cmd))}</strong><span>${r.correct}/${r.total} · ${r.avgSeconds?r.avgSeconds+' s prom.':'—'}</span></div>`}).join('');$('#finishBtn').textContent=advanced?`Continuar · Nivel ${currentLevel}`:'Volver a Hoy';$('#finishDialog').showModal();renderAll()}
function renderAll(){renderToday();renderLevels();renderProgress();if($('#commands').classList.contains('active'))renderCommands();syncSettingsDrawer()}
function exportProgress(){const payload={version:3,exportedAt:new Date().toISOString(),profile:dogProfile,storage:storageMode,progress,trials,history,currentLevel,dayType};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`patrick-training-${dogName().toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'backup'}.json`;a.click();URL.revokeObjectURL(a.href);toast('Respaldo descargado')}
async function resetProgress(){
  if(!confirm('¿Borrar TODOS los datos de Patrick Training en este dispositivo? Se eliminarán perfil, progreso, historial y preferencias, y volverás a la configuración inicial.'))return;
  stopExecutionTimer();
  try{
    if(window.PatrickDB?.clearAll)await window.PatrickDB.clearAll();
  }catch(e){
    console.warn('No pude vaciar IndexedDB; continuaré limpiando el respaldo local.',e);
  }
  Object.keys(STORAGE_DEFAULTS).forEach(key=>{
    try{localStorage.removeItem(key)}catch{}
  });
  location.reload();
}
function openDogProfileEditor(firstRun=false){const dialog=$('#profileDialog');dialog.dataset.firstRun=firstRun?'1':'0';$('#profileDialogTitle').textContent=firstRun?'¿Cómo se llama tu pastor alemán?':`Perfil de ${dogName()}`;$('#profileDialogText').textContent=firstRun?'Patrick Training seguirá siendo el nombre de la app. El nombre de tu perro personalizará las sesiones, el comando de atención y el progreso.':'Puedes cambiar el nombre sin perder niveles, sesiones ni estadísticas.';$('#dogNameInput').value=firstRun&&!dogProfile?.name?'':dogName();$('#profileCancelBtn').hidden=firstRun;$('#saveProfileBtn').textContent=firstRun?'Guardar y empezar':'Guardar cambios';if(!dialog.open)dialog.showModal();setTimeout(()=>$('#dogNameInput').focus(),80)}
function saveDogProfile(){const input=$('#dogNameInput');const name=input.value.trim().replace(/\s+/g,' ').slice(0,24);if(!name){toast('Escribe el nombre de tu perro');input.focus();return}dogProfile={name,breed:'Pastor Alemán'};store.set('patrickDogProfile',dogProfile);$('#profileDialog').close();renderAll();renderCommands();toast(`Perfil de ${name} guardado`)}

function ensureSettingsDrawer(){
  $('#progress .dogProfileCard')?.remove();
  $('#progress .progressTools')?.remove();
  $('#themeBtn')?.remove();
  if($('#settingsDrawer'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <div id="settingsBackdrop" class="settingsBackdrop" hidden></div>
    <aside id="settingsDrawer" class="settingsDrawer" aria-hidden="true" aria-label="Configuración de Patrick Training">
      <header class="settingsDrawerHead">
        <img src="icons/icon-192.webp" alt="">
        <div class="settingsDrawerIdentity"><small>PERFIL ACTIVO</small><strong id="dogProfileName">${escapeHtml(dogName())}</strong><span>Pastor alemán</span></div>
        <button id="settingsCloseBtn" class="settingsCloseBtn" type="button" aria-label="Cerrar configuración">×</button>
      </header>
      <div class="settingsDrawerBody">
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Perro</div>
          <button id="editDogBtn" class="settingsRow" type="button">
            <span class="settingsRowIcon">🐕</span><span class="settingsRowCopy"><strong>Perfil del perro</strong><small>Cambia el nombre sin perder progreso.</small></span><span class="settingsChevron">›</span>
          </button>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Entrenamiento</div>
          <div class="settingsField"><label><span class="settingsRowIcon">☀️</span><span class="settingsRowCopy"><strong>Plan del día</strong><small>Ajusta la duración de las sesiones.</small></span></label><select id="settingsDayType"><option>Todo el día</option><option>Solo noche</option></select></div>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Apariencia</div>
          <button id="settingsThemeBtn" class="settingsRow" type="button">
            <span class="settingsRowIcon">◐</span><span class="settingsRowCopy"><strong>Tema</strong><small>Cambia entre claro y oscuro.</small></span><span id="settingsThemeValue" class="settingsValue">Claro</span>
          </button>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Datos</div>
          <div class="settingsMeta"><strong>Almacenamiento</strong><span id="storageModeLabel" class="storageBadge">IndexedDB</span></div>
          <button id="exportBtn" class="settingsRow" type="button">
            <span class="settingsRowIcon">⇩</span><span class="settingsRowCopy"><strong>Exportar respaldo</strong><small>Descarga perfil, progreso y sesiones.</small></span><span class="settingsChevron">›</span>
          </button>
          <button id="resetBtn" class="settingsRow settingsDanger" type="button">
            <span class="settingsRowIcon">↺</span><span class="settingsRowCopy"><strong>Reiniciar aplicación</strong><small>Borra los datos de este dispositivo y vuelve al inicio.</small></span><span class="settingsChevron">›</span>
          </button>
        </section>
      </div>
      <footer class="settingsDrawerFoot"><strong>Patrick Training</strong><span>v4.5</span></footer>
    </aside>`);
}
function syncSettingsDrawer(){
  if(!$('#settingsDrawer'))return;
  renderDogIdentity();
  if($('#settingsDayType'))$('#settingsDayType').value=dayType;
  if($('#settingsThemeValue'))$('#settingsThemeValue').textContent=document.body.classList.contains('dark')?'Oscuro':'Claro';
}
function openSettingsDrawer(){
  ensureSettingsDrawer();syncSettingsDrawer();
  const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');
  backdrop.hidden=false;drawer.setAttribute('aria-hidden','false');document.body.classList.add('settingsOpen');
  requestAnimationFrame(()=>{drawer.classList.add('open');backdrop.classList.add('open')});
  setTimeout(()=>$('#settingsCloseBtn')?.focus(),120);
}
function closeSettingsDrawer(){
  const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');if(!drawer)return;
  drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true');document.body.classList.remove('settingsOpen');
  setTimeout(()=>{if(!backdrop.classList.contains('open'))backdrop.hidden=true},280);
}
function toggleTheme(){document.body.classList.toggle('dark');store.set('patrickDark',document.body.classList.contains('dark'));syncSettingsDrawer()}
function bindSettingsDrawer(){
  const brand=$('.brand');if(brand){brand.title='Toca la foto para abrir configuración';brand.onclick=e=>{if(e.target.closest('.brandAvatar')){e.preventDefault();e.stopPropagation();openSettingsDrawer();return}setView(brand.dataset.go||'today')}}
  $('#settingsCloseBtn').onclick=closeSettingsDrawer;
  $('#settingsBackdrop').onclick=closeSettingsDrawer;
  $('#editDogBtn').onclick=()=>{closeSettingsDrawer();setTimeout(()=>openDogProfileEditor(false),180)};
  $('#settingsDayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);$('#dayType').value=dayType;renderToday();syncSettingsDrawer()};
  $('#settingsThemeBtn').onclick=toggleTheme;
  $('#exportBtn').onclick=exportProgress;
  $('#resetBtn').onclick=resetProgress;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#settingsDrawer')?.classList.contains('open'))closeSettingsDrawer()});
}

function init(){const savedDark=store.get('patrickDark',null);if(savedDark===true||(savedDark===null&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.body.classList.add('dark');ensureExecutionUI();ensureSettingsDrawer();$('#dayType').value=dayType;$$('.bottomNav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));bindSettingsDrawer();$('#dayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);renderToday();syncSettingsDrawer()};$('#startSessionBtn').onclick=()=>startSession();$('#advanceBtn').onclick=()=>{if(currentLevel<10){currentLevel++;store.set('patrickCurrentLevel',currentLevel);renderAll();toast(`Nivel ${currentLevel} activado`)}};$('#search').oninput=renderCommands;$('#closeSessionBtn').onclick=()=>{if(confirm('¿Salir de la sesión actual?')){stopExecutionTimer();$('#sessionDialog').close()}};$('#retryBtn').onclick=repeatExecution;$('#correctBtn').onclick=completeExecution;$('#finishBtn').onclick=()=>{$('#finishDialog').close();setView('today')};$('#saveProfileBtn').onclick=saveDogProfile;$('#profileCancelBtn').onclick=()=>$('#profileDialog').close();$('#dogNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDogProfile()}});$('#profileDialog').addEventListener('cancel',e=>{if($('#profileDialog').dataset.firstRun==='1')e.preventDefault()});renderCommands();renderAll();if(!String(dogProfile?.name||'').trim())setTimeout(()=>openDogProfileEditor(true),80)}
window.PATRICK_READY.then(init).catch(e=>{console.error('Patrick Training bootstrap failed',e);init()});
