function commandTrialStats(cmd){
  const arr=Array.isArray(trials[cmd])?trials[cmd].map(Number).filter(Number.isFinite):[];
  const avg=arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  const lastMs=typeof commandLastPracticeMs==='function'?commandLastPracticeMs(cmd):0;
  return{arr,avg,lastMs};
}
function relativePracticeLabel(ms){
  if(!ms)return'Nunca';
  const days=Math.floor(Math.max(0,Date.now()-ms)/86400000);
  if(days===0)return'Hoy';if(days===1)return'Ayer';if(days<7)return`Hace ${days} días`;
  const weeks=Math.floor(days/7);return`Hace ${weeks} ${weeks===1?'semana':'semanas'}`;
}
function trialTrendHtml(arr){
  if(!arr.length)return'<span class="trendEmpty">Sin ejecuciones aún</span>';
  const recent=arr.slice(-10),labels=recent.map(v=>v>=1?'Logrado':v>=.5?'Con ayuda':'No logrado');
  return`<span class="trialTrend"><span class="srOnly">Últimas ejecuciones: ${escapeHtml(labels.join(', '))}</span>${recent.map((v,i)=>`<i class="${v>=1?'hit':v>=.5?'assist':'miss'}" aria-hidden="true" title="${escapeHtml(labels[i])}"></i>`).join('')}</span>`;
}
function adaptiveSummaryHtml(){
  const eligible=COMMANDS.filter(c=>c.level<=currentLevel).map(c=>{const details=commandPriorityDetails(c,currentLevel);return{c,details,stats:commandTrialStats(c.cmd)}}).sort((a,b)=>b.details.score-a.details.score).slice(0,3);
  if(!eligible.length)return'';
  return`<div class="adaptiveSummaryHead"><div><p class="kicker">MOTOR ADAPTATIVO V2</p><h2>Prioridades de hoy</h2></div><span class="adaptiveBadge">Explicable</span></div><div class="adaptiveCards adaptiveCardsV2">${eligible.map(({c,details,stats})=>`<article><div class="adaptiveCardTop"><strong>${escapeHtml(displayCommand(c))}</strong><span>${stats.avg===null?'Nuevo':Math.round(stats.avg*100)+'%'}</span></div><p>${escapeHtml(details.reasons[0])}</p><small>${escapeHtml(details.recommendation.label)} · ${relativePracticeLabel(stats.lastMs)}</small></article>`).join('')}</div><p class="adaptiveExplain">La prioridad combina nivel, rendimiento reciente, tiempo sin practicar y evidencia en contextos diferentes. La sugerencia de contexto no cambia tu sesión hasta que tú la selecciones.</p>`;
}
function sessionAccuracy(item){
  const values=Object.values(item?.results||{});let score=0,total=0;
  for(const r of values){score+=Number(r?.score)||0;total+=Number(r?.total)||0}
  return total?Math.round(score/total*100):0;
}
let historyEditIndex=null;
function renderSessionHistory(){
  const list=$('#sessionHistoryList'),count=$('#historyCount');if(!list)return;
  if(count)count.textContent=`${history.length} total`;
  if(!history.length){list.innerHTML='<article class="historyEmpty"><strong>Aún no hay sesiones</strong><p>Cuando termines una sesión aparecerá aquí con sus resultados.</p></article>';return}
  const fmt=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  list.innerHTML=history.slice(0,24).map((item,index)=>{
    const date=new Date(item.at),accuracy=sessionAccuracy(item),entries=Object.entries(item.results||{}),context=ENGINE.normalizeContext(item.context);
    return`<article class="historyCard"><div class="historyTop"><div><strong>${Number.isNaN(date.getTime())?'Sesión':fmt.format(date)}</strong><small>Nivel ${Number(item.level)||0} · ${accuracy}% de logro</small><small class="historyContext">${escapeHtml(ENGINE.contextLabel(context))}</small></div><div class="historyCardTools"><span class="historyScore">${accuracy}%</span><button class="historyEditBtn" type="button" data-history-edit="${index}" aria-label="Corregir sesión">Corregir</button></div></div><div class="historyCommands">${entries.map(([cmd,r])=>`<span><b>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</b><small>${Number(r?.achieved)||0}✓ · ${Number(r?.assisted)||0}~ · ${Number(r?.missed)||0}×</small></span>`).join('')}</div></article>`;
  }).join('');
  $$('[data-history-edit]').forEach(button=>button.onclick=()=>openHistoryEditor(Number(button.dataset.historyEdit)));
}
function historyEditorRow(cmd,result){
  const total=Math.max(1,Number(result?.total)||5);
  return`<article class="historyEditRow" data-history-command="${escapeHtml(cmd)}" data-history-total="${total}">
    <div><strong>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</strong><small>${total} ejecuciones registradas</small></div>
    <label><span>Logrado</span><input data-history-field="achieved" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.achieved)||0}"></label>
    <label><span>Con ayuda</span><input data-history-field="assisted" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.assisted)||0}"></label>
    <label><span>No logrado</span><input data-history-field="missed" type="number" min="0" max="${total}" inputmode="numeric" value="${Number(result?.missed)||0}"></label>
  </article>`;
}
function openHistoryEditor(index){
  const item=history[index],dialog=$('#historyEditDialog');if(!item||!dialog)return;
  historyEditIndex=index;const date=new Date(item.at),fmt=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}),context=ENGINE.normalizeContext(item.context);
  $('#historyEditMeta').textContent=`Nivel ${Number(item.level)||0} · ${Number.isNaN(date.getTime())?'fecha desconocida':fmt.format(date)} · ${ENGINE.contextLabel(context)}`;
  $('#historyEditResults').innerHTML=Object.entries(item.results||{}).map(([cmd,result])=>historyEditorRow(cmd,result)).join('');
  if(!dialog.open)dialog.showModal();
}
function closeHistoryEditor(){historyEditIndex=null;const dialog=$('#historyEditDialog');if(dialog?.open)dialog.close()}
async function saveHistoryCorrection(){
  if(historyEditIndex===null||!history[historyEditIndex])return;
  const original=history[historyEditIndex],results={...original.results},affected=[];
  for(const row of $$('.historyEditRow')){
    const cmd=row.dataset.historyCommand,total=Number(row.dataset.historyTotal)||5;
    const read=field=>Math.max(0,Math.min(total,Number(row.querySelector(`[data-history-field="${field}"]`)?.value)||0));
    const achieved=read('achieved'),assisted=read('assisted'),missed=read('missed');
    if(achieved+assisted+missed!==total){toast(`${displayCommand(commandBy(cmd)||cmd)} debe sumar ${total} ejecuciones`);return}
    const prev=results[cmd]||{},outcomes=[...Array(achieved).fill('achieved'),...Array(assisted).fill('assisted'),...Array(missed).fill('missed')];
    results[cmd]={...prev,achieved,assisted,missed,total,score:achieved+assisted*.5,outcomes};affected.push(cmd);
  }
  const nextHistory=[...history];nextHistory[historyEditIndex]={...original,results};
  await replaceHistoryAndRebuild(nextHistory,affected);closeHistoryEditor();toast('Sesión corregida y evidencia recalculada');
}
async function deleteHistorySession(){
  if(historyEditIndex===null||!history[historyEditIndex])return;
  if(!confirm('¿Eliminar esta sesión? Se recalculará la evidencia de sus comandos.'))return;
  const item=history[historyEditIndex],affected=Object.keys(item.results||{}),nextHistory=history.filter((_,index)=>index!==historyEditIndex);
  await replaceHistoryAndRebuild(nextHistory,affected);closeHistoryEditor();toast('Sesión eliminada y evidencia recalculada');
}

function renderProgress(){
  const pct=levelProgress(currentLevel),routePct=totalProgress(),level=levelBy(currentLevel),levelTotal=level?.commands?.length||0;renderDogIdentity();
  $('#progressPct').textContent=pct+'%';$('#progressRing').style.setProperty('--p',pct);
  $('#progressHeadline').textContent=pct===0?'Empieza este nivel':pct<35?'Construyendo bases':pct<70?'Buen progreso del nivel':pct<100?'Casi listo para avanzar':'Nivel consolidado';
  $('#progressText').textContent=pct===0?`Nivel ${currentLevel} · ${level?.title||''}. Completa una sesión para generar evidencia.`:`${currentLevelSolidCount()} de ${levelTotal} comandos del nivel están consistentes o mejor · ${routePct}% de la ruta completa.`;
  const adaptive=$('#adaptiveSummary');if(adaptive)adaptive.innerHTML=adaptiveSummaryHtml();
  renderSessionHistory();if(typeof renderEvolutionDashboard==='function')renderEvolutionDashboard();
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
  const names=['L','M','X','J','V','S','D'];
  card.innerHTML=`<div class="habitHead"><div><p class="kicker">HÁBITO SALUDABLE</p><h2>${streak?`${streak} ${streak===1?'día':'días'} de racha`:'Empieza tu racha'}</h2><p>${history.length?'Una micro-sesión al día es suficiente. No necesitas entrenar de más para mantenerla.':'La primera sesión de la semana cuenta. Corta, clara y positiva.'}</p></div><div class="habitFlame" aria-hidden="true">${icon('flame')}</div></div><div class="habitWeek" aria-label="Actividad de esta semana">${weekDays().map((date,i)=>{const key=localDateKey(date),active=days.has(key),today=key===todayKey,future=date>new Date();return`<div class="habitDay ${active?'active':''} ${today?'today':''} ${future?'future':''}"><span>${names[i]}</span><div aria-label="${active?'Entrenamiento registrado':'Sin entrenamiento'}">${active?icon('check'):''}</div></div>`}).join('')}</div><div class="habitFoot"><span>${weekCount} ${weekCount===1?'sesión':'sesiones'} esta semana</span><span>${history.length} total</span></div>`;
  const first=$('#firstSessionCoach');if(first)first.hidden=history.length>0;
}

$('#closeHistoryEditBtn')?.addEventListener('click',closeHistoryEditor);
$('#cancelHistoryEditBtn')?.addEventListener('click',closeHistoryEditor);
$('#saveHistoryEditBtn')?.addEventListener('click',saveHistoryCorrection);
$('#deleteHistorySessionBtn')?.addEventListener('click',deleteHistorySession);
$('#historyEditDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeHistoryEditor()});
$('#historyEditDialog')?.addEventListener('click',e=>{if(e.target===$('#historyEditDialog'))closeHistoryEditor()});
