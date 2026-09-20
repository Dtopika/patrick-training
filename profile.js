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
