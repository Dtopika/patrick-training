const SYSTEM_THEME=window.matchMedia('(prefers-color-scheme: dark)');
const REMINDER_KEY='patrickNotifications';
const REMINDER_TAG='patrick-daily-reminder';
let profileUiInitialized=false,reminderLoaded=false,reminderTimer=null,reminderStorageMode='indexeddb',settingsReturnFocus=null;
let reminderSettings={enabled:false,time:'19:00',lastNotifiedDate:null};

function currentDogAgeMonths(){return ENGINE.effectiveAgeMonths(dogProfile)}
function dogAgeLabel(){
  const months=currentDogAgeMonths();
  if(!months)return 'Edad sin configurar';
  if(months<12)return `${months} ${months===1?'mes':'meses'}`;
  const years=Math.round((months/12)*10)/10;
  const shown=Number.isInteger(years)?String(years):String(years).replace('.',',');
  return `${shown} ${years===1?'año':'años'}`;
}
function dogStageLabel(){const stage=ENGINE.ageStage(dogProfile);return stage.key==='unknown'?'':stage.label}

function applySystemTheme(){
  const dark=SYSTEM_THEME.matches;
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=dark?'#0d111b':'#f6f7f9';
  const value=$('#systemThemeValue');
  if(value)value.textContent=`Sistema · ${dark?'Oscuro':'Claro'}`;
}

function populateDogProfileEditor(){
  const months=currentDogAgeMonths();
  $('#dogNameInput').value=dogProfile?.name||'';
  if(months>=12){$('#dogAgeUnit').value='years';$('#dogAgeInput').step='0.1';$('#dogAgeInput').value=String(Math.round((months/12)*10)/10)}
  else{$('#dogAgeUnit').value='months';$('#dogAgeInput').step='1';$('#dogAgeInput').value=months?String(months):''}
  $('#dogAgeUnit').dataset.previous=$('#dogAgeUnit').value;updateDogAgePreview();
}
function updateDogAgePreview(){
  const value=Number($('#dogAgeInput')?.value||0),unit=$('#dogAgeUnit')?.value,preview=$('#dogAgePreview');if(!preview)return;
  if(!value){preview.textContent='Indica la edad de tu perro.';return}
  const months=Math.max(1,Math.round(unit==='years'?value*12:value));
  if(months<12){preview.textContent=`Cachorro · ${months} ${months===1?'mes':'meses'}`;return}
  const years=Math.round((months/12)*10)/10,shown=Number.isInteger(years)?String(years):String(years).replace('.',',');preview.textContent=`Adulto · ${shown} ${years===1?'año':'años'}`;
}
function openDogProfileEditor(firstRun=false,ageOnly=false){
  const dialog=$('#profileDialog');dialog.dataset.firstRun=firstRun?'1':'0';
  $('#profileDialogTitle').textContent=firstRun?'Cuéntame sobre tu pastor alemán':ageOnly?`Completa el perfil de ${dogName()}`:`Perfil de ${dogName()}`;
  $('#profileDialogText').textContent=firstRun?'Configura su nombre y edad. Patrick Training seguirá siendo el nombre de la app y personalizará las sesiones para tu perro.':ageOnly?'Añade su edad para que la app pueda mostrar su etapa de vida sin tocar tu progreso.':'Puedes cambiar el nombre y la edad sin perder niveles, sesiones ni estadísticas.';
  $('#profileCancelBtn').hidden=firstRun;$('#saveProfileBtn').textContent=firstRun?'Guardar y empezar':'Guardar cambios';populateDogProfileEditor();if(!dialog.open)dialog.showModal();
  setTimeout(()=>$(firstRun?'#dogNameInput':ageOnly?'#dogAgeInput':'#dogNameInput')?.focus(),80);
}
function saveDogProfile(){
  const name=$('#dogNameInput').value.trim().replace(/\s+/g,' ').slice(0,24);if(!name){toast('Escribe el nombre de tu perro');$('#dogNameInput').focus();return}
  const ageValue=Number($('#dogAgeInput').value||0),unit=$('#dogAgeUnit').value;if(!Number.isFinite(ageValue)||ageValue<=0){toast('Indica la edad de tu perro');$('#dogAgeInput').focus();return}
  const ageMonths=Math.max(1,Math.round(unit==='years'?ageValue*12:ageValue));dogProfile={...dogProfile,name,breed:'Pastor Alemán',ageMonths,ageUpdatedAt:new Date().toISOString()};
  store.set('patrickDogProfile',dogProfile);$('#profileDialog').close();renderAll();renderCommands();syncSettingsDrawer();toast(`Perfil de ${name} guardado`);
}

function exportProgress(){
  const payload={schemaVersion:CONFIG.BACKUP_SCHEMA_VERSION,appVersion:CONFIG.APP_VERSION,exportedAt:new Date().toISOString(),profile:dogProfile,storage:storageMode,progress,trials,history,currentLevel,dayType,notifications:reminderSettings};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`patrick-training-${dogName().toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'backup'}.json`;a.click();URL.revokeObjectURL(a.href);toast('Respaldo descargado');
}

async function importProgressFile(file){
  if(!file)return;
  if(file.size>CONFIG.BACKUP_MAX_BYTES){toast('El respaldo es demasiado grande');return}
  let data,normalized;
  try{data=JSON.parse(await file.text());normalized=BACKUP_SCHEMA.normalize(data,{commands:COMMANDS,states:STATES,currentProfile:dogProfile,maxSchemaVersion:CONFIG.BACKUP_SCHEMA_VERSION})}
  catch(e){console.warn('Respaldo rechazado',e);toast('El respaldo no tiene un formato compatible');return}
  if(!confirm('¿Restaurar este respaldo validado? Reemplazará el progreso actual de Patrick Training.'))return;
  const coreValues={
    patrickProgress:normalized.progress,patrickTrials:normalized.trials,patrickHistory:normalized.history,
    patrickCurrentLevel:normalized.currentLevel,patrickDayType:normalized.dayType,patrickDogProfile:normalized.profile
  };
  await store.setMany(coreValues);
  progress=normalized.progress;trials=normalized.trials;history=normalized.history;currentLevel=normalized.currentLevel;dayType=normalized.dayType;dogProfile=normalized.profile;
  if(normalized.notifications){
    reminderSettings={...reminderSettings,...normalized.notifications,lastNotifiedDate:null};
    await saveReminderSettings();scheduleForegroundReminder();
    if(reminderSettings.enabled&&notificationSupported()&&Notification.permission==='granted')await periodicReminderRegistration(true);
  }
  renderCommands();renderAll();syncSettingsDrawer();closeSettingsDrawer();toast('Respaldo restaurado');
}

function localReminderDateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function trainedToday(){const today=localReminderDateKey();return history.some(item=>{const d=new Date(item.at);return !Number.isNaN(d.getTime())&&localReminderDateKey(d)===today})}
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
  const day=new Intl.DateTimeFormat('es-CO',{weekday:'long'}).format(new Date());
  const streak=typeof currentHealthyStreak==='function'?currentHealthyStreak():0;
  const title=`Hoy es ${day} 🐾`;
  const body=streak>0?`Tu racha va en ${streak} ${streak===1?'día':'días'}. Una micro-sesión con ${dogName()} la mantiene.`:`Una micro-sesión corta con ${dogName()} es suficiente para empezar la racha.`;
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
  if(!notificationSupported()){toast('Este navegador no admite notificaciones PWA.');return}
  if(reminderSettings.enabled){reminderSettings.enabled=false;await saveReminderSettings();await periodicReminderRegistration(false);scheduleForegroundReminder();syncReminderUI();toast('Recordatorios desactivados');return}
  let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();
  if(permission!=='granted'){reminderSettings.enabled=false;await saveReminderSettings();syncReminderUI();toast('Activa las notificaciones de Patrick Training en los ajustes del navegador.');return}
  reminderSettings.enabled=true;reminderSettings.lastNotifiedDate=null;await saveReminderSettings();const background=await periodicReminderRegistration(true);scheduleForegroundReminder();syncReminderUI();
  toast(background?'Recordatorios activados':'Recordatorios activados; se comprobarán al usar la app');
}
function syncReminderUI(){
  const button=$('#notificationToggle'),value=$('#notificationStatus'),time=$('#notificationTime'),note=$('#notificationSupportText');if(!button)return;
  const supported=notificationSupported(),permission=supported?Notification.permission:'unsupported';
  button.disabled=!supported;button.setAttribute('aria-pressed',String(!!reminderSettings.enabled));
  if(value)value.textContent=!supported?'No disponible':permission==='denied'?'Bloqueadas':reminderSettings.enabled?'Activadas':'Desactivadas';
  if(time){time.value=reminderSettings.time||'19:00';time.disabled=!reminderSettings.enabled}
  if(note)note.textContent=permission==='denied'?'El navegador tiene bloqueadas las notificaciones para esta app.':reminderSettings.enabled&&(storageMode!=='indexeddb'||reminderStorageMode!=='indexeddb')?'El recordatorio funciona mientras usas la app; este almacenamiento no permite comprobarlo en segundo plano.':reminderSettings.enabled?'No se enviará nada si ya entrenaste hoy. El sistema puede decidir el momento exacto del chequeo en segundo plano.':'Actívalas para recibir un recordatorio diario si aún no has entrenado.';
}

function ensureSettingsDrawer(){
  if($('#settingsDrawer'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <div id="settingsBackdrop" class="settingsBackdrop" hidden></div>
    <aside id="settingsDrawer" class="settingsDrawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="settingsTitle"><h2 id="settingsTitle" class="srOnly">Configuración de Patrick Training</h2>
      <header class="settingsDrawerHead"><img src="icons/icon-192.webp" alt=""><div class="settingsDrawerIdentity"><small>PERFIL ACTIVO</small><strong id="dogProfileName">${escapeHtml(dogName())}</strong><span id="dogProfileMeta">Pastor alemán</span></div><button id="settingsCloseBtn" class="settingsCloseBtn iconButton" type="button" aria-label="Cerrar configuración">${icon('x')}</button></header>
      <div class="settingsDrawerBody">
        <section class="settingsGroup"><div class="settingsGroupTitle">Perro</div><button id="editDogBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('dog')}</span><span class="settingsRowCopy"><strong>Perfil del perro</strong><small>Nombre y edad sin perder progreso.</small></span><span class="settingsChevron">${icon('chevron')}</span></button></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Entrenamiento</div><div class="settingsField"><label><span class="settingsRowIcon">${icon('clock')}</span><span class="settingsRowCopy"><strong>Disponibilidad</strong><small>Define cuántas micro-sesiones te proponemos.</small></span></label><select id="settingsDayType" aria-label="Disponibilidad de entrenamiento"><option value="Todo el día">Durante el día</option><option value="Solo noche">Solo noche</option></select></div></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Recordatorios</div><button id="notificationToggle" class="settingsRow reminderToggle" type="button" aria-pressed="false"><span class="settingsRowIcon">${icon('clock')}</span><span class="settingsRowCopy"><strong>Recordatorio diario</strong><small>Solo si todavía no entrenaste ese día.</small></span><span id="notificationStatus" class="settingsValue">Desactivadas</span></button><div class="settingsField reminderTimeField"><label for="notificationTime"><span class="settingsRowCopy"><strong>Hora preferida</strong><small>Hora local del teléfono.</small></span></label><input id="notificationTime" class="settingsTimeInput" type="time" value="19:00" aria-label="Hora del recordatorio"></div><small id="notificationSupportText" class="settingsNote"></small></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Apariencia</div><div class="settingsMeta"><strong>Tema</strong><span id="systemThemeValue" class="settingsValue">Sistema</span></div></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Datos</div><div class="settingsMeta"><strong>Almacenamiento</strong><span id="storageModeLabel" class="storageBadge">IndexedDB</span></div><button id="exportBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('download')}</span><span class="settingsRowCopy"><strong>Exportar respaldo</strong><small>Descarga perfil, progreso y sesiones.</small></span><span class="settingsChevron">${icon('chevron')}</span></button><button id="importBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('upload')}</span><span class="settingsRowCopy"><strong>Restaurar respaldo</strong><small>Importa un JSON de Patrick Training.</small></span><span class="settingsChevron">${icon('chevron')}</span></button><input id="importFileInput" type="file" accept="application/json,.json" hidden></section>
      </div>
      <footer class="settingsDrawerFoot"><strong>Patrick Training</strong><span>v${escapeHtml(CONFIG.APP_VERSION)}</span></footer>
    </aside>`);
}
function syncSettingsDrawer(){
  if(!$('#settingsDrawer'))return;renderDogIdentity();$('#settingsDayType').value=dayType;
  const stage=dogStageLabel(),age=dogAgeLabel();$('#dogProfileMeta').textContent=`Pastor alemán${stage?` · ${stage}`:''} · ${age}`;applySystemTheme();syncReminderUI();
}
function settingsFocusables(){
  const drawer=$('#settingsDrawer');if(!drawer)return[];
  return [...drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden);
}
function setSettingsBackgroundInert(value){$('.appHeader,.appMain,.bottomNav').forEach(el=>{el.inert=!!value})}
function handleSettingsKeydown(e){
  const drawer=$('#settingsDrawer');if(!drawer?.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();closeSettingsDrawer();return}
  if(e.key!=='Tab')return;
  const focusable=settingsFocusables();if(!focusable.length){e.preventDefault();return}
  const first=focusable[0],last=focusable.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}
function openSettingsDrawer(){
  ensureSettingsDrawer();syncSettingsDrawer();const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');
  settingsReturnFocus=document.activeElement;backdrop.hidden=false;drawer.setAttribute('aria-hidden','false');setSettingsBackgroundInert(true);document.body.classList.add('settingsOpen');
  requestAnimationFrame(()=>{drawer.classList.add('open');backdrop.classList.add('open')});setTimeout(()=>$('#settingsCloseBtn')?.focus(),80);
}
function closeSettingsDrawer(){
  const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');if(!drawer)return;
  drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true');setSettingsBackgroundInert(false);document.body.classList.remove('settingsOpen');
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:280;
  setTimeout(()=>{if(!backdrop.classList.contains('open'))backdrop.hidden=true;const target=settingsReturnFocus;settingsReturnFocus=null;target?.focus?.()},delay);
}
function bindProfileUI(){
  $('#settingsAvatarBtn').onclick=openSettingsDrawer;$('#settingsCloseBtn').onclick=closeSettingsDrawer;$('#settingsBackdrop').onclick=closeSettingsDrawer;$('#editDogBtn').onclick=()=>{closeSettingsDrawer();setTimeout(()=>openDogProfileEditor(false),180)};
  $('#settingsDayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);$('#dayType').value=dayType;renderToday();syncSettingsDrawer()};$('#exportBtn').onclick=exportProgress;$('#importBtn').onclick=()=>$('#importFileInput').click();$('#importFileInput').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';await importProgressFile(file)};
  $('#notificationToggle').onclick=toggleDailyReminders;$('#notificationTime').onchange=async e=>{reminderSettings.time=e.target.value||'19:00';reminderSettings.lastNotifiedDate=null;await saveReminderSettings();scheduleForegroundReminder();syncReminderUI();toast(`Recordatorio: ${reminderSettings.time}`)};
  $('#saveProfileBtn').onclick=saveDogProfile;$('#profileCancelBtn').onclick=()=>$('#profileDialog').close();$('#dogNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDogProfile()}});$('#dogAgeInput').addEventListener('input',updateDogAgePreview);
  $('#dogAgeUnit').addEventListener('change',()=>{const input=$('#dogAgeInput'),unit=$('#dogAgeUnit'),previous=unit.dataset.previous||'months',value=Number(input.value||0);if(value>0){const months=previous==='years'?value*12:value;input.value=unit.value==='years'?String(Math.round((months/12)*10)/10):String(Math.max(1,Math.round(months)))}unit.dataset.previous=unit.value;input.step=unit.value==='years'?'0.1':'1';updateDogAgePreview()});
  $('#profileDialog').addEventListener('cancel',e=>{if($('#profileDialog').dataset.firstRun==='1')e.preventDefault()});document.addEventListener('keydown',handleSettingsKeydown);
}
function initProfileUI(){
  if(profileUiInitialized)return;profileUiInitialized=true;try{store.remove('patrickDark');localStorage.removeItem('patrickDark')}catch{}
  applySystemTheme();SYSTEM_THEME.addEventListener?.('change',applySystemTheme);ensureSettingsDrawer();bindProfileUI();syncSettingsDrawer();loadReminderSettings().then(async()=>{if(reminderSettings.enabled&&Notification.permission==='granted')await periodicReminderRegistration(true);await showDailyReminder()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)showDailyReminder()});window.addEventListener('focus',()=>showDailyReminder());
  const hasName=String(dogProfile?.name||'').trim(),hasAge=currentDogAgeMonths()>0;if(!hasName)setTimeout(()=>openDogProfileEditor(true),80);else if(!hasAge)setTimeout(()=>openDogProfileEditor(false,true),300);
}
