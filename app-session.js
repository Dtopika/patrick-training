const EXECUTIONS_PER_COMMAND=5;
const OUTCOME_SCORE={missed:0,assisted:.5,achieved:1};
const OUTCOME_LABEL={missed:'No logrado',assisted:'Con ayuda',achieved:'Logrado'};
let executionTimerId=null,executionStartedAt=0,executionElapsedMs=0,sessionAdvancing=false;

function updateRolling(cmd,score){
  const arr=trials[cmd]||[];arr.push(Number(score)||0);trials[cmd]=arr.slice(-10);store.set('patrickTrials',trials);
  if(stateOf(cmd)==='No iniciado')progress[cmd]='En práctica';
  const points=trials[cmd].reduce((a,b)=>a+(Number(b)||0),0);
  if(trials[cmd].length>=10&&points>=8&&STATE_SCORE[stateOf(cmd)]<2)progress[cmd]='Consistente';
  store.set('patrickProgress',progress);
}
function ensureExecutionUI(){
  if($('#executionCoach'))return;
  const target=$('#sessionMeaning'),box=document.createElement('section');box.id='executionCoach';box.className='executionCoach';
  box.innerHTML='<div class="executionTop"><div><small id="executionLabel">EJECUCIÓN 1 DE 5</small><strong id="executionTimer">00:00.0</strong></div><span id="executionState" class="executionState">En curso</span></div><div id="executionDots" class="executionDots" aria-label="Progreso de ejecuciones"></div><p id="executionHint" class="executionHint"></p>';
  target.insertAdjacentElement('afterend',box);
}
function formatExecutionTime(ms){const total=Math.max(0,ms)/1000,min=Math.floor(total/60),sec=Math.floor(total%60),tenth=Math.floor((total%1)*10);return`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}`}
function stopExecutionTimer(){if(executionTimerId){clearInterval(executionTimerId);executionTimerId=null}if(executionStartedAt)executionElapsedMs=performance.now()-executionStartedAt}
function updateExecutionClock(){if(!executionStartedAt)return;executionElapsedMs=performance.now()-executionStartedAt;const el=$('#executionTimer');if(el)el.textContent=formatExecutionTime(executionElapsedMs)}
function startExecutionTimer(){stopExecutionTimer();executionElapsedMs=0;executionStartedAt=performance.now();updateExecutionClock();executionTimerId=setInterval(updateExecutionClock,100)}
function outcomeMark(outcome){if(outcome==='achieved')return icon('check');if(outcome==='assisted')return icon('help');return icon('x')}
function updateExecutionDots(){
  const c=session.commands[session.index],results=session.results[c.cmd]||[];
  $('#executionDots').innerHTML=Array.from({length:EXECUTIONS_PER_COMMAND},(_,i)=>{const outcome=results[i],current=!outcome&&i===session.trial;return `<span class="${current?'current':''} ${outcome||''}">${outcome?outcomeMark(outcome):i+1}</span>`}).join('');
}
function setOutcomeButtonsDisabled(disabled){['#missedBtn','#assistedBtn','#correctBtn'].forEach(id=>{const b=$(id);if(b)b.disabled=disabled})}
function updateExecutionUI(){
  ensureExecutionUI();const current=Math.min(session.trial+1,EXECUTIONS_PER_COMMAND);
  $('#executionLabel').textContent=`EJECUCIÓN ${current} DE ${EXECUTIONS_PER_COMMAND}`;
  const state=$('#executionState');state.textContent='En curso';state.className='executionState';
  updateExecutionDots();
  $('#executionHint').textContent=`Haz la ejecución con ${dogName()} y califica cómo salió. La app avanza sola.`;
}
function startSession(cmds=focusForLevel(currentLevel)){
  if(!cmds.length)return;stopExecutionTimer();sessionAdvancing=false;
  session={commands:cmds,index:0,trial:0,results:{},timings:{}};
  cmds.forEach(c=>{session.results[c.cmd]=[];session.timings[c.cmd]=[]});
  $('#sessionDialog').showModal();renderSessionStep();
}
function renderSessionStep(){
  const c=session.commands[session.index],total=session.commands.length;
  $('#sessionCounter').textContent=`Comando ${session.index+1} de ${total}`;$('#sessionCommandTitle').textContent=displayCommand(c);$('#sessionCategory').textContent=`Nivel ${c.level} · ${c.category}`;$('#sessionPron').textContent=displayPron(c);$('#sessionMeaning').textContent=c.meaning;$('#sessionSignal').textContent=c.signal;$('#sessionAction').textContent=c.action;$('#sessionHow').textContent=c.how;$('#sessionReward').textContent=c.reward;
  const done=session.index*EXECUTIONS_PER_COMMAND+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/(total*EXECUTIONS_PER_COMMAND)*100)}%`;
  $('#sessionAudioBtn').onclick=()=>speak(c);updateExecutionUI();startExecutionTimer();sessionAdvancing=false;setOutcomeButtonsDisabled(false);
}
function rateExecution(outcome){
  if(!session||sessionAdvancing||!(outcome in OUTCOME_SCORE))return;
  sessionAdvancing=true;setOutcomeButtonsDisabled(true);stopExecutionTimer();
  const c=session.commands[session.index];session.results[c.cmd].push(outcome);session.timings[c.cmd].push(executionElapsedMs);updateRolling(c.cmd,OUTCOME_SCORE[outcome]);session.trial++;
  $('#executionTimer').textContent=formatExecutionTime(executionElapsedMs);const state=$('#executionState');state.textContent=OUTCOME_LABEL[outcome];state.className=`executionState ${outcome}`;updateExecutionDots();
  const done=session.index*EXECUTIONS_PER_COMMAND+session.trial;$('#sessionProgressBar').style.width=`${Math.round(done/(session.commands.length*EXECUTIONS_PER_COMMAND)*100)}%`;
  setTimeout(()=>{
    if(session.trial>=EXECUTIONS_PER_COMMAND){toast(`${displayCommand(c)} · 5 ejecuciones registradas`);session.index++;session.trial=0;if(session.index>=session.commands.length){finishSession();return}}
    renderSessionStep();
  },480);
}
function finishSession(){
  stopExecutionTimer();const finishedLevel=currentLevel,stamp={version:5,at:new Date().toISOString(),level:finishedLevel,dogName:dogName(),results:{},timings:session.timings};
  Object.entries(session.results).forEach(([cmd,arr])=>{const times=session.timings[cmd]||[],counts={achieved:arr.filter(x=>x==='achieved').length,assisted:arr.filter(x=>x==='assisted').length,missed:arr.filter(x=>x==='missed').length};stamp.results[cmd]={...counts,total:arr.length,score:arr.reduce((a,x)=>a+OUTCOME_SCORE[x],0),avgSeconds:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length/100)/10:0}});
  history.unshift(stamp);history=history.slice(0,200);store.set('patrickHistory',history);$('#sessionDialog').close();
  let advanced=false;if(levelReady(finishedLevel)&&finishedLevel<10&&currentLevel===finishedLevel){currentLevel=finishedLevel+1;store.set('patrickCurrentLevel',currentLevel);advanced=true}
  $('#finishSummary').textContent=advanced?`Nivel ${finishedLevel} completado. Nivel ${currentLevel} desbloqueado automáticamente.`:`Sesión guardada. Una práctica corta y clara ya cuenta para la racha de ${dogName()}.`;
  $('#finishResults').innerHTML=Object.entries(stamp.results).map(([cmd,r])=>{const c=commandBy(cmd);return `<div class="finishResult"><strong>${escapeHtml(displayCommand(c||cmd))}</strong><span>${r.achieved} logradas · ${r.assisted} con ayuda · ${r.missed} no logradas${r.avgSeconds?` · ${r.avgSeconds} s`:''}</span></div>`}).join('');
  $('#finishBtn').textContent=advanced?`Continuar · Nivel ${currentLevel}`:'Volver a Hoy';$('#finishDialog').showModal();renderAll();
}
function renderAll(){renderToday();renderLevels();renderProgress();renderHabit();if($('#commands').classList.contains('active'))renderCommands();syncSettingsDrawer()}

function init(){
  ensureExecutionUI();initProfileUI();$('#dayType').value=dayType;
  $$('.bottomNav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
  $('#dayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);renderToday();syncSettingsDrawer()};
  $('#startSessionBtn').onclick=()=>startSession();$('#firstSessionBtn').onclick=()=>startSession();
  $('#advanceBtn').onclick=()=>{if(currentLevel<10){currentLevel++;store.set('patrickCurrentLevel',currentLevel);renderAll();toast(`Nivel ${currentLevel} activado`)}};
  $('#search').oninput=renderCommands;
  $('#closeSessionBtn').onclick=()=>{if(confirm('¿Salir de la sesión actual?')){stopExecutionTimer();$('#sessionDialog').close()}};
  $('#missedBtn').onclick=()=>rateExecution('missed');$('#assistedBtn').onclick=()=>rateExecution('assisted');$('#correctBtn').onclick=()=>rateExecution('achieved');
  $('#finishBtn').onclick=()=>{$('#finishDialog').close();setView('today')};
  renderCommands();renderAll();document.dispatchEvent(new Event('patrick:ready'));
}
window.PATRICK_READY.then(init).catch(e=>{console.error('Patrick Training bootstrap failed',e);init()});
