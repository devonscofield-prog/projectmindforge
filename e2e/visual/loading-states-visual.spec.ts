import { test, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-fixtures';

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

test.describe('Loading States - Visual', () => {
  test('auth page loading', async ({ page }) => {
    // Slow down network to capture loading state
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    });

    await page.goto('/auth');
    
    // Capture any loading indicators
    await expect(page).toHaveScreenshot('auth-loading.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Skeleton States - Visual', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('dashboard skeleton loading', async ({ page }) => {
    // Block API to show skeletons
    await page.route('**/rest/v1/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    await page.goto('/rep');
    
    // Capture skeleton state quickly before data loads
    await expect(page).toHaveScreenshot('dashboard-skeleton.png', {
      animations: 'disabled',
      timeout: 3000,
    });
  });

  test('call history skeleton', async ({ page }) => {
    await page.route('**/rest/v1/call_transcripts**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    await page.goto('/rep/call-history');

    await expect(page).toHaveScreenshot('call-history-skeleton.png', {
      animations: 'disabled',
      timeout: 3000,
    });
  });

  test('prospects skeleton', async ({ page }) => {
    await page.route('**/rest/v1/prospects**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    await page.goto('/rep/prospects');

    await expect(page).toHaveScreenshot('prospects-skeleton.png', {
      animations: 'disabled',
      timeout: 3000,
    });
  });
});

test.describe('Empty States - Visual', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('call history empty state', async ({ page }) => {
    // Return empty array for calls
    await page.route('**/rest/v1/call_transcripts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
        headers: {
          'content-range': '0-0/0',
        },
      });
    });

    await page.goto('/rep/call-history');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('call-history-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('prospects empty state', async ({ page }) => {
    await page.route('**/rest/v1/prospects**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/rep/prospects');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('prospects-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Error States - Visual', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfNeeded(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test('api error state', async ({ page }) => {
    // Simulate API error
    await page.route('**/rest/v1/call_transcripts**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/rep/call-history');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('call-history-error.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
