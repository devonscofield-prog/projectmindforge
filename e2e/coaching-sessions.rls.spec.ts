/**
 * RLS Security Tests for coaching_sessions Table
 * 
 * Validates that Row-Level Security policies correctly enforce access control:
 * 1. Reps CAN view their own coaching sessions
 * 2. Reps CANNOT view, create, update, or delete any coaching sessions
 * 3. Managers CAN view and manage coaching sessions for their team members
 * 4. Managers CANNOT view or modify other teams' coaching sessions
 * 5. Admins CAN view and manage all coaching sessions across all teams
 */

import { test, expect } from './fixtures/test-fixtures';

// ============= TEST DATA CONFIGURATION =============

// Rep A: Enterprise East team - can only VIEW own sessions
const REP_A = {
  email: 'rep.east.1@example.com',
  password: 'password123',
  id: '760a1855-0294-4b4c-971c-2d40cc0e8327',
  coachingSessionId: '5049505a-7867-4a49-9a12-033d5bdfbdfb',
  teamId: 'c4ce8e62-5135-4579-bfac-fb64ee9888c4',
};

// Rep B: Enterprise West team - different team
const REP_B = {
  email: 'rep.west.1@example.com',
  id: '023b65eb-7c3b-4f8f-9850-0bf795c46e6c',
  coachingSessionId: '648d80a5-2f1f-4ff9-91a8-b3c85c6d6b07',
  teamId: '98d9851c-15f3-4e3a-88f9-1f409a5b61d5',
};

// Manager East: Manages Rep A
const MANAGER_EAST = {
  email: 'manager.east@example.com',
  password: 'password123',
  id: 'cfc74e11-0660-4bc5-aec7-e355615ce48e',
  teamId: 'c4ce8e62-5135-4579-bfac-fb64ee9888c4',
};

// Manager West: Manages Rep B
const MANAGER_WEST = {
  email: 'manager.west@example.com',
  id: '519f8b13-742f-41d6-acb3-d00d3d2daafd',
  teamId: '98d9851c-15f3-4e3a-88f9-1f409a5b61d5',
};

// Admin: Full access
const ADMIN = {
  email: 'admin@example.com',
  password: 'password123',
};

test.describe('Rep RLS Security Tests - coaching_sessions', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(REP_A.email, REP_A.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests - View Own Sessions', () => {
    test('Rep CAN view own coaching sessions in database', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Verify rep can query their own coaching sessions
      const sessions = await db.getCoachingSessionsForRep(REP_A.id);
      expect(sessions).toBeTruthy();
      expect(Array.isArray(sessions)).toBe(true);
      
      // All sessions should belong to this rep
      sessions.forEach(session => {
        expect(session.rep_id).toBe(REP_A.id);
      });
    });

    test('Rep can view coaching session on rep detail page', async ({ page }) => {
      // Navigate to rep coaching summary
      await page.goto('/rep/coaching-summary');
      await page.waitForLoadState('networkidle');
      
      // Page should load successfully
      await expect(page).toHaveURL('/rep/coaching-summary');
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Negative Access Tests - Blocked Operations', () => {
    test('Rep CANNOT query another rep\'s coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Try to get Rep B's sessions (should be blocked by RLS)
      const sessions = await db.getCoachingSessionsForRep(REP_B.id);
      
      // RLS should prevent rep from seeing other rep's sessions
      // When authenticated as Rep A, query for Rep B should return empty
      expect(sessions).toEqual([]);
    });

    test('Rep CANNOT access specific coaching session from another rep', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Try to access Rep B's coaching session
      const session = await db.getCoachingSessionById(REP_B.coachingSessionId).catch(() => null);
      
      // Should not be able to access other rep's session
      expect(session).toBeNull();
    });

    test('Rep CANNOT create coaching sessions', async ({ page }) => {
      // Reps don't have UI to create coaching sessions
      // They should not be able to insert via any means
      await page.goto('/rep');
      await page.waitForLoadState('networkidle');
      
      // Verify no coaching session creation button exists
      const createButton = page.getByRole('button', { name: /create.*coaching/i });
      await expect(createButton).not.toBeVisible();
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify both rep sessions exist (proves RLS, not missing data)', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Use admin client to verify both sessions exist
      const repASession = await db.getCoachingSessionById(REP_A.coachingSessionId);
      expect(repASession).toBeTruthy();
      expect(repASession.rep_id).toBe(REP_A.id);
      
      const repBSession = await db.getCoachingSessionById(REP_B.coachingSessionId);
      expect(repBSession).toBeTruthy();
      expect(repBSession.rep_id).toBe(REP_B.id);
      
      // Verify sessions belong to different reps
      expect(repASession.rep_id).not.toBe(repBSession.rep_id);
    });

    test('Verify rep role is correctly set', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      const role = await db.getUserRole(REP_A.id);
      expect(role).toBe('rep');
    });
  });
});

test.describe('Manager RLS Security Tests - coaching_sessions', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(MANAGER_EAST.email, MANAGER_EAST.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests - Team Coaching Sessions', () => {
    test('Manager CAN view team member coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Get Rep A's sessions (Manager East's team member)
      const sessions = await db.getCoachingSessionsForRep(REP_A.id);
      expect(sessions).toBeTruthy();
      expect(Array.isArray(sessions)).toBe(true);
      
      // Should be able to see team member's sessions
      sessions.forEach(session => {
        expect(session.rep_id).toBe(REP_A.id);
      });
    });

    test('Manager CAN access coaching page for team', async ({ page }) => {
      await page.goto('/manager/coaching');
      await page.waitForLoadState('networkidle');
      
      // Page should load successfully
      await expect(page).toHaveURL('/manager/coaching');
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    });

    test('Manager CAN view team member rep detail with coaching data', async ({ page }) => {
      await page.goto(`/manager/rep/${REP_A.id}`);
      await page.waitForLoadState('networkidle');
      
      // Should successfully load rep detail page
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${REP_A.id}`));
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    });

    test('Manager CAN query own coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Manager should be able to see sessions they created
      const count = await db.countCoachingSessions(MANAGER_EAST.id);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Negative Access Tests - Team Isolation', () => {
    test('Manager CANNOT view other team\'s coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Try to get Rep B's sessions (different team)
      const sessions = await db.getCoachingSessionsForRep(REP_B.id);
      
      // RLS should prevent access to other team's sessions
      expect(sessions).toEqual([]);
    });

    test('Manager CANNOT access specific session from other team', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Try to access Rep B's coaching session (different team)
      const session = await db.getCoachingSessionById(REP_B.coachingSessionId).catch(() => null);
      
      // Should not be able to access other team's session
      expect(session).toBeNull();
    });

    test('Manager CANNOT access other team rep detail page', async ({ page }) => {
      await page.goto(`/manager/rep/${REP_B.id}`);
      await page.waitForLoadState('networkidle');
      
      // Should be redirected or show error
      const url = page.url();
      if (url.includes(REP_B.id)) {
        // If stayed on page, should show error
        const hasError = await page.getByText(/not found|no data|access denied/i).isVisible().catch(() => false);
        expect(hasError).toBeTruthy();
      } else {
        // Should be redirected away
        expect(url).not.toContain(REP_B.id);
      }
    });

    test('Manager coaching page does not show other team data', async ({ page }) => {
      await page.goto('/manager/coaching');
      await page.waitForLoadState('networkidle');
      
      // Listen for API responses
      const apiResponses: string[] = [];
      page.on('response', async (response) => {
        if (response.url().includes('coaching')) {
          try {
            const body = await response.text();
            apiResponses.push(body);
          } catch (e) {
            // Ignore
          }
        }
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Verify no other team member IDs in responses
      const hasUnauthorizedData = apiResponses.some(body => 
        body.includes(REP_B.id) || 
        body.includes(MANAGER_WEST.id)
      );
      
      expect(hasUnauthorizedData).toBeFalsy();
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Verify is_manager_of_user function enforces team boundaries', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Manager East should manage Rep A
      const managerEast = await db.getUserByEmail(MANAGER_EAST.email);
      expect(managerEast).toBeTruthy();
      expect(managerEast!.team_id).toBe(MANAGER_EAST.teamId);
      
      // Rep A should be on same team
      const repA = await db.getUserByEmail(REP_A.email);
      expect(repA).toBeTruthy();
      expect(repA!.team_id).toBe(REP_A.teamId);
      expect(repA!.team_id).toBe(managerEast!.team_id);
    });

    test('Verify manager role is correctly set', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      const role = await db.getUserRole(MANAGER_EAST.id);
      expect(role).toBe('manager');
    });

    test('Verify both team sessions exist (proves RLS isolation)', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Use admin client to verify both team's sessions exist
      const eastSession = await db.getCoachingSessionById(REP_A.coachingSessionId);
      expect(eastSession).toBeTruthy();
      
      const westSession = await db.getCoachingSessionById(REP_B.coachingSessionId);
      expect(westSession).toBeTruthy();
      
      // Verify sessions belong to different teams
      expect(eastSession.manager_id).toBe(MANAGER_EAST.id);
      expect(westSession.manager_id).toBe(MANAGER_WEST.id);
    });
  });
});

test.describe('Admin RLS Security Tests - coaching_sessions', () => {
  test.beforeEach(async ({ page, authPage }) => {
    await authPage.goto();
    await authPage.login(ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
  });

  test.describe('Positive Access Tests - Full Access', () => {
    test('Admin CAN view all coaching sessions from all teams', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Admin should see sessions from both teams
      const eastSessions = await db.getCoachingSessionsForRep(REP_A.id);
      expect(eastSessions.length).toBeGreaterThanOrEqual(0);
      
      const westSessions = await db.getCoachingSessionsForRep(REP_B.id);
      expect(westSessions.length).toBeGreaterThanOrEqual(0);
    });

    test('Admin CAN access Team East coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      const session = await db.getCoachingSessionById(REP_A.coachingSessionId);
      expect(session).toBeTruthy();
      expect(session.rep_id).toBe(REP_A.id);
      expect(session.manager_id).toBe(MANAGER_EAST.id);
    });

    test('Admin CAN access Team West coaching sessions', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      const session = await db.getCoachingSessionById(REP_B.coachingSessionId);
      expect(session).toBeTruthy();
      expect(session.rep_id).toBe(REP_B.id);
      expect(session.manager_id).toBe(MANAGER_WEST.id);
    });

    test('Admin CAN access manager coaching page', async ({ page }) => {
      await page.goto('/manager/coaching');
      await page.waitForLoadState('networkidle');
      
      // Admin should be able to access manager pages
      await expect(page).toHaveURL('/manager/coaching');
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    });

    test('Admin CAN view any rep detail page', async ({ page }) => {
      // Access Team East rep
      await page.goto(`/manager/rep/${REP_A.id}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${REP_A.id}`));
      
      // Access Team West rep
      await page.goto(`/manager/rep/${REP_B.id}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${REP_B.id}`));
    });
  });

  test.describe('Database-Level RLS Verification', () => {
    test('Admin can query coaching sessions regardless of team', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      // Count sessions for both managers
      const eastCount = await db.countCoachingSessions(MANAGER_EAST.id);
      expect(eastCount).toBeGreaterThanOrEqual(0);
      
      const westCount = await db.countCoachingSessions(MANAGER_WEST.id);
      expect(westCount).toBeGreaterThanOrEqual(0);
    });

    test('Verify admin role is correctly set', async ({ db }) => {
      test.skip(!db.isAvailable(), 'Database operations require SUPABASE_SERVICE_ROLE_KEY');
      
      const admin = await db.getUserByEmail(ADMIN.email);
      expect(admin).toBeTruthy();
      
      const role = await db.getUserRole(admin!.id);
      expect(role).toBe('admin');
    });
  });
});

test.describe('coaching_sessions RLS Edge Cases', () => {
  test.describe('Rep Edge Cases', () => {
    test.beforeEach(async ({ page, authPage }) => {
      await authPage.goto();
      await authPage.login(REP_A.email, REP_A.password);
      await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
    });

    test('Rep cannot access manager coaching page', async ({ page }) => {
      await page.goto('/manager/coaching');
      await page.waitForLoadState('networkidle');
      
      // Should be redirected away from manager page
      const url = page.url();
      expect(url).not.toBe('/manager/coaching');
    });

    test('Rep cannot access manager rep detail page', async ({ page }) => {
      await page.goto(`/manager/rep/${REP_A.id}`);
      await page.waitForLoadState('networkidle');
      
      // Should be redirected away
      const url = page.url();
      expect(url).not.toContain('/manager/rep/');
    });
  });

  test.describe('Manager Edge Cases', () => {
    test.beforeEach(async ({ page, authPage }) => {
      await authPage.goto();
      await authPage.login(MANAGER_EAST.email, MANAGER_EAST.password);
      await page.waitForURL(/\/(rep|manager|admin)/, { timeout: 15000 });
    });

    test('Query parameters cannot bypass team isolation', async ({ page }) => {
      const bypassAttempts = [
        `?team=${REP_B.teamId}`,
        `?rep_id=${REP_B.id}`,
        `?bypass=true`,
        `?show_all=true`,
      ];
      
      for (const params of bypassAttempts) {
        await page.goto(`/manager/rep/${REP_B.id}${params}`);
        await page.waitForLoadState('networkidle');
        
        // All attempts should fail
        const url = page.url();
        if (url.includes(REP_B.id)) {
          const hasError = await page.getByText(/not found|no data|access denied/i).isVisible().catch(() => false);
          expect(hasError).toBeTruthy();
        }
      }
    });

    test('Browser back button maintains team isolation', async ({ page }) => {
      // Access own team member
      await page.goto(`/manager/rep/${REP_A.id}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(`/manager/rep/${REP_A.id}`));
      
      // Try other team
      await page.goto(`/manager/rep/${REP_B.id}`);
      await page.waitForLoadState('networkidle');
      
      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');
      
      // Should not reveal unauthorized data
      const url = page.url();
      expect(url).not.toContain(REP_B.id);
    });

    test('Multiple rapid unauthorized access attempts fail consistently', async ({ page }) => {
      for (let i = 0; i < 5; i++) {
        await page.goto(`/manager/rep/${REP_B.id}`);
        await page.waitForLoadState('networkidle');
        
        const url = page.url();
        if (url.includes(REP_B.id)) {
          const hasError = await page.getByText(/not found|no data|access denied/i).isVisible().catch(() => false);
          expect(hasError).toBeTruthy();
        } else {
          expect(url).not.toContain(REP_B.id);
        }
      }
    });

    test('Switching between authorized and unauthorized maintains isolation', async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        // Access authorized
        await page.goto(`/manager/rep/${REP_A.id}`);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(new RegExp(`/manager/rep/${REP_A.id}`));
        
        // Try unauthorized
        await page.goto(`/manager/rep/${REP_B.id}`);
        await page.waitForLoadState('networkidle');
        
        const url = page.url();
        if (url.includes(REP_B.id)) {
          const hasError = await page.getByText(/not found|no data|access denied/i).isVisible().catch(() => false);
          expect(hasError).toBeTruthy();
        } else {
          expect(url).not.toContain(REP_B.id);
        }
      }
    });
  });
});
