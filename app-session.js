const DEFAULT_EXECUTIONS_PER_COMMAND=5;
const OUTCOME_SCORE={missed:0,assisted:.5,achieved:1};
function outcomeLabel(outcome){return outcome==='missed'?t('missed'):outcome==='assisted'?t('assisted'):t('achieved')}
let executionTimerId=null,sessionAdvanceTimeoutId=null,sessionStartedAt=0,sessionClockTimerId=null,sessionElapsedMs=0,executionStartedAt=0,executionElapsedMs=0,executionReadyForRating=false,sessionAdvancing=false,lastRatedExecution=null;
let pendingStartRequest=null,startChoiceMode='recommended';
const ACTIVE_SESSION_SNAPSHOT_VERSION=1,ACTIVE_SESSION_TTL_MS=12*60*60*1000;
let sessionWakeLock=null;

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
  const contextTitle=appLanguage==='en'?'Session context':appLanguage==='de'?'Kontext dieser Einheit':'Contexto de esta sesión',suggestion=appLanguage==='en'?'The app will suggest a difficulty.':appLanguage==='de'?'Die App schlägt eine Schwierigkeit vor.':'La app sugerirá una dificultad.',evidence=appLanguage==='en'?'Evidence':appLanguage==='de'?'Daten':'Evidencia',environment=appLanguage==='en'?'Environment':appLanguage==='de'?'Umgebung':'Entorno',distraction=appLanguage==='en'?'Distraction':appLanguage==='de'?'Ablenkung':'Distracción',note=appLanguage==='en'?'Locks after the first execution so the entire session keeps the same context.':appLanguage==='de'?'Wird nach der ersten Ausführung gesperrt, damit die ganze Einheit denselben Kontext behält.':'Se bloquea al registrar la primera ejecución para que toda la sesión tenga el mismo contexto.';
  box.innerHTML='<div class="sessionContextHead"><div><strong>'+escapeHtml(contextTitle)+'</strong><small id="sessionContextSuggestion">'+escapeHtml(suggestion)+'</small></div><span class="contextEvidenceBadge">'+escapeHtml(evidence)+'</span></div><div class="sessionContextGrid"><label><span>'+escapeHtml(environment)+'</span><select id="sessionEnvironment">'+ENGINE.CONTEXT_ENVIRONMENTS.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(displayEngineText(x))+'</option>').join('')+'</select></label><label><span>'+escapeHtml(distraction)+'</span><select id="sessionDistraction">'+ENGINE.CONTEXT_DISTRACTIONS.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(displayEngineText(x))+'</option>').join('')+'</select></label></div><small class="sessionContextNote">'+escapeHtml(note)+'</small>';
  target.insertAdjacentElement('afterend',box);
  $('#sessionEnvironment').onchange=updateSessionContextFromUI;$('#sessionDistraction').onchange=updateSessionContextFromUI;
}
function ensureExecutionUI(){
  ensureSessionContextUI();
  if($('#executionCoach'))return;
  const target=$('#sessionMeaning'),box=document.createElement('section');box.id='executionCoach';box.className='executionCoach';
  const ready=appLanguage==='en'?'Ready':appLanguage==='de'?'Bereit':'Listo',start=appLanguage==='en'?'▶ Start execution':appLanguage==='de'?'▶ Ausführung starten':'▶ Iniciar ejecución',undo=appLanguage==='en'?'↶ Undo last result':appLanguage==='de'?'↶ Letztes Ergebnis rückgängig':'↶ Deshacer último resultado';
  box.innerHTML='<div class="executionTop"><div><small id="executionLabel"></small><strong id="executionTimer">00:00.0</strong></div><span id="executionState" class="executionState">'+escapeHtml(ready)+'</span></div><div id="executionDots" class="executionDots" aria-label="Execution progress"></div><p id="executionHint" class="executionHint"></p><button id="startExecutionBtn" class="executionStartBtn" type="button">'+escapeHtml(start)+'</button><button id="undoExecutionBtn" class="executionUndoBtn" type="button" hidden>'+escapeHtml(undo)+'</button>';
  target.insertAdjacentElement('afterend',box);
}
function formatExecutionTime(ms){const total=Math.max(0,ms)/1000,min=Math.floor(total/60),sec=Math.floor(total%60),tenth=Math.floor((total%1)*10);return`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}`}
function formatSessionTime(ms){const seconds=Math.floor(Math.max(0,ms)/1000),min=Math.floor(seconds/60),sec=seconds%60;return`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function updateSessionClock(){if(sessionStartedAt)sessionElapsedMs=performance.now()-sessionStartedAt;const el=$('#sessionElapsed');if(el)el.textContent=formatSessionTime(sessionElapsedMs)}
function currentSessionElapsedMs(){return sessionStartedAt?Math.max(0,performance.now()-sessionStartedAt):Math.max(0,sessionElapsedMs)}
function startSessionClock(initialMs=0){if(sessionClockTimerId)clearInterval(sessionClockTimerId);sessionElapsedMs=Math.max(0,Number(initialMs)||0);sessionStartedAt=performance.now()-sessionElapsedMs;updateSessionClock();sessionClockTimerId=setInterval(updateSessionClock,1000)}
function activeSessionSnapshot(options={}){
  if(!session)return null;
  const wasRunning=options.wasRunning===undefined?executionReadyForRating:!!options.wasRunning;
  return{version:ACTIVE_SESSION_SNAPSHOT_VERSION,savedAt:new Date().toISOString(),commands:session.commands.map(c=>c.cmd),level:session.level,index:session.index,trial:session.trial,results:JSON.parse(JSON.stringify(session.results||{})),timings:JSON.parse(JSON.stringify(session.timings||{})),targets:{...(session.targets||{})},context:ENGINE.normalizeContext(session.context),elapsedMs:Math.round(currentSessionElapsedMs()),wasRunning};
}
function persistActiveSession(options){const snapshot=activeSessionSnapshot(options);if(snapshot)store.set('patrickActiveSession',snapshot)}
function clearActiveSessionSnapshot(){return store.set('patrickActiveSession',null)}
async function requestSessionWakeLock(){
  if(!session||document.visibilityState!=='visible'||!('wakeLock'in navigator))return false;
  try{if(sessionWakeLock&&!sessionWakeLock.released)return true;sessionWakeLock=await navigator.wakeLock.request('screen');sessionWakeLock.addEventListener?.('release',()=>{sessionWakeLock=null});return true}
  catch(e){sessionWakeLock=null;console.warn('Screen Wake Lock unavailable',e);return false}
}
async function releaseSessionWakeLock(){const lock=sessionWakeLock;sessionWakeLock=null;try{await lock?.release?.()}catch{}}
function hapticSessionResult(outcome){if(typeof navigator.vibrate!=='function')return;const pattern=outcome==='achieved'?18:outcome==='assisted'?[12,28,12]:[16,36,16];try{navigator.vibrate(pattern)}catch{}}
function normalizeRecoveredSession(snapshot){
  if(!snapshot||snapshot.version!==ACTIVE_SESSION_SNAPSHOT_VERSION)return null;
  const saved=Date.parse(snapshot.savedAt||'');if(!Number.isFinite(saved)||Date.now()-saved>ACTIVE_SESSION_TTL_MS)return null;
  const names=Array.isArray(snapshot.commands)?snapshot.commands:[],commands=names.map(commandBy).filter(Boolean);if(!commands.length||commands.length!==names.length)return null;
  const results={},timings={},targets={};
  for(const command of commands){
    const outcomes=Array.isArray(snapshot.results?.[command.cmd])?snapshot.results[command.cmd].filter(x=>x in OUTCOME_SCORE):[];
    const rawTimes=Array.isArray(snapshot.timings?.[command.cmd])?snapshot.timings[command.cmd]:[];
    results[command.cmd]=outcomes;timings[command.cmd]=rawTimes.slice(0,outcomes.length).map(x=>Math.max(0,Number(x)||0));
    targets[command.cmd]=Math.max(1,Number(snapshot.targets?.[command.cmd])||ENGINE.recommendedAttempts(command,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile}));
  }
  let index=Math.max(0,Math.min(commands.length,Number(snapshot.index)||0));while(index<commands.length&&results[commands[index].cmd].length>=targets[commands[index].cmd])index++;
  const complete=index>=commands.length,activeIndex=complete?commands.length-1:index,trial=results[commands[activeIndex].cmd].length;
  return{commands,level:Number.isInteger(Number(snapshot.level))?Number(snapshot.level):inferSessionLevel(commands,currentLevel),index:activeIndex,trial,results,timings,targets,context:ENGINE.normalizeContext(snapshot.context||trainingContext),elapsedMs:Math.max(0,Number(snapshot.elapsedMs)||0),wasRunning:!!snapshot.wasRunning,complete};
}
function restoreActiveSession(){
  const raw=store.get('patrickActiveSession',null),recovered=normalizeRecoveredSession(raw);if(!recovered){if(raw)clearActiveSessionSnapshot();return false}
  session={commands:recovered.commands,level:recovered.level,index:recovered.index,trial:recovered.trial,results:recovered.results,timings:recovered.timings,targets:recovered.targets,context:recovered.context};
  executionReadyForRating=false;sessionAdvancing=false;lastRatedExecution=null;startSessionClock(recovered.elapsedMs);$('#sessionDialog').showModal();renderSessionStep();requestSessionWakeLock();persistActiveSession({wasRunning:false});
  if(recovered.complete){finishSession();return true}
  const copy=recovered.wasRunning?(appLanguage==='en'?'Session recovered. Restart the interrupted execution when ready.':appLanguage==='de'?'Einheit wiederhergestellt. Starte die unterbrochene Ausführung neu, wenn du bereit bist.':'Sesión recuperada. Reinicia la ejecución interrumpida cuando estés listo.'):(appLanguage==='en'?'Session recovered. Continue where you left off.':appLanguage==='de'?'Einheit wiederhergestellt. Fahre dort fort, wo du aufgehört hast.':'Sesión recuperada. Continúa donde ibas.');
  toast(copy);return true;
}
function stopSessionClock(){if(sessionStartedAt)sessionElapsedMs=performance.now()-sessionStartedAt;sessionStartedAt=0;if(sessionClockTimerId){clearInterval(sessionClockTimerId);sessionClockTimerId=null}updateSessionClock()}
function practicalCoachCopy(c){
  const family=ENGINE.skillFamily(c).key,state=stateOf(c.cmd),difficulty=ENGINE.difficultyTarget(c,state,{stateScore:STATE_SCORE,context:session?.context}),lang=appLanguage;
  const errorEs={communication:'Repetir la señal muchas veces hasta que deje de significar algo.',position:'Guiar con comida demasiado tiempo y no retirar la ayuda.',hold:'Subir duración, distancia y distracción al mismo tiempo.',recall:'Llamarlo cuando sabes que la distracción todavía es demasiado fuerte.',heel:'Buscar demasiados pasos antes de premiar una buena posición.',search:'Hacer el escondite difícil antes de que entienda el juego.',object:'Perseguirlo para quitarle el objeto o convertirlo en forcejeo.',control:'Usar la señal tarde, cuando ya está demasiado activado.',direction:'Aumentar distancia antes de tener una trayectoria clara.',household:'Cambiar lugar y criterio a la vez.',alert:'Premiar activación sin practicar la vuelta a calma.',default:'Subir dificultad antes de tener una respuesta clara.'};
  const errorEn={communication:'Repeating the cue until it loses meaning.',position:'Keeping the food lure too long instead of fading help.',hold:'Increasing duration, distance and distraction at the same time.',recall:'Calling when the distraction is still too strong.',heel:'Asking for too many steps before rewarding good position.',search:'Making the hide difficult before the game is understood.',object:'Chasing for the object or turning it into tug-of-war.',control:'Giving the cue too late, after arousal is already high.',direction:'Adding distance before the path is clear.',household:'Changing location and criterion at the same time.',alert:'Rewarding activation without rehearsing the return to calm.',default:'Increasing difficulty before the response is clear.'};
  const errorDe={communication:'Das Signal so oft wiederholen, bis es an Bedeutung verliert.',position:'Die Futterhilfe zu lange benutzen, statt sie abzubauen.',hold:'Dauer, Distanz und Ablenkung gleichzeitig erhöhen.',recall:'Rufen, obwohl die Ablenkung noch zu stark ist.',heel:'Zu viele Schritte verlangen, bevor eine gute Position belohnt wird.',search:'Das Versteck zu schwer machen, bevor das Spiel verstanden ist.',object:'Dem Objekt hinterherjagen oder daraus ein Zerrspiel machen.',control:'Das Signal zu spät geben, wenn die Erregung schon hoch ist.',direction:'Distanz erhöhen, bevor die Richtung klar ist.',household:'Ort und Kriterium gleichzeitig verändern.',alert:'Aktivierung belohnen, ohne die Rückkehr zur Ruhe zu üben.',default:'Die Schwierigkeit erhöhen, bevor die Reaktion klar ist.'};
  const fallback=lang==='en'?`Make it one step easier: reduce distance or distraction, ask once, help if needed and reward the first clear success.`:lang==='de'?`Mach es eine Stufe leichter: weniger Distanz oder Ablenkung, Signal einmal geben, bei Bedarf helfen und den ersten klaren Erfolg belohnen.`:`Hazlo un paso más fácil: baja distancia o distracción, da la señal una vez, ayuda si hace falta y premia el primer éxito claro.`;
  const rewardBase=displayCommandDetail(c,'reward'),reward=lang==='en'?`${rewardBase} Reward within about one second of the correct response.`:lang==='de'?`${rewardBase} Belohne innerhalb von etwa einer Sekunde nach der richtigen Reaktion.`:`${rewardBase} Premia dentro de aproximadamente un segundo de la respuesta correcta.`;
  const level=STATE_SCORE[state]||0,criterion=level<2?(lang==='en'?'Build recent evidence close to 8/10 points before adding difficulty.':lang==='de'?'Sammle ungefähr 8/10 aktuelle Punkte, bevor du die Schwierigkeit erhöhst.':'Construye evidencia reciente cercana a 8/10 puntos antes de subir dificultad.'):level<4?(lang==='en'?'Repeat strong results in different safe contexts; change only one difficulty variable at a time.':lang==='de'?'Wiederhole starke Ergebnisse in verschiedenen sicheren Kontexten; ändere nur eine Schwierigkeit gleichzeitig.':'Repite buenos resultados en contextos seguros distintos; cambia una sola variable de dificultad a la vez.'):(lang==='en'?'Keep it with short spaced reviews instead of drilling it every day.':lang==='de'?'Erhalte es mit kurzen verteilten Wiederholungen statt täglichem Drill.':'Mantenlo con repasos breves y espaciados en vez de repetirlo todos los días.');
  const goal=lang==='en'?`Today: ${displayEngineText(difficulty.target)} · ${displayEngineText(ENGINE.contextLabel(session?.context||trainingContext))}.`:lang==='de'?`Heute: ${displayEngineText(difficulty.target)} · ${displayEngineText(ENGINE.contextLabel(session?.context||trainingContext))}.`:`Hoy: ${displayEngineText(difficulty.target)} · ${displayEngineText(ENGINE.contextLabel(session?.context||trainingContext))}.`;
  return{goal,error:(lang==='en'?errorEn:lang==='de'?errorDe:errorEs)[family]||(lang==='en'?errorEn.default:lang==='de'?errorDe.default:errorEs.default),fallback,reward,criterion};
}
function renderPracticalCoach(c){
  const copy=practicalCoachCopy(c),labels=appLanguage==='en'?['LIVE COACH','COMMON ERROR','IF STUCK','REWARD','TO PROGRESS']:appLanguage==='de'?['LIVE-COACH','HÄUFIGER FEHLER','WENN ES HAKT','BELOHNUNG','FÜR DEN NÄCHSTEN SCHRITT']:['COACH EN VIVO','ERROR COMÚN','SI SE ATASCA','PREMIO','PARA AVANZAR'];
  $('#sessionPracticalKicker').textContent=labels[0];$('#sessionErrorLabel').textContent=labels[1];$('#sessionFallbackLabel').textContent=labels[2];$('#sessionRewardLabel').textContent=labels[3];$('#sessionProgressLabel').textContent=labels[4];
  $('#sessionPracticalGoal').textContent=copy.goal;$('#sessionCommonError').textContent=copy.error;$('#sessionFallback').textContent=copy.fallback;$('#sessionRewardStrategy').textContent=copy.reward;$('#sessionProgressCriterion').textContent=copy.criterion;
}

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
  const state=$('#executionState');if(state){state.textContent=appLanguage==='en'?'Ready':appLanguage==='de'?'Bereit':'Listo';state.className='executionState'}const timer=$('#executionTimer');if(timer)timer.textContent='00:00.0';
}
function beginExecution(){
  if(!session||sessionAdvancing||executionReadyForRating)return;
  executionReadyForRating=true;setStartExecutionVisible(false);setOutcomeButtonsDisabled(false);
  const state=$('#executionState');if(state){state.textContent=appLanguage==='en'?'In progress':appLanguage==='de'?'Läuft':'En curso';state.className='executionState'}
  startExecutionTimer();persistActiveSession({wasRunning:true});requestSessionWakeLock();
}
function setSessionContextLocked(locked){['#sessionEnvironment','#sessionDistraction'].forEach(id=>{const el=$(id);if(el)el.disabled=!!locked})}
function updateSessionContextFromUI(){
  if(!session||sessionAttemptCount()>0)return;
  session.context=ENGINE.normalizeContext({environment:$('#sessionEnvironment')?.value,distraction:$('#sessionDistraction')?.value});persistActiveSession();
}
function syncSessionContextUI(command){
  ensureSessionContextUI();if(!session)return;
  const context=ENGINE.normalizeContext(session.context),rec=recommendedTrainingContext(command);
  $('#sessionEnvironment').value=context.environment;$('#sessionDistraction').value=context.distraction;
  $('#sessionContextSuggestion').textContent=(appLanguage==='en'?'Suggestion for ':appLanguage==='de'?'Empfehlung für ':'Sugerencia para ')+displayCommand(command)+': '+displayEngineText(rec.label)+'.';
  setSessionContextLocked(sessionAttemptCount()>0);
}
function updateExecutionUI(){
  ensureExecutionUI();const command=session.commands[session.index],target=executionTarget(command),current=Math.min(session.trial+1,target);
  $('#executionLabel').textContent=appLanguage==='en'?`EXECUTION ${current} OF ${target}`:appLanguage==='de'?`AUSFÜHRUNG ${current} VON ${target}`:`EJECUCIÓN ${current} DE ${target}`;
  updateExecutionDots();
  const difficulty=ENGINE.difficultyTarget(command,stateOf(command.cmd),{stateScore:STATE_SCORE,context:session.context});
  const difficultyLabel=displayEngineText(difficulty.target);$('#executionHint').textContent=appLanguage==='en'?`Goal: ${difficultyLabel}. Tap “Start execution” just before giving ${dogName()} the cue.`:appLanguage==='de'?`Ziel: ${difficultyLabel}. Tippe direkt vor dem Signal an ${dogName()} auf „Ausführung starten“.`:`Objetivo: ${difficultyLabel}. Pulsa “Iniciar ejecución” justo antes de dar la señal a ${dogName()}.`;
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
  $('#startChoiceSubtitle').textContent=level===null?(appLanguage==='en'?`You will practice ${label}.`:appLanguage==='de'?`Du trainierst ${label}.`:`Vas a practicar ${label}.`):`${t('level')} ${level} · ${label}`;
  $('#recommendedStartLabel').textContent=displayEngineText(recommended.label);
  $('#lastStartLabel').textContent=displayEngineText(ENGINE.contextLabel(last));
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
  clearSessionAdvanceTimer();stopExecutionTimer();stopSessionClock();startSessionClock();sessionAdvancing=false;
  const sessionLevel=Number.isInteger(Number(options.sessionLevel))?Number(options.sessionLevel):inferSessionLevel(safeCommands,currentLevel);
  session={commands:safeCommands,level:sessionLevel,index:0,trial:0,results:{},timings:{},targets:{},context:ENGINE.normalizeContext(options.context||trainingContext)};
  safeCommands.forEach(c=>{session.results[c.cmd]=[];session.timings[c.cmd]=[];session.targets[c.cmd]=ENGINE.recommendedAttempts(c,{trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile})});
  persistActiveSession();$('#sessionDialog').showModal();renderSessionStep();requestSessionWakeLock();
}
function renderSessionStep(){
  if(!session)return;
  const c=session.commands[session.index],total=session.commands.length;
  $('#sessionCounter').textContent=appLanguage==='en'?`Command ${session.index+1} of ${total}`:appLanguage==='de'?`Kommando ${session.index+1} von ${total}`:`Comando ${session.index+1} de ${total}`;$('#sessionCommandTitle').textContent=displayCommand(c);$('#sessionCategory').textContent=`${t('level')} ${c.level} · ${displayCategory(c.category)}`;$('#sessionPron').textContent=displayPron(c);$('#sessionMeaning').textContent=displayMeaning(c);$('#sessionSignal').textContent=displayCommandDetail(c,'signal');$('#sessionAction').textContent=displayCommandDetail(c,'action');$('#sessionHow').textContent=displayCommandDetail(c,'how');$('#sessionReward').textContent=displayCommandDetail(c,'reward');
  const safety=trainingSafety(c),safetyBox=$('#sessionSafety');if(safetyBox){safetyBox.hidden=!safety;safetyBox.classList.toggle('deferred',!!safety?.deferFromAdaptive);if(safety)safetyBox.innerHTML=`<strong>${escapeHtml(displayEngineText(safety.label))}</strong><span>${escapeHtml(displayEngineText(safety.message))}</span>`}
  const done=completedBeforeCurrent()+session.trial,targetTotal=sessionTargetTotal();$('#sessionProgressBar').style.width=`${Math.round(done/Math.max(1,targetTotal)*100)}%`;
  lastRatedExecution=null;syncSessionContextUI(c);renderPracticalCoach(c);$('#sessionAudioBtn').onclick=()=>speak(c);updateExecutionUI();prepareExecution();
}
function rateExecution(outcome){
  if(!session||sessionAdvancing||!executionReadyForRating||!(outcome in OUTCOME_SCORE))return;
  sessionAdvancing=true;executionReadyForRating=false;setOutcomeButtonsDisabled(true);stopExecutionTimer();
  const c=session.commands[session.index],ratedMs=executionElapsedMs;
  lastRatedExecution={commandIndex:session.index,cmd:c.cmd,trialBefore:session.trial,outcome,elapsedMs:ratedMs};
  session.results[c.cmd].push(outcome);session.timings[c.cmd].push(ratedMs);session.trial++;setSessionContextLocked(true);hapticSessionResult(outcome);persistActiveSession({wasRunning:false});
  $('#executionTimer').textContent=formatExecutionTime(ratedMs);const state=$('#executionState');state.textContent=outcomeLabel(outcome);state.className=`executionState ${outcome}`;updateExecutionDots();setUndoExecutionVisible(true);
  const done=completedBeforeCurrent()+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/Math.max(1,sessionTargetTotal())*100)}%`;
  clearSessionAdvanceTimer();
  sessionAdvanceTimeoutId=setTimeout(()=>{
    sessionAdvanceTimeoutId=null;lastRatedExecution=null;setUndoExecutionVisible(false);if(!session)return;
    const target=executionTarget(c);if(session.trial>=target){toast(appLanguage==='en'?`${displayCommand(c)} · ${target} executions recorded`:appLanguage==='de'?`${displayCommand(c)} · ${target} Ausführungen erfasst`:`${displayCommand(c)} · ${target} ejecuciones registradas`);session.index++;session.trial=0;if(session.index>=session.commands.length){finishSession();return}}
    renderSessionStep();persistActiveSession();
  },1200);
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
  updateExecutionUI();const state=$('#executionState');state.textContent=appLanguage==='en'?'Correct result':appLanguage==='de'?'Ergebnis korrigieren':'Corrige resultado';state.className='executionState';$('#executionTimer').textContent=formatExecutionTime(executionElapsedMs);toast(appLanguage==='en'?'Result undone; rate it again':appLanguage==='de'?'Ergebnis rückgängig; bitte erneut bewerten':'Resultado deshecho; vuelve a calificarlo');persistActiveSession({wasRunning:false});
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
async function requestExitSession(){
  if(!session){$('#sessionDialog').close();return}
  const attempts=sessionAttemptCount(),message=appLanguage==='en'?(attempts?'Exit session? Executions from this session will not be saved.':'Exit the current session?'):appLanguage==='de'?(attempts?'Einheit verlassen? Die Ausführungen dieser Einheit werden nicht gespeichert.':'Aktuelle Einheit verlassen?'):(attempts?'¿Salir de la sesión? Las ejecuciones de esta sesión no se guardarán.':'¿Salir de la sesión actual?');
  if(!await appConfirm({
    eyebrow:appLanguage==='en'?'SESSION':appLanguage==='de'?'EINHEIT':'SESIÓN',
    title:appLanguage==='en'?'Exit training session?':appLanguage==='de'?'Trainingseinheit verlassen?':'¿Salir de la sesión?',
    message,
    confirmLabel:appLanguage==='en'?'Exit session':appLanguage==='de'?'Einheit verlassen':'Salir de la sesión',danger:attempts>0
  }))return;
  clearSessionAdvanceTimer();stopExecutionTimer();stopSessionClock();executionReadyForRating=false;lastRatedExecution=null;setUndoExecutionVisible(false);setStartExecutionVisible(false);session=null;sessionAdvancing=false;setOutcomeButtonsDisabled(false);await clearActiveSessionSnapshot();await releaseSessionWakeLock();$('#sessionDialog').close();
}
async function finishSession(){
  if(!session)return;
  clearSessionAdvanceTimer();stopExecutionTimer();stopSessionClock();sessionAdvancing=true;setOutcomeButtonsDisabled(true);
  const activeSession=session,finishedLevel=Number(activeSession.level);
  const nextTrials=Object.fromEntries(Object.entries(trials).map(([cmd,list])=>[cmd,Array.isArray(list)?[...list]:[]])),nextProgress={...progress};
  for(const [cmd,outcomes] of Object.entries(activeSession.results))for(const outcome of outcomes)applyRollingToState(nextTrials,nextProgress,cmd,OUTCOME_SCORE[outcome]);
  const stamp={version:CONFIG.SESSION_SCHEMA_VERSION,at:new Date().toISOString(),level:finishedLevel,dogName:dogName(),timingMode:'cue-to-rating',durationSeconds:Math.max(0,Math.round(sessionElapsedMs/1000)),results:{},timings:activeSession.timings,context:ENGINE.normalizeContext(activeSession.context)};
  Object.entries(activeSession.results).forEach(([cmd,arr])=>{const times=activeSession.timings[cmd]||[],counts={achieved:arr.filter(x=>x==='achieved').length,assisted:arr.filter(x=>x==='assisted').length,missed:arr.filter(x=>x==='missed').length};stamp.results[cmd]={...counts,total:arr.length,score:arr.reduce((a,x)=>a+OUTCOME_SCORE[x],0),avgSeconds:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length/100)/10:0,outcomes:[...arr]}});
  const compacted=compactHistory([stamp,...history],historyArchive),nextHistory=compacted.history,nextArchive=compacted.archive;
  for(const cmd of Object.keys(activeSession.results))nextProgress[cmd]=ENGINE.nextProgressState(cmd,nextProgress[cmd],{trials:nextTrials,history:nextHistory,stateScore:STATE_SCORE});
  const routeFrontierBefore=maxUnlockedLevelFrom(progress);
  const advanced=finishedLevel===currentLevel&&finishedLevel===routeFrontierBefore&&levelReadyWithProgress(finishedLevel,nextProgress)&&finishedLevel<maxRouteLevel(),nextLevel=advanced?finishedLevel+1:currentLevel;
  const nextTrainingContext=stamp.context;
  await store.setMany({patrickTrials:nextTrials,patrickProgress:nextProgress,patrickHistory:nextHistory,patrickHistoryArchive:nextArchive,patrickCurrentLevel:nextLevel,patrickTrainingContext:nextTrainingContext,patrickActiveSession:null});
  trials=nextTrials;progress=nextProgress;history=nextHistory;historyArchive=nextArchive;currentLevel=nextLevel;trainingContext=nextTrainingContext;session=null;await releaseSessionWakeLock();$('#sessionDialog').close();
  $('#finishSummary').textContent=advanced?(appLanguage==='en'?`Level ${finishedLevel} completed. Level ${currentLevel} unlocked automatically.`:appLanguage==='de'?`Stufe ${finishedLevel} abgeschlossen. Stufe ${currentLevel} wurde automatisch freigeschaltet.`:`Nivel ${finishedLevel} completado. Nivel ${currentLevel} desbloqueado automáticamente.`):(appLanguage==='en'?`Session saved. A short, clear practice already counts toward ${dogName()}'s streak.`:appLanguage==='de'?`Einheit gespeichert. Eine kurze, klare Übung zählt bereits für ${dogName()}s Serie.`:`Sesión guardada. Una práctica corta y clara ya cuenta para la racha de ${dogName()}.`);
  $('#finishResults').innerHTML=Object.entries(stamp.results).map(([cmd,r])=>{const c=commandBy(cmd),labels=appLanguage==='en'?['achieved','assisted','missed']:appLanguage==='de'?['geschafft','mit Hilfe','nicht geschafft']:['logradas','con ayuda','no logradas'];return `<div class="finishResult"><strong>${escapeHtml(displayCommand(c||cmd))}</strong><span>${r.achieved} ${labels[0]} · ${r.assisted} ${labels[1]} · ${r.missed} ${labels[2]}${r.avgSeconds?` · ${r.avgSeconds} s`:''}</span></div>`}).join('');
  $('#finishBtn').textContent=advanced?`${t('continue')} · ${t('level')} ${currentLevel}`:(appLanguage==='en'?'Back to Today':appLanguage==='de'?'Zurück zu Heute':'Volver a Hoy');$('#finishDialog').showModal();renderAll();sessionAdvancing=false;
}
function renderAll(){applyStaticAppLanguage();renderToday();renderLevels();renderProgress();renderHabit();if($('#commands').classList.contains('active'))renderCommands();syncSettingsDrawer()}

function init(){
  ensureExecutionUI();initProfileUI();$('#dayType').value=dayType;
  $$('.bottomNav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
  $('#dayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);renderToday();syncSettingsDrawer()};
  const startToday=()=>{const level=levelBy(currentLevel),commands=focusForLevel(currentLevel);openStartChoice(commands,{level:currentLevel,label:levelText(level).title||(appLanguage==='en'?'today’s session':appLanguage==='de'?'heutige Einheit':'sesión de hoy')})};
  $('#startSessionBtn').onclick=startToday;$('#firstSessionBtn').onclick=startToday;
  $('#advanceBtn').onclick=()=>{if(currentLevel<maxRouteLevel())activateLevel(currentLevel+1)};
  $$('[data-start-mode]').forEach(button=>button.onclick=()=>setStartChoiceMode(button.dataset.startMode));
  $('#cancelStartChoiceBtn').onclick=closeStartChoice;$('#closeStartChoiceBtn').onclick=closeStartChoice;$('#confirmStartChoiceBtn').onclick=confirmStartChoice;
  $('#startChoiceDialog').addEventListener('cancel',e=>{e.preventDefault();closeStartChoice()});$('#startChoiceDialog').addEventListener('click',e=>{if(e.target===$('#startChoiceDialog'))closeStartChoice()});
  $('#search').oninput=renderCommands;
  $('#closeSessionBtn').onclick=requestExitSession;$('#sessionDialog').addEventListener('cancel',e=>{e.preventDefault();requestExitSession()});
  $('#startExecutionBtn').onclick=beginExecution;$('#missedBtn').onclick=()=>rateExecution('missed');$('#assistedBtn').onclick=()=>rateExecution('assisted');$('#correctBtn').onclick=()=>rateExecution('achieved');$('#undoExecutionBtn').onclick=undoLastExecution;
  $('#finishBtn').onclick=()=>{$('#finishDialog').close();setView('today')};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session)requestSessionWakeLock();else if(session)persistActiveSession({wasRunning:executionReadyForRating})});
  window.addEventListener('pagehide',()=>{if(session)persistActiveSession({wasRunning:executionReadyForRating})});
  renderCommands();renderAll();restoreRememberedAppView();restoreActiveSession();document.documentElement.dataset.patrickReady='true';document.dispatchEvent(new Event('patrick:ready'));
}
let bootstrapRetrying=false;
function showBootstrapFailure(error){
  console.error('Patrick Training bootstrap failed',error);
  let box=$('#bootstrapRecovery');
  if(!box){document.body.insertAdjacentHTML('beforeend','<section id="bootstrapRecovery" class="bootstrapRecovery" role="alertdialog" aria-modal="true"><div><strong id="bootstrapRecoveryTitle"></strong><p id="bootstrapRecoveryText"></p><button id="bootstrapRetryBtn" type="button"></button></div></section>');box=$('#bootstrapRecovery')}
  const lang=document.documentElement.lang||'es',title=lang==='en'?'Patrick Training could not start':lang==='de'?'Patrick Training konnte nicht starten':'Patrick Training no pudo iniciar',message=lang==='en'?'Your data is still on this device. Try loading the app again.':lang==='de'?'Deine Daten bleiben auf diesem Gerät. Versuche, die App erneut zu laden.':'Tus datos siguen en este dispositivo. Intenta cargar la app de nuevo.',retry=lang==='en'?'Try again':lang==='de'?'Erneut versuchen':'Intentar de nuevo';
  $('#bootstrapRecoveryTitle').textContent=title;$('#bootstrapRecoveryText').textContent=message;const button=$('#bootstrapRetryBtn');button.textContent=retry;button.disabled=false;
  button.onclick=async()=>{if(bootstrapRetrying)return;bootstrapRetrying=true;button.disabled=true;try{await bootstrapPatrick();box.remove();init()}catch(e){bootstrapRetrying=false;showBootstrapFailure(e)}};
}
window.PATRICK_READY.then(init).catch(showBootstrapFailure);
