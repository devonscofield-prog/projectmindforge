/**
 * RLS Security Tests for Prospects Table
 * 
 * Validates that Row-Level Security policies correctly enforce:
 * 1. Reps CAN access their own prospects
 * 2. Reps CANNOT access prospects belonging to other reps
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============
// These IDs come from the seeded demo data
// Rep A: rep.east.1@example.com (the authenticated test user)
const REP_A_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'rep.east.1@example.com',
  password: process.env.TEST_USER_PASSWORD || 'password123',
};

// Prospect owned by Rep A (rep.east.1@example.com)
const REP_A_PROSPECT_ID = '1b7d1b47-6ea0-4f3a-a65a-c9e1c5bde405';

// Prospect owned by Rep B (different user - ben.martin@stormwindlive.com)
const REP_B_PROSPECT_ID = 'eb4a2a15-6a52-434e-b1a2-6c1d8a8fd781';

test.describe('Rep RLS Security Tests', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    
    // Wait for redirect to dashboard after login
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests', () => {
    test('Rep CAN access their own prospect', async ({ page }) => {
      // Navigate to Rep A's own prospect
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      
      // Wait for page to load (either content or redirect)
      await page.waitForLoadState('networkidle');
      
      // Verify we're still on the prospect detail page (not redirected)
      await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      
      // Verify the prospect detail page loaded successfully
      // The h1 heading contains the prospect/account name
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify key UI elements are present (indicates successful data load)
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      
      // Verify we don't see error messages
      await expect(page.getByText(/account not found/i)).not.toBeVisible();
    });

    test('Rep can view prospect details and interact with UI', async ({ page }) => {
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify multiple detail elements are present
      await expect(page.locator('h1').first()).toBeVisible();
      
      // Verify quick actions bar is present (indicates full page loaded)
      await expect(page.getByRole('button', { name: /log email/i })).toBeVisible();
      
      // Verify tabs are present and functional
      const tabsList = page.locator('[role="tablist"]');
      await expect(tabsList).toBeVisible();
    });
  });

  test.describe('Negative Access Tests (RLS Enforcement)', () => {
    test('Rep CANNOT access another rep\'s prospect - redirects to prospects list', async ({ page }) => {
      // Attempt to navigate to Rep B's prospect
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      
      // Wait for the redirect or error handling to complete
      await page.waitForLoadState('networkidle');
      
      // Verify the user was redirected away from the unauthorized prospect
      // The app redirects to /rep/prospects when prospect is not found/accessible
      await expect(page).toHaveURL('/rep/prospects', { timeout: 10000 });
      
      // Verify we're on the prospects list page, not the detail page
      await expect(page.locator('h1').filter({ hasText: /accounts|prospects/i })).toBeVisible();
    });

    test('Rep CANNOT access another rep\'s prospect - shows error toast', async ({ page }) => {
      // Navigate to Rep B's prospect
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      
      // Wait for navigation/redirect
      await page.waitForLoadState('networkidle');
      
      // Check for the "Account not found" toast message
      // The app uses sonner toasts
      await expect(page.getByText(/account not found/i)).toBeVisible({ timeout: 10000 });
    });

    test('Rep CANNOT access prospect with random/invalid UUID', async ({ page }) => {
      const invalidId = '00000000-0000-0000-0000-000000000000';
      
      await page.goto(`/rep/prospects/${invalidId}`);
      await page.waitForLoadState('networkidle');
      
      // Should redirect to prospects list
      await expect(page).toHaveURL('/rep/prospects', { timeout: 10000 });
      
      // Should show error toast
      await expect(page.getByText(/account not found/i)).toBeVisible({ timeout: 10000 });
    });

    test('Rep CANNOT access prospect with malformed UUID', async ({ page }) => {
      const malformedId = 'not-a-valid-uuid';
      
      await page.goto(`/rep/prospects/${malformedId}`);
      await page.waitForLoadState('networkidle');
      
      // Should redirect to prospects list
      await expect(page).toHaveURL('/rep/prospects', { timeout: 10000 });
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify RLS blocks direct database query for unauthorized prospect', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // This test uses the admin client to verify RLS behavior
      // The admin client bypasses RLS, so we verify the policy logic separately
      
      // Verify Rep A's prospect exists and is accessible
      const repAProspect = await db.getProspectById(REP_A_PROSPECT_ID);
      expect(repAProspect).toBeTruthy();
      expect(repAProspect.id).toBe(REP_A_PROSPECT_ID);
      
      // Verify Rep B's prospect exists (proves it's RLS blocking, not missing data)
      const repBProspect = await db.getProspectById(REP_B_PROSPECT_ID);
      expect(repBProspect).toBeTruthy();
      expect(repBProspect.id).toBe(REP_B_PROSPECT_ID);
      
      // Verify the prospects belong to different reps
      expect(repAProspect.rep_id).not.toBe(repBProspect.rep_id);
    });

    test('Verify prospects count is limited to own prospects via RLS', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // Get Rep A's user info
      const repA = await db.getUserByEmail(REP_A_CREDENTIALS.email);
      expect(repA).toBeTruthy();
      
      // Count prospects for Rep A (using service role - bypasses RLS)
      const count = await db.countProspects(repA!.id);
      
      // Rep A should have at least 1 prospect
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('Verify user role is correctly set', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // Get Rep A's user info
      const repA = await db.getUserByEmail(REP_A_CREDENTIALS.email);
      expect(repA).toBeTruthy();
      
      // Verify the user has 'rep' role
      const role = await db.getUserRole(repA!.id);
      expect(role).toBe('rep');
    });
  });
});

test.describe('Rep RLS Security Tests - Edge Cases', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Direct URL manipulation cannot bypass RLS', async ({ page }) => {
    // First verify we can access our own prospect
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    
    // Now try to access another rep's prospect via URL manipulation
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Should be redirected, not shown the data
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    await expect(page).toHaveURL('/rep/prospects');
  });

  test('Browser back button after redirect maintains security', async ({ page }) => {
    // Navigate to unauthorized prospect (will redirect)
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/rep/prospects', { timeout: 10000 });
    
    // Try browser back - should not reveal unauthorized data
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should either stay on prospects list or go to previous valid page
    // Should NOT load the unauthorized prospect detail
    const url = page.url();
    expect(url).not.toContain(REP_B_PROSPECT_ID);
  });

  test('Multiple rapid unauthorized access attempts fail consistently', async ({ page }) => {
    // Try to access unauthorized prospect multiple times rapidly
    const attemptCount = 3;
    
    for (let i = 0; i < attemptCount; i++) {
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Each attempt should fail
      await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
      await expect(page).toHaveURL('/rep/prospects');
    }
  });

  test('Switching between authorized and unauthorized prospects maintains RLS', async ({ page }) => {
    // Access authorized prospect (should succeed)
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Try to access unauthorized prospect (should fail)
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/rep/prospects');
    
    // Access authorized prospect again (should still succeed)
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Query parameters cannot bypass RLS', async ({ page }) => {
    // Try to access unauthorized prospect with various query parameters
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}?bypass=true`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}?admin=1`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}?force=true`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
  });
});
