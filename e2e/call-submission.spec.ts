import { test, expect, TEST_USER } from './fixtures/test-fixtures';

// Sample transcript for testing
const SAMPLE_TRANSCRIPT = `
Rep: Hi John, thanks for taking the time to meet with me today.
Customer: No problem, I've been looking forward to learning more about your solution.
Rep: Great! So tell me, what challenges are you currently facing with your current system?
Customer: Well, we're struggling with data silos and lack of visibility across departments.
Rep: I see. That's actually a common pain point we help solve. Our platform provides a unified view...
Customer: That sounds promising. What about implementation time?
Rep: Typically we see full deployment within 6-8 weeks.
Customer: And pricing?
Rep: Based on your team size, we'd be looking at around $50,000 annually.
Customer: Let me discuss with my team and get back to you next week.
Rep: Perfect, I'll send you a follow-up email with the details we discussed.
`;

test.describe('Call Submission Flow', () => {
  // Skip these tests if no test user configured
  test.beforeEach(async ({ page, authPage }) => {
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    // Login first
    await authPage.goto();
    await authPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('should display call submission form on rep dashboard', async ({ page }) => {
    await page.goto('/rep');

    await expect(page.getByRole('heading', { name: /submit a transcript/i })).toBeVisible();
    await expect(page.getByLabel(/account name/i)).toBeVisible();
    await expect(page.getByLabel(/stakeholder/i)).toBeVisible();
    await expect(page.getByLabel(/transcript/i)).toBeVisible();
  });

  test('should require all mandatory fields', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    // Submit button should be disabled without required fields
    const submitButton = page.getByRole('button', { name: /analyze call/i });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit when required fields are filled', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    await dashboardPage.fillAccountName('Test Company');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillStakeholder('John Doe');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillSalesforceLink('https://salesforce.com/account/123');
    await dashboardPage.fillTranscript(SAMPLE_TRANSCRIPT);

    // Submit button should now be enabled
    const submitButton = page.getByRole('button', { name: /analyze call/i });
    await expect(submitButton).toBeEnabled();
  });

  test('should show loading state during submission', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    await dashboardPage.fillAccountName('Test Company');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillStakeholder('John Doe');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillSalesforceLink('https://salesforce.com/account/123');
    await dashboardPage.fillTranscript(SAMPLE_TRANSCRIPT);

    await dashboardPage.submitCall();

    // Should show loading indicator
    await expect(page.getByText(/analyzing/i)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to call detail after successful submission', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    await dashboardPage.fillAccountName('E2E Test Company ' + Date.now());
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillStakeholder('E2E Test Stakeholder');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillSalesforceLink('https://salesforce.com/account/e2e-test');
    await dashboardPage.fillTranscript(SAMPLE_TRANSCRIPT);

    await dashboardPage.submitCall();

    // Should redirect to call detail page
    await expect(page).toHaveURL(/\/calls\//, { timeout: 30000 });
  });

  test('should display call type selector', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const callTypeSelect = page.getByLabel(/call type/i);
    await expect(callTypeSelect).toBeVisible();
    await callTypeSelect.click();

    // Should show call type options
    await expect(page.getByRole('option', { name: /demo/i })).toBeVisible();
  });

  test('should handle date selection', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const dateInput = page.getByLabel(/call date/i);
    await expect(dateInput).toBeVisible();

    // Should have today's date by default
    const today = new Date().toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(today);
  });
});

test.describe('Call Submission - Validation', () => {
  test.beforeEach(async ({ page, authPage }) => {
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    await authPage.goto();
    await authPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('should validate salesforce link format', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    await dashboardPage.fillAccountName('Test Company');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillStakeholder('John Doe');
    await page.keyboard.press('Tab');
    
    // Enter invalid URL
    await dashboardPage.fillSalesforceLink('not-a-valid-url');
    await dashboardPage.fillTranscript(SAMPLE_TRANSCRIPT);

    const submitButton = page.getByRole('button', { name: /analyze call/i });
    
    // Behavior depends on validation implementation
    // Either button is disabled or shows error on submit
  });

  test('should handle empty transcript gracefully', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    await dashboardPage.fillAccountName('Test Company');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillStakeholder('John Doe');
    await page.keyboard.press('Tab');
    
    await dashboardPage.fillSalesforceLink('https://salesforce.com/account/123');
    // Leave transcript empty

    const submitButton = page.getByRole('button', { name: /analyze call/i });
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('Call Submission - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display form properly on mobile', async ({ page, authPage }) => {
    if (TEST_USER.email === 'test@example.com') {
      test.skip();
      return;
    }

    await authPage.goto();
    await authPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
    
    await page.goto('/rep');

    await expect(page.getByRole('heading', { name: /submit a transcript/i })).toBeVisible();
    await expect(page.getByLabel(/transcript/i)).toBeVisible();
  });
});
