import { test, expect } from '@playwright/test';

test.describe('F1 Track Metrics Lab', () => {
  test('saves favorites across reload and filters the collection', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button',{name:'Favorite Monaco',exact:true}).click();
    await page.reload();
    await page.getByRole('combobox',{name:'Circuit collection'}).selectOption('favorites');
    await expect(page.getByRole('button',{name:'Favorite Monaco',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.circuit-list li')).toHaveCount(1);
    await page.getByRole('button',{name:'Favorite Monaco',exact:true}).click();
    await expect(page.getByText('No matching circuits')).toBeVisible();
    await page.getByRole('button',{name:'Clear filters'}).click();
    await expect(page.locator('.circuit-list li')).toHaveCount(40);
  });
  test('swaps comparison selections and shows the summary', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button',{name:'Compare',exact:true}).click();
    const a = page.getByRole('combobox',{name:'Circuit A'});
    const b = page.getByRole('combobox',{name:'Circuit B'});
    const beforeA = await a.inputValue(), beforeB = await b.inputValue();
    await page.getByRole('button',{name:'Swap circuits'}).click();
    await expect(a).toHaveValue(beforeB);
    await expect(b).toHaveValue(beforeA);
    await expect(page.getByLabel('Comparison highlights')).toBeVisible();
  });
  test('recovers from an empty circuit search', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', {name:'Search circuits or cities'}).fill('no-such-circuit');
    await expect(page.getByText('No matching circuits')).toBeVisible();
    await page.getByRole('button', {name:'Clear filters'}).click();
    await expect(page.getByRole('textbox', {name:'Search circuits or cities'})).toHaveValue('');
    await expect(page.locator('.circuit-list button').first()).toBeVisible();
  });

  test('mobile circuit drawer closes with Escape and restores focus', async ({ page }) => {
    await page.setViewportSize({width:390, height:844});
    await page.goto('/');
    const toggle = page.getByRole('button', {name:'Toggle sidebar'});
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('textbox', {name:'Search circuits or cities'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await expect(page.getByRole('textbox', {name:'Search circuits or cities'})).not.toBeVisible();
  });
  test('loads the landing page with title and sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=F1 Track Metrics Lab')).toBeVisible();
    await expect(page.locator('text=Unofficial track explorer')).toBeVisible();
    await expect(page.locator('.sidebar-list-header')).toBeVisible();
  });

  test('sidebar shows circuit list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Albert Park Circuit')).toBeVisible();
    await expect(page.locator('text=Circuit de Monaco')).toBeVisible();
    await expect(page.locator('text=Circuit of the Americas')).toBeVisible();
  });

  test('map view renders Leaflet canvas', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Map")');
    // Leaflet container should appear
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
  });

  test('3D view renders canvas element', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("3D View")');
    // Wait for lazy-loaded 3D panel
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('search filters circuit list', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Monaco');
    await expect(page.locator('text=Circuit de Monaco')).toBeVisible();
    await expect(page.locator('text=Albert Park Circuit')).not.toBeVisible();
  });
});
