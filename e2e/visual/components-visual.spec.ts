import { test, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-fixtures';

// Helper to login before tests
async function loginIfNeeded(page: any) {
  if (TEST_USER.email === 'test@example.com') {
    return false;
  }

  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  return true;
}

test.describe('Dashboard Components - Visual', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('rep dashboard - desktop', async ({ page }) => {
    await page.goto('/rep');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-rep-desktop.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [
        // Mask dynamic content
        page.locator('[data-testid="timestamp"]'),
        page.locator('time'),
      ],
    });
  });

  test('call submission form - empty', async ({ page }) => {
    await page.goto('/rep');
    await page.waitForLoadState('networkidle');

    const form = page.locator('form');
    await expect(form).toHaveScreenshot('call-form-empty.png', {
      animations: 'disabled',
    });
  });

  test('call submission form - filled', async ({ page }) => {
    await page.goto('/rep');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/select or type account/i).fill('Test Company');
    await page.keyboard.press('Tab');
    await page.getByPlaceholder(/who was on the call/i).fill('John Doe');
    await page.keyboard.press('Tab');

    const form = page.locator('form');
    await expect(form).toHaveScreenshot('call-form-filled.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dashboard Components - Mobile Visual', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('rep dashboard - mobile', async ({ page }) => {
    await page.goto('/rep');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-rep-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Dashboard - Dark Mode Visual', () => {
  test.use({ colorScheme: 'dark' });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('rep dashboard - dark mode', async ({ page }) => {
    await page.goto('/rep');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-rep-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
