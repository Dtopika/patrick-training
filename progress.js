function commandTrialStats(cmd){
  const arr=Array.isArray(trials[cmd])?trials[cmd].map(Number).filter(Number.isFinite):[];
  const avg=arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  const lastMs=typeof commandLastPracticeMs==='function'?commandLastPracticeMs(cmd):0;
  return{arr,avg,lastMs};
}
function relativePracticeLabel(ms){
  if(!ms)return copyText('Nunca');
  const days=Math.floor(Math.max(0,Date.now()-ms)/86400000);
  if(days===0)return appLanguage==='en'?'Today':appLanguage==='de'?'Heute':'Hoy';if(days===1)return appLanguage==='en'?'Yesterday':appLanguage==='de'?'Gestern':'Ayer';if(days<7)return appLanguage==='en'?`${days} days ago`:appLanguage==='de'?`Vor ${days} Tagen`:`Hace ${days} días`;
  const weeks=Math.floor(days/7);return appLanguage==='en'?`${weeks} ${weeks===1?'week':'weeks'} ago`:appLanguage==='de'?`Vor ${weeks} ${weeks===1?'Woche':'Wochen'}`:`Hace ${weeks} ${weeks===1?'semana':'semanas'}`;
}
function trialTrendHtml(arr){
  if(!arr.length)return`<span class="trendEmpty">${appLanguage==='en'?'No executions yet':appLanguage==='de'?'Noch keine Ausführungen':'Sin ejecuciones aún'}</span>`;
  const recent=arr.slice(-10),labels=recent.map(v=>v>=1?t('achieved'):v>=.5?t('assisted'):t('missed'));
  const recentLabel=appLanguage==='en'?'Latest executions':appLanguage==='de'?'Letzte Ausführungen':'Últimas ejecuciones';return`<span class="trialTrend"><span class="srOnly">${recentLabel}: ${escapeHtml(labels.join(', '))}</span>${recent.map((v,i)=>`<i class="${v>=1?'hit':v>=.5?'assist':'miss'}" aria-hidden="true" title="${escapeHtml(labels[i])}"></i>`).join('')}</span>`;
}
function adaptiveSummaryHtml(){
  const eligible=COMMANDS.filter(c=>c.level<=currentLevel).map(c=>{const details=commandPriorityDetails(c,currentLevel);return{c,details,stats:commandTrialStats(c.cmd)}}).sort((a,b)=>b.details.score-a.details.score).slice(0,3);
  if(!eligible.length)return'';
  const explanation=appLanguage==='en'?'Priority combines level, recent performance, time since practice and evidence across different contexts. The context suggestion does not change your session until you select it.':appLanguage==='de'?'Die Priorität kombiniert Stufe, aktuelle Leistung, Zeit seit dem letzten Training und Daten aus verschiedenen Kontexten. Der Kontextvorschlag ändert deine Einheit erst, wenn du ihn auswählst.':'La prioridad combina nivel, rendimiento reciente, tiempo sin practicar y evidencia en contextos diferentes. La sugerencia de contexto no cambia tu sesión hasta que tú la selecciones.';return`<div class="adaptiveSummaryHead"><div><p class="kicker">${escapeHtml(copyText('MOTOR ADAPTATIVO V3'))}</p><h2>${escapeHtml(copyText('Prioridades de hoy'))}</h2></div><span class="adaptiveBadge">${escapeHtml(copyText('Explicable'))}</span></div><div class="adaptiveCards adaptiveCardsV2">${eligible.map(({c,details,stats})=>`<article><div class="adaptiveCardTop"><strong>${escapeHtml(displayCommand(c))}</strong><span>${stats.avg===null?escapeHtml(copyText('Nuevo')):Math.round(stats.avg*100)+'%'}</span></div><p>${escapeHtml(displayEngineText(details.reasons[0]))}</p><small>${escapeHtml(displayEngineText(details.recommendation.label))} · ${relativePracticeLabel(stats.lastMs)}</small></article>`).join('')}</div><p class="adaptiveExplain">${escapeHtml(explanation)}</p>`;
}
function sessionAccuracy(item){
  const values=Object.values(item?.results||{});let score=0,total=0;
  for(const r of values){score+=Number(r?.score)||0;total+=Number(r?.total)||0}
  return total?Math.round(score/total*100):0;
}
let historyEditIndex=null;
function renderSessionHistory(){
  const list=$('#sessionHistoryList'),count=$('#historyCount');if(!list)return;
  if(count)count.textContent=archivedSessionCount()?(appLanguage==='en'?`${history.length} recent · ${archivedSessionCount()} archived`:appLanguage==='de'?`${history.length} aktuell · ${archivedSessionCount()} archiviert`:`${history.length} recientes · ${archivedSessionCount()} archivadas`):(appLanguage==='en'?`${history.length} recent`:appLanguage==='de'?`${history.length} aktuell`:`${history.length} recientes`);
  if(!history.length){list.innerHTML=`<article class="historyEmpty"><strong>${escapeHtml(copyText('Aún no hay sesiones'))}</strong><p>${escapeHtml(copyText('Cuando termines una sesión aparecerá aquí con sus resultados.'))}</p></article>`;return}
  const fmt=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  list.innerHTML=history.slice(0,24).map((item,index)=>{
    const date=new Date(item.at),accuracy=sessionAccuracy(item),entries=Object.entries(item.results||{}),context=ENGINE.normalizeContext(item.context);
    const achievement=appLanguage==='en'?'achievement':appLanguage==='de'?'Erfolg':'logro';return`<article class="historyCard"><div class="historyTop"><div><strong>${Number.isNaN(date.getTime())?(appLanguage==='en'?'Session':appLanguage==='de'?'Einheit':'Sesión'):fmt.format(date)}</strong><small>${t('level')} ${Number(item.level)||0} · ${accuracy}% ${achievement}</small><small class="historyContext">${escapeHtml(displayEngineText(ENGINE.contextLabel(context)))}</small></div><div class="historyCardTools"><span class="historyScore">${accuracy}%</span><button class="historyEditBtn" type="button" data-history-edit="${index}" aria-label="${escapeHtml(copyText('Corregir sesión'))}">${escapeHtml(copyText('Corregir'))}</button></div></div><div class="historyCommands">${entries.map(([cmd,r])=>`<span><b>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</b><small>${Number(r?.achieved)||0}✓ · ${Number(r?.assisted)||0}~ · ${Number(r?.missed)||0}×</small></span>`).join('')}</div></article>`;
  }).join('');
  $$('[data-history-edit]').forEach(button=>button.onclick=()=>openHistoryEditor(Number(button.dataset.historyEdit)));
}
function archiveMonthLabel(key){
  if(!/^\d{4}-\d{2}$/.test(key))return key;
  const [year,month]=key.split('-').map(Number),date=new Date(Date.UTC(year,month-1,1));
  const label=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  return label.charAt(0).toUpperCase()+label.slice(1);
}
function monthSummarySeed(source={}){
  return{sessions:Number(source.sessions)||0,score:Number(source.score)||0,total:Number(source.total)||0,contexts:{...(source.contexts||{})},commands:Object.fromEntries(Object.entries(source.commands||{}).map(([cmd,data])=>[cmd,{...data}]))};
}
function addSessionToMonthlySummary(month,item){
  month.sessions++;
  const context=ENGINE.contextLabel(ENGINE.normalizeContext(item?.context));month.contexts[context]=(month.contexts[context]||0)+1;
  for(const [cmd,result] of Object.entries(item?.results||{})){
    const score=Number(result?.score)||0,total=Number(result?.total)||0;month.score+=score;month.total+=total;
    const data=month.commands[cmd]||{sessions:0,score:0,total:0,timedSessions:0,seconds:0};data.sessions++;data.score+=score;data.total+=total;
    if(item?.timingMode==='cue-to-rating'&&Number(result?.avgSeconds)>0){data.timedSessions++;data.seconds+=Number(result.avgSeconds)}
    month.commands[cmd]=data;
  }
  return month;
}
function longTermEvolutionRows(limit=6){
  const months=Object.fromEntries(Object.entries(historyArchive?.months||{}).map(([key,value])=>[key,monthSummarySeed(value)]));
  for(const item of history){
    const key=archiveMonthKey(item?.at);if(key==='unknown')continue;
    months[key]=addSessionToMonthlySummary(months[key]||monthSummarySeed(),item);
  }
  return Object.entries(months).sort(([a],[b])=>a.localeCompare(b)).slice(-limit).map(([key,month])=>{
    const accuracy=month.total>0?Math.round(month.score/month.total*100):0;
    const topCommand=Object.entries(month.commands||{}).sort((a,b)=>(b[1]?.sessions||0)-(a[1]?.sessions||0))[0]||null;
    return{key,month,accuracy,topCommand};
  });
}
function renderLongTermEvolution(){
  const root=$('#longTermEvolution');if(!root)return;
  const rows=longTermEvolutionRows(6);root.hidden=rows.length<2;if(rows.length<2){root.innerHTML='';return}
  const first=rows[0],last=rows.at(-1),delta=last.accuracy-first.accuracy,maxSessions=Math.max(...rows.map(x=>x.month.sessions),1);
  const monthsTitle=appLanguage==='en'?`Last ${rows.length} active months`:appLanguage==='de'?`Letzte ${rows.length} aktive Monate`:`Últimos ${rows.length} meses con actividad`,deltaText=delta===0?copyText('Precisión estable'):delta>0?(appLanguage==='en'?`+${delta} accuracy pts since ${archiveMonthLabel(first.key)}`:appLanguage==='de'?`+${delta} Genauigkeitspunkte seit ${archiveMonthLabel(first.key)}`:`+${delta} pts de precisión desde ${archiveMonthLabel(first.key)}`):(appLanguage==='en'?`${delta} pts since ${archiveMonthLabel(first.key)}`:appLanguage==='de'?`${delta} Punkte seit ${archiveMonthLabel(first.key)}`:`${delta} pts desde ${archiveMonthLabel(first.key)}`);root.innerHTML=`<div class="longTermHead"><div><p class="kicker">${escapeHtml(copyText('EVOLUCIÓN A LARGO PLAZO'))}</p><h2>${escapeHtml(monthsTitle)}</h2><p>${escapeHtml(deltaText)} · ${allSessionCount()} ${appLanguage==='en'?'sessions recorded':appLanguage==='de'?'erfasste Einheiten':'sesiones registradas'}</p></div><span>${last.accuracy}% ${appLanguage==='en'?'current':appLanguage==='de'?'aktuell':'actual'}</span></div>
    <div class="longTermChart" role="list" aria-label="${escapeHtml(copyText('Evolución mensual'))}">${rows.map(row=>`<article class="longTermMonth" role="listitem"><div class="longTermBars"><i class="longTermSessionBar" style="height:${Math.max(12,Math.round(row.month.sessions/maxSessions*100))}%"></i><i class="longTermAccuracyBar" style="height:${Math.max(8,row.accuracy)}%"></i></div><strong>${row.accuracy}%</strong><small>${escapeHtml(archiveMonthLabel(row.key).replace(/ de /g,' '))}</small><span>${row.month.sessions} ${appLanguage==='en'?'sess.':appLanguage==='de'?'Ein.':'ses.'} · ${Object.keys(row.month.contexts||{}).length} ${appLanguage==='en'?'ctx.':appLanguage==='de'?'Kon.':'ctx.'}</span>${row.topCommand?`<em>${escapeHtml(displayCommand(commandBy(row.topCommand[0])||row.topCommand[0]))}</em>`:''}</article>`).join('')}</div>
    <div class="longTermLegend"><span><i class="legendSessions"></i> ${appLanguage==='en'?'sessions':appLanguage==='de'?'Einheiten':'sesiones'}</span><span><i class="legendAccuracy"></i> ${appLanguage==='en'?'accuracy':appLanguage==='de'?'Genauigkeit':'precisión'}</span></div>`;
}

function renderHistoryArchive(){
  const section=$('#historyArchiveSection'),list=$('#historyArchiveList'),count=$('#archiveCount');if(!section||!list)return;
  const months=Object.entries(historyArchive?.months||{}).sort(([a],[b])=>b.localeCompare(a));
  section.hidden=!months.length;if(count)count.textContent=`${archivedSessionCount()} ${appLanguage==='en'?(archivedSessionCount()===1?'session':'sessions'):appLanguage==='de'?(archivedSessionCount()===1?'Einheit':'Einheiten'):(archivedSessionCount()===1?'sesión':'sesiones')}`;
  list.innerHTML=months.map(([key,month])=>{
    const accuracy=Number(month.total)>0?Math.round(Number(month.score||0)/Number(month.total)*100):0;
    const commands=Object.entries(month.commands||{}).sort((a,b)=>(b[1]?.sessions||0)-(a[1]?.sessions||0)).slice(0,4);
    const sessionsLabel=appLanguage==='en'?'sessions':appLanguage==='de'?'Einheiten':'sesiones',contextsLabel=appLanguage==='en'?'contexts':appLanguage==='de'?'Kontexte':'contextos';return`<article class="archiveMonthCard"><div class="archiveMonthTop"><div><strong>${escapeHtml(archiveMonthLabel(key))}</strong><small>${Number(month.sessions)||0} ${sessionsLabel} · ${Object.keys(month.contexts||{}).length} ${contextsLabel}</small></div><span>${accuracy}%</span></div><div class="archiveCommands">${commands.map(([cmd,data])=>`<span><b>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</b><small>${Number(data.sessions)||0} ${sessionsLabel} · ${Number(data.total)>0?Math.round(Number(data.score||0)/Number(data.total)*100):0}%</small></span>`).join('')}</div></article>`;
  }).join('');
}

function historyEditorRow(cmd,result){
  const total=Math.max(1,Number(result?.total)||5);
  return`<article class="historyEditRow" data-history-command="${escapeHtml(cmd)}" data-history-total="${total}">
    <div><strong>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</strong><small>${total} ${appLanguage==='en'?'executions recorded':appLanguage==='de'?'Ausführungen erfasst':'ejecuciones registradas'}</small></div>
    <label><span>${escapeHtml(t('achieved'))}</span><input data-history-field="achieved" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.achieved)||0}"></label>
    <label><span>${escapeHtml(t('assisted'))}</span><input data-history-field="assisted" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.assisted)||0}"></label>
    <label><span>${escapeHtml(t('missed'))}</span><input data-history-field="missed" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.missed)||0}"></label>
  </article>`;
}
function openHistoryEditor(index){
  const item=history[index],dialog=$('#historyEditDialog');if(!item||!dialog)return;
  historyEditIndex=index;const date=new Date(item.at),fmt=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{dateStyle:'medium',timeStyle:'short'}),context=ENGINE.normalizeContext(item.context);
  $('#historyEditMeta').textContent=`${t('level')} ${Number(item.level)||0} · ${Number.isNaN(date.getTime())?copyText('fecha desconocida'):fmt.format(date)} · ${displayEngineText(ENGINE.contextLabel(context))}`;
  $('#historyEditResults').innerHTML=Object.entries(item.results||{}).map(([cmd,result])=>historyEditorRow(cmd,result)).join('');
  if(!dialog.open)dialog.showModal();
}
function closeHistoryEditor(){historyEditIndex=null;const dialog=$('#historyEditDialog');if(dialog?.open)dialog.close()}
async function saveHistoryCorrection(){
  if(historyEditIndex===null||!history[historyEditIndex])return;
  const original=history[historyEditIndex],results={...original.results},affected=[];
  for(const row of $$('.historyEditRow')){
    const cmd=row.dataset.historyCommand,total=Number(row.dataset.historyTotal)||5;
    const read=field=>Number(row.querySelector(`[data-history-field="${field}"]`)?.value);
    const achieved=read('achieved'),assisted=read('assisted'),missed=read('missed'),values=[achieved,assisted,missed];
    if(values.some(value=>!Number.isInteger(value)||value<0||value>total)){toast(copyText('Usa números enteros entre 0 y ')+total);return}
    if(achieved+assisted+missed!==total){toast(appLanguage==='en'?`${displayCommand(commandBy(cmd)||cmd)} must total ${total} executions`:appLanguage==='de'?`${displayCommand(commandBy(cmd)||cmd)} muss insgesamt ${total} Ausführungen ergeben`:`${displayCommand(commandBy(cmd)||cmd)} debe sumar ${total} ejecuciones`);return}
    const prev=results[cmd]||{},outcomes=[...Array(achieved).fill('achieved'),...Array(assisted).fill('assisted'),...Array(missed).fill('missed')];
    results[cmd]={...prev,achieved,assisted,missed,total,score:achieved+assisted*.5,outcomes};affected.push(cmd);
  }
  const nextHistory=[...history];nextHistory[historyEditIndex]={...original,results};
  await replaceHistoryAndRebuild(nextHistory,affected);closeHistoryEditor();toast(copyText('Sesión corregida y evidencia recalculada'));
}
async function deleteHistorySession(){
  if(historyEditIndex===null||!history[historyEditIndex])return;
  if(!confirm(copyText('¿Eliminar esta sesión? Se recalculará la evidencia de sus comandos.')))return;
  const item=history[historyEditIndex],affected=Object.keys(item.results||{}),nextHistory=history.filter((_,index)=>index!==historyEditIndex);
  await replaceHistoryAndRebuild(nextHistory,affected);closeHistoryEditor();toast(copyText('Sesión eliminada y evidencia recalculada'));
}

function renderProgress(){
  const pct=levelProgress(currentLevel),routePct=totalProgress(),level=levelBy(currentLevel),levelTotal=level?.commands?.length||0;renderDogIdentity();
  $('#progressPct').textContent=pct+'%';$('#progressRing').style.setProperty('--p',pct);
  $('#progressHeadline').textContent=copyText(pct===0?'Empieza este nivel':pct<35?'Construyendo bases':pct<70?'Buen progreso del nivel':pct<100?'Casi listo para avanzar':'Nivel consolidado');
  const lt=levelText(level);$('#progressText').textContent=pct===0?(appLanguage==='en'?`Level ${currentLevel} · ${lt.title}. Complete a session to generate evidence.`:appLanguage==='de'?`Stufe ${currentLevel} · ${lt.title}. Schließe eine Einheit ab, um Daten zu erzeugen.`:`Nivel ${currentLevel} · ${lt.title}. Completa una sesión para generar evidencia.`):(appLanguage==='en'?`${currentLevelSolidCount()} of ${levelTotal} commands in this level are consistent or better · ${routePct}% of the full route.`:appLanguage==='de'?`${currentLevelSolidCount()} von ${levelTotal} Kommandos dieser Stufe sind konstant oder besser · ${routePct}% der gesamten Route.`:`${currentLevelSolidCount()} de ${levelTotal} comandos del nivel están consistentes o mejor · ${routePct}% de la ruta completa.`);
  const adaptive=$('#adaptiveSummary');if(adaptive)adaptive.innerHTML=adaptiveSummaryHtml();
  renderSessionHistory();renderHistoryArchive();renderLongTermEvolution();if(typeof renderEvolutionDashboard==='function')renderEvolutionDashboard();
}
function localDateKey(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function historyDaySet(){return new Set(history.map(x=>{const d=new Date(x.at);return Number.isNaN(d.getTime())?null:localDateKey(d)}).filter(Boolean))}
function currentHealthyStreak(){
  const days=historyDaySet();if(!days.size)return 0;
  const cursor=new Date();cursor.setHours(0,0,0,0);
  if(!days.has(localDateKey(cursor)))cursor.setDate(cursor.getDate()-1);
  let count=0;
  while(days.has(localDateKey(cursor))){count++;cursor.setDate(cursor.getDate()-1)}
  return count;
}
function weekDays(){
  const today=new Date();today.setHours(0,0,0,0);
  const start=new Date(today);start.setDate(today.getDate()-((today.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return date});
}
function sessionsThisWeek(){
  const [start]=weekDays(),end=new Date(start);end.setDate(start.getDate()+7);
  return history.filter(x=>{const d=new Date(x.at);return d>=start&&d<end}).length;
}
function renderHabit(){
  const card=$('#habitCard');if(!card)return;
  const days=historyDaySet(),todayKey=localDateKey(new Date()),streak=currentHealthyStreak(),weekCount=sessionsThisWeek();
  const names=appLanguage==='en'?['M','T','W','T','F','S','S']:appLanguage==='de'?['M','D','M','D','F','S','S']:['L','M','X','J','V','S','D'];
  const streakText=streak?(appLanguage==='en'?`${streak} ${streak===1?'day':'days'} streak`:appLanguage==='de'?`${streak} ${streak===1?'Tag':'Tage'} Serie`:`${streak} ${streak===1?'día':'días'} de racha`):copyText('Empieza tu racha'),habitText=history.length?(appLanguage==='en'?'One micro-session a day is enough. You do not need to overtrain to maintain it.':appLanguage==='de'?'Eine Mikro-Einheit pro Tag reicht aus. Du musst nicht zu viel trainieren, um die Serie zu halten.':'Una micro-sesión al día es suficiente. No necesitas entrenar de más para mantenerla.'):(appLanguage==='en'?'The first session of the week counts. Short, clear and positive.':appLanguage==='de'?'Die erste Einheit der Woche zählt. Kurz, klar und positiv.':'La primera sesión de la semana cuenta. Corta, clara y positiva.');card.innerHTML=`<div class="habitHead"><div><p class="kicker">${escapeHtml(copyText('HÁBITO SALUDABLE'))}</p><h2>${escapeHtml(streakText)}</h2><p>${escapeHtml(habitText)}</p></div><div class="habitFlame" aria-hidden="true">${icon('flame')}</div></div><div class="habitWeek" aria-label="${escapeHtml(copyText('Actividad de esta semana'))}">${weekDays().map((date,i)=>{const key=localDateKey(date),active=days.has(key),today=key===todayKey,future=date>new Date();return`<div class="habitDay ${active?'active':''} ${today?'today':''} ${future?'future':''}"><span>${names[i]}</span><div aria-label="${escapeHtml(copyText(active?'Entrenamiento registrado':'Sin entrenamiento'))}">${active?icon('check'):''}</div></div>`}).join('')}</div><div class="habitFoot"><span>${weekCount} ${appLanguage==='en'?(weekCount===1?'session':'sessions'):appLanguage==='de'?(weekCount===1?'Einheit':'Einheiten'):(weekCount===1?'sesión':'sesiones')} ${appLanguage==='en'?'this week':appLanguage==='de'?'diese Woche':'esta semana'}</span><span>${allSessionCount()} ${appLanguage==='en'?'total':appLanguage==='de'?'gesamt':'total'}</span></div>`;
  const first=$('#firstSessionCoach');if(first)first.hidden=allSessionCount()>0;
}

$('#closeHistoryEditBtn')?.addEventListener('click',closeHistoryEditor);
$('#cancelHistoryEditBtn')?.addEventListener('click',closeHistoryEditor);
$('#saveHistoryEditBtn')?.addEventListener('click',saveHistoryCorrection);
$('#deleteHistorySessionBtn')?.addEventListener('click',deleteHistorySession);
$('#historyEditDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeHistoryEditor()});
$('#historyEditDialog')?.addEventListener('click',e=>{if(e.target===$('#historyEditDialog'))closeHistoryEditor()});
