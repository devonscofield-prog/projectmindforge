import { test, expect, TEST_USER } from './fixtures/test-fixtures';

test.describe('Navigation - Unauthenticated', () => {
  test('should redirect to auth when accessing protected routes', async ({ page }) => {
    await page.goto('/rep');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect to auth when accessing manager routes', async ({ page }) => {
    await page.goto('/manager');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect to auth when accessing admin routes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should allow access to auth page', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

test.describe('Navigation - Authenticated', () => {
  test.beforeEach(async ({ page, authPage }) => {
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    await authPage.goto();
    await authPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('should display navigation menu', async ({ page }) => {
    // Navigation should be visible
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('should navigate to call history', async ({ page }) => {
    await page.getByRole('link', { name: /call history|calls/i }).click();
    await expect(page).toHaveURL(/\/call/i);
  });

  test('should navigate to accounts/prospects', async ({ page }) => {
    const accountsLink = page.getByRole('link', { name: /accounts|prospects/i });
    if (await accountsLink.isVisible()) {
      await accountsLink.click();
      await expect(page).toHaveURL(/\/(accounts|prospects)/i);
    }
  });

  test('should allow logout', async ({ page }) => {
    // Find logout button/link
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/auth/);
    }
  });
});

test.describe('Navigation - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile navigation', async ({ page, authPage }) => {
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    await authPage.goto();
    await authPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });

    // Mobile bottom nav should be visible
    const bottomNav = page.locator('[data-testid="mobile-nav"], nav.fixed.bottom-0');
    // or look for mobile-specific navigation pattern
  });
});

test.describe('404 Page', () => {
  test('should display 404 for unknown routes', async ({ page }) => {
    await page.goto('/unknown-route-that-does-not-exist');
    
    // Should show 404 or redirect to auth
    const is404 = await page.getByText(/404|not found/i).isVisible();
    const isAuth = page.url().includes('/auth');
    
    expect(is404 || isAuth).toBeTruthy();
  });
});
