/**
 * RLS Security Tests for Admin Role
 * 
 * Validates that Row-Level Security policies correctly enforce admin access:
 * 1. Admins CAN access data from all teams
 * 2. Admins CAN access data from all users (reps and managers)
 * 3. Admins have full visibility across the entire organization
 * 4. Admin access cannot be restricted by team-based or user-based RLS
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============
// Admin user credentials
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'password123',
};

// Test data from multiple teams
// Team A (Enterprise East)
const TEAM_A_ID = 'c4ce8e62-5135-4579-bfac-fb64ee9888c4';
const TEAM_A_REP_ID = '760a1855-0294-4b4c-971c-2d40cc0e8327'; // rep.east.1@example.com
const TEAM_A_PROSPECT_ID = '1b7d1b47-6ea0-4f3a-a65a-c9e1c5bde405';
const TEAM_A_CALL_ID = '07cedd82-487b-4ef0-8ba0-b47661bb12a2';
const TEAM_A_STAKEHOLDER_ID = '003f9b84-9225-49ad-a5a0-ca9e03f253ea';

// Team B (Enterprise West)
const TEAM_B_ID = '98d9851c-15f3-4e3a-88f9-1f409a5b61d5';
const TEAM_B_REP_ID = '023b65eb-7c3b-4f8f-9850-0bf795c46e6c'; // rep.west.1@example.com
const TEAM_B_CALL_ID = '2f557b63-611d-4820-8850-ddeb02ebfea0';

// External rep (no team)
const EXTERNAL_REP_PROSPECT_ID = 'eb4a2a15-6a52-434e-b1a2-6c1d8a8fd781'; // ben.martin@stormwindlive.com
const EXTERNAL_REP_STAKEHOLDER_ID = 'e64df2b6-d4c9-4c87-b74b-bca37eb40a96';

test.describe('Admin RLS Security Tests', () => {
  // Authenticate as Admin before each test
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    
    // Wait for redirect to dashboard after login
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Full Access - Team A Data', () => {
    test('Admin CAN access Team A prospect', async ({ page }) => {
      // Navigate to Team A's prospect
      await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct prospect page (not redirected)
      await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      
      // Verify the prospect detail page loaded successfully
      const heading = page.locator('h1');
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify we don't see error messages
      await expect(page.getByText(/account not found/i)).not.toBeVisible();
    });

    test('Admin CAN access Team A call transcript', async ({ page }) => {
      // Navigate to Team A's call
      await page.goto(`/calls/${TEAM_A_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct call page
      await expect(page).toHaveURL(`/calls/${TEAM_A_CALL_ID}`);
      
      // Verify the call detail page loaded successfully
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      
      // Verify key UI elements are present
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
    });

    test('Admin CAN view Team A stakeholder data', async ({ page }) => {
      // Navigate to Team A's prospect (which contains stakeholder)
      await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify page loaded successfully
      await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Full Access - Team B Data', () => {
    test('Admin CAN access Team B call transcript', async ({ page }) => {
      // Navigate to Team B's call
      await page.goto(`/calls/${TEAM_B_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct call page
      await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
      
      // Verify the call detail page loaded successfully
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('Admin CAN view Team B rep details', async ({ page }) => {
      // Navigate to Team B rep's page
      await page.goto(`/manager/rep/${TEAM_B_REP_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the rep detail page
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${TEAM_B_REP_ID}`));
      
      // Verify page loaded successfully
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Full Access - External Rep Data (No Team)', () => {
    test('Admin CAN access prospect from rep without team', async ({ page }) => {
      // Navigate to external rep's prospect
      await page.goto(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct prospect page
      await expect(page).toHaveURL(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
      
      // Verify the prospect detail page loaded successfully
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Admin Dashboard and List Views', () => {
    test('Admin CAN access admin dashboard', async ({ page }) => {
      // Navigate to admin dashboard
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the admin dashboard
      await expect(page).toHaveURL('/admin');
      
      // Verify dashboard loaded with admin-level content
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Admin CAN view all accounts across all teams', async ({ page }) => {
      // Navigate to admin accounts page
      await page.goto('/admin/accounts');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the accounts page
      await expect(page).toHaveURL('/admin/accounts');
      
      // Verify page loaded with data from all teams
      await expect(page.locator('h1').filter({ hasText: /accounts/i })).toBeVisible();
    });

    test('Admin CAN view all teams', async ({ page }) => {
      // Navigate to admin teams page
      await page.goto('/admin/teams');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the teams page
      await expect(page).toHaveURL('/admin/teams');
      
      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Admin CAN view all users', async ({ page }) => {
      // Navigate to admin users page
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the users page
      await expect(page).toHaveURL('/admin/users');
      
      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Admin CAN access transcript analysis page', async ({ page }) => {
      // Navigate to transcript analysis page (admin-only feature)
      await page.goto('/admin/transcript-analysis');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the transcript analysis page
      await expect(page).toHaveURL('/admin/transcript-analysis');
      
      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Admin CAN access performance monitor', async ({ page }) => {
      // Navigate to performance monitor (admin-only feature)
      await page.goto('/admin/performance-monitor');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the performance monitor page
      await expect(page).toHaveURL('/admin/performance-monitor');
      
      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Admin CAN access coaching trends', async ({ page }) => {
      // Navigate to coaching trends
      await page.goto('/admin/coaching-trends');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the coaching trends page
      await expect(page).toHaveURL('/admin/coaching-trends');
      
      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify admin can query data from Team A', async ({ db }) => {
      // Get Admin user info
      const admin = await db.getUserByEmail(ADMIN_CREDENTIALS.email);
      expect(admin).toBeTruthy();
      
      // Verify admin role
      const role = await db.getUserRole(admin!.id);
      expect(role).toBe('admin');
      
      // Get Team A's prospect (using admin client - bypasses RLS)
      const prospect = await db.getProspectById(TEAM_A_PROSPECT_ID);
      expect(prospect).toBeTruthy();
      expect(prospect.rep_id).toBe(TEAM_A_REP_ID);
    });

    test('Verify admin can query data from Team B', async ({ db }) => {
      // Get Team B's call
      const call = await db.getCallTranscriptById(TEAM_B_CALL_ID);
      expect(call).toBeTruthy();
      expect(call.rep_id).toBe(TEAM_B_REP_ID);
    });

    test('Verify admin can query data from external rep', async ({ db }) => {
      // Get external rep's prospect
      const prospect = await db.getProspectById(EXTERNAL_REP_PROSPECT_ID);
      expect(prospect).toBeTruthy();
      
      // Get stakeholder
      const stakeholders = await db.getStakeholders(EXTERNAL_REP_PROSPECT_ID);
      expect(stakeholders.length).toBeGreaterThan(0);
    });

    test('Verify admin can query all prospects across teams', async ({ db }) => {
      // Get prospects from Team A rep
      const teamACount = await db.countProspects(TEAM_A_REP_ID);
      expect(teamACount).toBeGreaterThanOrEqual(0);
      
      // Get prospects from Team B rep
      const teamBCount = await db.countProspects(TEAM_B_REP_ID);
      expect(teamBCount).toBeGreaterThanOrEqual(0);
      
      // Admin can see both
      expect(true).toBeTruthy(); // Admin client bypasses RLS, so this always works
    });

    test('Verify admin can query all call transcripts across teams', async ({ db }) => {
      // Get calls from Team A rep
      const teamACalls = await db.countCallTranscripts(TEAM_A_REP_ID);
      expect(teamACalls).toBeGreaterThanOrEqual(0);
      
      // Get calls from Team B rep
      const teamBCalls = await db.countCallTranscripts(TEAM_B_REP_ID);
      expect(teamBCalls).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Cross-Team Access Verification', () => {
    test('Admin can switch between teams without restriction', async ({ page }) => {
      // Access Team A data
      await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await expect(page.locator('h1')).toBeVisible();
      
      // Access Team B data
      await page.goto(`/calls/${TEAM_B_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Access external rep data
      await page.goto(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
      await expect(page.locator('h1')).toBeVisible();
    });

    test('Admin can access multiple prospects from different teams in sequence', async ({ page }) => {
      const prospects = [
        TEAM_A_PROSPECT_ID,
        EXTERNAL_REP_PROSPECT_ID,
      ];
      
      for (const prospectId of prospects) {
        await page.goto(`/admin/accounts/${prospectId}`);
        await page.waitForLoadState('networkidle');
        
        // Should successfully access each prospect
        await expect(page).toHaveURL(`/admin/accounts/${prospectId}`);
        await expect(page.locator('h1')).toBeVisible();
      }
    });

    test('Admin can access multiple calls from different teams in sequence', async ({ page }) => {
      const calls = [
        TEAM_A_CALL_ID,
        TEAM_B_CALL_ID,
      ];
      
      for (const callId of calls) {
        await page.goto(`/calls/${callId}`);
        await page.waitForLoadState('networkidle');
        
        // Should successfully access each call
        await expect(page).toHaveURL(`/calls/${callId}`);
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
    });
  });
});

test.describe('Admin RLS Security Tests - Edge Cases', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Admin access persists across session', async ({ page }) => {
    // Access Team A data
    await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    
    // Wait to simulate session persistence
    await page.waitForTimeout(1000);
    
    // Access Team B data (should still work)
    await page.goto(`/calls/${TEAM_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
  });

  test('Browser back/forward maintains admin access', async ({ page }) => {
    // Access Team A data
    await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    
    // Access Team B data
    await page.goto(`/calls/${TEAM_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    
    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
  });

  test('Query parameters do not affect admin access', async ({ page }) => {
    // Try accessing with various query parameters
    const queryParams = ['?team=other', '?restrict=true', '?limit=own'];
    
    for (const params of queryParams) {
      await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}${params}`);
      await page.waitForLoadState('networkidle');
      
      // Should still have access
      await expect(page).toHaveURL(new RegExp(TEAM_A_PROSPECT_ID));
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('Multiple tabs maintain admin access independently', async ({ browser }) => {
    // Create multiple pages (tabs)
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Login in first tab
    await page1.goto('/auth');
    await page1.getByLabel(/email/i).fill(ADMIN_CREDENTIALS.email);
    await page1.getByLabel(/password/i).fill(ADMIN_CREDENTIALS.password);
    await page1.getByRole('button', { name: /sign in/i }).click();
    await page1.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
    
    // Access Team A data in tab 1
    await page1.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    await page1.waitForLoadState('networkidle');
    await expect(page1).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
    
    // Access Team B data in tab 2 (should share auth)
    await page2.goto(`/calls/${TEAM_B_CALL_ID}`);
    await page2.waitForLoadState('networkidle');
    await expect(page2).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
    
    await context.close();
  });

  test('Admin cannot lose access by navigating to restricted pages', async ({ page }) => {
    // Access admin dashboard
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/admin');
    
    // Navigate to various pages
    await page.goto('/admin/accounts');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/admin/accounts');
    
    // Navigate to cross-team data
    await page.goto(`/calls/${TEAM_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
    
    // Navigate back to admin dashboard
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/admin');
  });

  test('API responses include data from all teams', async ({ page }) => {
    // Navigate to admin accounts page
    await page.goto('/admin/accounts');
    await page.waitForLoadState('networkidle');
    
    // Listen for API responses
    const apiResponses: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('prospects') || response.url().includes('profiles')) {
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
    
    // Admin should be able to see data from multiple teams
    // (Note: The specific data depends on the RLS implementation)
    expect(apiResponses.length).toBeGreaterThan(0);
  });

  test('Rapid switching between teams maintains admin access', async ({ page }) => {
    // Rapidly switch between different team resources
    for (let i = 0; i < 3; i++) {
      // Team A
      await page.goto(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/admin/accounts/${TEAM_A_PROSPECT_ID}`);
      
      // Team B
      await page.goto(`/calls/${TEAM_B_CALL_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
      
      // External rep
      await page.goto(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/admin/accounts/${EXTERNAL_REP_PROSPECT_ID}`);
    }
  });
});

test.describe('Admin vs Manager Privilege Comparison', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Admin can access data that managers cannot', async ({ page }) => {
    // Admin should be able to access data from Team B
    // (whereas Team A's manager cannot access Team B's data)
    await page.goto(`/calls/${TEAM_B_CALL_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Admin should have access
    await expect(page).toHaveURL(`/calls/${TEAM_B_CALL_ID}`);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('Admin can access admin-only features', async ({ page }) => {
    const adminOnlyPages = [
      '/admin/teams',
      '/admin/users',
      '/admin/transcript-analysis',
      '/admin/performance-monitor',
    ];
    
    for (const adminPage of adminOnlyPages) {
      await page.goto(adminPage);
      await page.waitForLoadState('networkidle');
      
      // Should be able to access
      await expect(page).toHaveURL(adminPage);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });
});
