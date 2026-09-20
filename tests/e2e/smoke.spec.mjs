import {test,expect} from '@playwright/test';

async function onboard(page){
  await page.goto('/');
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

test('full reset requires two confirmations and only then returns to first-run wizard',async({page})=>{
  await onboard(page);
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');

  await page.locator('#settingsAvatarBtn').click();
  await page.locator('#openAppSettingsBtn').click();
  await expect(page.locator('#appSettingsDialog')).toBeVisible();
  await expect(page.locator('#resetAllDataBtn')).toBeVisible();

  const firstMessages=[];
  page.once('dialog',async dialog=>{firstMessages.push(dialog.message());await dialog.dismiss()});
  await page.locator('#resetAllDataBtn').click();
  await expect.poll(()=>firstMessages.length).toBe(1);
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');
  await expect(page.locator('#setupWizardDialog')).not.toBeVisible();

  const secondMessages=[];
  const cancelSecond=async dialog=>{
    secondMessages.push(dialog.message());
    if(secondMessages.length===1)await dialog.accept();else await dialog.dismiss();
  };
  page.on('dialog',cancelSecond);
  await page.locator('#resetAllDataBtn').click();
  await expect.poll(()=>secondMessages.length).toBe(2);
  page.off('dialog',cancelSecond);
  await expect.poll(()=>page.evaluate(()=>dogName())).toBe('Patrick');
  await expect(page.locator('#setupWizardDialog')).not.toBeVisible();

  const finalMessages=[];
  const acceptBoth=async dialog=>{finalMessages.push(dialog.message());await dialog.accept()};
  page.on('dialog',acceptBoth);
  await page.locator('#resetAllDataBtn').click();
  await expect.poll(()=>finalMessages.length).toBe(2);
  page.off('dialog',acceptBoth);

  await expect(page.locator('#appSettingsDialog')).not.toBeVisible();
  await expect(page.locator('#setupWizardDialog')).toBeVisible();
  await expect(page.locator('#setupWizardCounter')).toHaveText('1 / 4');
  await expect(page.locator('#setupDogName')).toHaveValue('');
  await expect.poll(()=>page.evaluate(()=>({name:dogProfile.name||'',level:currentLevel,sessions:history.length,archived:archivedSessionCount(),wizard:setupWizardVersion}))).toEqual({name:'',level:0,sessions:0,archived:0,wizard:0});
  expect(finalMessages[0]).toContain('Reiniciar todos los datos');
  expect(finalMessages[1]).toContain('ÚLTIMA CONFIRMACIÓN');
});

test('level 11 safe protection route is visible but locked until previous levels are complete',async({page})=>{
  await onboard(page);
  await page.locator('.bottomNav [data-view="levels"]').click();
  const level11=page.locator('.levelCard').filter({hasText:'Control y protección segura'});
  await expect(level11).toBeVisible();
  await expect(level11).toContainText('PASO 11');
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
