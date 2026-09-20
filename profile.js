const SYSTEM_THEME=window.matchMedia('(prefers-color-scheme: dark)');
const THEME_KEY='patrickTheme';
const REMINDER_KEY='patrickNotifications';
const REMINDER_TAG='patrick-daily-reminder';
const TEACHING_GUIDE_VERSION=1;
const SETUP_WIZARD_VERSION=1;
let profileUiInitialized=false,reminderLoaded=false,reminderTimer=null,reminderStorageMode='indexeddb',settingsReturnFocus=null,teachingOnboardingVersion=0,setupWizardVersion=0,setupWizardStep=0;
let reminderSettings={enabled:false,time:'19:00',lastNotifiedDate:null},themePreference='system';
const MAX_DOG_AGE_MONTHS=CONFIG?.MAX_DOG_AGE_MONTHS||240;
function dogAgeMonthsFromValue(value,unit='months'){const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(unit==='years'?n*12:n):0}
function dogAgeValueValid(value,unit='months'){const months=dogAgeMonthsFromValue(value,unit);return months>=1&&months<=MAX_DOG_AGE_MONTHS}
function syncDogAgeInputBounds(input,unit='months'){if(!input)return;input.min='1';input.max=String(unit==='years'?MAX_DOG_AGE_MONTHS/12:MAX_DOG_AGE_MONTHS);input.step=unit==='years'?'0.1':'1'}
function dogAgeLimitMessage(){const years=MAX_DOG_AGE_MONTHS/12;return appLanguage==='en'?`Enter an age up to ${years} years.`:appLanguage==='de'?`Gib ein Alter bis ${years} Jahre ein.`:`Indica una edad de máximo ${years} años.`}

function currentDogAgeMonths(){return ENGINE.effectiveAgeMonths(dogProfile)}
function dogAgeLabel(){
  const months=currentDogAgeMonths();
  if(!months)return appLanguage==='en'?'Age not set':appLanguage==='de'?'Alter nicht festgelegt':'Edad sin configurar';
  if(months<12)return `${months} ${appLanguage==='en'?(months===1?'month':'months'):appLanguage==='de'?(months===1?'Monat':'Monate'):(months===1?'mes':'meses')}`;
  const years=Math.round((months/12)*10)/10;
  const shown=Number.isInteger(years)?String(years):String(years).replace('.',appLanguage==='en'?'.':',');
  return `${shown} ${appLanguage==='en'?(years===1?'year':'years'):appLanguage==='de'?(years===1?'Jahr':'Jahre'):(years===1?'año':'años')}`;
}
function dogStageLabel(){
  const stage=ENGINE.ageStage(dogProfile);if(stage.key==='unknown')return'';
  const labels={es:{'young-puppy':'Cachorro joven',puppy:'Cachorro',adolescent:'Adolescente',adult:'Adulto'},en:{'young-puppy':'Young puppy',puppy:'Puppy',adolescent:'Adolescent',adult:'Adult'},de:{'young-puppy':'Junger Welpe',puppy:'Welpe',adolescent:'Junghund',adult:'Erwachsen'}};
  return labels[appLanguage]?.[stage.key]||stage.label;
}

function normalizeTheme(value){return['system','light','dark'].includes(value)?value:'system'}
function themePreferenceLabel(value=themePreference){return value==='dark'?t('dark'):value==='light'?t('light'):t('system')}
function applyTheme(){
  const mode=normalizeTheme(themePreference),dark=mode==='dark'||(mode==='system'&&SYSTEM_THEME.matches);
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=dark?'#0d111b':'#f6f7f9';
  const select=$('#themeSelect');if(select)select.value=mode;
  const value=$('#themeCurrentValue');if(value)value.textContent=mode==='system'?`${t('system')} · ${dark?t('dark'):t('light')}`:themePreferenceLabel(mode);
}
function setThemePreference(value){
  themePreference=normalizeTheme(value);store.set(THEME_KEY,themePreference);applyTheme();syncManagementDialogs();toast(appLanguage==='en'?`Theme: ${themePreferenceLabel()}`:appLanguage==='de'?`Design: ${themePreferenceLabel()}`:`Tema: ${themePreferenceLabel()}`);
}
function germanVoiceOptions(){
  const voices=typeof germanVoices==='function'?germanVoices():[];
  return[{value:'auto',label:copyText('Automática · prioriza alemán de Alemania')},...voices.map(v=>({value:v.voiceURI||v.name,label:germanVoiceLabel(v)}))];
}
function syncGermanVoiceUI(){
  const select=$('#germanVoiceSelect'),current=$('#germanVoiceCurrent');if(!select)return;
  const options=germanVoiceOptions(),selected=options.some(x=>x.value===germanVoicePreference)?germanVoicePreference:'auto';
  select.innerHTML=options.map(x=>`<option value="${escapeHtml(x.value)}">${escapeHtml(x.label)}</option>`).join('');
  select.value=selected;select.disabled=options.length===1;
  if(current)current.textContent=selected==='auto'?copyText('Automática'):options.find(x=>x.value===selected)?.label||copyText('Automática');
}
function setGermanVoicePreference(value){
  const options=germanVoiceOptions(),valid=options.some(x=>x.value===value)?value:'auto';
  germanVoicePreference=valid;store.set('patrickGermanVoice',germanVoicePreference);syncGermanVoiceUI();toast(appLanguage==='en'?(valid==='auto'?'Automatic German voice':'German voice saved'):appLanguage==='de'?(valid==='auto'?'Automatische deutsche Stimme':'Deutsche Stimme gespeichert'):(valid==='auto'?'Voz alemana automática':'Voz alemana guardada'));
}

function setAppLanguage(value,{persist=true,rerender=true}={}){
  appLanguage=I18N?.normalizeLanguage?.(value)||'es';document.documentElement.lang=appLanguage;
  if(persist)store.set('patrickAppLanguage',appLanguage);
  if(rerender){applyStaticAppLanguage();renderSetupWizard();renderCommands();renderAll();syncSettingsDrawer();syncManagementDialogs()}
}
function setCommandLanguage(value,{persist=true,rerender=true}={}){
  commandLanguage=I18N?.normalizeLanguage?.(value,'de')||'de';
  if(persist)store.set('patrickCommandLanguage',commandLanguage);
  if(rerender){renderSetupWizard();renderCommands();renderAll();syncManagementDialogs()}
}
function applySetupLanguageText(){
  const set=(selector,key,vars)=>{const el=$(selector);if(el)el.textContent=t(key,vars)};
  set('.setupWizardBrand small','setup');set('[data-setup-step="0"] .kicker','welcome');set('[data-setup-step="0"] h2','makeYours');set('[data-setup-step="0"]>.setupLead','setupLead');
  set('#setupAppLanguageLabel','appLanguage');set('#setupAppLanguageHelp','appLanguageHelp');set('#setupCommandLanguageLabel','commandLanguage');set('#setupCommandLanguageHelp','commandLanguageHelp');set('#setupAppearanceLabel','appearance');
  set('[data-setup-theme="system"] strong','system');set('[data-setup-theme="system"] small','systemHelp');set('[data-setup-theme="light"] strong','light');set('[data-setup-theme="light"] small','lightHelp');set('[data-setup-theme="dark"] strong','dark');set('[data-setup-theme="dark"] small','darkHelp');
  set('[data-setup-step="1"] .kicker','yourDog');set('[data-setup-step="1"] h2','whoTrain');set('[data-setup-step="1"]>.setupLead','dogLead');
  set('[data-setup-step="1"] .profileField>span','dogName');const ageLabels=$$('[data-setup-step="1"] .profileAgeGrid .profileField>span');if(ageLabels[0])ageLabels[0].textContent=t('age');if(ageLabels[1])ageLabels[1].textContent=t('unit');
  const monthOpt=$('#setupDogAgeUnit option[value="months"]'),yearOpt=$('#setupDogAgeUnit option[value="years"]');if(monthOpt)monthOpt.textContent=t('months');if(yearOpt)yearOpt.textContent=t('years');
  set('[data-setup-step="1"] .setupNameHint p','nameHint');
  set('[data-setup-step="2"] .kicker','howWorks');set('[data-setup-step="2"] h2','shortSessions');set('[data-setup-step="2"]>.setupLead','howLead');
  const teaching=$$('[data-setup-step="2"] .setupTeachingGrid article');const keys=[['missionToday','missionTodayHelp'],['startExecution','startExecutionHelp'],['rateResult','rateResultHelp'],['adaptiveRoute','adaptiveRouteHelp']];teaching.forEach((article,i)=>{const strong=article.querySelector('strong'),p=article.querySelector('p');if(strong)strong.textContent=t(keys[i][0]);if(p)p.textContent=t(keys[i][1])});
  set('[data-setup-step="3"] .kicker','allReady');set('[data-setup-step="3"]>.setupLead','readyLead');set('#setupSummaryDogLabel','dog');set('#setupSummaryStageLabel','stage');set('#setupSummaryAgeLabel','age');set('#setupSummaryThemeLabel','theme');set('#setupSummaryAppLabel','appLangShort');set('#setupSummaryCommandsLabel','commandsShort');
  const readyRoute=$('.setupReadyRoute');if(readyRoute){const strong=readyRoute.querySelector('strong'),small=readyRoute.querySelector('small');if(strong)strong.textContent=t('communicationBases');if(small)small.textContent=t('communicationGoal')}
}
function setupAgePreviewText(){
  const value=Number($('#setupDogAge')?.value||0),unit=$('#setupDogAgeUnit')?.value||'months';
  if(!value)return t('ageHint');
  const months=Math.max(1,Math.round(unit==='years'?value*12:value)),stage=ENGINE.ageStage({ageMonths:months,ageUpdatedAt:new Date().toISOString()}),map={es:{'young-puppy':'Cachorro joven',puppy:'Cachorro',adolescent:'Adolescente',adult:'Adulto'},en:{'young-puppy':'Young puppy',puppy:'Puppy',adolescent:'Adolescent',adult:'Adult'},de:{'young-puppy':'Junger Welpe',puppy:'Welpe',adolescent:'Junghund',adult:'Erwachsen'}},stageLabel=map[appLanguage]?.[stage.key]||stage.label;
  if(months<12)return `${stageLabel} · ${months} ${appLanguage==='en'?(months===1?'month':'months'):appLanguage==='de'?(months===1?'Monat':'Monate'):(months===1?'mes':'meses')}`;
  const years=Math.round(months/12*10)/10,shown=Number.isInteger(years)?String(years):String(years).replace('.',appLanguage==='en'?'.':',');
  return `${stageLabel} · ${shown} ${appLanguage==='en'?(years===1?'year':'years'):appLanguage==='de'?(years===1?'Jahr':'Jahre'):(years===1?'año':'años')}`;
}
function syncSetupAgePreview(){const preview=$('#setupDogAgePreview');if(preview)preview.textContent=setupAgePreviewText()}
function setupDogDraft(){
  const name=String($('#setupDogName')?.value||dogProfile?.name||'').trim().replace(/\s+/g,' ').slice(0,24);
  const value=Number($('#setupDogAge')?.value||0),unit=$('#setupDogAgeUnit')?.value||'months';
  const ageMonths=dogAgeMonthsFromValue(value,unit);
  return{name,ageMonths,ageUpdatedAt:new Date().toISOString(),breed:'Pastor Alemán'};
}
function syncSetupThemeButtons(){
  $$('[data-setup-theme]').forEach(button=>{const selected=button.dataset.setupTheme===themePreference;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});
}
function syncSetupReadySummary(){
  const draft=setupDogDraft(),name=draft.name||(appLanguage==='en'?'Your dog':appLanguage==='de'?'Dein Hund':'Tu perro'),stage=ENGINE.ageStage(draft);
  const stageLabel=(()=>{const map={es:{'young-puppy':'Cachorro joven',puppy:'Cachorro',adolescent:'Adolescente',adult:'Adulto'},en:{'young-puppy':'Young puppy',puppy:'Puppy',adolescent:'Adolescent',adult:'Adult'},de:{'young-puppy':'Junger Welpe',puppy:'Welpe',adolescent:'Junghund',adult:'Erwachsen'}};return map[appLanguage]?.[stage.key]||stage.label})();
  const age=draft.ageMonths<12?`${draft.ageMonths} ${appLanguage==='en'?(draft.ageMonths===1?'month':'months'):appLanguage==='de'?(draft.ageMonths===1?'Monat':'Monate'):(draft.ageMonths===1?'mes':'meses')}`:`${Math.round(draft.ageMonths/12*10)/10} ${appLanguage==='en'?'years':appLanguage==='de'?'Jahre':'años'}`;
  $('#setupReadyName').textContent=name;$('#setupReadyName').parentElement.innerHTML=t('startsLevel0',{name:escapeHtml(name)}).replace(escapeHtml(name),`<span id="setupReadyName">${escapeHtml(name)}</span>`);
  $('#setupSummaryName').textContent=draft.name||'—';$('#setupSummaryStage').textContent=stageLabel;$('#setupSummaryAge').textContent=draft.ageMonths?age:'—';$('#setupSummaryTheme').textContent=themePreferenceLabel();$('#setupSummaryAppLanguage').textContent=languageName(appLanguage);$('#setupSummaryCommandLanguage').textContent=languageName(commandLanguage);
}
function setupStepCanContinue(){
  if(setupWizardStep!==1)return true;
  const name=String($('#setupDogName')?.value||'').trim(),age=$('#setupDogAge')?.value,unit=$('#setupDogAgeUnit')?.value||'months';
  return !!name&&dogAgeValueValid(age,unit);
}
function syncSetupNextState(){
  const next=$('#setupNextBtn');if(!next)return;
  const enabled=setupStepCanContinue();next.disabled=!enabled;next.setAttribute('aria-disabled',String(!enabled));
}
function renderSetupWizard(){
  const steps=$$('.setupWizardStep'),counter=$('#setupWizardCounter'),bar=$('#setupWizardProgressBar'),back=$('#setupBackBtn'),next=$('#setupNextBtn'),actions=$('.setupWizardActions'),body=$('#setupWizardBody');
  steps.forEach((step,index)=>step.hidden=index!==setupWizardStep);counter.textContent=`${setupWizardStep+1} / 4`;bar.style.width=`${(setupWizardStep+1)*25}%`;back.hidden=setupWizardStep===0;actions?.classList.toggle('singleAction',setupWizardStep===0);
  next.textContent=setupWizardStep===2?t('viewSummary'):setupWizardStep===3?t('startLevel0'):t('continue');back.textContent=t('back');
  const appSelect=$('#setupAppLanguage'),commandSelect=$('#setupCommandLanguage');if(appSelect)appSelect.value=appLanguage;if(commandSelect)commandSelect.value=commandLanguage;
  applySetupLanguageText();syncSetupThemeButtons();if(setupWizardStep===1)syncSetupAgePreview();if(setupWizardStep===3)syncSetupReadySummary();syncSetupNextState();
  if(body)body.scrollTop=0;
}
function populateSetupWizard(){
  $('#setupDogName').value=dogProfile?.name||'';
  const months=currentDogAgeMonths();if(months>=12){$('#setupDogAgeUnit').value='years';$('#setupDogAge').value=String(Math.round(months/12*10)/10)}else{$('#setupDogAgeUnit').value='months';$('#setupDogAge').value=months?String(months):''}
  syncDogAgeInputBounds($('#setupDogAge'),$('#setupDogAgeUnit').value);syncSetupAgePreview();
}
function validateSetupDog(){
  const draft=setupDogDraft(),ageValue=$('#setupDogAge')?.value,ageUnit=$('#setupDogAgeUnit')?.value||'months';if(!draft.name){toast(appLanguage==='en'?'Enter your dog’s name':appLanguage==='de'?'Gib den Namen deines Hundes ein':'Escribe el nombre de tu perro');$('#setupDogName')?.focus();return false}if(!dogAgeValueValid(ageValue,ageUnit)){toast(dogAgeLimitMessage());$('#setupDogAge')?.focus();return false}
  dogProfile={...dogProfile,...draft};return true;
}
async function completeSetupWizard(){
  if(!validateSetupDog()){setupWizardStep=1;renderSetupWizard();return}
  setupWizardVersion=SETUP_WIZARD_VERSION;teachingOnboardingVersion=TEACHING_GUIDE_VERSION;
  await store.setMany({patrickDogProfile:dogProfile,patrickTheme:themePreference,patrickAppLanguage:appLanguage,patrickCommandLanguage:commandLanguage,patrickSetupWizardVersion:setupWizardVersion,patrickTeachingOnboardingVersion:teachingOnboardingVersion});
  const dialog=$('#setupWizardDialog');if(dialog?.open)dialog.close();renderCommands();renderAll();syncSettingsDrawer();syncManagementDialogs();toast(appLanguage==='en'?`All set to train with ${dogName()}`:appLanguage==='de'?`Alles bereit für das Training mit ${dogName()}`:`Todo listo para entrenar con ${dogName()}`);setTimeout(()=>$('#dailyMissionStartBtn')?.focus(),120);
}
function setupWizardNext(){
  if(!setupStepCanContinue())return;
  if(setupWizardStep===1&&!validateSetupDog())return;
  document.activeElement?.blur?.();
  if(setupWizardStep>=3){completeSetupWizard();return}
  setupWizardStep++;renderSetupWizard();if(setupWizardStep===1)setTimeout(()=>$('#setupDogName')?.focus(),80);
}
function openSetupWizard(){
  setupWizardStep=0;populateSetupWizard();renderSetupWizard();const dialog=$('#setupWizardDialog');if(!dialog.open)dialog.showModal();
}
function bindSetupWizard(){
  $('#setupBackBtn').onclick=()=>{if(setupWizardStep>0){document.activeElement?.blur?.();setupWizardStep--;renderSetupWizard()}};$('#setupNextBtn').onclick=setupWizardNext;
  $('#setupAppLanguage').onchange=e=>setAppLanguage(e.target.value,{persist:false,rerender:true});$('#setupCommandLanguage').onchange=e=>setCommandLanguage(e.target.value,{persist:false,rerender:true});
  $$('[data-setup-theme]').forEach(button=>button.onclick=()=>{themePreference=normalizeTheme(button.dataset.setupTheme);applyTheme();syncSetupThemeButtons()});
  $('#setupDogName').addEventListener('input',syncSetupNextState);
  $('#setupDogAge').addEventListener('input',()=>{syncSetupAgePreview();syncSetupNextState()});
  $('#setupDogAgeUnit').addEventListener('change',()=>{const input=$('#setupDogAge'),unit=$('#setupDogAgeUnit');syncDogAgeInputBounds(input,unit.value);syncSetupAgePreview();syncSetupNextState()});
  $('#setupDogName').addEventListener('keydown',e=>{if(e.key==='Enter'&&setupStepCanContinue()){e.preventDefault();setupWizardNext()}});$('#setupWizardDialog').addEventListener('cancel',e=>e.preventDefault());
}
function populateDogProfileEditor(){
  const months=currentDogAgeMonths();
  $('#dogNameInput').value=dogProfile?.name||'';
  if(months>=12){$('#dogAgeUnit').value='years';$('#dogAgeInput').value=String(Math.round((months/12)*10)/10)}
  else{$('#dogAgeUnit').value='months';$('#dogAgeInput').value=months?String(months):''}
  syncDogAgeInputBounds($('#dogAgeInput'),$('#dogAgeUnit').value);$('#dogAgeUnit').dataset.previous=$('#dogAgeUnit').value;updateDogAgePreview();
}
function updateDogAgePreview(){
  const value=Number($('#dogAgeInput')?.value||0),unit=$('#dogAgeUnit')?.value,preview=$('#dogAgePreview');if(!preview)return;
  if(!value){preview.textContent=t('ageHint');return}if(!dogAgeValueValid(value,unit)){preview.textContent=dogAgeLimitMessage();return}
  const months=dogAgeMonthsFromValue(value,unit),stage=ENGINE.ageStage({ageMonths:months,ageUpdatedAt:new Date().toISOString()}),stageLabel=displayEngineText(stage.label);
  if(months<12){preview.textContent=`${stageLabel} · ${months} ${appLanguage==='en'?(months===1?'month':'months'):appLanguage==='de'?(months===1?'Monat':'Monate'):(months===1?'mes':'meses')}`;return}
  const years=Math.round((months/12)*10)/10,shown=Number.isInteger(years)?String(years):String(years).replace('.',appLanguage==='en'?'.':',');preview.textContent=`${stageLabel} · ${shown} ${appLanguage==='en'?(years===1?'year':'years'):appLanguage==='de'?(years===1?'Jahr':'Jahre'):(years===1?'año':'años')}`;
}
function openDogProfileEditor(firstRun=false,ageOnly=false){
  const dialog=$('#profileDialog');dialog.dataset.firstRun=firstRun?'1':'0';
  $('#profileDialogTitle').textContent=firstRun?copyText('Cuéntame sobre tu pastor alemán'):ageOnly?(appLanguage==='en'?`Complete ${dogName()}'s profile`:appLanguage==='de'?`Profil von ${dogName()} vervollständigen`:`Completa el perfil de ${dogName()}`):(appLanguage==='en'?`${dogName()}'s profile`:appLanguage==='de'?`Profil von ${dogName()}`:`Perfil de ${dogName()}`);
  $('#profileDialogText').textContent=firstRun?(appLanguage==='en'?'Set name and age. Patrick Training remains the app name and will personalize sessions for your dog.':appLanguage==='de'?'Lege Name und Alter fest. Patrick Training bleibt der App-Name und personalisiert die Einheiten für deinen Hund.':'Configura su nombre y edad. Patrick Training seguirá siendo el nombre de la app y personalizará las sesiones para tu perro.'):ageOnly?(appLanguage==='en'?'Add age so the app can show the life stage without changing progress.':appLanguage==='de'?'Füge das Alter hinzu, damit die App die Lebensphase anzeigen kann, ohne den Fortschritt zu verändern.':'Añade su edad para que la app pueda mostrar su etapa de vida sin tocar tu progreso.'):(appLanguage==='en'?'You can change name and age without losing levels, sessions or statistics.':appLanguage==='de'?'Du kannst Name und Alter ändern, ohne Stufen, Einheiten oder Statistiken zu verlieren.':'Puedes cambiar el nombre y la edad sin perder niveles, sesiones ni estadísticas.');
  const kicker=dialog.querySelector('.profileCard .kicker');if(kicker)kicker.textContent=copyText('PERFIL DEL PERRO');const fields=dialog.querySelectorAll('.profileField>span');if(fields[0])fields[0].textContent=appLanguage==='en'?'Name':appLanguage==='de'?'Name':'Nombre';if(fields[1])fields[1].textContent=t('age');if(fields[2])fields[2].textContent=t('unit');const monthOpt=$('#dogAgeUnit option[value="months"]'),yearOpt=$('#dogAgeUnit option[value="years"]');if(monthOpt)monthOpt.textContent=t('months');if(yearOpt)yearOpt.textContent=t('years');
  $('#profileCancelBtn').hidden=firstRun;$('#profileCancelBtn').textContent=t('cancel');$('#saveProfileBtn').textContent=firstRun?copyText('Guardar y empezar'):(appLanguage==='en'?'Save changes':appLanguage==='de'?'Änderungen speichern':'Guardar cambios');populateDogProfileEditor();if(!dialog.open)dialog.showModal();
  setTimeout(()=>$(firstRun?'#dogNameInput':ageOnly?'#dogAgeInput':'#dogNameInput')?.focus(),80);
}
function saveDogProfile(){
  const firstRun=$('#profileDialog')?.dataset.firstRun==='1';
  const name=$('#dogNameInput').value.trim().replace(/\s+/g,' ').slice(0,24);if(!name){toast(appLanguage==='en'?'Enter your dog’s name':appLanguage==='de'?'Gib den Namen deines Hundes ein':'Escribe el nombre de tu perro');$('#dogNameInput').focus();return}
  const ageValue=Number($('#dogAgeInput').value||0),unit=$('#dogAgeUnit').value;if(!dogAgeValueValid(ageValue,unit)){toast(dogAgeLimitMessage());$('#dogAgeInput').focus();return}
  const ageMonths=dogAgeMonthsFromValue(ageValue,unit);dogProfile={...dogProfile,name,breed:'Pastor Alemán',ageMonths,ageUpdatedAt:new Date().toISOString()};
  store.set('patrickDogProfile',dogProfile);$('#profileDialog').close();renderAll();renderCommands();syncSettingsDrawer();toast(appLanguage==='en'?`${name}'s profile saved`:appLanguage==='de'?`Profil von ${name} gespeichert`:`Perfil de ${name} guardado`);
  if(firstRun&&teachingOnboardingVersion<TEACHING_GUIDE_VERSION)setTimeout(()=>openTeachingGuide(),220);
}

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
  const day=new Intl.DateTimeFormat(I18N?.locale?.(appLanguage)||'es-CO',{weekday:'long'}).format(new Date());
  const streak=typeof currentHealthyStreak==='function'?currentHealthyStreak():0;
  const title=appLanguage==='en'?`Today is ${day} 🐾`:appLanguage==='de'?`Heute ist ${day} 🐾`:`Hoy es ${day} 🐾`;
  const body=streak>0?(appLanguage==='en'?`Your streak is ${streak} ${streak===1?'day':'days'}. One micro-session with ${dogName()} keeps it going.`:appLanguage==='de'?`Deine Serie steht bei ${streak} ${streak===1?'Tag':'Tagen'}. Eine Mikro-Einheit mit ${dogName()} hält sie am Laufen.`:`Tu racha va en ${streak} ${streak===1?'día':'días'}. Una micro-sesión con ${dogName()} la mantiene.`):(appLanguage==='en'?`One short micro-session with ${dogName()} is enough to start the streak.`:appLanguage==='de'?`Eine kurze Mikro-Einheit mit ${dogName()} reicht aus, um die Serie zu starten.`:`Una micro-sesión corta con ${dogName()} es suficiente para empezar la racha.`);
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
  if(note)note.textContent=permission==='denied'?(appLanguage==='en'?'The browser has blocked notifications for this app.':appLanguage==='de'?'Der Browser hat Benachrichtigungen für diese App blockiert.':'El navegador tiene bloqueadas las notificaciones para esta app.'):reminderSettings.enabled&&(storageMode!=='indexeddb'||reminderStorageMode!=='indexeddb')?(appLanguage==='en'?'The reminder works while you use the app; this storage mode cannot check it in the background.':appLanguage==='de'?'Die Erinnerung funktioniert während der App-Nutzung; dieser Speichermodus kann sie nicht im Hintergrund prüfen.':'El recordatorio funciona mientras usas la app; este almacenamiento no permite comprobarlo en segundo plano.'):reminderSettings.enabled?(appLanguage==='en'?'Nothing is sent if you already trained today. The system may choose the exact background check time.':appLanguage==='de'?'Wenn du heute schon trainiert hast, wird nichts gesendet. Das System kann den genauen Zeitpunkt der Hintergrundprüfung bestimmen.':'No se enviará nada si ya entrenaste hoy. El sistema puede decidir el momento exacto del chequeo en segundo plano.'):(appLanguage==='en'?'Enable them to get a daily reminder if you have not trained yet.':appLanguage==='de'?'Aktiviere sie für eine tägliche Erinnerung, falls du noch nicht trainiert hast.':'Actívalas para recibir un recordatorio diario si aún no has entrenado.');
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
      <header class="managementHeader"><div><p class="kicker">APLICACIÓN</p><h2 id="appSettingsTitle">Configuración</h2><p class="muted">Idioma, apariencia, almacenamiento y respaldos.</p></div><button id="closeAppSettingsBtn" class="roundBtn" type="button" aria-label="Cerrar configuración">${icon('x')}</button></header>
      <section id="languageSettingsSection" class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('settings')}</span><div><strong id="languageSettingsTitle">Idioma</strong><small id="languageSettingsHelp">La interfaz y los comandos pueden usar idiomas distintos.</small></div></div><label class="managementControl"><span id="appLanguageSettingsLabel">Idioma de la app</span><select id="appLanguageSelect" aria-label="Idioma de la aplicación"><option value="es">Español</option><option value="en">English</option><option value="de">Deutsch</option></select></label><label class="managementControl"><span id="commandLanguageSettingsLabel">Idioma de los comandos</span><select id="commandLanguageSelect" aria-label="Idioma de los comandos"><option value="de">Deutsch</option><option value="es">Español</option><option value="en">English</option></select></label></section>
      <section class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('palette')}</span><div><strong id="appearanceSettingsTitle">Apariencia</strong><small id="themeCurrentValue">Sistema</small></div></div><label class="managementControl"><span id="themeSettingsLabel">Tema</span><select id="themeSelect" aria-label="Tema de la aplicación"><option value="system">Usar sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label></section><section id="germanVoiceSection" class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('volume')}</span><div><strong id="germanVoiceTitle">Pronunciación alemana</strong><small id="germanVoiceCurrent">Automática</small></div></div><label class="managementControl"><span id="voiceSettingsLabel">Voz</span><select id="germanVoiceSelect" aria-label="Voz alemana"></select></label><button id="testGermanVoiceBtn" class="managementAction" type="button"><span>${icon('volume')}</span><div><strong id="testVoiceTitle">Probar voz</strong><small id="testVoiceHelp">Reproduce “Sitz” con la voz seleccionada.</small></div><i>${icon('chevron')}</i></button><small id="germanVoiceNote" class="settingsNote">Usa las voces instaladas en tu dispositivo. Si la voz elegida deja de existir, la app vuelve automáticamente a una voz alemana disponible.</small></section>
      <section class="managementSection"><div class="managementSectionTitle"><span class="managementIcon">${icon('database')}</span><div><strong>Datos y almacenamiento</strong><small>Tu información permanece en este dispositivo.</small></div></div><div class="managementMeta"><span>Motor de almacenamiento</span><strong id="storageModeLabel" class="storageBadge">IndexedDB</strong></div><div class="managementMeta"><span>Estado técnico</span><strong id="diagnosticSummary">v${escapeHtml(CONFIG.APP_VERSION)} · schema ${CONFIG.BACKUP_SCHEMA_VERSION}</strong></div><div class="managementMeta"><span>Último respaldo</span><strong id="lastBackupStatus">Aún sin respaldo</strong></div><button id="exportBtn" class="managementAction" type="button"><span>${icon('download')}</span><div><strong>Exportar respaldo</strong><small>Descarga perfil, progreso, sesiones y preferencias.</small></div><i>${icon('chevron')}</i></button><button id="importBtn" class="managementAction" type="button"><span>${icon('upload')}</span><div><strong>Restaurar respaldo</strong><small>Importa un respaldo validado de Patrick Training.</small></div><i>${icon('chevron')}</i></button><button id="exportDiagnosticBtn" class="managementAction" type="button"><span>${icon('info')}</span><div><strong>Exportar diagnóstico</strong><small>Versión, almacenamiento, ruta y estado técnico; sin historial detallado.</small></div><i>${icon('chevron')}</i></button><button id="resetAllDataBtn" class="managementAction managementDangerAction" type="button"><span>${icon('x')}</span><div><strong>Reiniciar todos los datos</strong><small>Borra perfil, progreso, sesiones, preferencias y vuelve al wizard inicial.</small></div><i>${icon('chevron')}</i></button><input id="importFileInput" type="file" accept="application/json,.json" hidden></section>
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
function applyManagementLanguageText(){
  const set=(selector,key)=>{const el=$(selector);if(el)el.textContent=t(key)},copy=(selector,source)=>{const el=$(selector);if(el)el.textContent=copyText(source)},attr=(selector,name,source)=>{const el=$(selector);if(el)el.setAttribute(name,copyText(source))};
  set('#appSettingsDialog .managementHeader .kicker','application');set('#appSettingsTitle','configuration');set('#appSettingsDialog .managementHeader .muted','configurationHelp');
  set('#languageSettingsTitle','language');set('#languageSettingsHelp','languageHelp');set('#appLanguageSettingsLabel','appLanguage');set('#commandLanguageSettingsLabel','commandLanguage');
  set('#appearanceSettingsTitle','appearance');set('#themeSettingsLabel','theme');set('#germanVoiceTitle','germanPronunciation');set('#voiceSettingsLabel','voice');set('#testVoiceTitle','testVoice');set('#testVoiceHelp','testVoiceHelp');
  const theme=$('#themeSelect');if(theme){theme.options[0].text=t('system');theme.options[1].text=t('light');theme.options[2].text=t('dark')}
  attr('#closeAppSettingsBtn','aria-label','Cerrar configuración');copy('#germanVoiceNote','Usa las voces instaladas en tu dispositivo. Si la voz elegida deja de existir, la app vuelve automáticamente a una voz alemana disponible.');
  const dataSection=$('#exportBtn')?.closest('.managementSection');if(dataSection){const title=dataSection.querySelector('.managementSectionTitle strong'),note=dataSection.querySelector('.managementSectionTitle small'),meta=dataSection.querySelectorAll('.managementMeta>span'),actions=dataSection.querySelectorAll('.managementAction');if(title)title.textContent=copyText('Datos y almacenamiento');if(note)note.textContent=copyText('Tu información permanece en este dispositivo.');if(meta[0])meta[0].textContent=copyText('Motor de almacenamiento');if(meta[1])meta[1].textContent=copyText('Estado técnico');if(meta[2])meta[2].textContent=appLanguage==='en'?'Last backup':appLanguage==='de'?'Letztes Backup':'Último respaldo';if(actions[0]){actions[0].querySelector('strong').textContent=t('exportBackup');actions[0].querySelector('small').textContent=copyText('Descarga perfil, progreso, sesiones y preferencias.')}if(actions[1]){actions[1].querySelector('strong').textContent=t('restoreBackup');actions[1].querySelector('small').textContent=copyText('Importa un respaldo validado de Patrick Training.')}if(actions[2]){actions[2].querySelector('strong').textContent=t('exportDiagnostic');actions[2].querySelector('small').textContent=copyText('Versión, almacenamiento, ruta y estado técnico; sin historial detallado.')}if(actions[3]){actions[3].querySelector('strong').textContent=t('resetAll');actions[3].querySelector('small').textContent=copyText('Borra perfil, progreso, sesiones, preferencias y vuelve al wizard inicial.')}}
  copy('#aboutDialog .managementHeader .kicker','ACERCA DE');copy('#aboutDialog .managementHeader .muted','Entrenamiento local-first para construir vínculo, obediencia y progreso.');attr('#closeAboutBtn','aria-label','Cerrar acerca de');
  const aboutVersion=$('#aboutDialog .aboutHero span');if(aboutVersion)aboutVersion.textContent=(appLanguage==='en'?'Version ':appLanguage==='de'?'Version ':'Versión ')+CONFIG.APP_VERSION;copy('#aboutDialog .aboutCreator small','CREADO POR');copy('#aboutDialog .aboutCreator p','Proyecto independiente diseñado para acompañar el entrenamiento diario de Patrick.');
  const aboutLinks=$$('#aboutDialog .aboutLinks a');if(aboutLinks[0]){aboutLinks[0].querySelector('strong').textContent=copyText('Proyecto en GitHub')}if(aboutLinks[1]){aboutLinks[1].querySelector('strong').textContent=copyText('Contacto / creador');aboutLinks[1].querySelector('small').textContent=copyText('Perfil de Dtopika en GitHub')}
  const guide=$('#teachingGuideDialog');if(guide){guide.querySelector('.managementHeader .kicker').textContent=t('howWorks').toUpperCase();guide.querySelector('#teachingGuideTitle').textContent=copyText('Entrena menos, mide mejor');guide.querySelector('.managementHeader .muted').textContent=copyText('Patrick Training usa evidencia reciente para decidir qué practicar y cuándo subir dificultad.');guide.querySelector('#closeTeachingGuideBtn').setAttribute('aria-label',appLanguage==='en'?'Close guide':appLanguage==='de'?'Anleitung schließen':'Cerrar guía');
    const steps=guide.querySelectorAll('.teachingSteps article'),titles=[copyText('Estados de aprendizaje'),copyText('Confianza de la evidencia'),copyText('3–5 ejecuciones, no siempre cinco'),copyText('Tiempo preciso')],paras=appLanguage==='en'?['In practice builds the response; Consistent means stable responses; Generalizing works across different contexts; Mastered has varied and sustained evidence.','This is not a grade for your dog. It shows how much information the app has: sessions, executions, contexts and evidence days.','The engine adjusts volume by performance, state and development stage. More repetitions do not always mean better training.','Tap Start execution just before giving the cue. Rate the result when your dog responds. Only these new timings are used to assess speed or duration.']:appLanguage==='de'?['Im Training baut die Reaktion auf; Konstant bedeutet stabile Reaktionen; Generalisiert funktioniert in verschiedenen Kontexten; Beherrscht hat vielfältige und nachhaltige Daten.','Das ist keine Note für deinen Hund. Es zeigt, wie viele Informationen die App hat: Einheiten, Ausführungen, Kontexte und Tage mit Daten.','Die Engine passt den Umfang an Leistung, Status und Entwicklungsphase an. Mehr Wiederholungen bedeuten nicht automatisch besseres Training.','Tippe direkt vor dem Signal auf Ausführung starten. Bewerte das Ergebnis, sobald dein Hund reagiert. Nur diese neuen Zeiten werden für Geschwindigkeit oder Dauer verwendet.']:['En práctica construye la respuesta; Consistente ya responde con estabilidad; Generalizando funciona en contextos distintos; Dominado tiene evidencia variada y sostenida.','No es una nota de Patrick. Indica cuánta información tiene la app: sesiones, ejecuciones, contextos y días de evidencia.','El motor ajusta el volumen según rendimiento, estado y etapa. Más repeticiones no siempre significan mejor entrenamiento.','Pulsa Iniciar ejecución justo antes de dar la señal. Luego califica cuando Patrick responda. Solo esos tiempos nuevos se usan para valorar velocidad o duración.'];steps.forEach((step,i)=>{step.querySelector('strong').textContent=titles[i];step.querySelector('p').textContent=paras[i]});copy('#teachingGuideDialog .teachingLegend strong','Regla simple');const legend=guide.querySelector('.teachingLegend span');if(legend)legend.textContent=appLanguage==='en'?'Short sessions, clear criterion, the marker at the right moment and immediate reward.':appLanguage==='de'?'Kurze Einheiten, klares Kriterium, Marker im richtigen Moment und sofortige Belohnung.':'Sesiones cortas, criterio claro, Ja! en el momento correcto y premio inmediato.';copy('#finishTeachingGuideBtn','Entendido')}
}
function syncManagementDialogs(){
  if(!$('#appSettingsDialog'))return;
  const theme=$('#themeSelect');if(theme)theme.value=normalizeTheme(themePreference);
  const appSelect=$('#appLanguageSelect'),commandSelect=$('#commandLanguageSelect');if(appSelect)appSelect.value=appLanguage;if(commandSelect)commandSelect.value=commandLanguage;
  const storage=$('#storageModeLabel');if(storage)storage.textContent=storageMode==='indexeddb'?'IndexedDB':appLanguage==='en'?'Local storage':appLanguage==='de'?'Lokaler Speicher':'Almacenamiento local';
  const backup=$('#lastBackupStatus');if(backup)backup.textContent=backupHealthText();
  const germanSection=$('#germanVoiceSection');if(germanSection)germanSection.hidden=commandLanguage!=='de';
  applyTheme();applyManagementLanguageText();syncGermanVoiceUI();
}
function openAppSettingsDialog(){ensureManagementDialogs();syncManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#appSettingsDialog');if(!d.open)d.showModal()},180)}
function openAboutDialog(){ensureManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#aboutDialog');if(!d.open)d.showModal()},180)}
function markTeachingGuideSeen(){
  if(teachingOnboardingVersion>=TEACHING_GUIDE_VERSION)return;
  teachingOnboardingVersion=TEACHING_GUIDE_VERSION;store.set('patrickTeachingOnboardingVersion',teachingOnboardingVersion);
}
function closeTeachingGuide(){markTeachingGuideSeen();const dialog=$('#teachingGuideDialog');if(dialog?.open)dialog.close()}
function openTeachingGuide(){ensureManagementDialogs();closeSettingsDrawer();setTimeout(()=>{const d=$('#teachingGuideDialog');if(!d.open)d.showModal()},180)}

function applySettingsDrawerLanguageText(){
  const drawer=$('#settingsDrawer');if(!drawer)return;
  const groupTitles=$$('.settingsGroupTitle');if(groupTitles[1])groupTitles[1].textContent=appLanguage==='en'?'Training':appLanguage==='de'?'Training':'Entrenamiento';if(groupTitles[2])groupTitles[2].textContent=t('reminders');if(groupTitles[3])groupTitles[3].textContent=appLanguage==='en'?'Application':appLanguage==='de'?'Anwendung':'Aplicación';
  const set=(selector,key)=>{const el=$(selector);if(el)el.textContent=t(key)},copy=(selector,source)=>{const el=$(selector);if(el)el.textContent=copyText(source)},attr=(selector,name,source)=>{const el=$(selector);if(el)el.setAttribute(name,copyText(source))};
  set('#editDogBtn strong','profileDog');set('#openTeachingGuideBtn strong','howItWorks');set('#openAppSettingsBtn strong','appSettings');set('#openAboutBtn strong','about');set('#notificationToggle strong','dailyReminder');
  copy('#settingsDrawer .settingsDrawerIdentity small','PERFIL ACTIVO');copy('#editDogBtn small','Nombre, edad y etapa de desarrollo.');copy('#settingsDrawer .settingsGroup:nth-of-type(2) .settingsRowCopy strong','Disponibilidad');copy('#settingsDrawer .settingsGroup:nth-of-type(2) .settingsRowCopy small','Define cuántas micro-sesiones te proponemos.');
  copy('#notificationToggle small','Solo si todavía no entrenaste ese día.');copy('#settingsDrawer .reminderTimeField strong','Hora preferida');copy('#settingsDrawer .reminderTimeField small','Hora local del teléfono.');copy('#openTeachingGuideBtn small','Estados, confianza, repeticiones y medición.');copy('#openAppSettingsBtn small','Tema, almacenamiento y respaldos.');copy('#openAboutBtn small','Creador, versión y contacto del proyecto.');
  attr('#settingsCloseBtn','aria-label','Cerrar menú');const time=$('#notificationTime');if(time)time.setAttribute('aria-label',copyText('Hora del recordatorio'));const dayOptions=$('#settingsDayType')?.options;if(dayOptions?.length>=2){dayOptions[0].text=t('duringDay');dayOptions[1].text=t('nightOnly')}
}
function syncSettingsDrawer(){
  if(!$('#settingsDrawer'))return;renderDogIdentity();$('#settingsDayType').value=dayType;applySettingsDrawerLanguageText();
  const stage=dogStageLabel(),age=dogAgeLabel(),breed=appLanguage==='en'?'German Shepherd':appLanguage==='de'?'Deutscher Schäferhund':'Pastor alemán';$('#dogProfileMeta').textContent=`${breed}${stage?` · ${stage}`:''} · ${age}`;syncReminderUI();
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
  $('#openTeachingGuideBtn').onclick=openTeachingGuide;$('#openAppSettingsBtn').onclick=openAppSettingsDialog;$('#openAboutBtn').onclick=openAboutDialog;
  $('#settingsDayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);$('#dayType').value=dayType;renderToday();syncSettingsDrawer()};
  $('#appLanguageSelect').onchange=e=>setAppLanguage(e.target.value);$('#commandLanguageSelect').onchange=e=>setCommandLanguage(e.target.value);$('#themeSelect').onchange=e=>setThemePreference(e.target.value);$('#germanVoiceSelect').onchange=e=>setGermanVoicePreference(e.target.value);$('#testGermanVoiceBtn').onclick=()=>speak(commandBy('Sitz'));$('#closeAppSettingsBtn').onclick=()=>$('#appSettingsDialog').close();$('#closeAboutBtn').onclick=()=>$('#aboutDialog').close();$('#closeTeachingGuideBtn').onclick=closeTeachingGuide;$('#finishTeachingGuideBtn').onclick=closeTeachingGuide;
  $('#exportBtn').onclick=exportProgress;$('#exportDiagnosticBtn').onclick=exportDiagnostic;$('#resetAllDataBtn').onclick=resetAllTrainingData;$('#importBtn').onclick=()=>$('#importFileInput').click();$('#importFileInput').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';await importProgressFile(file)};
  $('#appSettingsDialog').addEventListener('click',e=>{if(e.target===$('#appSettingsDialog'))$('#appSettingsDialog').close()});$('#aboutDialog').addEventListener('click',e=>{if(e.target===$('#aboutDialog'))$('#aboutDialog').close()});$('#teachingGuideDialog').addEventListener('cancel',e=>{e.preventDefault();closeTeachingGuide()});$('#teachingGuideDialog').addEventListener('click',e=>{if(e.target===$('#teachingGuideDialog'))closeTeachingGuide()});
  $('#notificationToggle').onclick=toggleDailyReminders;$('#notificationTime').onchange=async e=>{reminderSettings.time=e.target.value||'19:00';reminderSettings.lastNotifiedDate=null;await saveReminderSettings();scheduleForegroundReminder();syncReminderUI();toast(`Recordatorio: ${reminderSettings.time}`)};
  $('#saveProfileBtn').onclick=saveDogProfile;$('#profileCancelBtn').onclick=()=>$('#profileDialog').close();$('#dogNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDogProfile()}});$('#dogAgeInput').addEventListener('input',updateDogAgePreview);
  $('#dogAgeUnit').addEventListener('change',()=>{const input=$('#dogAgeInput'),unit=$('#dogAgeUnit'),previous=unit.dataset.previous||'months',value=Number(input.value||0);if(value>0){const months=previous==='years'?value*12:value;input.value=unit.value==='years'?String(Math.round((months/12)*10)/10):String(Math.max(1,Math.round(months)))}unit.dataset.previous=unit.value;syncDogAgeInputBounds(input,unit.value);updateDogAgePreview()});
  $('#profileDialog').addEventListener('cancel',e=>{if($('#profileDialog').dataset.firstRun==='1')e.preventDefault()});document.addEventListener('keydown',handleSettingsKeydown);
}
function initProfileUI(){
  if(profileUiInitialized)return;profileUiInitialized=true;try{store.remove('patrickDark');localStorage.removeItem('patrickDark')}catch{}
  themePreference=normalizeTheme(store.get(THEME_KEY,'system'));teachingOnboardingVersion=Number(store.get('patrickTeachingOnboardingVersion',0))||0;setupWizardVersion=Number(store.get('patrickSetupWizardVersion',0))||0;applyTheme();SYSTEM_THEME.addEventListener?.('change',()=>{if(themePreference==='system')applyTheme()});window.speechSynthesis?.addEventListener?.('voiceschanged',syncGermanVoiceUI);ensureSettingsDrawer();ensureManagementDialogs();bindProfileUI();bindSetupWizard();syncSettingsDrawer();syncManagementDialogs();loadReminderSettings().then(async()=>{if(reminderSettings.enabled&&Notification.permission==='granted')await periodicReminderRegistration(true);await showDailyReminder()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)showDailyReminder()});window.addEventListener('focus',()=>showDailyReminder());
  const hasName=String(dogProfile?.name||'').trim(),hasAge=currentDogAgeMonths()>0,completeProfile=!!hasName&&hasAge;
  if(completeProfile&&setupWizardVersion<SETUP_WIZARD_VERSION){setupWizardVersion=SETUP_WIZARD_VERSION;store.set('patrickSetupWizardVersion',setupWizardVersion)}
  if(currentLevel===0&&!completeProfile)setTimeout(openSetupWizard,80);
  else if(!hasName)setTimeout(()=>openDogProfileEditor(true),80);
  else if(!hasAge)setTimeout(()=>openDogProfileEditor(false,true),300);
  else if(teachingOnboardingVersion<TEACHING_GUIDE_VERSION)setTimeout(()=>openTeachingGuide(),520);
}
