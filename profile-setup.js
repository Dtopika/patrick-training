'use strict';
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
  if(!value)return t('ageHint');if(!dogAgeValueValid(value,unit))return dogAgeLimitMessage();
  const months=dogAgeMonthsFromValue(value,unit),stage=ENGINE.ageStage({ageMonths:months,ageUpdatedAt:new Date().toISOString()}),map={es:{'young-puppy':'Cachorro joven',puppy:'Cachorro',adolescent:'Adolescente',adult:'Adulto'},en:{'young-puppy':'Young puppy',puppy:'Puppy',adolescent:'Adolescent',adult:'Adult'},de:{'young-puppy':'Junger Welpe',puppy:'Welpe',adolescent:'Junghund',adult:'Erwachsen'}},stageLabel=map[appLanguage]?.[stage.key]||stage.label;
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
