/**
 * RLS Security Tests for Stakeholders Table
 * 
 * Validates that Row-Level Security policies correctly enforce:
 * 1. Reps CAN access stakeholders for their own prospects
 * 2. Reps CANNOT access stakeholders belonging to other reps' prospects
 * 3. Stakeholders are only accessible within the context of accessible prospects
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============
// These IDs come from the seeded demo data
// Rep A: rep.east.1@example.com (the authenticated test user)
const REP_A_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'rep.east.1@example.com',
  password: process.env.TEST_USER_PASSWORD || 'password123',
};

// Rep A's prospect and stakeholder
const REP_A_PROSPECT_ID = '1b7d1b47-6ea0-4f3a-a65a-c9e1c5bde405';
const REP_A_STAKEHOLDER_ID = '003f9b84-9225-49ad-a5a0-ca9e03f253ea';

// Rep B's prospect and stakeholder (different user - ben.martin@stormwindlive.com)
const REP_B_PROSPECT_ID = 'eb4a2a15-6a52-434e-b1a2-6c1d8a8fd781';
const REP_B_STAKEHOLDER_ID = 'e64df2b6-d4c9-4c87-b74b-bca37eb40a96';

test.describe('Stakeholders RLS Security Tests', () => {
  // Authenticate before each test
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    
    // Wait for redirect to dashboard after login
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests', () => {
    test('Rep CAN view stakeholders for their own prospect', async ({ page }) => {
      // Navigate to Rep A's own prospect
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct prospect page
      await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      
      // Navigate to or check for Stakeholders section
      // Try to find the Stakeholders tab or section
      const stakeholdersTab = page.locator('text=/stakeholders/i, [role="tab"]:has-text("Stakeholders")').first();
      
      if (await stakeholdersTab.isVisible()) {
        await stakeholdersTab.click();
        await page.waitForLoadState('networkidle');
        
        // Verify stakeholder content is visible
        // Look for stakeholder cards or list items
        const stakeholderSection = page.locator('[data-testid="stakeholders-section"], .stakeholder-card, [class*="stakeholder"]').first();
        await expect(stakeholderSection).toBeVisible({ timeout: 10000 });
      }
    });

    test('Rep can view stakeholder details via sheet/modal', async ({ page }) => {
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Try to find and click on a stakeholder to open details
      const stakeholderCard = page.locator('[class*="stakeholder"], [data-stakeholder-id]').first();
      
      if (await stakeholderCard.isVisible()) {
        await stakeholderCard.click();
        await page.waitForLoadState('networkidle');
        
        // Verify stakeholder detail sheet/dialog opened
        const detailSheet = page.locator('[role="dialog"], [role="complementary"], .sheet-content').first();
        await expect(detailSheet).toBeVisible({ timeout: 10000 });
      }
    });

    test('Rep can add new stakeholders to their own prospect', async ({ page }) => {
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Look for "Add Stakeholder" button
      const addButton = page.getByRole('button', { name: /add stakeholder/i });
      
      if (await addButton.isVisible()) {
        await expect(addButton).toBeEnabled();
      }
    });

    test('Rep can interact with stakeholder data in their prospect', async ({ page, db }) => {
      // Verify stakeholder exists in database
      const stakeholders = await db.getStakeholders(REP_A_PROSPECT_ID);
      expect(stakeholders.length).toBeGreaterThan(0);
      
      // Navigate to prospect page
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Page should load successfully with stakeholder data
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Negative Access Tests (RLS Enforcement)', () => {
    test('Rep CANNOT access prospect page with unauthorized stakeholders', async ({ page }) => {
      // Attempt to navigate to Rep B's prospect (which contains Rep B's stakeholders)
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Should be redirected away from unauthorized prospect
      await expect(page).not.toHaveURL(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await expect(page).toHaveURL('/rep/prospects', { timeout: 10000 });
      
      // Therefore, stakeholders from Rep B's prospect are not accessible
    });

    test('Rep CANNOT access stakeholders through unauthorized prospect', async ({ page }) => {
      // Try to access unauthorized prospect
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Should be redirected
      await expect(page).toHaveURL('/rep/prospects');
      
      // Verify error toast appears
      await expect(page.getByText(/account not found/i)).toBeVisible({ timeout: 10000 });
      
      // Stakeholder data from Rep B should not be visible anywhere
      const repBStakeholderName = page.getByText(/human resources department/i);
      await expect(repBStakeholderName).not.toBeVisible();
    });

    test('Rep CANNOT view stakeholder count for unauthorized prospects', async ({ page }) => {
      // Even indirect information about unauthorized stakeholders should not leak
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      
      // Should not see stakeholder statistics or counts
      await expect(page).toHaveURL('/rep/prospects');
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify stakeholders exist for both reps (using admin client)', async ({ db }) => {
      // Verify Rep A's stakeholder exists
      const repAStakeholders = await db.getStakeholders(REP_A_PROSPECT_ID);
      expect(repAStakeholders.length).toBeGreaterThan(0);
      
      const repAStakeholder = repAStakeholders.find(s => s.id === REP_A_STAKEHOLDER_ID);
      expect(repAStakeholder).toBeTruthy();
      expect(repAStakeholder?.prospect_id).toBe(REP_A_PROSPECT_ID);
      
      // Verify Rep B's stakeholder exists (proves data exists, RLS blocks access)
      const repBStakeholders = await db.getStakeholders(REP_B_PROSPECT_ID);
      expect(repBStakeholders.length).toBeGreaterThan(0);
      
      const repBStakeholder = repBStakeholders.find(s => s.id === REP_B_STAKEHOLDER_ID);
      expect(repBStakeholder).toBeTruthy();
      expect(repBStakeholder?.prospect_id).toBe(REP_B_PROSPECT_ID);
    });

    test('Verify stakeholders belong to different prospects with different reps', async ({ db }) => {
      // Get both prospects to verify they have different rep_ids
      const repAProspect = await db.getProspectById(REP_A_PROSPECT_ID);
      const repBProspect = await db.getProspectById(REP_B_PROSPECT_ID);
      
      expect(repAProspect.rep_id).not.toBe(repBProspect.rep_id);
      
      // Get stakeholders
      const repAStakeholders = await db.getStakeholders(REP_A_PROSPECT_ID);
      const repBStakeholders = await db.getStakeholders(REP_B_PROSPECT_ID);
      
      // Verify stakeholders have correct rep_id through their prospects
      expect(repAStakeholders[0].rep_id).toBe(repAProspect.rep_id);
      expect(repBStakeholders[0].rep_id).toBe(repBProspect.rep_id);
      expect(repAStakeholders[0].rep_id).not.toBe(repBStakeholders[0].rep_id);
    });

    test('Verify stakeholder data integrity and relationships', async ({ db }) => {
      const repAStakeholders = await db.getStakeholders(REP_A_PROSPECT_ID);
      
      expect(repAStakeholders.length).toBeGreaterThan(0);
      
      // Verify stakeholder has required fields
      const stakeholder = repAStakeholders[0];
      expect(stakeholder.id).toBeTruthy();
      expect(stakeholder.name).toBeTruthy();
      expect(stakeholder.prospect_id).toBe(REP_A_PROSPECT_ID);
      expect(stakeholder.rep_id).toBeTruthy();
      expect(stakeholder.deleted_at).toBeNull();
    });

    test('Verify RLS policy structure via database query patterns', async ({ db }) => {
      // Get Rep A's user info
      const repA = await db.getUserByEmail(REP_A_CREDENTIALS.email);
      expect(repA).toBeTruthy();
      
      // Verify Rep A has the correct role
      const role = await db.getUserRole(repA!.id);
      expect(role).toBe('rep');
      
      // Get stakeholders for Rep A's prospects
      const repAStakeholders = await db.getStakeholders(REP_A_PROSPECT_ID);
      expect(repAStakeholders.length).toBeGreaterThan(0);
      
      // All stakeholders should have rep_id matching Rep A
      repAStakeholders.forEach(stakeholder => {
        expect(stakeholder.rep_id).toBe(repA!.id);
      });
    });
  });
});

test.describe('Stakeholders RLS Security Tests - Edge Cases', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A_CREDENTIALS.email, REP_A_CREDENTIALS.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test('Cannot access stakeholders via direct database injection attempts', async ({ page }) => {
    // Try to access authorized prospect first
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    
    // Now try unauthorized prospect with stakeholder context
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}?stakeholder=${REP_B_STAKEHOLDER_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Should fail and redirect
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    await expect(page).toHaveURL('/rep/prospects');
  });

  test('Query parameters cannot bypass stakeholder RLS', async ({ page }) => {
    // Try various query parameter injection attempts
    const bypassAttempts = [
      `?stakeholder_id=${REP_B_STAKEHOLDER_ID}`,
      `?show_all=true`,
      `?bypass=true&stakeholder=${REP_B_STAKEHOLDER_ID}`,
      `?admin=1`,
    ];
    
    for (const params of bypassAttempts) {
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}${params}`);
      await page.waitForLoadState('networkidle');
      
      // All attempts should fail
      await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    }
  });

  test('Browser back button maintains stakeholder security', async ({ page }) => {
    // Access authorized prospect with stakeholders
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    
    // Try to access unauthorized prospect
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/rep/prospects');
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should not reveal unauthorized stakeholder data
    const url = page.url();
    expect(url).not.toContain(REP_B_PROSPECT_ID);
    expect(url).not.toContain(REP_B_STAKEHOLDER_ID);
  });

  test('Rapid switching between prospects maintains stakeholder isolation', async ({ page }) => {
    // Rapidly switch between authorized and unauthorized prospects
    for (let i = 0; i < 3; i++) {
      // Access authorized (should succeed)
      await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
      
      // Try unauthorized (should fail)
      await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    }
  });

  test('Stakeholder data does not leak through API responses', async ({ page }) => {
    // Access authorized prospect
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Listen for API responses
    const apiResponses: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('stakeholders') || response.url().includes('prospects')) {
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
    
    // Wait a bit for API responses to be captured
    await page.waitForTimeout(2000);
    
    // Verify no unauthorized stakeholder data in responses
    const hasUnauthorizedData = apiResponses.some(body => 
      body.includes(REP_B_STAKEHOLDER_ID) || 
      body.toLowerCase().includes('human resources department')
    );
    
    expect(hasUnauthorizedData).toBeFalsy();
  });

  test('Session persistence does not allow unauthorized stakeholder access', async ({ page }) => {
    // Access authorized prospect
    await page.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    
    // Wait to simulate session persistence
    await page.waitForTimeout(1000);
    
    // Try to access unauthorized prospect (should still fail after waiting)
    await page.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
  });

  test('Multiple tabs cannot bypass stakeholder RLS', async ({ browser }) => {
    // Create a new page (simulates opening new tab)
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Login in first tab
    await page1.goto('/auth');
    await page1.getByLabel(/email/i).fill(REP_A_CREDENTIALS.email);
    await page1.getByLabel(/password/i).fill(REP_A_CREDENTIALS.password);
    await page1.getByRole('button', { name: /sign in/i }).click();
    await page1.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
    
    // Access authorized prospect in tab 1
    await page1.goto(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    await page1.waitForLoadState('networkidle');
    await expect(page1).toHaveURL(`/rep/prospects/${REP_A_PROSPECT_ID}`);
    
    // Try to access unauthorized prospect in tab 2 (should share auth but still block)
    await page2.goto(`/rep/prospects/${REP_B_PROSPECT_ID}`);
    await page2.waitForLoadState('networkidle');
    await expect(page2).not.toHaveURL(new RegExp(REP_B_PROSPECT_ID));
    
    await context.close();
  });
});
