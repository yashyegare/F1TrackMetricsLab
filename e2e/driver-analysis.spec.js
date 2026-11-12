import {test,expect} from '@playwright/test';
import {mockQualifying} from './fixtures/qualifying';
test('recovers from a lost graphics context without silently changing views',async ({page}) => {
  await page.goto('/?mode=compare3d');
  const canvas=page.locator('canvas').first();
  await expect(canvas).toBeVisible({timeout:15000});
  await canvas.evaluate(element => element.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await expect(page.getByRole('heading',{name:'3D view interrupted'})).toBeVisible();
  await page.getByRole('button',{name:'Open 2D comparison',exact:true}).click();
  await expect(page.getByLabel('Comparison highlights')).toBeVisible();
});
test('offers an explicit map recovery when WebGL is unavailable',async ({page}) => {
  await page.addInitScript(() => {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args) {
      return String(type).includes('webgl') ? null : original.call(this,type,...args);
    };
  });
  await page.goto('/?mode=compare3d');
  await expect(page.getByRole('heading',{name:'WebGL not available'})).toBeVisible();
  await page.getByRole('button',{name:'Open map',exact:true}).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
});
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
