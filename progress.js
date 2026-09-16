function renderProgress(){
  const pct=totalProgress();renderDogIdentity();
  $('#progressPct').textContent=pct+'%';$('#progressRing').style.setProperty('--p',pct);
  $('#progressHeadline').textContent=pct===0?'Tu ruta empieza aquí':pct<35?'Construyendo bases':pct<70?'Buen progreso':'Obediencia avanzada';
  $('#progressText').textContent=pct===0?'Completa una sesión guiada para empezar a construir el historial.':`${solidCount()} de ${COMMANDS.length} comandos están consistentes o mejor.`;
  $('#progressList').innerHTML=COMMANDS.map(c=>`<article class="progressRow"><div><strong>${escapeHtml(displayCommand(c))} · <span class="pronunciation">${escapeHtml(displayPron(c))}</span></strong><small>Nivel ${c.level} · ${escapeHtml(c.meaning)}</small></div><select data-state="${escapeHtml(c.cmd)}" aria-label="Estado de ${escapeHtml(displayCommand(c))}">${STATES.map(s=>`<option ${stateOf(c.cmd)===s?'selected':''}>${s}</option>`).join('')}</select></article>`).join('');
  $$('[data-state]').forEach(s=>s.onchange=()=>{progress[s.dataset.state]=s.value;store.set('patrickProgress',progress);renderAll()});
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
