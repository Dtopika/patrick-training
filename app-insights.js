let activeInsightCommand=null,currentDailyMissionPlan=null;

function pctText(value){return value===null||value===undefined?'—':Math.round(Number(value)*100)+'%'}
function signedPct(value){if(value===null||value===undefined)return copyText('Sin comparación');const n=Math.round(Number(value)*100);return(n>0?'+':'')+n+' pts'}
function stateProgressHint(state){
  if(state==='No iniciado')return'Empieza con una respuesta simple y fácil de premiar.';
  if(state==='En práctica')return'Busca 8 de 10 puntos recientes antes de subir dificultad.';
  if(state==='Consistente')return'Ahora importa repetir el comportamiento en contextos diferentes.';
  if(state==='Generalizando')return'Consolida buenos resultados en varios entornos y a lo largo del tiempo.';
  return'Mantén el comando con repasos espaciados sin entrenarlo de más.';
}

function renderDailyMission(plan){
  const root=$('#dailyMission');if(!root||!plan?.items?.length)return;
  currentDailyMissionPlan=plan;
  const commands=plan.items.map(item=>item.command),first=plan.items[0],confidence=plan.items.map(item=>item.confidence?.level||'Baja');
  const confidenceLabel=appLanguage==='en'?(confidence.every(x=>x==='Alta')?'High confidence':confidence.some(x=>x==='Baja')?'Building confidence':'Medium confidence'):appLanguage==='de'?(confidence.every(x=>x==='Alta')?'Hohes Vertrauen':confidence.some(x=>x==='Baja')?'Vertrauen im Aufbau':'Mittleres Vertrauen'):(confidence.every(x=>x==='Alta')?'Confianza alta':confidence.some(x=>x==='Baja')?'Confianza en construcción':'Confianza media');
  $('#dailyMissionTitle').textContent=`${plan.totalMinutes} min · ${commands.map(displayCommand).join(' + ')}`;
  $('#dailyMissionMeta').textContent=`${t('level')} ${currentLevel} · ${displayEngineText(first.context.label)} · ${displayEngineText(plan.stage)}`;
  $('#dailyMissionConfidence').textContent=confidenceLabel;
  $('#dailyMissionCommands').innerHTML=plan.items.map(item=>`<span><b>${escapeHtml(displayCommand(item.command))}</b><small>${item.attempts} ${appLanguage==='en'?'executions':appLanguage==='de'?'Ausführungen':'ejecuciones'} · ${escapeHtml(displayEngineText(item.difficulty.target))}</small></span>`).join('');
  $('#dailyMissionReason').textContent=first.reason?displayEngineText(first.reason):(appLanguage==='en'?'A short, clear session is enough to move forward.':appLanguage==='de'?'Eine kurze, klare Einheit reicht aus, um Fortschritt zu machen.':'Una sesión corta y clara es suficiente para avanzar.');
  const guidance=ENGINE.ageGuidance(dogProfile),box=$('#dailyMissionGuidance');box.hidden=!guidance;if(guidance)box.innerHTML=`<strong>${escapeHtml(displayEngineText(guidance.label))}</strong><span>${escapeHtml(displayEngineText(guidance.message))}</span>`;
}
function startDailyMission(){
  if(!currentDailyMissionPlan?.items?.length)return;
  const commands=currentDailyMissionPlan.items.map(item=>item.command).filter(Boolean);
  openStartChoice(commands,{level:currentLevel,label:t('missionToday')});
}

function renderSmartDailyPlan(){
  const root=$('#smartDailyPlan');if(!root)return;
  const plan=ENGINE.dailyPlan(COMMANDS,currentLevel,{dayType,trials,history,progress,stateScore:STATE_SCORE,profile:dogProfile});
  if(!plan.items.length){root.innerHTML='';root.hidden=true;currentDailyMissionPlan=null;return}
  root.hidden=false;renderDailyMission(plan);
  root.innerHTML=`<div class="smartPlanHead"><div><p class="kicker">${escapeHtml(copyText('ENTRENADOR ADAPTATIVO'))}</p><h2>${escapeHtml(displayEngineText(plan.title))}</h2><p>${plan.totalMinutes} min ${appLanguage==='en'?'approx.':appLanguage==='de'?'ca.':'aprox.'} · ${escapeHtml(displayEngineText(plan.stage))}</p></div><span class="smartPlanBadge">v3</span></div>
    <div class="smartPlanList">${plan.items.map((item,i)=>`<article class="smartPlanItem">
      <span class="smartPlanIndex">${i+1}</span>
      <div class="smartPlanBody"><div class="smartPlanTitle"><strong>${escapeHtml(displayCommand(item.command))}</strong><span>${escapeHtml(displayState(item.state))} · ${appLanguage==='en'?'confidence':appLanguage==='de'?'Vertrauen':'confianza'} ${escapeHtml(displayEngineText(item.confidence.level).toLowerCase())}</span></div>
      <p>${escapeHtml(displayEngineText(item.objective))}</p><small>${escapeHtml(displayEngineText(item.reason))}</small>
      <div class="smartPlanContext"><span>${escapeHtml(displayEngineText(item.context.label))}</span><span>${escapeHtml(displayEngineText(item.difficulty.target))}</span><span>${item.attempts} ${appLanguage==='en'?'executions':appLanguage==='de'?'Ausführungen':'ejecuciones'} · ${item.minutes} min</span></div></div>
      <button class="smartPlanStart" type="button" data-smart-practice="${escapeHtml(item.command.cmd)}">${escapeHtml(copyText('Practicar'))}</button>
    </article>`).join('')}</div>`;
}

function renderEvolutionDashboard(){
  const root=$('#evolutionDashboard');if(!root)return;
  const summary=ENGINE.evolutionSummary(COMMANDS,{history,progress,stateScore:STATE_SCORE});
  const delta=summary.accuracy7!==null&&summary.previousAccuracy7!==null?summary.accuracy7-summary.previousAccuracy7:null;
  const improving=summary.improving?.command,attention=summary.attention?.command;
  const stateTotal=Math.max(1,COMMANDS.length);
  root.innerHTML=`<div class="evolutionHead"><div><p class="kicker">${escapeHtml(copyText('EVOLUCIÓN'))}</p><h2>${escapeHtml(copyText('Últimos 30 días'))}</h2></div><span class="evolutionDelta ${delta!==null&&delta<0?'down':''}">${signedPct(delta)}</span></div>
    <div class="evolutionMetrics">
      <article><strong>${summary.sessions7}</strong><span>${appLanguage==='en'?'sessions · 7 days':appLanguage==='de'?'Einheiten · 7 Tage':'sesiones · 7 días'}</span></article>
      <article><strong>${pctText(summary.accuracy7)}</strong><span>${appLanguage==='en'?'accuracy · 7 days':appLanguage==='de'?'Genauigkeit · 7 Tage':'precisión · 7 días'}</span></article>
      <article><strong>${summary.activeCommands30}</strong><span>${appLanguage==='en'?'active commands':appLanguage==='de'?'aktive Kommandos':'comandos activos'}</span></article>
      <article><strong>${summary.contexts30}</strong><span>${appLanguage==='en'?'contexts used':appLanguage==='de'?'verwendete Kontexte':'contextos usados'}</span></article>
    </div>
    <div class="evolutionSignals">
      <article><small>${escapeHtml(copyText('MEJORANDO'))}</small><strong>${improving?escapeHtml(displayCommand(improving)):escapeHtml(copyText('Aún sin tendencia'))}</strong><span>${summary.improving?signedPct(summary.improving.trend.delta):escapeHtml(copyText('Necesitamos más sesiones comparables.'))}</span></article>
      <article><small>${escapeHtml(copyText('A VIGILAR'))}</small><strong>${attention?escapeHtml(displayCommand(attention)):escapeHtml(copyText('Sin señal todavía'))}</strong><span>${summary.attention?pctText(summary.attention.trend.recent)+' '+(appLanguage==='en'?'recent':appLanguage==='de'?'aktuell':'reciente'):escapeHtml(copyText('Aparecerá cuando haya evidencia suficiente.'))}</span></article>
    </div>
    <div class="stateDistribution" aria-label="${appLanguage==='en'?'Distribution by state':appLanguage==='de'?'Verteilung nach Status':'Distribución por estado'}">${STATES.map(state=>{const count=summary.states[state]||0;return`<div><span><b>${escapeHtml(displayState(state))}</b><small>${count}</small></span><i><em style="width:${Math.round(count/stateTotal*100)}%"></em></i></div>`}).join('')}</div>`;
}

function commandSeriesHtml(series){
  if(!series.length)return`<p class="insightEmpty">${appLanguage==='en'?'There are no completed sessions for this command yet.':appLanguage==='de'?'Für dieses Kommando gibt es noch keine abgeschlossenen Einheiten.':'Todavía no hay sesiones terminadas para este comando.'}</p>`;
  const fmt=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{day:'numeric',month:'short'});
  return`<div class="commandSeriesRail" role="list" aria-label="Sesiones recientes, de izquierda a derecha">${series.map(item=>`<article class="commandSessionCard" role="listitem"><small>${fmt.format(new Date(item.at))}</small><strong>${Math.round(item.accuracy*100)}%</strong><span>${escapeHtml(ENGINE.contextLabel(item.context))}</span>${item.timingMode==='cue-to-rating'&&item.avgSeconds?`<span>${item.avgSeconds.toFixed(1)} s · tiempo preciso</span>`:''}</article>`).join('')}</div><small class="commandSeriesHint">Más antiguo ← desliza → más reciente</small>`;
}

function openCommandInsight(cmdName){
  const command=commandBy(cmdName);if(!command)return;
  activeInsightCommand=command;
  const dialog=$('#commandInsightDialog'),stats=commandTrialStats(command.cmd),details=commandPriorityDetails(command,currentLevel);
  const evidence=commandContextEvidence(command.cmd),trend=ENGINE.commandTrend(history,command.cmd),series=ENGINE.commandHistorySeries(history,command.cmd,8);
  $('#commandInsightTitle').textContent=displayCommand(command);
  $('#commandInsightPron').textContent=displayPron(command);
  $('#commandInsightMeaning').textContent=displayMeaning(command);
  $('#commandInsightState').textContent=displayState(stateOf(command.cmd));
  $('#commandInsightAccuracy').textContent=stats.avg===null?copyText('Sin datos'):Math.round(stats.avg*100)+'%';
  $('#commandInsightLast').textContent=relativePracticeLabel(stats.lastMs);
  $('#commandInsightContexts').textContent=String(evidence.contextCount);
  $('#commandInsightTrend').textContent=trend.delta===null?copyText('Sin comparación'):signedPct(trend.delta);
  $('#commandInsightConfidence').textContent=displayEngineText(details.confidence.level);
  $('#commandInsightSeries').innerHTML=commandSeriesHtml(series);
  $('#commandInsightWhy').innerHTML=details.reasons.map(x=>`<li>${escapeHtml(displayEngineText(x))}</li>`).join('');
  const timingText=details.timing.recentCount?`${displayEngineText(details.timing.targetLabel)} · ${appLanguage==='en'?'observed':appLanguage==='de'?'beobachtet':'observado'} ≈ ${details.timing.medianSeconds.toFixed(1)} s`:(appLanguage==='en'?'Precise timing will appear after new v7 sessions.':appLanguage==='de'?'Präzise Zeitmessung erscheint nach neuen v7-Einheiten.':'El tiempo preciso aparecerá después de nuevas sesiones v7.');
  $('#commandInsightNext').innerHTML=`<strong>${escapeHtml(displayEngineText(details.difficulty.label))}</strong><span>${escapeHtml(stateProgressHint(stateOf(command.cmd)))}</span><span>${escapeHtml(timingText)}</span><span>${details.attempts} ${appLanguage==='en'?'recommended executions · confidence':appLanguage==='de'?'empfohlene Ausführungen · Vertrauen':'ejecuciones recomendadas · confianza'} ${escapeHtml(displayEngineText(details.confidence.level).toLowerCase())}</span>`;
  const safety=details.safety,box=$('#commandInsightSafety');box.hidden=!safety;if(safety)box.innerHTML=`<strong>${escapeHtml(displayEngineText(safety.label))}</strong><span>${escapeHtml(displayEngineText(safety.message))}</span>`;
  if(!dialog.open)dialog.showModal();
}

function closeCommandInsight(){
  activeInsightCommand=null;
  const dialog=$('#commandInsightDialog');if(dialog?.open)dialog.close();
}

function decorateInsightButtons(){
  $$('.commandCard').forEach(card=>{
    const actions=card.querySelector('.commandActions');if(!actions||actions.querySelector('.insightBtn'))return;
    const button=document.createElement('button');button.className='audioBtn insightBtn';button.type='button';button.dataset.commandInsight=card.dataset.command;button.title=copyText('Ver ficha inteligente');button.setAttribute('aria-label',(appLanguage==='en'?'View smart card for ':appLanguage==='de'?'Smart-Karte anzeigen für ':'Ver ficha inteligente de ')+displayCommand(commandBy(card.dataset.command)||card.dataset.command));button.innerHTML=icon('chart');
    actions.prepend(button);
  });
}

function renderInsights(){renderSmartDailyPlan();renderEvolutionDashboard();decorateInsightButtons()}

document.addEventListener('click',e=>{
  const detail=e.target.closest('[data-command-insight]');if(detail){openCommandInsight(detail.dataset.commandInsight);return}
  const practice=e.target.closest('[data-smart-practice]');if(practice){
    const command=commandBy(practice.dataset.smartPractice);if(!command)return;
    openStartChoice([command],{level:command.level,label:displayCommand(command)});return;
  }
});

$('#closeCommandInsightBtn')?.addEventListener('click',closeCommandInsight);
$('#commandInsightDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeCommandInsight()});
$('#commandInsightDialog')?.addEventListener('click',e=>{if(e.target===$('#commandInsightDialog'))closeCommandInsight()});
$('#commandInsightPracticeBtn')?.addEventListener('click',()=>{if(!activeInsightCommand)return;const command=activeInsightCommand;closeCommandInsight();openStartChoice([command],{label:displayCommand(command)})});
$('#commandInsightDemoBtn')?.addEventListener('click',()=>{if(activeInsightCommand)openDemo(activeInsightCommand)});
$('#dailyMissionStartBtn')?.addEventListener('click',startDailyMission);

const insightCommandList=$('#commandList');
if(insightCommandList)new MutationObserver(decorateInsightButtons).observe(insightCommandList,{childList:true,subtree:true});
