let activeInsightCommand=null;

function pctText(value){return value===null||value===undefined?'—':Math.round(Number(value)*100)+'%'}
function signedPct(value){if(value===null||value===undefined)return'Sin comparación';const n=Math.round(Number(value)*100);return(n>0?'+':'')+n+' pts'}
function stateProgressHint(state){
  if(state==='No iniciado')return'Empieza con una respuesta simple y fácil de premiar.';
  if(state==='En práctica')return'Busca 8 de 10 puntos recientes antes de subir dificultad.';
  if(state==='Consistente')return'Ahora importa repetir el comportamiento en contextos diferentes.';
  if(state==='Generalizando')return'Consolida buenos resultados en varios entornos y a lo largo del tiempo.';
  return'Mantén el comando con repasos espaciados sin entrenarlo de más.';
}

function renderSmartDailyPlan(){
  const root=$('#smartDailyPlan');if(!root)return;
  const plan=ENGINE.dailyPlan(COMMANDS,currentLevel,{dayType,trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile});
  if(!plan.items.length){root.innerHTML='';root.hidden=true;return}
  root.hidden=false;
  root.innerHTML=`<div class="smartPlanHead"><div><p class="kicker">ENTRENADOR ADAPTATIVO</p><h2>${escapeHtml(plan.title)}</h2><p>${plan.totalMinutes} min aprox. · ${escapeHtml(plan.stage)}</p></div><span class="smartPlanBadge">v2</span></div>
    <div class="smartPlanList">${plan.items.map((item,i)=>`<article class="smartPlanItem">
      <span class="smartPlanIndex">${i+1}</span>
      <div class="smartPlanBody"><div class="smartPlanTitle"><strong>${escapeHtml(displayCommand(item.command))}</strong><span>${escapeHtml(item.state)}</span></div>
      <p>${escapeHtml(item.objective)}</p><small>${escapeHtml(item.reason)}</small>
      <div class="smartPlanContext"><span>${escapeHtml(item.context.label)}</span><span>${item.attempts} ejecuciones · ${item.minutes} min</span></div></div>
      <button class="smartPlanStart" type="button" data-smart-practice="${escapeHtml(item.command.cmd)}" data-environment="${escapeHtml(item.context.environment)}" data-distraction="${escapeHtml(item.context.distraction)}">Practicar</button>
    </article>`).join('')}</div>`;
}

function renderEvolutionDashboard(){
  const root=$('#evolutionDashboard');if(!root)return;
  const summary=ENGINE.evolutionSummary(COMMANDS,{history,progress,stateScore:STATE_SCORE});
  const delta=summary.accuracy7!==null&&summary.previousAccuracy7!==null?summary.accuracy7-summary.previousAccuracy7:null;
  const improving=summary.improving?.command,attention=summary.attention?.command;
  const stateTotal=Math.max(1,COMMANDS.length);
  root.innerHTML=`<div class="evolutionHead"><div><p class="kicker">EVOLUCIÓN</p><h2>Últimos 30 días</h2></div><span class="evolutionDelta ${delta!==null&&delta<0?'down':''}">${signedPct(delta)}</span></div>
    <div class="evolutionMetrics">
      <article><strong>${summary.sessions7}</strong><span>sesiones · 7 días</span></article>
      <article><strong>${pctText(summary.accuracy7)}</strong><span>precisión · 7 días</span></article>
      <article><strong>${summary.activeCommands30}</strong><span>comandos activos</span></article>
      <article><strong>${summary.contexts30}</strong><span>contextos usados</span></article>
    </div>
    <div class="evolutionSignals">
      <article><small>MEJORANDO</small><strong>${improving?escapeHtml(displayCommand(improving)):'Aún sin tendencia'}</strong><span>${summary.improving?signedPct(summary.improving.trend.delta):'Necesitamos más sesiones comparables.'}</span></article>
      <article><small>A VIGILAR</small><strong>${attention?escapeHtml(displayCommand(attention)):'Sin señal todavía'}</strong><span>${summary.attention?pctText(summary.attention.trend.recent)+' reciente':'Aparecerá cuando haya evidencia suficiente.'}</span></article>
    </div>
    <div class="stateDistribution" aria-label="Distribución por estado">${STATES.map(state=>{const count=summary.states[state]||0;return`<div><span><b>${escapeHtml(state)}</b><small>${count}</small></span><i><em style="width:${Math.round(count/stateTotal*100)}%"></em></i></div>`}).join('')}</div>`;
}

function commandSeriesHtml(series){
  if(!series.length)return'<p class="insightEmpty">Todavía no hay sesiones terminadas para este comando.</p>';
  const fmt=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short'});
  return`<div class="commandSeriesRail" role="list" aria-label="Sesiones recientes, de izquierda a derecha">${series.map(item=>`<article class="commandSessionCard" role="listitem"><small>${fmt.format(new Date(item.at))}</small><strong>${Math.round(item.accuracy*100)}%</strong><span>${escapeHtml(ENGINE.contextLabel(item.context))}</span></article>`).join('')}</div><small class="commandSeriesHint">Más antiguo ← desliza → más reciente</small>`;
}

function openCommandInsight(cmdName){
  const command=commandBy(cmdName);if(!command)return;
  activeInsightCommand=command;
  const dialog=$('#commandInsightDialog'),stats=commandTrialStats(command.cmd),details=commandPriorityDetails(command,currentLevel);
  const evidence=commandContextEvidence(command.cmd),trend=ENGINE.commandTrend(history,command.cmd),series=ENGINE.commandHistorySeries(history,command.cmd,8);
  $('#commandInsightTitle').textContent=displayCommand(command);
  $('#commandInsightPron').textContent=displayPron(command);
  $('#commandInsightMeaning').textContent=command.meaning;
  $('#commandInsightState').textContent=stateOf(command.cmd);
  $('#commandInsightAccuracy').textContent=stats.avg===null?'Sin datos':Math.round(stats.avg*100)+'%';
  $('#commandInsightLast').textContent=relativePracticeLabel(stats.lastMs);
  $('#commandInsightContexts').textContent=String(evidence.contextCount);
  $('#commandInsightTrend').textContent=trend.delta===null?'Sin comparación':signedPct(trend.delta);
  $('#commandInsightSeries').innerHTML=commandSeriesHtml(series);
  $('#commandInsightWhy').innerHTML=details.reasons.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
  $('#commandInsightNext').innerHTML=`<strong>${escapeHtml(details.recommendation.label)}</strong><span>${escapeHtml(stateProgressHint(stateOf(command.cmd)))}</span>`;
  const safety=details.safety,box=$('#commandInsightSafety');box.hidden=!safety;if(safety)box.innerHTML=`<strong>${escapeHtml(safety.label)}</strong><span>${escapeHtml(safety.message)}</span>`;
  if(!dialog.open)dialog.showModal();
}

function closeCommandInsight(){
  activeInsightCommand=null;
  const dialog=$('#commandInsightDialog');if(dialog?.open)dialog.close();
}

function decorateInsightButtons(){
  $$('.commandCard').forEach(card=>{
    const actions=card.querySelector('.commandActions');if(!actions||actions.querySelector('.insightBtn'))return;
    const button=document.createElement('button');button.className='insightBtn';button.type='button';button.dataset.commandInsight=card.dataset.command;button.title='Ver ficha inteligente';button.setAttribute('aria-label','Ver ficha inteligente de '+displayCommand(commandBy(card.dataset.command)||card.dataset.command));button.innerHTML=icon('chart');
    actions.prepend(button);
  });
}

function renderInsights(){renderSmartDailyPlan();renderEvolutionDashboard();decorateInsightButtons()}

document.addEventListener('click',e=>{
  const detail=e.target.closest('[data-command-insight]');if(detail){openCommandInsight(detail.dataset.commandInsight);return}
  const practice=e.target.closest('[data-smart-practice]');if(practice){
    const command=commandBy(practice.dataset.smartPractice);if(!command)return;
    const context=ENGINE.normalizeContext({environment:practice.dataset.environment,distraction:practice.dataset.distraction});
    startSession([command],{context});return;
  }
});

$('#closeCommandInsightBtn')?.addEventListener('click',closeCommandInsight);
$('#commandInsightDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeCommandInsight()});
$('#commandInsightDialog')?.addEventListener('click',e=>{if(e.target===$('#commandInsightDialog'))closeCommandInsight()});
$('#commandInsightPracticeBtn')?.addEventListener('click',()=>{if(!activeInsightCommand)return;const command=activeInsightCommand,context=recommendedTrainingContext(command);closeCommandInsight();startSession([command],{context})});
$('#commandInsightDemoBtn')?.addEventListener('click',()=>{if(activeInsightCommand)openDemo(activeInsightCommand)});

const insightCommandList=$('#commandList');
if(insightCommandList)new MutationObserver(decorateInsightButtons).observe(insightCommandList,{childList:true,subtree:true});
