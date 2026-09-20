'use strict';
function downloadJson(filename,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
function backupHealthText(){
  const raw=store.get('patrickLastBackupAt',null),stamp=Date.parse(raw||'');if(!Number.isFinite(stamp))return appLanguage==='en'?'No backup yet':appLanguage==='de'?'Noch kein Backup':'Aún sin respaldo';
  const days=Math.floor(Math.max(0,Date.now()-stamp)/86400000);if(days===0)return appLanguage==='en'?'Today · protected':appLanguage==='de'?'Heute · gesichert':'Hoy · protegido';
  const base=appLanguage==='en'?`${days} ${days===1?'day':'days'} ago`:appLanguage==='de'?`Vor ${days} ${days===1?'Tag':'Tagen'}`:`Hace ${days} ${days===1?'día':'días'}`;
  return days>=14?base+(appLanguage==='en'?' · backup recommended':appLanguage==='de'?' · Backup empfohlen':' · respaldo recomendado'):base;
}
function exportProgress(){
  const exportedAt=new Date().toISOString(),payload={schemaVersion:CONFIG.BACKUP_SCHEMA_VERSION,appVersion:CONFIG.APP_VERSION,exportedAt,profile:dogProfile,storage:storageMode,progress,trials,history,historyArchive,currentLevel,dayType,trainingContext,theme:themePreference,appLanguage,commandLanguage,germanVoice:germanVoicePreference,teachingGuideVersion:teachingOnboardingVersion,setupWizardVersion,notifications:reminderSettings};
  downloadJson(`patrick-training-${dogName().toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'backup'}.json`,payload);store.set('patrickLastBackupAt',exportedAt);syncManagementDialogs();toast(appLanguage==='en'?'Backup downloaded':appLanguage==='de'?'Backup heruntergeladen':'Respaldo descargado');
}
function exportDiagnostic(){
  const states=Object.fromEntries(STATES.map(state=>[state,COMMANDS.filter(c=>stateOf(c.cmd)===state).length]));
  const payload={
    generatedAt:new Date().toISOString(),appVersion:CONFIG.APP_VERSION,backupSchemaVersion:CONFIG.BACKUP_SCHEMA_VERSION,
    sessionSchemaVersion:CONFIG.SESSION_SCHEMA_VERSION,cacheName:CONFIG.CACHE_NAME,storageMode,reminderStorageMode,
    theme:themePreference,appLanguage,commandLanguage,germanVoice:germanVoicePreference,setupWizardVersion,lastBackupAt:store.get('patrickLastBackupAt',null),focusLevel:currentLevel,unlockedLevel:maxUnlockedLevel(),recentSessionCount:history.length,archivedSessionCount:archivedSessionCount(),totalSessionCount:allSessionCount(),states,
    serviceWorker:{supported:'serviceWorker'in navigator,controlled:!!navigator.serviceWorker?.controller},
    network:{online:navigator.onLine},browser:{userAgent:navigator.userAgent}
  };
  downloadJson(`patrick-training-diagnostico-${new Date().toISOString().slice(0,10)}.json`,payload);toast(appLanguage==='en'?'Diagnostics exported':appLanguage==='de'?'Diagnose exportiert':'Diagnóstico exportado');
}

function freshStorageValues(){
  const values={};
  for(const [key,value] of Object.entries(STORAGE_DEFAULTS))values[key]=value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):value;
  return values;
}
async function resetAllTrainingData(){
  const first=confirm(appLanguage==='en'?'Reset all Patrick Training data on this device?\n\nProfile, progress, sessions, history archive, preferences and reminders will be deleted.':appLanguage==='de'?'Alle Patrick-Training-Daten auf diesem Gerät zurücksetzen?\n\nProfil, Fortschritt, Einheiten, Verlaufsarchiv, Einstellungen und Erinnerungen werden gelöscht.':'¿Reiniciar todos los datos de Patrick Training en este dispositivo?\n\nSe borrarán perfil, progreso, sesiones, archivo histórico, preferencias y recordatorios.');
  if(!first)return false;
  const second=confirm(appLanguage==='en'?'FINAL CONFIRMATION\n\nThis cannot be undone. Delete everything and return to initial setup?':appLanguage==='de'?'LETZTE BESTÄTIGUNG\n\nDies kann nicht rückgängig gemacht werden. Alles löschen und zur Ersteinrichtung zurückkehren?':'ÚLTIMA CONFIRMACIÓN\n\nEsto no se puede deshacer. ¿Borrar todo y volver a la configuración inicial?');
  if(!second)return false;

  clearTimeout(reminderTimer);reminderTimer=null;
  try{await periodicReminderRegistration(false)}catch{}
  try{localStorage.removeItem(REMINDER_KEY)}catch{}
  try{await window.PatrickDB?.del?.(REMINDER_KEY)}catch{}
  try{
    const reg=await navigator.serviceWorker?.ready,notifications=await reg?.getNotifications?.({tag:REMINDER_TAG});
    notifications?.forEach?.(notification=>notification.close());
  }catch{}

  const fresh=freshStorageValues();await store.setMany(fresh);
  progress={};trials={};history=[];historyArchive=emptyHistoryArchive();currentLevel=0;dayType='Todo el día';filter='Todos';
  dogProfile={name:'',breed:'Pastor Alemán'};trainingContext=ENGINE.normalizeContext({environment:'Casa',distraction:'Baja'});
  themePreference='system';germanVoicePreference='auto';teachingOnboardingVersion=0;setupWizardVersion=0;
  reminderSettings={enabled:false,time:'19:00',lastNotifiedDate:null};reminderLoaded=true;reminderStorageMode=storageMode==='indexeddb'?'indexeddb':'localStorage';
  applyTheme();renderCommands();renderAll();syncSettingsDrawer();syncManagementDialogs();syncReminderUI();
  const settings=$('#appSettingsDialog');if(settings?.open)settings.close();closeSettingsDrawer();
  if(typeof setView==='function')setView('today');
  toast(appLanguage==='en'?'Data reset':appLanguage==='de'?'Daten zurückgesetzt':'Datos reiniciados');
  setTimeout(openSetupWizard,180);
  return true;
}

async function importProgressFile(file){
  if(!file)return;
  if(file.size>CONFIG.BACKUP_MAX_BYTES){toast(appLanguage==='en'?'The backup is too large':appLanguage==='de'?'Das Backup ist zu groß':'El respaldo es demasiado grande');return}
  let data,normalized;
  try{data=JSON.parse(await file.text());normalized=BACKUP_SCHEMA.normalize(data,{commands:COMMANDS,states:STATES,currentProfile:dogProfile,currentTrainingContext:trainingContext,currentTheme:themePreference,currentAppLanguage:appLanguage,currentCommandLanguage:commandLanguage,currentGermanVoice:germanVoicePreference,maxSchemaVersion:CONFIG.BACKUP_SCHEMA_VERSION})}
  catch(e){console.warn('Respaldo rechazado',e);toast(appLanguage==='en'?'The backup format is not compatible':appLanguage==='de'?'Das Backup-Format ist nicht kompatibel':'El respaldo no tiene un formato compatible');return}
  if(!confirm(appLanguage==='en'?'Restore this validated backup? It will replace the current Patrick Training progress.':appLanguage==='de'?'Dieses geprüfte Backup wiederherstellen? Es ersetzt den aktuellen Patrick-Training-Fortschritt.':'¿Restaurar este respaldo validado? Reemplazará el progreso actual de Patrick Training.'))return;
  const coreValues={
    patrickProgress:normalized.progress,patrickTrials:normalized.trials,patrickHistory:normalized.history,
    patrickCurrentLevel:normalized.currentLevel,patrickDayType:normalized.dayType,patrickDogProfile:normalized.profile,patrickTrainingContext:normalized.trainingContext,patrickTheme:normalized.theme,patrickAppLanguage:normalized.appLanguage,patrickCommandLanguage:normalized.commandLanguage,patrickGermanVoice:normalized.germanVoice,patrickHistoryArchive:normalized.historyArchive,patrickTeachingOnboardingVersion:normalized.teachingGuideVersion,patrickSetupWizardVersion:normalized.setupWizardVersion
  };
  await store.setMany(coreValues);
  progress=normalized.progress;trials=normalized.trials;history=normalized.history;historyArchive=normalizeHistoryArchive(normalized.historyArchive);currentLevel=normalized.currentLevel;dayType=normalized.dayType;dogProfile=normalized.profile;trainingContext=normalized.trainingContext;themePreference=normalized.theme;appLanguage=normalized.appLanguage;commandLanguage=normalized.commandLanguage;germanVoicePreference=normalized.germanVoice;teachingOnboardingVersion=normalized.teachingGuideVersion;setupWizardVersion=normalized.setupWizardVersion;document.documentElement.lang=appLanguage;applyTheme();syncGermanVoiceUI();
  if(normalized.notifications){
    reminderSettings={...reminderSettings,...normalized.notifications,lastNotifiedDate:null};
    await saveReminderSettings();scheduleForegroundReminder();
    if(reminderSettings.enabled&&notificationSupported()&&Notification.permission==='granted')await periodicReminderRegistration(true);
  }
  renderCommands();renderAll();syncSettingsDrawer();syncManagementDialogs();if($('#appSettingsDialog')?.open)$('#appSettingsDialog').close();closeSettingsDrawer();toast(appLanguage==='en'?'Backup restored':appLanguage==='de'?'Backup wiederhergestellt':'Respaldo restaurado');
}
