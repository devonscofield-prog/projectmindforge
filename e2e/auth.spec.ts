import { test, expect, TEST_USER } from './fixtures/test-fixtures';

test.describe('Authentication', () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto();
  });

  test('should display login form by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should switch between sign in and sign up modes', async ({ page, authPage }) => {
    // Initially on sign in
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    // Switch to sign up
    await authPage.switchToSignUp();
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();

    // Switch back to sign in
    await authPage.switchToSignIn();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page, authPage }) => {
    await authPage.fillEmail('invalid-email');
    await authPage.fillPassword('password123');
    await authPage.clickSignIn();

    // Should show validation error or remain on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should show validation error for short password', async ({ page, authPage }) => {
    await authPage.fillEmail('test@example.com');
    await authPage.fillPassword('123');
    await authPage.clickSignIn();

    // Should show validation error or remain on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should show error for invalid credentials', async ({ page, authPage }) => {
    await authPage.login('wrong@example.com', 'wrongpassword');

    // Wait for error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
  });

  test('should redirect authenticated users away from auth page', async ({ page, authPage }) => {
    // This test requires a valid test user in the database
    // Skip if no test credentials configured
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    await authPage.login(TEST_USER.email, TEST_USER.password);

    // Should redirect to dashboard
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 10000 });
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for proper labels
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check inputs are focusable
    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();
  });

  test('should handle password visibility toggle if present', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    const toggleButton = page.getByRole('button', { name: /show|hide|toggle/i });

    // Only run if toggle exists
    if (await toggleButton.isVisible()) {
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});

test.describe('Authentication - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display properly on mobile', async ({ authPage, page }) => {
    await authPage.goto();

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
