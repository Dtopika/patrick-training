import {test,expect} from '@playwright/test';

async function onboard(page){
  await page.goto('/');
  const profile=page.locator('#profileDialog');
  await expect(profile).toBeVisible();
  await page.locator('#dogNameInput').fill('Patrick');
  await page.locator('#dogAgeInput').fill('4');
  await page.locator('#saveProfileBtn').click();
  await expect(profile).not.toBeVisible();
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
