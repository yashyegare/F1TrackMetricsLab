import {test,expect} from '@playwright/test';
import {mockQualifying} from './fixtures/qualifying';
test('compares different drivers in the same session and preserves the deep link',async ({page}) => {
  await mockQualifying(page);
  await page.goto('/?mode=compare3d&analysis=drivers&circuit=us-2012&year=2024');
  await expect(page.getByRole('region',{name:'Driver time analysis'})).toBeVisible({timeout:30000});
  await expect(page.getByText('Driver One was 1.000s faster.',{exact:true})).toBeVisible();
  const a=page.getByRole('combobox',{name:'Track A driver'}),b=page.getByRole('combobox',{name:'Track B driver'});
  await expect(a).toHaveValue('1');await expect(b).toHaveValue('2');
  await page.getByRole('button',{name:'Swap circuits',exact:true}).isDisabled().then(value => expect(value).toBe(true));
  await page.getByRole('button',{name:/Telemetry Traces/}).click();
  await expect(page.getByText('Time Delta',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'3D graphics quality'}).selectOption('low');
  await page.reload();
  await expect(page.getByRole('region',{name:'Driver time analysis'})).toBeVisible({timeout:30000});
  await expect(page.getByRole('combobox',{name:'3D graphics quality'})).toHaveValue('low');
});
test('explains missing qualifying without substituting a race',async ({page}) => {
  await mockQualifying(page,{missing:true});
  await page.goto('/?mode=compare3d&analysis=drivers&circuit=us-2012');
  await expect(page.getByRole('button',{name:'Retry telemetry'})).toBeVisible({timeout:20000});
  await expect(page.getByRole('region',{name:'Driver time analysis'})).not.toBeVisible();
  await page.getByRole('button',{name:'Compare tracks',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Circuit B',exact:true})).toBeEnabled();
});
test('cross-track comparison never shows a driver-performance delta',async ({page}) => {
  await mockQualifying(page);
  await page.goto('/?mode=compare3d&analysis=tracks&racePace=1&circuit=us-2012&vs=az-2016');
  await expect(page.getByRole('combobox',{name:'Track A driver'})).toBeVisible({timeout:20000});
  await expect(page.getByRole('region',{name:'Driver time analysis'})).not.toBeVisible();
  await expect(page.getByText(/Cross-track replay is illustrative/)).toBeVisible();
});
