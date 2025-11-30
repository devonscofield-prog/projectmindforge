import { test, expect } from '@playwright/test';

// Common viewport sizes
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

test.describe('Responsive - Auth Page', () => {
  for (const [name, viewport] of Object.entries(viewports)) {
    test(`auth page - ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`auth-responsive-${name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

test.describe('Responsive - Navigation', () => {
  test('mobile bottom nav visibility', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/auth');
    
    // Check for mobile-specific elements
    await expect(page).toHaveScreenshot('nav-mobile.png', {
      animations: 'disabled',
    });
  });

  test('desktop sidebar visibility', async ({ page }) => {
    await page.setViewportSize(viewports.desktop);
    await page.goto('/auth');
    
    await expect(page).toHaveScreenshot('nav-desktop.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Responsive - Form Layouts', () => {
  test('login form - narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-narrow.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('login form - ultra wide', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-ultrawide.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Responsive - Orientation', () => {
  test('mobile landscape', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-mobile-landscape.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('tablet landscape', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-tablet-landscape.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
