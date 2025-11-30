import { test, expect } from '@playwright/test';

test.describe('Auth Page - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('login form - desktop', async ({ page }) => {
    await expect(page).toHaveScreenshot('auth-login-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('login form - with filled fields', async ({ page }) => {
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');

    await expect(page).toHaveScreenshot('auth-login-filled.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('signup form - desktop', async ({ page }) => {
    // Switch to signup
    await page.getByText(/don't have an account/i).click();
    await page.waitForTimeout(300); // Wait for animation

    await expect(page).toHaveScreenshot('auth-signup-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('login form - error state', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid');
    await page.getByLabel(/password/i).fill('short');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error to appear
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('auth-login-error.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Auth Page - Mobile Visual', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('login form - mobile', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-login-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('signup form - mobile', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.getByText(/don't have an account/i).click();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('auth-signup-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Auth Page - Tablet Visual', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('login form - tablet', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-login-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Auth Page - Dark Mode Visual', () => {
  test.use({ colorScheme: 'dark' });

  test('login form - dark mode', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('auth-login-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('signup form - dark mode', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.getByText(/don't have an account/i).click();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('auth-signup-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
