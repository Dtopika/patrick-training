'use strict';
function localReminderDateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function trainedToday(){const today=localReminderDateKey();return history.some(item=>{const d=new Date(item.at);return !Number.isNaN(d.getTime())&&localReminderDateKey(d)===today})}
function reminderActivitySnapshot(now=new Date()){
  const today=localReminderDateKey(now),days=new Set(),timestamps=[];
  for(const item of history){const d=new Date(item?.at);if(Number.isNaN(d.getTime()))continue;days.add(localReminderDateKey(d));timestamps.push(d.getTime())}
  const sessions7=history.filter(item=>{const t=Date.parse(item?.at||'');return Number.isFinite(t)&&t<=now.getTime()&&now.getTime()-t<7*86400000}).length;
  const last=timestamps.length?Math.max(...timestamps):null,daysSinceLast=last===null?null:Math.max(0,Math.floor((new Date(today+'T12:00:00').getTime()-new Date(localReminderDateKey(new Date(last))+'T12:00:00').getTime())/86400000));
  return{sessions7,daysSinceLast,trainedYesterday:days.has(localReminderDateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1)))};
}
function reminderTimePassed(){const [h,m]=String(reminderSettings.time||'19:00').split(':').map(Number),now=new Date();return now.getHours()>h||(now.getHours()===h&&now.getMinutes()>=m)}
function notificationSupported(){return 'Notification'in window&&'serviceWorker'in navigator}
async function loadReminderSettings(){
  let saved,localSaved=null;reminderStorageMode='indexeddb';
  try{saved=await window.PatrickDB?.get?.(REMINDER_KEY)}catch(e){reminderStorageMode='localStorage';console.warn('No pude leer recordatorios desde IndexedDB',e)}
  try{localSaved=JSON.parse(localStorage.getItem(REMINDER_KEY)||'null')}catch{}
  if(saved===undefined&&localSaved&&reminderStorageMode==='indexeddb'){
    try{await window.PatrickDB.set(REMINDER_KEY,localSaved);localStorage.removeItem(REMINDER_KEY);saved=localSaved}catch{reminderStorageMode='localStorage';saved=localSaved}
  }else if(saved===undefined&&localSaved)saved=localSaved;
  if(saved&&typeof saved==='object')reminderSettings={...reminderSettings,...saved};
  reminderSettings.time=/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderSettings.time||'')?reminderSettings.time:'19:00';
  reminderLoaded=true;syncReminderUI();scheduleForegroundReminder();
}
async function saveReminderSettings(){
  if(storageMode!=='indexeddb'||reminderStorageMode==='localStorage'){
    reminderStorageMode='localStorage';try{localStorage.setItem(REMINDER_KEY,JSON.stringify(reminderSettings))}catch{}return false;
  }
  try{await window.PatrickDB.set(REMINDER_KEY,reminderSettings);reminderStorageMode='indexeddb';return true}catch(e){reminderStorageMode='localStorage';console.warn('No pude guardar recordatorios en IndexedDB',e);try{localStorage.setItem(REMINDER_KEY,JSON.stringify(reminderSettings))}catch{}return false}
}
async function periodicReminderRegistration(enable){
  if(!('serviceWorker'in navigator))return false;
  if(enable&&(storageMode!=='indexeddb'||reminderStorageMode!=='indexeddb'))return false;
  try{
    const reg=await navigator.serviceWorker.ready;if(!reg.periodicSync)return false;
    if(enable)await reg.periodicSync.register(REMINDER_TAG,{minInterval:12*60*60*1000});else await reg.periodicSync.unregister(REMINDER_TAG);
    return true;
  }catch(e){console.info('Periodic Background Sync no disponible en este dispositivo',e);return false}
}
function reminderMessage(){
  const day=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{weekday:'long'}).format(new Date()),activity=reminderActivitySnapshot();
  const streak=typeof currentHealthyStreak==='function'?currentHealthyStreak():0;
  const title=appLanguage==='en'?`Today is ${day} 🐾`:appLanguage==='de'?`Heute ist ${day} 🐾`:`Hoy es ${day} 🐾`;
  let body;
  if(streak>0)body=appLanguage==='en'?`Your streak is ${streak} ${streak===1?'day':'days'}. One clear micro-session with ${dogName()} keeps it going.`:appLanguage==='de'?`Deine Serie steht bei ${streak} ${streak===1?'Tag':'Tagen'}. Eine klare Mikro-Einheit mit ${dogName()} hält sie am Laufen.`:`Tu racha va en ${streak} ${streak===1?'día':'días'}. Una micro-sesión clara con ${dogName()} la mantiene.`;
  else if(activity.daysSinceLast!==null&&activity.daysSinceLast>=2)body=appLanguage==='en'?`It has been ${activity.daysSinceLast} days since the last session. Restart with 3 easy minutes and one clear win.`:appLanguage==='de'?`Seit der letzten Einheit sind ${activity.daysSinceLast} Tage vergangen. Starte mit 3 leichten Minuten und einem klaren Erfolg.`:`Van ${activity.daysSinceLast} días desde la última sesión. Retoma con 3 minutos fáciles y una victoria clara.`;
  else if(activity.trainedYesterday)body=appLanguage==='en'?`You trained yesterday. A short review with ${dogName()} today is enough to keep the habit healthy.`:appLanguage==='de'?`Ihr habt gestern trainiert. Eine kurze Wiederholung mit ${dogName()} reicht heute, um die Gewohnheit gesund zu halten.`:`Ayer entrenaron. Un repaso corto con ${dogName()} hoy es suficiente para mantener el hábito sano.`;
  else body=appLanguage==='en'?`One short micro-session with ${dogName()} is enough to build the habit.`:appLanguage==='de'?`Eine kurze Mikro-Einheit mit ${dogName()} reicht aus, um die Gewohnheit aufzubauen.`:`Una micro-sesión corta con ${dogName()} es suficiente para construir el hábito.`;
  return{title,body};
}
async function showDailyReminder(force=false){
  if(!reminderLoaded||!reminderSettings.enabled||!notificationSupported()||Notification.permission!=='granted'||trainedToday())return false;
  const today=localReminderDateKey();if(!force&&(!reminderTimePassed()||reminderSettings.lastNotifiedDate===today))return false;
  try{
    const reg=await navigator.serviceWorker.ready,{title,body}=reminderMessage();
    await reg.showNotification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:REMINDER_TAG,renotify:false,data:{url:'./'},vibrate:[120,70,120]});
    reminderSettings.lastNotifiedDate=today;await saveReminderSettings();syncReminderUI();return true;
  }catch(e){console.warn('No pude mostrar el recordatorio',e);return false}
}
function scheduleForegroundReminder(){
  clearTimeout(reminderTimer);reminderTimer=null;if(!reminderSettings.enabled)return;
  const [h,m]=String(reminderSettings.time||'19:00').split(':').map(Number),now=new Date(),target=new Date(now);target.setHours(h,m,0,0);if(target<=now)target.setDate(target.getDate()+1);
  reminderTimer=setTimeout(async()=>{await showDailyReminder();scheduleForegroundReminder()},Math.min(target-now,2147483647));
}
async function toggleDailyReminders(){
  if(!notificationSupported()){toast(appLanguage==='en'?'This browser does not support PWA notifications.':appLanguage==='de'?'Dieser Browser unterstützt keine PWA-Benachrichtigungen.':'Este navegador no admite notificaciones PWA.');return}
  if(reminderSettings.enabled){reminderSettings.enabled=false;await saveReminderSettings();await periodicReminderRegistration(false);scheduleForegroundReminder();syncReminderUI();toast(appLanguage==='en'?'Reminders disabled':appLanguage==='de'?'Erinnerungen deaktiviert':'Recordatorios desactivados');return}
  let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();
  if(permission!=='granted'){reminderSettings.enabled=false;await saveReminderSettings();syncReminderUI();toast(appLanguage==='en'?'Enable Patrick Training notifications in your browser settings.':appLanguage==='de'?'Aktiviere Patrick-Training-Benachrichtigungen in den Browser-Einstellungen.':'Activa las notificaciones de Patrick Training en los ajustes del navegador.');return}
  reminderSettings.enabled=true;reminderSettings.lastNotifiedDate=null;await saveReminderSettings();const background=await periodicReminderRegistration(true);scheduleForegroundReminder();syncReminderUI();
  toast(appLanguage==='en'?(background?'Reminders enabled':'Reminders enabled; they will be checked while using the app'):appLanguage==='de'?(background?'Erinnerungen aktiviert':'Erinnerungen aktiviert; sie werden bei Nutzung der App geprüft'):(background?'Recordatorios activados':'Recordatorios activados; se comprobarán al usar la app'));
}
function syncReminderUI(){
  const button=$('#notificationToggle'),value=$('#notificationStatus'),time=$('#notificationTime'),note=$('#notificationSupportText');if(!button)return;
  const supported=notificationSupported(),permission=supported?Notification.permission:'unsupported';
  button.disabled=!supported;button.setAttribute('aria-pressed',String(!!reminderSettings.enabled));
  if(value)value.textContent=!supported?(appLanguage==='en'?'Unavailable':appLanguage==='de'?'Nicht verfügbar':'No disponible'):permission==='denied'?(appLanguage==='en'?'Blocked':appLanguage==='de'?'Blockiert':'Bloqueadas'):reminderSettings.enabled?(appLanguage==='en'?'Enabled':appLanguage==='de'?'Aktiv':'Activadas'):(appLanguage==='en'?'Off':appLanguage==='de'?'Aus':'Desactivadas');
  if(time){time.value=reminderSettings.time||'19:00';time.disabled=!reminderSettings.enabled}
  if(note)note.textContent=permission==='denied'?(appLanguage==='en'?'The browser has blocked notifications for this app.':appLanguage==='de'?'Der Browser hat Benachrichtigungen für diese App blockiert.':'El navegador tiene bloqueadas las notificaciones para esta app.'):reminderSettings.enabled&&(storageMode!=='indexeddb'||reminderStorageMode!=='indexeddb')?(appLanguage==='en'?'The reminder works while you use the app; this storage mode cannot check it in the background.':appLanguage==='de'?'Die Erinnerung funktioniert während der App-Nutzung; dieser Speichermodus kann sie nicht im Hintergrund prüfen.':'El recordatorio funciona mientras usas la app; este almacenamiento no permite comprobarlo en segundo plano.'):reminderSettings.enabled?(appLanguage==='en'?'It adapts to your recent activity and never sends if you already trained today. The system may choose the exact background check time.':appLanguage==='de'?'Sie passt sich deiner letzten Aktivität an und sendet nichts, wenn du heute schon trainiert hast. Das System kann den genauen Zeitpunkt der Hintergrundprüfung bestimmen.':'Se adapta a tu actividad reciente y no envía nada si ya entrenaste hoy. El sistema puede decidir el momento exacto del chequeo en segundo plano.'):(appLanguage==='en'?'Enable them to get a daily reminder if you have not trained yet.':appLanguage==='de'?'Aktiviere sie für eine tägliche Erinnerung, falls du noch nicht trainiert hast.':'Actívalas para recibir un recordatorio diario si aún no has entrenado.');
}
