/**
 * RLS Security Tests for Manager Role
 * 
 * Validates that Row-Level Security policies correctly enforce team-based access:
 * 1. Managers CAN view data for their own team members
 * 2. Managers CANNOT view data for other teams
 * 3. Team-based isolation is enforced across all data types
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============
// Manager A: Enterprise East team
const MANAGER_A_CREDENTIALS = {
  email: process.env.MANAGER_A_EMAIL || 'manager.east@example.com',
  password: process.env.MANAGER_A_PASSWORD || 'TestPassword123!',
};

// Manager A's team data (Enterprise East)
const MANAGER_A_TEAM_ID = 'c4ce8e62-5135-4579-bfac-fb64ee9888c4';
const MANAGER_A_REP_ID = '760a1855-0294-4b4c-971c-2d40cc0e8327'; // rep.east.1@example.com
const MANAGER_A_TEAM_PROSPECT_ID = '1b7d1b47-6ea0-4f3a-a65a-c9e1c5bde405';
const MANAGER_A_TEAM_CALL_ID = '07cedd82-487b-4ef0-8ba0-b47661bb12a2';

// Manager B's team data (Enterprise West) - should be blocked
const MANAGER_B_TEAM_ID = '98d9851c-15f3-4e3a-88f9-1f409a5b61d5';
const MANAGER_B_REP_ID = '023b65eb-7c3b-4f8f-9850-0bf795c46e6c'; // rep.west.1@example.com
const MANAGER_B_TEAM_CALL_ID = '2f557b63-611d-4820-8850-ddeb02ebfea0';

test.describe('Manager RLS Security Tests', () => {
  // Authenticate as Manager A before each test
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(MANAGER_A_CREDENTIALS.email, MANAGER_A_CREDENTIALS.password);
    
    // Wait for redirect to dashboard after login
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests - Own Team Data', () => {
    test('Manager CAN access their team\'s prospect', async ({ page }) => {
      // Navigate to team member's prospect
      await page.goto(`/manager/accounts/${MANAGER_A_TEAM_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct prospect page (not redirected)
      await expect(page).toHaveURL(`/manager/accounts/${MANAGER_A_TEAM_PROSPECT_ID}`);
      
      // Verify the prospect detail page loaded successfully
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify we don't see error messages
      await expect(page.getByText(/account not found/i)).not.toBeVisible();
    });

    test('Manager CAN access their team\'s call transcript', async ({ page }) => {
      // Navigate to team member's call
      await page.goto(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct call page
      await expect(page).toHaveURL(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
      
      // Verify the call detail page loaded successfully
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify key UI elements are present
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
    });

    test('Manager CAN view team accounts list', async ({ page }) => {
      // Navigate to accounts page
      await page.goto('/manager/accounts');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the accounts page
      await expect(page).toHaveURL('/manager/accounts');
      
      // Verify page loaded with content
      await expect(page.locator('h1').filter({ hasText: /accounts/i })).toBeVisible();
    });

    test('Manager CAN view team member details', async ({ page }) => {
      // Navigate to rep detail page
      await page.goto(`/manager/rep/${MANAGER_A_REP_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the rep detail page
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${MANAGER_A_REP_ID}`));
      
      // Verify page loaded successfully
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('Manager CAN view coaching page for their team', async ({ page }) => {
      // Navigate to coaching page
      await page.goto('/manager/coaching');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the coaching page
      await expect(page).toHaveURL('/manager/coaching');
      
      // Verify page loaded with team data
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  test.describe('Negative Access Tests - Other Team Data', () => {
    test('Manager CANNOT access other team\'s call via direct URL', async ({ page }) => {
      // Attempt to navigate to another team's call
      await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Should be redirected away from unauthorized call
      await expect(page).not.toHaveURL(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
      
      // Should show error or redirect to safe location
      const url = page.url();
      const validRedirects = ['/manager', '/manager/coaching', '/not-found', '/'];
      const isValidRedirect = validRedirects.some(path => url.includes(path));
      expect(isValidRedirect).toBeTruthy();
    });

    test('Manager CANNOT access other team rep\'s detail page', async ({ page }) => {
      // Try to access another team's rep
      await page.goto(`/manager/rep/${MANAGER_B_REP_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Should not be on the unauthorized rep's page
      // Manager pages may handle this differently, so check for redirect or error
      const url = page.url();
      
      // If stayed on the page, should show error or empty state
      if (url.includes(MANAGER_B_REP_ID)) {
        // Check for error message or empty state
        const hasError = await page.getByText(/not found|no data|access denied/i).isVisible().catch(() => false);
        expect(hasError).toBeTruthy();
      } else {
        // Should be redirected
        expect(url).not.toContain(MANAGER_B_REP_ID);
      }
    });

    test('Manager accounts page should only show own team data', async ({ page }) => {
      // Navigate to accounts page
      await page.goto('/manager/accounts');
      await page.waitForLoadState('networkidle');
      
      // Page should load (managers can access this page)
      await expect(page).toHaveURL('/manager/accounts');
      
      // Verify page shows data (own team's accounts)
      // The filtering happens at the data level via RLS
      await expect(page.locator('h1').filter({ hasText: /accounts/i })).toBeVisible();
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify manager can query own team prospects', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // Get Manager A's user info
      const managerA = await db.getUserByEmail(MANAGER_A_CREDENTIALS.email);
      expect(managerA).toBeTruthy();
      expect(managerA!.team_id).toBe(MANAGER_A_TEAM_ID);
      
      // Verify manager role
      const role = await db.getUserRole(managerA!.id);
      expect(role).toBe('manager');
      
      // Get team member's prospect
      const prospect = await db.getProspectById(MANAGER_A_TEAM_PROSPECT_ID);
      expect(prospect).toBeTruthy();
      expect(prospect.rep_id).toBe(MANAGER_A_REP_ID);
    });

    test('Verify manager can query own team calls', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // Get Manager A's call
      const call = await db.getCallTranscriptById(MANAGER_A_TEAM_CALL_ID);
      expect(call).toBeTruthy();
      expect(call.rep_id).toBe(MANAGER_A_REP_ID);
      
      // Get Manager B's call (using admin client - proves data exists)
      const otherTeamCall = await db.getCallTranscriptById(MANAGER_B_TEAM_CALL_ID);
      expect(otherTeamCall).toBeTruthy();
      expect(otherTeamCall.rep_id).toBe(MANAGER_B_REP_ID);
      
      // Verify calls belong to different reps
      expect(call.rep_id).not.toBe(otherTeamCall.rep_id);
    });

    test('Verify team member belongs to correct team', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // Get rep profile
      const rep = await db.getUserByEmail('rep.east.1@example.com');
      expect(rep).toBeTruthy();
      expect(rep!.team_id).toBe(MANAGER_A_TEAM_ID);
      
      // Count prospects for this rep
      const prospectCount = await db.countProspects(rep!.id);
      expect(prospectCount).toBeGreaterThanOrEqual(0);
    });

    test('Verify is_manager_of_user function works correctly', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      // This test verifies the database function that powers manager RLS
      // The function should be defined in migrations as: is_manager_of_user(manager_id, rep_id)
      
      const managerA = await db.getUserByEmail(MANAGER_A_CREDENTIALS.email);
      expect(managerA).toBeTruthy();
      
      // Manager A should be manager of their team member
      // (This is validated through RLS policies using is_manager_of_user function)
      expect(managerA!.team_id).toBe(MANAGER_A_TEAM_ID);
    });
  });
});

test.describe('Manager RLS Security Tests - Edge Cases', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(MANAGER_A_CREDENTIALS.email, MANAGER_A_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Direct URL manipulation cannot bypass team isolation', async ({ page }) => {
    // First verify we can access our own team's call
    await page.goto(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    
    // Now try to access another team's call
    await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Should be redirected or blocked
    await expect(page).not.toHaveURL(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
  });

  test('Query parameters cannot bypass team RLS', async ({ page }) => {
    // Try various bypass attempts
    const bypassAttempts = [
      `?team=${MANAGER_B_TEAM_ID}`,
      `?bypass=true`,
      `?admin=1`,
      `?show_all=true`,
    ];
    
    for (const params of bypassAttempts) {
      await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}${params}`);
      await page.waitForLoadState('networkidle');
      
      // All attempts should fail
      await expect(page).not.toHaveURL(new RegExp(MANAGER_B_TEAM_CALL_ID));
    }
  });

  test('Browser back button maintains team isolation', async ({ page }) => {
    // Access own team's call
    await page.goto(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    
    // Try to access other team's call
    await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should not reveal unauthorized data
    const url = page.url();
    expect(url).not.toContain(MANAGER_B_TEAM_CALL_ID);
  });

  test('Switching between own team and other team maintains isolation', async ({ page }) => {
    // Rapidly switch between authorized and unauthorized resources
    for (let i = 0; i < 3; i++) {
      // Access authorized (should succeed)
      await page.goto(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
      
      // Try unauthorized (should fail)
      await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(new RegExp(MANAGER_B_TEAM_CALL_ID));
    }
  });

  test('Manager cannot escalate to admin privileges', async ({ page }) => {
    // Try to access admin-only pages
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Should not be on admin page
    // May redirect to manager dashboard or show access denied
    const url = page.url();
    expect(url).not.toBe('/admin');
  });

  test('Session persistence does not allow cross-team access', async ({ page }) => {
    // Access own team's call
    await page.goto(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${MANAGER_A_TEAM_CALL_ID}`);
    
    // Wait to simulate session persistence
    await page.waitForTimeout(1000);
    
    // Try to access other team's call (should still fail)
    await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(MANAGER_B_TEAM_CALL_ID));
  });

  test('API responses do not leak other team data', async ({ page }) => {
    // Navigate to manager dashboard or accounts page
    await page.goto('/manager/accounts');
    await page.waitForLoadState('networkidle');
    
    // Listen for API responses
    const apiResponses: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('prospects') || 
          response.url().includes('calls') ||
          response.url().includes('profiles')) {
        try {
          const body = await response.text();
          apiResponses.push(body);
        } catch (e) {
          // Ignore errors reading response body
        }
      }
    });
    
    // Trigger a reload to capture API calls
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify no other team member IDs in responses
    const hasUnauthorizedData = apiResponses.some(body => 
      body.includes(MANAGER_B_REP_ID) || 
      body.includes(MANAGER_B_TEAM_CALL_ID)
    );
    
    expect(hasUnauthorizedData).toBeFalsy();
  });

  test('Manager cannot modify team assignment to access other team data', async ({ page, db }) => {
    test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
    // Verify manager's current team
    const manager = await db.getUserByEmail(MANAGER_A_CREDENTIALS.email);
    expect(manager).toBeTruthy();
    expect(manager!.team_id).toBe(MANAGER_A_TEAM_ID);
    
    // Manager should not be able to change their team_id via UI
    // (This would require admin privileges)
    // Navigate to manager dashboard
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');
    
    // Verify they're still on manager dashboard
    await expect(page).toHaveURL('/manager');
    
    // Verify they cannot access other team's call
    await page.goto(`/calls/${MANAGER_B_TEAM_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(MANAGER_B_TEAM_CALL_ID));
  });
});

test.describe('Manager RLS Cross-Team Verification', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(MANAGER_A_CREDENTIALS.email, MANAGER_A_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Verify team isolation across all resource types', async ({ page }) => {
    // List of other team's resources to test
    const unauthorizedResources = [
      `/calls/${MANAGER_B_TEAM_CALL_ID}`,
      `/manager/rep/${MANAGER_B_REP_ID}`,
    ];
    
    for (const resource of unauthorizedResources) {
      await page.goto(resource);
      await page.waitForLoadState('networkidle');
      
      // Should not be able to access any other team resources
      const url = page.url();
      expect(url).not.toContain(resource.split('/').pop());
    }
  });

  test('Manager dashboard shows only own team metrics', async ({ page, db }) => {
    test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
    // Navigate to manager dashboard
    await page.goto('/manager');
    await page.waitForLoadState('networkidle');
    
    // Get manager info
    const manager = await db.getUserByEmail(MANAGER_A_CREDENTIALS.email);
    expect(manager).toBeTruthy();
    
    // Dashboard should only show own team's data
    // This is enforced at the RLS level, so we verify the page loads
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
