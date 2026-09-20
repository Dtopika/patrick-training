const DEFAULT_EXECUTIONS_PER_COMMAND=5;
const OUTCOME_SCORE={missed:0,assisted:.5,achieved:1};
const OUTCOME_LABEL={missed:'No logrado',assisted:'Con ayuda',achieved:'Logrado'};
let executionTimerId=null,sessionAdvanceTimeoutId=null,executionStartedAt=0,executionElapsedMs=0,executionReadyForRating=false,sessionAdvancing=false,lastRatedExecution=null;
let pendingStartRequest=null,startChoiceMode='recommended';

function clearSessionAdvanceTimer(){if(sessionAdvanceTimeoutId){clearTimeout(sessionAdvanceTimeoutId);sessionAdvanceTimeoutId=null}}
function applyRollingToState(nextTrials,nextProgress,cmd,score){
  const arr=Array.isArray(nextTrials[cmd])?[...nextTrials[cmd]]:[];arr.push(Number(score)||0);nextTrials[cmd]=arr.slice(-10);
  const current=nextProgress[cmd]||'No iniciado';
  if(current==='No iniciado')nextProgress[cmd]='En práctica';
  const points=nextTrials[cmd].reduce((a,b)=>a+(Number(b)||0),0);
  if(nextTrials[cmd].length>=10&&points>=8&&STATE_SCORE[nextProgress[cmd]||'No iniciado']<2)nextProgress[cmd]='Consistente';
}
function levelReadyWithProgress(n,nextProgress){return levelBy(n).commands.every(cmd=>STATE_SCORE[nextProgress[cmd]||'No iniciado']>=2)}
function ensureSessionContextUI(){
  if($('#sessionContext'))return;
  const target=$('#sessionSafety'),box=document.createElement('section');box.id='sessionContext';box.className='sessionContext';
  box.innerHTML='<div class="sessionContextHead"><div><strong>Contexto de esta sesión</strong><small id="sessionContextSuggestion">La app sugerirá una dificultad.</small></div><span class="contextEvidenceBadge">Evidencia</span></div><div class="sessionContextGrid"><label><span>Entorno</span><select id="sessionEnvironment">'+ENGINE.CONTEXT_ENVIRONMENTS.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')+'</select></label><label><span>Distracción</span><select id="sessionDistraction">'+ENGINE.CONTEXT_DISTRACTIONS.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')+'</select></label></div><small class="sessionContextNote">Se bloquea al registrar la primera ejecución para que toda la sesión tenga el mismo contexto.</small>';
  target.insertAdjacentElement('afterend',box);
  $('#sessionEnvironment').onchange=updateSessionContextFromUI;$('#sessionDistraction').onchange=updateSessionContextFromUI;
}
function ensureExecutionUI(){
  ensureSessionContextUI();
  if($('#executionCoach'))return;
  const target=$('#sessionMeaning'),box=document.createElement('section');box.id='executionCoach';box.className='executionCoach';
  box.innerHTML='<div class="executionTop"><div><small id="executionLabel">EJECUCIÓN 1 DE 4</small><strong id="executionTimer">00:00.0</strong></div><span id="executionState" class="executionState">Listo</span></div><div id="executionDots" class="executionDots" aria-label="Progreso de ejecuciones"></div><p id="executionHint" class="executionHint"></p><button id="startExecutionBtn" class="executionStartBtn" type="button">▶ Iniciar ejecución</button><button id="undoExecutionBtn" class="executionUndoBtn" type="button" hidden>↶ Deshacer último resultado</button>';
  target.insertAdjacentElement('afterend',box);
}
function formatExecutionTime(ms){const total=Math.max(0,ms)/1000,min=Math.floor(total/60),sec=Math.floor(total%60),tenth=Math.floor((total%1)*10);return`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}`}
function stopExecutionTimer({capture=true}={}){if(executionTimerId){clearInterval(executionTimerId);executionTimerId=null}if(capture&&executionStartedAt)executionElapsedMs=performance.now()-executionStartedAt;executionStartedAt=0}
function updateExecutionClock(){if(!executionStartedAt)return;executionElapsedMs=performance.now()-executionStartedAt;const el=$('#executionTimer');if(el)el.textContent=formatExecutionTime(executionElapsedMs)}
function startExecutionTimer(){stopExecutionTimer({capture:false});executionElapsedMs=0;executionStartedAt=performance.now();updateExecutionClock();executionTimerId=setInterval(updateExecutionClock,100)}
function outcomeMark(outcome){if(outcome==='achieved')return icon('check');if(outcome==='assisted')return icon('help');return icon('x')}
function executionTarget(command=session?.commands?.[session?.index]){return command?Number(session?.targets?.[command.cmd])||DEFAULT_EXECUTIONS_PER_COMMAND:DEFAULT_EXECUTIONS_PER_COMMAND}
function sessionTargetTotal(){return session?session.commands.reduce((sum,c)=>sum+executionTarget(c),0):0}
function completedBeforeCurrent(){return session?session.commands.slice(0,session.index).reduce((sum,c)=>sum+executionTarget(c),0):0}
function updateExecutionDots(){
  const c=session.commands[session.index],results=session.results[c.cmd]||[],target=executionTarget(c);
  $('#executionDots').innerHTML=Array.from({length:target},(_,i)=>{const outcome=results[i],current=!outcome&&i===session.trial;return `<span class="${current?'current':''} ${outcome||''}">${outcome?outcomeMark(outcome):i+1}</span>`}).join('');
}
function setOutcomeButtonsDisabled(disabled){['#missedBtn','#assistedBtn','#correctBtn'].forEach(id=>{const b=$(id);if(b)b.disabled=disabled})}
function setUndoExecutionVisible(visible){const button=$('#undoExecutionBtn');if(button)button.hidden=!visible}
function setStartExecutionVisible(visible){const button=$('#startExecutionBtn');if(button)button.hidden=!visible}
function prepareExecution(){
  stopExecutionTimer({capture:false});executionElapsedMs=0;executionReadyForRating=false;sessionAdvancing=false;setOutcomeButtonsDisabled(true);setUndoExecutionVisible(false);setStartExecutionVisible(true);
  const state=$('#executionState');if(state){state.textContent='Listo';state.className='executionState'}const timer=$('#executionTimer');if(timer)timer.textContent='00:00.0';
}
function beginExecution(){
  if(!session||sessionAdvancing||executionReadyForRating)return;
  executionReadyForRating=true;setStartExecutionVisible(false);setOutcomeButtonsDisabled(false);
  const state=$('#executionState');if(state){state.textContent='En curso';state.className='executionState'}
  startExecutionTimer();
}
function setSessionContextLocked(locked){['#sessionEnvironment','#sessionDistraction'].forEach(id=>{const el=$(id);if(el)el.disabled=!!locked})}
function updateSessionContextFromUI(){
  if(!session||sessionAttemptCount()>0)return;
  session.context=ENGINE.normalizeContext({environment:$('#sessionEnvironment')?.value,distraction:$('#sessionDistraction')?.value});
}
function syncSessionContextUI(command){
  ensureSessionContextUI();if(!session)return;
  const context=ENGINE.normalizeContext(session.context),rec=recommendedTrainingContext(command);
  $('#sessionEnvironment').value=context.environment;$('#sessionDistraction').value=context.distraction;
  $('#sessionContextSuggestion').textContent='Sugerencia para '+displayCommand(command)+': '+rec.label+'.';
  setSessionContextLocked(sessionAttemptCount()>0);
}
function updateExecutionUI(){
  ensureExecutionUI();const command=session.commands[session.index],target=executionTarget(command),current=Math.min(session.trial+1,target);
  $('#executionLabel').textContent=`EJECUCIÓN ${current} DE ${target}`;
  updateExecutionDots();
  const difficulty=ENGINE.difficultyTarget(command,stateOf(command.cmd),{stateScore:STATE_SCORE,context:session.context});
  $('#executionHint').textContent=`Objetivo: ${difficulty.target}. Pulsa “Iniciar ejecución” justo antes de dar la señal a ${dogName()}.`;
}
function inferSessionLevel(commands,fallback=currentLevel){
  const levels=[...new Set((commands||[]).map(c=>Number(c?.level)).filter(Number.isInteger))];
  return levels.length===1?levels[0]:Number(fallback)||0;
}
function commandsForLevelStart(levelNumber){
  const level=levelBy(levelNumber);if(!level)return[];
  const count=dayType==='Solo noche'?2:3;
  return level.commands.map(commandBy).filter(Boolean).filter(c=>!trainingSafety(c)?.deferFromAdaptive).sort((a,b)=>adaptivePriority(b,levelNumber)-adaptivePriority(a,levelNumber)).slice(0,count);
}
function setStartChoiceMode(mode){
  startChoiceMode=mode==='last'?'last':'recommended';
  $$('[data-start-mode]').forEach(button=>{const selected=button.dataset.startMode===startChoiceMode;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected))});
}
function closeStartChoice(){
  pendingStartRequest=null;startChoiceMode='recommended';
  const dialog=$('#startChoiceDialog');if(dialog?.open)dialog.close();
}
function openStartChoice(cmds,{level=null,label='esta sesión'}={}){
  const commands=(Array.isArray(cmds)?cmds:[]).filter(c=>c&&typeof c.cmd==='string');if(!commands.length)return;
  const sessionLevel=Number.isInteger(Number(level))?Number(level):inferSessionLevel(commands,currentLevel);
  const recommended=recommendedTrainingContext(commands[0]),last=ENGINE.normalizeContext(trainingContext);
  pendingStartRequest={commands,level:sessionLevel,recommended,last,label};
  $('#startChoiceSubtitle').textContent=level===null?`Vas a practicar ${label}.`:`Nivel ${level} · ${label}`;
  $('#recommendedStartLabel').textContent=recommended.label;
  $('#lastStartLabel').textContent=ENGINE.contextLabel(last);
  setStartChoiceMode('recommended');
  const dialog=$('#startChoiceDialog');if(!dialog.open)dialog.showModal();
}
function confirmStartChoice(){
  if(!pendingStartRequest)return;
  const request=pendingStartRequest,context=startChoiceMode==='last'?request.last:request.recommended;
  pendingStartRequest=null;
  const dialog=$('#startChoiceDialog');if(dialog?.open)dialog.close();
  startSession(request.commands,{context,sessionLevel:request.level});
}

function startSession(cmds=focusForLevel(currentLevel),options={}){
  const safeCommands=(Array.isArray(cmds)?cmds:[]).filter(c=>c&&typeof c.cmd==='string');if(!safeCommands.length)return;
  clearSessionAdvanceTimer();stopExecutionTimer();sessionAdvancing=false;
  const sessionLevel=Number.isInteger(Number(options.sessionLevel))?Number(options.sessionLevel):inferSessionLevel(safeCommands,currentLevel);
  session={commands:safeCommands,level:sessionLevel,index:0,trial:0,results:{},timings:{},targets:{},context:ENGINE.normalizeContext(options.context||trainingContext)};
  safeCommands.forEach(c=>{session.results[c.cmd]=[];session.timings[c.cmd]=[];session.targets[c.cmd]=ENGINE.recommendedAttempts(c,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})});
  $('#sessionDialog').showModal();renderSessionStep();
}
function renderSessionStep(){
  if(!session)return;
  const c=session.commands[session.index],total=session.commands.length;
  $('#sessionCounter').textContent=`Comando ${session.index+1} de ${total}`;$('#sessionCommandTitle').textContent=displayCommand(c);$('#sessionCategory').textContent=`Nivel ${c.level} · ${c.category}`;$('#sessionPron').textContent=displayPron(c);$('#sessionMeaning').textContent=c.meaning;$('#sessionSignal').textContent=c.signal;$('#sessionAction').textContent=c.action;$('#sessionHow').textContent=c.how;$('#sessionReward').textContent=c.reward;
  const safety=trainingSafety(c),safetyBox=$('#sessionSafety');if(safetyBox){safetyBox.hidden=!safety;safetyBox.classList.toggle('deferred',!!safety?.deferFromAdaptive);if(safety)safetyBox.innerHTML=`<strong>${escapeHtml(safety.label)}</strong><span>${escapeHtml(safety.message)}</span>`}
  const done=completedBeforeCurrent()+session.trial,targetTotal=sessionTargetTotal();$('#sessionProgressBar').style.width=`${Math.round(done/Math.max(1,targetTotal)*100)}%`;
  lastRatedExecution=null;syncSessionContextUI(c);$('#sessionAudioBtn').onclick=()=>speak(c);updateExecutionUI();prepareExecution();
}
function rateExecution(outcome){
  if(!session||sessionAdvancing||!executionReadyForRating||!(outcome in OUTCOME_SCORE))return;
  sessionAdvancing=true;executionReadyForRating=false;setOutcomeButtonsDisabled(true);stopExecutionTimer();
  const c=session.commands[session.index],ratedMs=executionElapsedMs;
  lastRatedExecution={commandIndex:session.index,cmd:c.cmd,trialBefore:session.trial,outcome,elapsedMs:ratedMs};
  session.results[c.cmd].push(outcome);session.timings[c.cmd].push(ratedMs);session.trial++;setSessionContextLocked(true);
  $('#executionTimer').textContent=formatExecutionTime(ratedMs);const state=$('#executionState');state.textContent=OUTCOME_LABEL[outcome];state.className=`executionState ${outcome}`;updateExecutionDots();setUndoExecutionVisible(true);
  const done=completedBeforeCurrent()+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/Math.max(1,sessionTargetTotal())*100)}%`;
  clearSessionAdvanceTimer();
  sessionAdvanceTimeoutId=setTimeout(()=>{
    sessionAdvanceTimeoutId=null;lastRatedExecution=null;setUndoExecutionVisible(false);if(!session)return;
    const target=executionTarget(c);if(session.trial>=target){toast(`${displayCommand(c)} · ${target} ejecuciones registradas`);session.index++;session.trial=0;if(session.index>=session.commands.length){finishSession();return}}
    renderSessionStep();
  },1600);
}
function undoLastExecution(){
  if(!session||!lastRatedExecution)return;
  clearSessionAdvanceTimer();
  const last=lastRatedExecution,c=session.commands[last.commandIndex];
  if(!c||c.cmd!==last.cmd||session.index!==last.commandIndex)return;
  const results=session.results[last.cmd]||[],timings=session.timings[last.cmd]||[];
  if(results.length)results.pop();if(timings.length)timings.pop();
  session.trial=Math.max(0,last.trialBefore);executionElapsedMs=last.elapsedMs;lastRatedExecution=null;sessionAdvancing=false;executionReadyForRating=true;setOutcomeButtonsDisabled(false);setUndoExecutionVisible(false);setStartExecutionVisible(false);
  setSessionContextLocked(sessionAttemptCount()>0);
  const done=completedBeforeCurrent()+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/Math.max(1,sessionTargetTotal())*100)}%`;
  updateExecutionUI();const state=$('#executionState');state.textContent='Corrige resultado';state.className='executionState';$('#executionTimer').textContent=formatExecutionTime(executionElapsedMs);toast('Resultado deshecho; vuelve a calificarlo');
}
function sessionAttemptCount(){return session?Object.values(session.results).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0):0}
function resultOutcomeScores(result){
  if(Array.isArray(result?.outcomes)&&result.outcomes.every(x=>x in OUTCOME_SCORE))return result.outcomes.map(x=>OUTCOME_SCORE[x]);
  return[
    ...Array(Math.max(0,Number(result?.achieved)||0)).fill(1),
    ...Array(Math.max(0,Number(result?.assisted)||0)).fill(.5),
    ...Array(Math.max(0,Number(result?.missed)||0)).fill(0)
  ];
}
function rebuildCommandEvidence(cmd,nextHistory){
  let rolling=[],state='No iniciado';const seen=[];
  const chronological=[...nextHistory].sort((a,b)=>Date.parse(a.at||'')-Date.parse(b.at||''));
  for(const item of chronological){
    seen.push(item);const result=item?.results?.[cmd];if(!result)continue;
    for(const score of resultOutcomeScores(result)){rolling.push(score);rolling=rolling.slice(-10)}
    state=ENGINE.nextProgressState(cmd,state,{trials:{[cmd]:rolling},history:seen,stateScore:STATE_SCORE});
  }
  return{trials:rolling,state};
}
async function replaceHistoryAndRebuild(nextHistory,affectedCommands){
  const compacted=compactHistory(nextHistory,historyArchive),cleanHistory=compacted.history,nextArchive=compacted.archive,nextTrials=Object.fromEntries(Object.entries(trials).map(([cmd,list])=>[cmd,Array.isArray(list)?[...list]:[]])),nextProgress={...progress};
  for(const cmd of new Set(affectedCommands||[])){
    const rebuilt=rebuildCommandEvidence(cmd,cleanHistory);nextTrials[cmd]=rebuilt.trials;
    if(rebuilt.state==='No iniciado')delete nextProgress[cmd];else nextProgress[cmd]=rebuilt.state;
  }
  const frontier=maxUnlockedLevelFrom(nextProgress),nextLevel=Math.min(currentLevel,frontier);
  await store.setMany({patrickHistory:cleanHistory,patrickHistoryArchive:nextArchive,patrickTrials:nextTrials,patrickProgress:nextProgress,patrickCurrentLevel:nextLevel});
  history=cleanHistory;historyArchive=nextArchive;trials=nextTrials;progress=nextProgress;currentLevel=nextLevel;renderAll();
}
function requestExitSession(){
  if(!session){$('#sessionDialog').close();return}
  const attempts=sessionAttemptCount(),message=attempts?'¿Salir de la sesión? Las ejecuciones de esta sesión no se guardarán.':'¿Salir de la sesión actual?';
  if(!confirm(message))return;
  clearSessionAdvanceTimer();stopExecutionTimer();executionReadyForRating=false;lastRatedExecution=null;setUndoExecutionVisible(false);setStartExecutionVisible(false);session=null;sessionAdvancing=false;setOutcomeButtonsDisabled(false);$('#sessionDialog').close();
}
async function finishSession(){
  if(!session)return;
  clearSessionAdvanceTimer();stopExecutionTimer();sessionAdvancing=true;setOutcomeButtonsDisabled(true);
  const activeSession=session,finishedLevel=Number(activeSession.level);
  const nextTrials=Object.fromEntries(Object.entries(trials).map(([cmd,list])=>[cmd,Array.isArray(list)?[...list]:[]])),nextProgress={...progress};
  for(const [cmd,outcomes] of Object.entries(activeSession.results))for(const outcome of outcomes)applyRollingToState(nextTrials,nextProgress,cmd,OUTCOME_SCORE[outcome]);
  const stamp={version:CONFIG.SESSION_SCHEMA_VERSION,at:new Date().toISOString(),level:finishedLevel,dogName:dogName(),timingMode:'cue-to-rating',results:{},timings:activeSession.timings,context:ENGINE.normalizeContext(activeSession.context)};
  Object.entries(activeSession.results).forEach(([cmd,arr])=>{const times=activeSession.timings[cmd]||[],counts={achieved:arr.filter(x=>x==='achieved').length,assisted:arr.filter(x=>x==='assisted').length,missed:arr.filter(x=>x==='missed').length};stamp.results[cmd]={...counts,total:arr.length,score:arr.reduce((a,x)=>a+OUTCOME_SCORE[x],0),avgSeconds:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length/100)/10:0,outcomes:[...arr]}});
  const compacted=compactHistory([stamp,...history],historyArchive),nextHistory=compacted.history,nextArchive=compacted.archive;
  for(const cmd of Object.keys(activeSession.results))nextProgress[cmd]=ENGINE.nextProgressState(cmd,nextProgress[cmd],{trials:nextTrials,history:nextHistory,stateScore:STATE_SCORE});
  const routeFrontierBefore=maxUnlockedLevelFrom(progress);
  const advanced=finishedLevel===currentLevel&&finishedLevel===routeFrontierBefore&&levelReadyWithProgress(finishedLevel,nextProgress)&&finishedLevel<maxRouteLevel(),nextLevel=advanced?finishedLevel+1:currentLevel;
  const nextTrainingContext=stamp.context;
  await store.setMany({patrickTrials:nextTrials,patrickProgress:nextProgress,patrickHistory:nextHistory,patrickHistoryArchive:nextArchive,patrickCurrentLevel:nextLevel,patrickTrainingContext:nextTrainingContext});
  trials=nextTrials;progress=nextProgress;history=nextHistory;historyArchive=nextArchive;currentLevel=nextLevel;trainingContext=nextTrainingContext;session=null;$('#sessionDialog').close();
  $('#finishSummary').textContent=advanced?`Nivel ${finishedLevel} completado. Nivel ${currentLevel} desbloqueado automáticamente.`:`Sesión guardada. Una práctica corta y clara ya cuenta para la racha de ${dogName()}.`;
  $('#finishResults').innerHTML=Object.entries(stamp.results).map(([cmd,r])=>{const c=commandBy(cmd);return `<div class="finishResult"><strong>${escapeHtml(displayCommand(c||cmd))}</strong><span>${r.achieved} logradas · ${r.assisted} con ayuda · ${r.missed} no logradas${r.avgSeconds?` · ${r.avgSeconds} s`:''}</span></div>`}).join('');
  $('#finishBtn').textContent=advanced?`Continuar · Nivel ${currentLevel}`:'Volver a Hoy';$('#finishDialog').showModal();renderAll();sessionAdvancing=false;
}
function renderAll(){renderToday();renderLevels();renderProgress();renderHabit();if($('#commands').classList.contains('active'))renderCommands();syncSettingsDrawer()}

function init(){
  ensureExecutionUI();initProfileUI();$('#dayType').value=dayType;
  $$('.bottomNav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
  $('#dayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);renderToday();syncSettingsDrawer()};
  const startToday=()=>{const level=levelBy(currentLevel),commands=focusForLevel(currentLevel);openStartChoice(commands,{level:currentLevel,label:level?.title||'sesión de hoy'})};
  $('#startSessionBtn').onclick=startToday;$('#firstSessionBtn').onclick=startToday;
  $('#advanceBtn').onclick=()=>{if(currentLevel<maxRouteLevel())activateLevel(currentLevel+1)};
  $$('[data-start-mode]').forEach(button=>button.onclick=()=>setStartChoiceMode(button.dataset.startMode));
  $('#cancelStartChoiceBtn').onclick=closeStartChoice;$('#closeStartChoiceBtn').onclick=closeStartChoice;$('#confirmStartChoiceBtn').onclick=confirmStartChoice;
  $('#startChoiceDialog').addEventListener('cancel',e=>{e.preventDefault();closeStartChoice()});$('#startChoiceDialog').addEventListener('click',e=>{if(e.target===$('#startChoiceDialog'))closeStartChoice()});
  $('#search').oninput=renderCommands;
  $('#closeSessionBtn').onclick=requestExitSession;$('#sessionDialog').addEventListener('cancel',e=>{e.preventDefault();requestExitSession()});
  $('#startExecutionBtn').onclick=beginExecution;$('#missedBtn').onclick=()=>rateExecution('missed');$('#assistedBtn').onclick=()=>rateExecution('assisted');$('#correctBtn').onclick=()=>rateExecution('achieved');$('#undoExecutionBtn').onclick=undoLastExecution;
  $('#finishBtn').onclick=()=>{$('#finishDialog').close();setView('today')};
  renderCommands();renderAll();document.dispatchEvent(new Event('patrick:ready'));
}
window.PATRICK_READY.then(init).catch(e=>{console.error('Patrick Training bootstrap failed',e);init()});
