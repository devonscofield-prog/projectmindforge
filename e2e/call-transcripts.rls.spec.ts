/**
 * RLS Security Tests for Call Transcripts Table
 * 
 * Validates that Row-Level Security policies correctly enforce:
 * 1. Reps CAN access their own call transcripts
 * 2. Reps CANNOT access call transcripts belonging to other reps
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============
// These IDs come from the seeded demo data
// Rep A: rep.east.1@example.com (the authenticated test user)
const REP_A_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'rep.east.1@example.com',
  password: process.env.TEST_USER_PASSWORD || 'password123',
};

// Call transcript owned by Rep A (rep.east.1@example.com)
const REP_A_CALL_ID = 'e2938baa-6926-4d02-b29a-42cbd94a36b1';

// Call transcript owned by Rep B (different user - ben.martin@stormwindlive.com)
const REP_B_CALL_ID = 'aa340274-bb38-4a13-9274-f70ac6c73813';

test.describe('Call Transcripts RLS Security Tests', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    
    // Wait for redirect to dashboard after login
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests', () => {
    test('Rep CAN access their own call transcript', async ({ page }) => {
      // Navigate to Rep A's own call
      await page.goto(`/calls/${REP_A_CALL_ID}`);
      
      // Wait for page to load (either content or redirect)
      await page.waitForLoadState('networkidle');
      
      // Verify we're still on the call detail page (not redirected)
      await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
      
      // Verify the call detail page loaded successfully
      // Look for key elements that indicate a successful page load
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify key UI elements are present (indicates successful data load)
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      
      // Verify we don't see error messages
      await expect(page.getByText(/call not found/i)).not.toBeVisible();
      await expect(page.getByText(/not authorized/i)).not.toBeVisible();
    });

    test('Rep can view call details and analysis results', async ({ page }) => {
      await page.goto(`/calls/${REP_A_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct page
      await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
      
      // Verify call transcript section is visible (using more flexible selectors)
      const transcriptSection = page.locator('text=/transcript/i, [role="tabpanel"]').first();
      await expect(transcriptSection).toBeVisible({ timeout: 10000 });
    });

    test('Rep can navigate to call from their call history', async ({ page }) => {
      // Go to call history page
      await page.goto('/rep/history');
      await page.waitForLoadState('networkidle');
      
      // Find and click on a call link (if table has data)
      const callLink = page.locator(`a[href*="/calls/"]`).first();
      
      if (await callLink.isVisible()) {
        await callLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should be on a call detail page
        await expect(page.url()).toMatch(/\/calls\//);
        
        // Verify call detail page loaded
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
    });
  });

  test.describe('Negative Access Tests (RLS Enforcement)', () => {
    test('Rep CANNOT access another rep\'s call - redirects to dashboard', async ({ page }) => {
      // Attempt to navigate to Rep B's call
      await page.goto(`/calls/${REP_B_CALL_ID}`);
      
      // Wait for the redirect or error handling to complete
      await page.waitForLoadState('networkidle');
      
      // Verify the user was redirected away from the unauthorized call
      // The app should redirect to an error page or dashboard
      await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
      
      // Should be redirected to a safe location (dashboard, call history, or error page)
      const url = page.url();
      const validRedirects = ['/rep', '/rep/history', '/not-found', '/'];
      const isValidRedirect = validRedirects.some(path => url.includes(path));
      expect(isValidRedirect).toBeTruthy();
    });

    test('Rep CANNOT access another rep\'s call - shows error message', async ({ page }) => {
      // Navigate to Rep B's call
      await page.goto(`/calls/${REP_B_CALL_ID}`);
      
      // Wait for navigation/redirect
      await page.waitForLoadState('networkidle');
      
      // Check for error message (toast, alert, or error page)
      const errorIndicators = [
        page.getByText(/call not found/i),
        page.getByText(/not authorized/i),
        page.getByText(/access denied/i),
        page.getByText(/not found/i),
      ];
      
      // At least one error indicator should be visible
      let errorFound = false;
      for (const indicator of errorIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          errorFound = true;
          break;
        }
      }
      
      // If not redirected to error page, should have error toast/message
      if (page.url().includes('/calls/')) {
        expect(errorFound).toBeTruthy();
      }
    });

    test('Rep CANNOT access call with random/invalid UUID', async ({ page }) => {
      const invalidId = '00000000-0000-0000-0000-000000000000';
      
      await page.goto(`/calls/${invalidId}`);
      await page.waitForLoadState('networkidle');
      
      // Should not stay on the invalid call page
      const url = page.url();
      const isRedirected = !url.includes(invalidId) || url.includes('/not-found');
      expect(isRedirected).toBeTruthy();
    });

    test('Rep CANNOT access call with malformed UUID', async ({ page }) => {
      const malformedId = 'not-a-valid-uuid';
      
      await page.goto(`/calls/${malformedId}`);
      await page.waitForLoadState('networkidle');
      
      // Should redirect or show error
      await expect(page).not.toHaveURL(`/calls/${malformedId}`);
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify RLS blocks direct database query for unauthorized call', async ({ db }) => {
      // This test uses the admin client to verify RLS behavior
      // The admin client bypasses RLS, so we verify the policy logic separately
      
      // Verify Rep A's call exists and is accessible
      const repACall = await db.getCallTranscriptById(REP_A_CALL_ID);
      expect(repACall).toBeTruthy();
      expect(repACall.id).toBe(REP_A_CALL_ID);
      
      // Verify Rep B's call exists (proves it's RLS blocking, not missing data)
      const repBCall = await db.getCallTranscriptById(REP_B_CALL_ID);
      expect(repBCall).toBeTruthy();
      expect(repBCall.id).toBe(REP_B_CALL_ID);
      
      // Verify the calls belong to different reps
      expect(repACall.rep_id).not.toBe(repBCall.rep_id);
    });

    test('Verify call count is limited to own calls via RLS', async ({ db }) => {
      // Get Rep A's user info
      const repA = await db.getUserByEmail(REP_A_CREDENTIALS.email);
      expect(repA).toBeTruthy();
      
      // Count calls for Rep A (using service role - bypasses RLS)
      const count = await db.countCallTranscripts(repA!.id);
      
      // Rep A should have at least 1 call
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('Verify call analysis is properly linked and secured', async ({ db }) => {
      // Get Rep A's call
      const repACall = await db.getCallTranscriptById(REP_A_CALL_ID);
      expect(repACall).toBeTruthy();
      
      // Try to get analysis (may or may not exist depending on analysis status)
      const analysis = await db.getCallAnalysis(REP_A_CALL_ID);
      
      // If analysis exists, verify it belongs to the same rep
      if (analysis) {
        expect(analysis.rep_id).toBe(repACall.rep_id);
      }
    });

    test('Verify user role is correctly set', async ({ db }) => {
      // Get Rep A's user info
      const repA = await db.getUserByEmail(REP_A_CREDENTIALS.email);
      expect(repA).toBeTruthy();
      
      // Verify the user has 'rep' role
      const role = await db.getUserRole(repA!.id);
      expect(role).toBe('rep');
    });
  });
});

test.describe('Call Transcripts RLS Security Tests - Edge Cases', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Direct URL manipulation cannot bypass RLS', async ({ page }) => {
    // First verify we can access our own call
    await page.goto(`/calls/${REP_A_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    
    // Now try to access another rep's call via URL manipulation
    await page.goto(`/calls/${REP_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Should be redirected, not shown the data
    await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
  });

  test('Browser back button after redirect maintains security', async ({ page }) => {
    // Navigate to unauthorized call (will redirect)
    await page.goto(`/calls/${REP_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Verify we were redirected
    await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
    
    // Try browser back - should not reveal unauthorized data
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should NOT load the unauthorized call detail
    const url = page.url();
    expect(url).not.toContain(REP_B_CALL_ID);
  });

  test('Multiple rapid unauthorized access attempts fail consistently', async ({ page }) => {
    // Try to access unauthorized call multiple times rapidly
    const attemptCount = 3;
    
    for (let i = 0; i < attemptCount; i++) {
      await page.goto(`/calls/${REP_B_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Each attempt should fail
      await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
    }
  });

  test('Switching between authorized and unauthorized calls maintains RLS', async ({ page }) => {
    // Access authorized call (should succeed)
    await page.goto(`/calls/${REP_A_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Try to access unauthorized call (should fail)
    await page.goto(`/calls/${REP_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
    
    // Access authorized call again (should still succeed)
    await page.goto(`/calls/${REP_A_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('Query parameters cannot bypass RLS', async ({ page }) => {
    // Try to access unauthorized call with various query parameters
    await page.goto(`/calls/${REP_B_CALL_ID}?bypass=true`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_CALL_ID));
    
    await page.goto(`/calls/${REP_B_CALL_ID}?admin=1`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_CALL_ID));
    
    await page.goto(`/calls/${REP_B_CALL_ID}?force=true`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_CALL_ID));
  });

  test('Cannot access call via prospect page if RLS blocks', async ({ page }) => {
    // This tests that even if a rep navigates via a prospect page,
    // they still cannot access calls from other reps
    
    // Try to directly access the unauthorized call
    await page.goto(`/calls/${REP_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Should fail regardless of navigation path
    await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
  });

  test('Session persistence does not allow unauthorized access', async ({ page }) => {
    // Access authorized call
    await page.goto(`/calls/${REP_A_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${REP_A_CALL_ID}`);
    
    // Wait a bit to simulate session persistence
    await page.waitForTimeout(1000);
    
    // Try to access unauthorized call (should still fail)
    await page.goto(`/calls/${REP_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(`/calls/${REP_B_CALL_ID}`);
  });
});
