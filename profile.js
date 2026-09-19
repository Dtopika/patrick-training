const SYSTEM_THEME=window.matchMedia('(prefers-color-scheme: dark)');
const THEME_KEY='patrickTheme';
const REMINDER_KEY='patrickNotifications';
const REMINDER_TAG='patrick-daily-reminder';
const TEACHING_GUIDE_VERSION=1;
let profileUiInitialized=false,reminderLoaded=false,reminderTimer=null,reminderStorageMode='indexeddb',settingsReturnFocus=null,teachingOnboardingVersion=0;
let reminderSettings={enabled:false,time:'19:00',lastNotifiedDate:null},themePreference='system';

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

function normalizeTheme(value){return['system','light','dark'].includes(value)?value:'system'}
function themePreferenceLabel(value=themePreference){return value==='dark'?'Oscuro':value==='light'?'Claro':'Sistema'}
function applyTheme(){
  const mode=normalizeTheme(themePreference),dark=mode==='dark'||(mode==='system'&&SYSTEM_THEME.matches);
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=dark?'#0d111b':'#f6f7f9';
  const select=$('#themeSelect');if(select)select.value=mode;
  const value=$('#themeCurrentValue');if(value)value.textContent=mode==='system'?`Sistema · ${dark?'Oscuro':'Claro'}`:themePreferenceLabel(mode);
}
function setThemePreference(value){
  themePreference=normalizeTheme(value);store.set(THEME_KEY,themePreference);applyTheme();syncManagementDialogs();toast(`Tema: ${themePreferenceLabel()}`);
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
  const months=Math.max(1,Math.round(unit==='years'?value*12:value)),stage=ENGINE.ageStage({ageMonths:months,ageUpdatedAt:new Date().toISOString()});
  if(months<12){preview.textContent=`${stage.label} · ${months} ${months===1?'mes':'meses'}`;return}
  const years=Math.round((months/12)*10)/10,shown=Number.isInteger(years)?String(years):String(years).replace('.',',');preview.textContent=`${stage.label} · ${shown} ${years===1?'año':'años'}`;
}
function openDogProfileEditor(firstRun=false,ageOnly=false){
  const dialog=$('#profileDialog');dialog.dataset.firstRun=firstRun?'1':'0';
  $('#profileDialogTitle').textContent=firstRun?'Cuéntame sobre tu pastor alemán':ageOnly?`Completa el perfil de ${dogName()}`:`Perfil de ${dogName()}`;
  $('#profileDialogText').textContent=firstRun?'Configura su nombre y edad. Patrick Training seguirá siendo el nombre de la app y personalizará las sesiones para tu perro.':ageOnly?'Añade su edad para que la app pueda mostrar su etapa de vida sin tocar tu progreso.':'Puedes cambiar el nombre y la edad sin perder niveles, sesiones ni estadísticas.';
  $('#profileCancelBtn').hidden=firstRun;$('#saveProfileBtn').textContent=firstRun?'Guardar y empezar':'Guardar cambios';populateDogProfileEditor();if(!dialog.open)dialog.showModal();
  setTimeout(()=>$(firstRun?'#dogNameInput':ageOnly?'#dogAgeInput':'#dogNameInput')?.focus(),80);
}
function saveDogProfile(){
  const firstRun=$('#profileDialog')?.dataset.firstRun==='1';
  const name=$('#dogNameInput').value.trim().replace(/\s+/g,' ').slice(0,24);if(!name){toast('Escribe el nombre de tu perro');$('#dogNameInput').focus();return}
  const ageValue=Number($('#dogAgeInput').value||0),unit=$('#dogAgeUnit').value;if(!Number.isFinite(ageValue)||ageValue<=0){toast('Indica la edad de tu perro');$('#dogAgeInput').focus();return}
  const ageMonths=Math.max(1,Math.round(unit==='years'?ageValue*12:ageValue));dogProfile={...dogProfile,name,breed:'Pastor Alemán',ageMonths,ageUpdatedAt:new Date().toISOString()};
  store.set('patrickDogProfile',dogProfile);$('#profileDialog').close();renderAll();renderCommands();syncSettingsDrawer();toast(`Perfil de ${name} guardado`);
  if(firstRun&&teachingOnboardingVersion<TEACHING_GUIDE_VERSION)setTimeout(()=>openTeachingGuide(),220);
}

function downloadJson(filename,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
function exportProgress(){
  const payload={schemaVersion:CONFIG.BACKUP_SCHEMA_VERSION,appVersion:CONFIG.APP_VERSION,exportedAt:new Date().toISOString(),profile:dogProfile,storage:storageMode,progress,trials,history,currentLevel,dayType,trainingContext,theme:themePreference,notifications:reminderSettings};
  downloadJson(`patrick-training-${dogName().toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'backup'}.json`,payload);toast('Respaldo descargado');
}
function exportDiagnostic(){
  const states=Object.fromEntries(STATES.map(state=>[state,COMMANDS.filter(c=>stateOf(c.cmd)===state).length]));
  const payload={
    generatedAt:new Date().toISOString(),appVersion:CONFIG.APP_VERSION,backupSchemaVersion:CONFIG.BACKUP_SCHEMA_VERSION,
    sessionSchemaVersion:CONFIG.SESSION_SCHEMA_VERSION,cacheName:CONFIG.CACHE_NAME,storageMode,reminderStorageMode,
    theme:themePreference,focusLevel:currentLevel,unlockedLevel:maxUnlockedLevel(),sessionCount:history.length,states,
    serviceWorker:{supported:'serviceWorker'in navigator,controlled:!!navigator.serviceWorker?.controller},
    network:{online:navigator.onLine},browser:{userAgent:navigator.userAgent}
  };
  downloadJson(`patrick-training-diagnostico-${new Date().toISOString().slice(0,10)}.json`,payload);toast('Diagnóstico exportado');
}

async function importProgressFile(file){
  if(!file)return;
  if(file.size>CONFIG.BACKUP_MAX_BYTES){toast('El respaldo es demasiado grande');return}
  let data,normalized;
  try{data=JSON.parse(await file.text());normalized=BACKUP_SCHEMA.normalize(data,{commands:COMMANDS,states:STATES,currentProfile:dogProfile,currentTrainingContext:trainingContext,currentTheme:themePreference,maxSchemaVersion:CONFIG.BACKUP_SCHEMA_VERSION})}
  catch(e){console.warn('Respaldo rechazado',e);toast('El respaldo no tiene un formato compatible');return}
  if(!confirm('¿Restaurar este respaldo validado? Reemplazará el progreso actual de Patrick Training.'))return;
  const coreValues={
    patrickProgress:normalized.progress,patrickTrials:normalized.trials,patrickHistory:normalized.history,
    patrickCurrentLevel:normalized.currentLevel,patrickDayType:normalized.dayType,patrickDogProfile:normalized.profile,patrickTrainingContext:normalized.trainingContext,patrickTheme:normalized.theme
  };
  await store.setMany(coreValues);
  progress=normalized.progress;trials=normalized.trials;history=normalized.history;currentLevel=normalized.currentLevel;dayType=normalized.dayType;dogProfile=normalized.profile;trainingContext=normalized.trainingContext;themePreference=normalized.theme;applyTheme();
  if(normalized.notifications){
    reminderSettings={...reminderSettings,...normalized.notifications,lastNotifiedDate:null};
    await saveReminderSettings();scheduleForegroundReminder();
    if(reminderSettings.enabled&&notificationSupported()&&Notification.permission==='granted')await periodicReminderRegistration(true);
  }
  renderCommands();renderAll();syncSettingsDrawer();syncManagementDialogs();if($('#appSettingsDialog')?.open)$('#appSettingsDialog').close();closeSettingsDrawer();toast('Respaldo restaurado');
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
    <aside id="settingsDrawer" class="settingsDrawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="settingsTitle"><h2 id="settingsTitle" class="srOnly">Menú de Patrick Training</h2>
      <header class="settingsDrawerHead"><img src="icons/icon-192.webp" alt=""><div class="settingsDrawerIdentity"><small>PERFIL ACTIVO</small><strong id="dogProfileName">${escapeHtml(dogName())}</strong><span id="dogProfileMeta">Pastor alemán</span></div><button id="settingsCloseBtn" class="settingsCloseBtn iconButton" type="button" aria-label="Cerrar menú">${icon('x')}</button></header>
      <div class="settingsDrawerBody">
        <section class="settingsGroup"><div class="settingsGroupTitle">Patrick</div><button id="editDogBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('dog')}</span><span class="settingsRowCopy"><strong>Perfil del perro</strong><small>Nombre, edad y etapa de desarrollo.</small></span><span class="settingsChevron">${icon('chevron')}</span></button></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Entrenamiento</div><div class="settingsField"><label><span class="settingsRowIcon">${icon('clock')}</span><span class="settingsRowCopy"><strong>Disponibilidad</strong><small>Define cuántas micro-sesiones te proponemos.</small></span></label><select id="settingsDayType" aria-label="Disponibilidad de entrenamiento"><option value="Todo el día">Durante el día</option><option value="Solo noche">Solo noche</option></select></div></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Recordatorios</div><button id="notificationToggle" class="settingsRow reminderToggle" type="button" aria-pressed="false"><span class="settingsRowIcon">${icon('clock')}</span><span class="settingsRowCopy"><strong>Recordatorio diario</strong><small>Solo si todavía no entrenaste ese día.</small></span><span id="notificationStatus" class="settingsValue">Desactivadas</span></button><div class="settingsField reminderTimeField"><label for="notificationTime"><span class="settingsRowCopy"><strong>Hora preferida</strong><small>Hora local del teléfono.</small></span></label><input id="notificationTime" class="settingsTimeInput" type="time" value="19:00" aria-label="Hora del recordatorio"></div><small id="notificationSupportText" class="settingsNote"></small></section>
        <section class="settingsGroup"><div class="settingsGroupTitle">Aplicación</div>
          <button id="openTeachingGuideBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('help')}</span><span class="settingsRowCopy"><strong>Cómo funciona</strong><small>Estados, confianza, repeticiones y medición.</small></span><span class="settingsChevron">${icon('chevron')}</span></button>
          <button id="openAppSettingsBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('settings')}</span><span class="settingsRowCopy"><strong>Configuración</strong><small>Tema, almacenamiento y respaldos.</small></span><span class="settingsChevron">${icon('chevron')}</span></button>
          <button id="openAboutBtn" class="settingsRow" type="button"><span class="settingsRowIcon">${icon('info')}</span><span class="settingsRowCopy"><strong>Acerca de</strong><small>Creador, versión y contacto del proyecto.</small></span><span class="settingsChevron">${icon('chevron')}</span></button>
        </section>
      </div>
      <footer class="settingsDrawerFoot"><strong>Patrick Training</strong><span>v${escapeHtml(CONFIG.APP_VERSION)}</span></footer>
    </aside>`);
}
function ensureManagementDialogs(){
  if($('#appSettingsDialog'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="appSettingsDialog" class="managementDialog" aria-labelledby="appSettingsTitle"><section class="managementCard">
      <header class="managementHeader"><div><p class="kicker">APLICACIÓN</p><h2 id="appSettingsTitle">Configuración</h2><p class="muted">Apariencia, almacenamiento y respaldos.</p></div><button id="closeAppSettingsBtn" class="roundBtn" type="button" aria-label="Cerrar configuración">${icon('x')}</button></header>
      <section class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('palette')}</span><div><strong>Apariencia</strong><small id="themeCurrentValue">Sistema</small></div></div><label class="managementControl"><span>Tema</span><select id="themeSelect" aria-label="Tema de la aplicación"><option value="system">Usar sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label></section>
      <section class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('database')}</span><div><strong>Datos y almacenamiento</strong><small>Tu información permanece en este dispositivo.</small></div></div><div class="managementMeta"><span>Motor de almacenamiento</span><strong id="storageModeLabel" class="storageBadge">IndexedDB</strong></div><div class="managementMeta"><span>Estado técnico</span><strong id="diagnosticSummary">v${escapeHtml(CONFIG.APP_VERSION)} · schema ${CONFIG.BACKUP_SCHEMA_VERSION}</strong></div><button id="exportBtn" class="managementAction" type="button"><span>${icon('download')}</span><div><strong>Exportar respaldo</strong><small>Descarga perfil, progreso, sesiones y preferencias.</small></div><i>${icon('chevron')}</i></button><button id="importBtn" class="managementAction" type="button"><span>${icon('upload')}</span><div><strong>Restaurar respaldo</strong><small>Importa un respaldo validado de Patrick Training.</small></div><i>${icon('chevron')}</i></button><button id="exportDiagnosticBtn" class="managementAction" type="button"><span>${icon('info')}</span><div><strong>Exportar diagnóstico</strong><small>Versión, almacenamiento, ruta y estado técnico; sin historial detallado.</small></div><i>${icon('chevron')}</i></button><input id="importFileInput" type="file" accept="application/json,.json" hidden></section>
    </section></dialog>
    <dialog id="aboutDialog" class="managementDialog" aria-labelledby="aboutTitle"><section class="managementCard aboutCard">
      <header class="managementHeader"><div><p class="kicker">ACERCA DE</p><h2 id="aboutTitle">Patrick Training</h2><p class="muted">Entrenamiento local-first para construir vínculo, obediencia y progreso.</p></div><button id="closeAboutBtn" class="roundBtn" type="button" aria-label="Cerrar acerca de">${icon('x')}</button></header>
      <div class="aboutHero"><img src="icons/icon-192.webp" alt=""><div><strong>Patrick Training</strong><span>Versión ${escapeHtml(CONFIG.APP_VERSION)}</span></div></div>
      <section class="aboutCreator"><small>CREADO POR</small><strong>Dtopika</strong><p>Proyecto independiente diseñado para acompañar el entrenamiento diario de Patrick.</p></section>
      <div class="aboutLinks"><a href="https://github.com/Dtopika/patrick-training" target="_blank" rel="noopener noreferrer">${icon('github')}<span><strong>Proyecto en GitHub</strong><small>Dtopika/patrick-training</small></span>${icon('chevron')}</a><a href="https://github.com/Dtopika" target="_blank" rel="noopener noreferrer">${icon('info')}<span><strong>Contacto / creador</strong><small>Perfil de Dtopika en GitHub</small></span>${icon('chevron')}</a></div>
    </section></dialog>
    <dialog id="teachingGuideDialog" class="managementDialog teachingGuideDialog" aria-labelledby="teachingGuideTitle"><section class="managementCard teachingGuideCard">
      <header class="managementHeader"><div><p class="kicker">CÓMO FUNCIONA</p><h2 id="teachingGuideTitle">Entrena menos, mide mejor</h2><p class="muted">Patrick Training usa evidencia reciente para decidir qué practicar y cuándo subir dificultad.</p></div><button id="closeTeachingGuideBtn" class="roundBtn" type="button" aria-label="Cerrar guía">${icon('x')}</button></header>
      <div class="teachingSteps">
        <article><span>1</span><div><strong>Estados de aprendizaje</strong><p><b>En práctica</b> construye la respuesta; <b>Consistente</b> ya responde con estabilidad; <b>Generalizando</b> funciona en contextos distintos; <b>Dominado</b> tiene evidencia variada y sostenida.</p></div></article>
        <article><span>2</span><div><strong>Confianza de la evidencia</strong><p>No es una nota de Patrick. Indica cuánta información tiene la app: sesiones, ejecuciones, contextos y días de evidencia.</p></div></article>
        <article><span>3</span><div><strong>3–5 ejecuciones, no siempre cinco</strong><p>El motor ajusta el volumen según rendimiento, estado y etapa. Más repeticiones no siempre significan mejor entrenamiento.</p></div></article>
        <article><span>4</span><div><strong>Tiempo preciso</strong><p>Pulsa <b>Iniciar ejecución</b> justo antes de dar la señal. Luego califica cuando Patrick responda. Solo esos tiempos nuevos se usan para valorar velocidad o duración.</p></div></article>
      </div>
      <div class="teachingLegend"><strong>Regla simple</strong><span>Sesiones cortas, criterio claro, Ja! en el momento correcto y premio inmediato.</span></div>
      <button id="finishTeachingGuideBtn" class="primaryBtn" type="button">Entendido</button>
    </section></dialog>`);
}
function syncManagementDialogs(){
  if(!$('#appSettingsDialog'))return;
  const theme=$('#themeSelect');if(theme)theme.value=normalizeTheme(themePreference);
  const storage=$('#storageModeLabel');if(storage)storage.textContent=storageMode==='indexeddb'?'IndexedDB':'Almacenamiento local';
  applyTheme();
}
function openAppSettingsDialog(){ensureManagementDialogs();syncManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#appSettingsDialog');if(!d.open)d.showModal()},180)}
function openAboutDialog(){ensureManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#aboutDialog');if(!d.open)d.showModal()},180)}
function markTeachingGuideSeen(){
  if(teachingOnboardingVersion>=TEACHING_GUIDE_VERSION)return;
  teachingOnboardingVersion=TEACHING_GUIDE_VERSION;store.set('patrickTeachingOnboardingVersion',teachingOnboardingVersion);
}
function closeTeachingGuide(){markTeachingGuideSeen();const dialog=$('#teachingGuideDialog');if(dialog?.open)dialog.close()}
function openTeachingGuide(){ensureManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#teachingGuideDialog');if(!d.open)d.showModal()},180)}

function syncSettingsDrawer(){
  if(!$('#settingsDrawer'))return;renderDogIdentity();$('#settingsDayType').value=dayType;
  const stage=dogStageLabel(),age=dogAgeLabel();$('#dogProfileMeta').textContent=`Pastor alemán${stage?` · ${stage}`:''} · ${age}`;syncReminderUI();
}
function settingsFocusables(){
  const drawer=$('#settingsDrawer');if(!drawer)return[];
  return [...drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden);
}
function setSettingsBackgroundInert(value){$$('.appHeader,.appMain,.bottomNav').forEach(el=>{el.inert=!!value})}
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
  $('#openAppSettingsBtn').onclick=openAppSettingsDialog;$('#openAboutBtn').onclick=openAboutDialog;
  $('#settingsDayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);$('#dayType').value=dayType;renderToday();syncSettingsDrawer()};
  $('#themeSelect').onchange=e=>setThemePreference(e.target.value);$('#closeAppSettingsBtn').onclick=()=>$('#appSettingsDialog').close();$('#closeAboutBtn').onclick=()=>$('#aboutDialog').close();
  $('#exportBtn').onclick=exportProgress;$('#exportDiagnosticBtn').onclick=exportDiagnostic;$('#importBtn').onclick=()=>$('#importFileInput').click();$('#importFileInput').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';await importProgressFile(file)};
  $('#appSettingsDialog').addEventListener('click',e=>{if(e.target===$('#appSettingsDialog'))$('#appSettingsDialog').close()});$('#aboutDialog').addEventListener('click',e=>{if(e.target===$('#aboutDialog'))$('#aboutDialog').close()});
  $('#notificationToggle').onclick=toggleDailyReminders;$('#notificationTime').onchange=async e=>{reminderSettings.time=e.target.value||'19:00';reminderSettings.lastNotifiedDate=null;await saveReminderSettings();scheduleForegroundReminder();syncReminderUI();toast(`Recordatorio: ${reminderSettings.time}`)};
  $('#saveProfileBtn').onclick=saveDogProfile;$('#profileCancelBtn').onclick=()=>$('#profileDialog').close();$('#dogNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDogProfile()}});$('#dogAgeInput').addEventListener('input',updateDogAgePreview);
  $('#dogAgeUnit').addEventListener('change',()=>{const input=$('#dogAgeInput'),unit=$('#dogAgeUnit'),previous=unit.dataset.previous||'months',value=Number(input.value||0);if(value>0){const months=previous==='years'?value*12:value;input.value=unit.value==='years'?String(Math.round((months/12)*10)/10):String(Math.max(1,Math.round(months)))}unit.dataset.previous=unit.value;input.step=unit.value==='years'?'0.1':'1';updateDogAgePreview()});
  $('#profileDialog').addEventListener('cancel',e=>{if($('#profileDialog').dataset.firstRun==='1')e.preventDefault()});document.addEventListener('keydown',handleSettingsKeydown);
}
function initProfileUI(){
  if(profileUiInitialized)return;profileUiInitialized=true;try{store.remove('patrickDark');localStorage.removeItem('patrickDark')}catch{}
  themePreference=normalizeTheme(store.get(THEME_KEY,'system'));applyTheme();SYSTEM_THEME.addEventListener?.('change',()=>{if(themePreference==='system')applyTheme()});ensureSettingsDrawer();ensureManagementDialogs();bindProfileUI();syncSettingsDrawer();syncManagementDialogs();loadReminderSettings().then(async()=>{if(reminderSettings.enabled&&Notification.permission==='granted')await periodicReminderRegistration(true);await showDailyReminder()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)showDailyReminder()});window.addEventListener('focus',()=>showDailyReminder());
  const hasName=String(dogProfile?.name||'').trim(),hasAge=currentDogAgeMonths()>0;if(!hasName)setTimeout(()=>openDogProfileEditor(true),80);else if(!hasAge)setTimeout(()=>openDogProfileEditor(false,true),300);
}
