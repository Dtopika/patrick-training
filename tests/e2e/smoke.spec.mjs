import {test,expect} from '@playwright/test';

async function expectContainedHorizontally(page,selector){
  const metrics=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();
    const offenders=[...el.querySelectorAll('*')].map(node=>{
      const box=node.getBoundingClientRect();
      return{
        tag:node.tagName.toLowerCase(),
        id:node.id||'',
        className:typeof node.className==='string'?node.className:'',
        left:Math.round(box.left),
        right:Math.round(box.right),
        width:Math.round(box.width),
        scrollWidth:node.scrollWidth,
        clientWidth:node.clientWidth
      };
    }).filter(item=>item.right>window.innerWidth+1||item.left<-1||item.scrollWidth>item.clientWidth+1)
      .sort((a,b)=>Math.max(b.right-window.innerWidth,b.scrollWidth-b.clientWidth)-Math.max(a.right-window.innerWidth,a.scrollWidth-a.clientWidth))
      .slice(0,8);
    return{left:r.left,right:r.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,viewport:window.innerWidth,offenders};
  });
  const details=selector+' overflow diagnostics: '+JSON.stringify(metrics.offenders);
  expect(metrics.left,details).toBeGreaterThanOrEqual(-1);
  expect(metrics.right,details).toBeLessThanOrEqual(metrics.viewport+1);
  expect(metrics.scrollWidth,details).toBeLessThanOrEqual(metrics.clientWidth+1);
}
async function expectNoHorizontalOverflow(page){
  const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,innerWidth:window.innerWidth}));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth+1);
  expect(metrics.clientWidth).toBeLessThanOrEqual(metrics.innerWidth+1);
}
async function expectVisibleBounds(page,selector){
  const metrics=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();
    return{left:r.left,right:r.right,viewport:window.innerWidth,overflowX:getComputedStyle(el).overflowX};
  });
  const details=selector+' visible bounds: '+JSON.stringify(metrics);
  expect(metrics.left,details).toBeGreaterThanOrEqual(-1);
  expect(metrics.right,details).toBeLessThanOrEqual(metrics.viewport+1);
}
async function onboard(page){
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.patrickReady||'')).toBe('true');
  const wizard=page.locator('#setupWizardDialog');
  await expect(wizard).toBeVisible();
  await expect(page.locator('#setupWizardCounter')).toHaveText('1 / 4');

  const firstNextBox=await page.locator('#setupNextBtn').boundingBox();
  const viewport=page.viewportSize();
  expect(firstNextBox.height).toBeLessThanOrEqual(54);
  expect(firstNextBox.width).toBeGreaterThan(viewport.width*.82);
  await expect(page.locator('#setupBackBtn')).toBeHidden();

  await page.locator('[data-setup-theme="dark"]').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('#setupWizardCounter')).toHaveText('2 / 4');
  await expect(page.locator('#setupBackBtn')).toBeVisible();
  await expect(page.locator('#setupNextBtn')).toBeDisabled();
  const backBox=await page.locator('#setupBackBtn').boundingBox();
  const secondNextBox=await page.locator('#setupNextBtn').boundingBox();
  expect(backBox.height).toBeLessThanOrEqual(54);
  expect(secondNextBox.height).toBeLessThanOrEqual(54);
  expect(secondNextBox.width).toBeGreaterThan(backBox.width*1.5);

  await page.locator('#setupDogName').fill('Patrick');
  await expect(page.locator('#setupNextBtn')).toBeDisabled();
  await page.locator('#setupDogAge').fill('4');
  await expect(page.locator('#setupNextBtn')).toBeEnabled();
  await expect(page.locator('#setupDogAgePreview')).toContainText('4 meses');
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('#setupWizardCounter')).toHaveText('3 / 4');
  await expect(page.locator('[data-setup-step="2"]')).toContainText('Sesiones cortas');
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('#setupWizardCounter')).toHaveText('4 / 4');
  await expect(page.locator('#setupSummaryName')).toHaveText('Patrick');
  await expect(page.locator('#setupSummaryTheme')).toHaveText('Oscuro');
  await page.locator('#setupNextBtn').click();

  await expect(wizard).not.toBeVisible();
  await expect(page.locator('#dailyMission')).toBeVisible();
  await expect(page.locator('#dailyMissionTitle')).not.toHaveText('Preparando tu sesión');
}

test('app and command languages are independent from wizard through settings',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#setupWizardDialog')).toBeVisible();

  await page.locator('#setupAppLanguage').selectOption('en');
  await expect(page.locator('[data-setup-step="0"] h2')).toHaveText('First, make it yours');
  await expect(page.locator('#setupNextBtn')).toHaveText('Continue');
  await page.locator('#setupCommandLanguage').selectOption('es');
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('[data-setup-step="1"] h2')).toHaveText('Who are we training with?');
  await page.locator('#setupDogName').fill('Max');
  await page.locator('#setupDogAge').fill('5');
  await expect(page.locator('#setupDogAgePreview')).toContainText('5 months');
  await page.locator('#setupNextBtn').click();
  await expect(page.locator('[data-setup-step="2"]')).toContainText('Short sessions');
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('#setupSummaryAppLanguage')).toHaveText('English');
  await expect(page.locator('#setupSummaryCommandLanguage')).toHaveText('Español');
  await expect(page.locator('#setupNextBtn')).toHaveText('Start Level 0');
  await page.locator('#setupNextBtn').click();

  await expect(page.locator('.bottomNav [data-view="today"] small')).toHaveText('Today');
  await expect(page.locator('.bottomNav [data-view="commands"] small')).toHaveText('Commands');
  await expect(page.locator('#dailyPlanDetails summary span')).toHaveText('View plan details');
  await expect(page.locator('#smartDailyPlan')).toContainText('ADAPTIVE COACH');
  await page.locator('.bottomNav [data-view="commands"]').click();
  const sit=page.locator('.commandCard[data-command="Sitz"]');
  await expect(sit).toBeVisible();
  await expect(sit.locator('.commandTitle strong')).toHaveText('Siéntate');
  await expect(sit.locator('.commandMeaning')).toHaveText('Sit');
  await sit.locator('.commandToggle').click();
  await expect(sit).toContainText('Rear touches the ground while front paws remain planted.');
  await expect(sit).toContainText('Reward at the nose');
  await expect.poll(()=>page.evaluate(()=>({app:appLanguage,commands:commandLanguage,canonical:commandBy('Sitz').cmd,shown:displayCommand(commandBy('Sitz'))}))).toEqual({app:'en',commands:'es',canonical:'Sitz',shown:'Siéntate'});

  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#germanVoiceSection')).toBeHidden();
  await expect(page.locator('#exportBtn strong')).toHaveText('Export backup');
  await page.locator('#appLanguageSelect').selectOption('de');
  await page.locator('#commandLanguageSelect').selectOption('en');
  await expect(page.locator('#appSettingsTitle')).toHaveText('Einstellungen');
  await expect(page.locator('#exportBtn strong')).toHaveText('Backup exportieren');
  await expect(page.locator('#germanVoiceSection')).toBeHidden();
  await page.locator('#closeAppSettingsBtn').click();

  await expect(page.locator('.bottomNav [data-view="today"] small')).toHaveText('Heute');
  await expect(page.locator('.bottomNav [data-view="levels"] small')).toHaveText('Stufen');
  await page.locator('.bottomNav [data-view="commands"]').click();
  const germanSit=page.locator('.commandCard[data-command="Sitz"]');
  await expect(germanSit.locator('.commandTitle strong')).toHaveText('Sit');
  await germanSit.locator('.commandToggle').click();
  await expect(germanSit).toContainText('Hinterteil am Boden');
  await expect(germanSit).toContainText('Belohnung an die Nase');
  await page.locator('.bottomNav [data-view="progress"]').click();
  await expect(page.locator('#adaptiveSummary')).toContainText('ADAPTIVE ENGINE V3');
  await expect(page.locator('#habitCard')).toContainText('GESUNDE GEWOHNHEIT');
  await expect.poll(()=>page.evaluate(()=>({lang:document.documentElement.lang,app:appLanguage,commands:commandLanguage,canonical:commandBy('Sitz').cmd}))).toEqual({lang:'de',app:'de',commands:'en',canonical:'Sitz'});
});


test('v7.9 prevents browser pull-to-refresh and restores the active section after reload',async({page})=>{
  await onboard(page);
  await page.locator('.bottomNav [data-view="commands"]').click();
  await expect(page.locator('#commands')).toHaveClass(/active/);
  const shell=await page.evaluate(()=>({
    htmlOverscroll:getComputedStyle(document.documentElement).overscrollBehaviorY,
    bodyOverscroll:getComputedStyle(document.body).overscrollBehaviorY,
    remembered:sessionStorage.getItem('patrickActiveView')
  }));
  expect(shell.htmlOverscroll).toBe('none');
  expect(shell.bodyOverscroll).toBe('none');
  expect(shell.remembered).toBe('commands');
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.patrickReady||'')).toBe('true');
  await expect(page.locator('#commands')).toHaveClass(/active/);
  await expect(page.locator('.bottomNav [data-view="commands"]')).toHaveClass(/active/);
});

test('v7.7 weekly coach launches a guided live session',async({page})=>{
  await onboard(page);
  await expect(page.locator('#weeklyCoach')).toBeVisible();
  await expect(page.locator('#weeklyCoach .weeklyDay')).toHaveCount(7);
  const start=page.locator('#weeklyCoach [data-week-start]:not([disabled])').first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('#startChoiceDialog')).toBeVisible();
  await page.locator('#confirmStartChoiceBtn').click();
  await expect(page.locator('#sessionDialog')).toBeVisible();
  await expect(page.locator('#sessionElapsed')).toBeVisible();
  await expect(page.locator('#sessionPracticalCoach')).toBeVisible();
  await expect(page.locator('#sessionPracticalGoal')).not.toHaveText('');
  await expect(page.locator('#sessionCommonError')).not.toHaveText('');
  await expect(page.locator('#sessionFallback')).not.toHaveText('');
  await expect(page.locator('#sessionProgressCriterion')).not.toHaveText('');
  await expectContainedHorizontally(page,'#sessionPracticalCoach');
});

test('long management dialogs keep close visible and lock background scrolling',async({page})=>{
  await onboard(page);
  await page.evaluate(()=>window.scrollTo(0,Math.max(0,document.documentElement.scrollHeight-window.innerHeight)));
  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  const dialog=page.locator('#appSettingsDialog'),card=dialog.locator('.managementCard'),close=page.locator('#closeAppSettingsBtn');
  await expect(dialog).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('dialogScrollLocked'))).toBe(true);
  await card.evaluate(el=>{el.scrollTop=el.scrollHeight});
  await expect(close).toBeVisible();
  const bounds=await page.evaluate(()=>{
    const cardEl=document.querySelector('#appSettingsDialog .managementCard'),card=cardEl.getBoundingClientRect();
    const button=document.querySelector('#closeAppSettingsBtn').getBoundingClientRect();
    const header=document.querySelector('#appSettingsDialog .managementHeader');
    return{cardTop:card.top,cardBottom:card.bottom,buttonTop:button.top,buttonBottom:button.bottom,position:getComputedStyle(header).position,bodyPosition:getComputedStyle(document.body).position,overscroll:getComputedStyle(cardEl).overscrollBehavior};
  });
  expect(bounds.position).toBe('sticky');
  expect(bounds.bodyPosition).toBe('fixed');
  expect(bounds.overscroll).toContain('contain');
  expect(bounds.buttonTop).toBeGreaterThanOrEqual(bounds.cardTop-1);
  expect(bounds.buttonBottom).toBeLessThanOrEqual(bounds.cardBottom+1);
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('dialogScrollLocked'))).toBe(false);
});

test('v7.9 core accessibility and management-focus contracts hold on mobile',async({page})=>{
  await onboard(page);
  const audit=await page.evaluate(()=>{
    const ids=[...document.querySelectorAll('[id]')].map(el=>el.id),counts=ids.reduce((map,id)=>(map[id]=(map[id]||0)+1,map),{});
    const duplicateIds=Object.entries(counts).filter(([,count])=>count>1).map(([id])=>id);
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const unlabeledButtons=[...document.querySelectorAll('button')].filter(visible).filter(button=>!(button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent.trim())).map(button=>button.id||button.outerHTML.slice(0,80));
    const unnamedDialogs=[...document.querySelectorAll('dialog')].filter(dialog=>{
      const label=dialog.getAttribute('aria-label'),labelledBy=dialog.getAttribute('aria-labelledby');
      return !label&&!(labelledBy&&document.getElementById(labelledBy));
    }).map(dialog=>dialog.id);
    return{duplicateIds,unlabeledButtons,unnamedDialogs};
  });
  expect(audit.duplicateIds).toEqual([]);
  expect(audit.unlabeledButtons).toEqual([]);
  expect(audit.unnamedDialogs).toEqual([]);

  await page.locator('#settingsAvatarBtn').click();
  await expect(page.locator('#settingsDrawer')).toHaveClass(/open/);
  await expect(page.locator('#settingsCloseBtn')).toBeFocused();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#closeAppSettingsBtn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#appSettingsDialog')).not.toBeVisible();
  await expect(page.locator('#settingsAvatarBtn')).toBeFocused();
});

test('v7.9 update action becomes available when a newer published version is reported',async({page})=>{
  await onboard(page);
  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await page.evaluate(()=>{
    const current=window.PATRICK_CONFIG.APP_VERSION;
    window.__patrickApplyCalled=false;
    window.PatrickPWA={
      status:()=>({online:true,standalone:true,serviceWorker:true,updateState:'update-found',lastChecked:new Date().toISOString(),currentVersion:current,publishedVersion:'99.0.0'}),
      checkForUpdate:async()=>window.PatrickPWA.status(),
      applyUpdate:async()=>{window.__patrickApplyCalled=true;return window.PatrickPWA.status()}
    };
    window.dispatchEvent(new CustomEvent('patrick:pwa-status'));
  });
  const apply=page.locator('#applyPwaUpdateBtn');
  await expect(apply).toBeVisible();
  await expect(apply).toContainText('Actualizar ahora');
  await apply.click();
  await expect.poll(()=>page.evaluate(()=>window.__patrickApplyCalled)).toBe(true);
});

test('localized option layouts stay inside the mobile viewport',async({page})=>{
  await page.goto('/');
  await page.locator('#setupAppLanguage').selectOption('de');
  await expect(page.locator('[data-setup-step="0"] h2')).toContainText('Mach sie');
  await expectContainedHorizontally(page,'#setupWizardDialog .setupWizardCard');
  await expectContainedHorizontally(page,'.setupLanguageGrid');

  await page.locator('#setupNextBtn').click();
  await page.locator('#setupDogName').fill('Patrick');
  await page.locator('#setupDogAge').fill('4');
  await page.locator('#setupNextBtn').click();
  await page.locator('#setupNextBtn').click();
  await page.locator('#setupNextBtn').click();

  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#germanVoiceSection')).toBeVisible();
  await expectContainedHorizontally(page,'#appSettingsDialog .managementCard');

  const layout=await page.locator('#appSettingsDialog .managementCard').evaluate(card=>({
    cardScrollWidth:card.scrollWidth,
    cardClientWidth:card.clientWidth,
    widest:[...card.querySelectorAll('.managementControl,.managementMeta,.managementAction')].reduce((max,el)=>Math.max(max,el.scrollWidth-el.clientWidth),0),
    escaped:[...card.querySelectorAll('.managementControl,.managementMeta,.managementAction,select')].some(el=>{const r=el.getBoundingClientRect();return r.left<card.getBoundingClientRect().left-1||r.right>card.getBoundingClientRect().right+1})
  }));
  expect(layout.cardScrollWidth).toBeLessThanOrEqual(layout.cardClientWidth+1);
  expect(layout.widest).toBeLessThanOrEqual(1);
  expect(layout.escaped).toBe(false);

  await page.locator('#appLanguageSelect').selectOption('en');
  await expect(page.locator('#appSettingsTitle')).toHaveText('Settings');
  await expectContainedHorizontally(page,'#appSettingsDialog .managementCard');

  await page.locator('#appLanguageSelect').selectOption('de');
  await page.locator('#commandLanguageSelect').selectOption('de');
  await expect(page.locator('#germanVoiceSection')).toBeVisible();
  await expectContainedHorizontally(page,'#germanVoiceSection');
  await expectContainedHorizontally(page,'#germanVoiceSelect');
});
test('mobile navigation, chooser and undo work end to end',async({page})=>{
  await onboard(page);

  await page.locator('.bottomNav [data-view="levels"]').click();
  await expect(page.locator('#levelsHeading')).toBeVisible();
  await page.locator('[data-start-level="0"]').click();
  await expect(page.locator('#startChoiceDialog')).toBeVisible();
  await page.locator('#cancelStartChoiceBtn').click();
  await expect(page.locator('#startChoiceDialog')).not.toBeVisible();

  await page.locator('.bottomNav [data-view="commands"]').click();
  const card=page.locator('.commandCard[data-command="Patrick"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.demoBtn')).toBeVisible();
  await card.locator('.demoBtn').click();
  await expect(page.locator('#demoDialog')).toBeVisible();
  await expect(page.locator('#demoFlow .demoFlowStep')).toHaveCount(4);
  await expect(page.locator('#demoFlow')).toContainText('Ja!');
  await page.locator('#closeDemoBtn').click();
  await card.locator('.practiceBtn').click();
  await expect(page.locator('#startChoiceDialog')).toBeVisible();
  await page.locator('#confirmStartChoiceBtn').click();
  await expect(page.locator('#sessionDialog')).toBeVisible();

  await expect(page.locator('#correctBtn')).toBeDisabled();
  await page.locator('#startExecutionBtn').click();
  await expect(page.locator('#correctBtn')).toBeEnabled();
  await page.locator('#correctBtn').click();
  await expect(page.locator('#undoExecutionBtn')).toBeVisible();
  await page.locator('#undoExecutionBtn').click();
  await expect(page.locator('#executionLabel')).toContainText('EJECUCIÓN 1 DE 4');
  await expect(page.locator('#undoExecutionBtn')).toBeHidden();
});

test('v7.8.1 update check reports the published version inside settings',async({page})=>{
  await onboard(page);
  await page.locator('#settingsAvatarBtn').click();
  await expect(page.locator('#notificationToggle strong')).toHaveText('Recordatorio inteligente');
  await expect(page.locator('#notificationToggle small')).toContainText('actividad reciente');
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#pwaRuntimeStatus')).not.toHaveText('');
  const updateButton=page.locator('#checkPwaUpdateBtn'),status=page.locator('#pwaUpdateCheckStatus');
  await expect(updateButton).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>typeof window.PatrickPWA?.checkForUpdate)).toBe('function');
  const version=await page.evaluate(()=>window.PATRICK_CONFIG.APP_VERSION);
  await updateButton.click();
  await expect(status).toContainText('Al día',{timeout:10000});
  await expect(status).toContainText('v'+version);
  await expect(updateButton).toBeEnabled();
  await expectContainedHorizontally(page,'#appSettingsDialog .managementCard');
});

test('German voice settings and long-term evolution are available on mobile',async({page})=>{
  await onboard(page);

  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#germanVoiceSelect')).toBeVisible();
  await expect(page.locator('#testGermanVoiceBtn')).toBeVisible();
  await page.locator('#closeAppSettingsBtn').click();

  await page.evaluate(()=>{
    historyArchive={
      version:1,totalSessions:5,months:{
        '2026-07':{sessions:2,score:7,total:8,contexts:{'Casa · distracción baja':2},commands:{Patrick:{sessions:2,score:7,total:8,timedSessions:0,seconds:0}}},
        '2026-08':{sessions:3,score:11,total:12,contexts:{'Casa · distracción baja':2,'Exterior tranquilo · distracción baja':1},commands:{Patrick:{sessions:3,score:11,total:12,timedSessions:0,seconds:0}}}
      }
    };
    setView('progress');renderProgress();
  });
  await expect(page.locator('#longTermEvolution')).toBeVisible();
  await expect(page.locator('#longTermEvolution .longTermMonth')).toHaveCount(2);
});

test('full reset uses two app-native confirmations before returning to first-run wizard',async({page})=>{
  await onboard(page);
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');

  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#resetAllDataBtn')).toBeVisible();

  await page.locator('#resetAllDataBtn').click();
  await expect(page.locator('#appConfirmDialog')).toBeVisible();
  await expect(page.locator('#appConfirmTitle')).toContainText('Reiniciar Patrick Training');
  await page.locator('#appConfirmCancelBtn').click();
  await expect(page.locator('#appConfirmDialog')).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');

  await page.locator('#resetAllDataBtn').click();
  await page.locator('#appConfirmAcceptBtn').click();
  await expect(page.locator('#appConfirmDialog')).toBeVisible();
  await expect(page.locator('#appConfirmEyebrow')).toHaveText('ÚLTIMA CONFIRMACIÓN');
  await page.locator('#appConfirmCancelBtn').click();
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');
  await expect(page.locator('#setupWizardDialog')).not.toBeVisible();

  await page.locator('#resetAllDataBtn').click();
  await page.locator('#appConfirmAcceptBtn').click();
  await expect(page.locator('#appConfirmEyebrow')).toHaveText('ÚLTIMA CONFIRMACIÓN');
  await page.locator('#appConfirmAcceptBtn').click();

  await expect(page.locator('#appSettingsDialog')).not.toBeVisible();
  await expect(page.locator('#setupWizardDialog')).toBeVisible();
  await expect(page.locator('#setupWizardCounter')).toHaveText('1 / 4');
  await expect(page.locator('#setupDogName')).toHaveValue('');
  await expect.poll(()=>page.evaluate(()=>({name:dogProfile.name||'',level:currentLevel,sessions:history.length,archived:archivedSessionCount(),wizard:setupWizardVersion}))).toEqual({name:'',level:0,sessions:0,archived:0,wizard:0});
});

test('level 11 safe protection route is visible but locked until previous levels are complete',async({page})=>{
  await onboard(page);
  await page.locator('.bottomNav [data-view="levels"]').click();
  const level11=page.locator('.levelCard').filter({hasText:'Control y protección segura'});
  await expect(level11).toBeVisible();
  await expect(level11).toContainText('NIVEL 11');
  await expect(level11).toContainText('Bloqueado');
  await expect(level11).toContainText('Completa el anterior');

  await page.locator('.bottomNav [data-view="commands"]').click();
  await page.locator('#search').fill('Bei mir');
  const command=page.locator('.commandCard[data-command="Bei mir"]');
  await expect(command).toBeVisible();
  await expect(command).toContainText('Protección segura');
  await command.locator('.commandToggle').click();
  await expect(command).toContainText('No lo uses para acercar al perro a personas o conflictos');
});
test('completed session can be corrected from history',async({page})=>{
  await onboard(page);
  await page.locator('.bottomNav [data-view="commands"]').click();
  const card=page.locator('.commandCard[data-command="Patrick"]');
  await card.locator('.practiceBtn').click();
  await page.locator('#confirmStartChoiceBtn').click();

  for(let i=0;i<4;i++){
    await page.locator('#startExecutionBtn').click();
    await page.locator('#correctBtn').click();
    if(i<3)await expect(page.locator('#startExecutionBtn')).toBeVisible({timeout:4000});
  }

  await expect(page.locator('#finishDialog')).toBeVisible({timeout:5000});
  await page.locator('#finishBtn').click();
  await page.locator('.bottomNav [data-view="progress"]').click();
  await page.locator('[data-history-edit="0"]').click();
  await expect(page.locator('#historyEditDialog')).toBeVisible();

  const row=page.locator('.historyEditRow').first();
  await row.locator('[data-history-field="achieved"]').fill('3');
  await row.locator('[data-history-field="assisted"]').fill('1');
  await row.locator('[data-history-field="missed"]').fill('0');
  await page.locator('#saveHistoryEditBtn').click();
  await expect(page.locator('#historyEditDialog')).not.toBeVisible();
  await expect(page.locator('.historyCard').first()).toContainText('3✓ · 1~ · 0×');
});

test('dog age contract stays valid from wizard input through backup rules',async({page})=>{
  await page.goto('/');
  await page.locator('#setupAppLanguage').selectOption('en');
  await page.locator('#setupNextBtn').click();
  await page.locator('#setupDogName').fill('Patrick');
  await page.locator('#setupDogAgeUnit').selectOption('years');
  await expect(page.locator('#setupDogAge')).toHaveAttribute('max','20');
  await page.locator('#setupDogAge').fill('21');
  await expect(page.locator('#setupNextBtn')).toBeDisabled();
  await expect(page.locator('#setupDogAgePreview')).toContainText('up to 20 years');
  await page.locator('#setupDogAge').fill('20');
  await expect(page.locator('#setupNextBtn')).toBeEnabled();
  await page.locator('#setupDogAgeUnit').selectOption('months');
  await expect(page.locator('#setupDogAge')).toHaveAttribute('max','240');
  await expect.poll(()=>page.evaluate(()=>PATRICK_CONFIG.MAX_DOG_AGE_MONTHS)).toBe(240);
});

test('backup health updates immediately after a successful export',async({page})=>{
  await onboard(page);
  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#lastBackupStatus')).toHaveText('Aún sin respaldo');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  await downloadPromise;
  await expect(page.locator('#lastBackupStatus')).toHaveText('Hoy · protegido');
  await expect.poll(()=>page.evaluate(()=>store.get('patrickLastBackupAt',null))).not.toBeNull();
});

test('core surfaces preserve visual bounds across the Android viewport matrix',async({page})=>{
  await onboard(page);
  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await page.locator('#appLanguageSelect').selectOption('de');
  await expectNoHorizontalOverflow(page);
  await expectContainedHorizontally(page,'#appSettingsDialog .managementCard');
  await page.locator('#closeAppSettingsBtn').click();

  for(const view of ['today','levels','commands','progress']){
    await page.locator('.bottomNav [data-view="'+view+'"]').click();
    await expectNoHorizontalOverflow(page);
    if(view==='commands'){
      await expectVisibleBounds(page,'#commands');
      await expectVisibleBounds(page,'#filters');
    }else{
      await expectContainedHorizontally(page,'#'+view);
    }
  }

  await page.locator('.bottomNav [data-view="commands"]').click();
  const sit=page.locator('.commandCard[data-command="Sitz"]');
  await sit.locator('.commandToggle').click();
  await expectContainedHorizontally(page,'.commandCard[data-command="Sitz"]');
  await expectNoHorizontalOverflow(page);
});

