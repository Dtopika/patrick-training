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
  const eligible=COMMANDS.filter(c=>c.level<=currentLevel).map(c=>({c,score:typeof adaptivePriority==='function'?adaptivePriority(c,currentLevel):0,stats:commandTrialStats(c.cmd)})).sort((a,b)=>b.score-a.score).slice(0,3);
  if(!eligible.length)return'';
  return`<div class="adaptiveSummaryHead"><div><p class="kicker">SESIÓN ADAPTATIVA</p><h2>Prioridades de hoy</h2></div><span class="adaptiveBadge">Automático</span></div><div class="adaptiveCards">${eligible.map(({c,stats})=>`<article><strong>${escapeHtml(displayCommand(c))}</strong><span>${stats.avg===null?'Nuevo':Math.round(stats.avg*100)+'% reciente'}</span><small>${relativePracticeLabel(stats.lastMs)}</small></article>`).join('')}</div><p class="adaptiveExplain">La app prioriza comandos del nivel actual, resultados bajos y prácticas que llevan más tiempo sin repetirse.</p>`;
}
function sessionAccuracy(item){
  const values=Object.values(item?.results||{});let score=0,total=0;
  for(const r of values){score+=Number(r?.score)||0;total+=Number(r?.total)||0}
  return total?Math.round(score/total*100):0;
}
function renderSessionHistory(){
  const list=$('#sessionHistoryList'),count=$('#historyCount');if(!list)return;
  if(count)count.textContent=`${history.length} total`;
  if(!history.length){list.innerHTML='<article class="historyEmpty"><strong>Aún no hay sesiones</strong><p>Cuando termines una sesión aparecerá aquí con sus resultados.</p></article>';return}
  const fmt=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  list.innerHTML=history.slice(0,24).map(item=>{
    const date=new Date(item.at),accuracy=sessionAccuracy(item),entries=Object.entries(item.results||{});
    return`<article class="historyCard"><div class="historyTop"><div><strong>${Number.isNaN(date.getTime())?'Sesión':fmt.format(date)}</strong><small>Nivel ${Number(item.level)||0} · ${accuracy}% de logro</small></div><span class="historyScore">${accuracy}%</span></div><div class="historyCommands">${entries.map(([cmd,r])=>`<span><b>${escapeHtml(displayCommand(commandBy(cmd)||cmd))}</b><small>${Number(r?.achieved)||0}✓ · ${Number(r?.assisted)||0}~ · ${Number(r?.missed)||0}×</small></span>`).join('')}</div></article>`;
  }).join('');
}
function renderProgress(){
  const pct=totalProgress();renderDogIdentity();
  $('#progressPct').textContent=pct+'%';$('#progressRing').style.setProperty('--p',pct);
  $('#progressHeadline').textContent=pct===0?'Tu ruta empieza aquí':pct<35?'Construyendo bases':pct<70?'Buen progreso':'Obediencia avanzada';
  $('#progressText').textContent=pct===0?'Completa una sesión guiada para empezar a construir el historial.':`${solidCount()} de ${COMMANDS.length} comandos están consistentes o mejor.`;
  const adaptive=$('#adaptiveSummary');if(adaptive)adaptive.innerHTML=adaptiveSummaryHtml();
  $('#progressList').innerHTML=COMMANDS.map(c=>{const stats=commandTrialStats(c.cmd),recent=stats.avg===null?'Sin datos':`${Math.round(stats.avg*100)}% reciente`;return`<article class="progressRow progressRowV56"><div class="progressMain"><strong>${escapeHtml(displayCommand(c))} · <span class="pronunciation">${escapeHtml(displayPron(c))}</span></strong><small>Nivel ${c.level} · ${escapeHtml(c.meaning)}</small><div class="progressEvidence">${trialTrendHtml(stats.arr)}<span>${recent} · ${relativePracticeLabel(stats.lastMs)}</span></div></div><select data-state="${escapeHtml(c.cmd)}" aria-label="Estado de ${escapeHtml(displayCommand(c))}">${STATES.map(s=>`<option ${stateOf(c.cmd)===s?'selected':''}>${s}</option>`).join('')}</select></article>`}).join('');
  $$('[data-state]').forEach(s=>s.onchange=()=>{progress[s.dataset.state]=s.value;store.set('patrickProgress',progress);renderAll()});
  renderSessionHistory();
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
