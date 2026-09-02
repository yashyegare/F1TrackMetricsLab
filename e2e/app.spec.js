import { test, expect } from '@playwright/test';

test.describe('F1 Track Metrics Lab', () => {
  test('loads the landing page with title and sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=F1 Track Metrics Lab')).toBeVisible();
    await expect(page.locator('text=Unofficial track explorer')).toBeVisible();
    await expect(page.locator('text=CIRCUITS')).toBeVisible();
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
