# E2E Tests

This directory contains end-to-end tests using Playwright, including visual regression tests.

## Prerequisites

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Set up test environment variables:
   ```bash
   # Rep user credentials
   export TEST_USER_EMAIL="your-test-user@example.com"
   export TEST_USER_PASSWORD="your-test-password"
   
   # Manager user credentials (for manager RLS tests)
   export MANAGER_A_EMAIL="manager.east@example.com"
   export MANAGER_A_PASSWORD="your-manager-password"
   
   # Admin user credentials (for admin RLS tests)
   export ADMIN_EMAIL="admin@example.com"
   export ADMIN_PASSWORD="your-admin-password"
   
   # Supabase credentials
   export VITE_SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```
   Note: Service role key is required for database validation tests

## Running Tests

### Run all tests
```bash
npx playwright test
```

### Run only visual regression tests
```bash
npx playwright test e2e/visual/
```

### Run tests in headed mode (see the browser)
```bash
npx playwright test --headed
```

### Run specific test file
```bash
npx playwright test e2e/auth.spec.ts
```

### Run RLS security tests
```bash
# Run all RLS tests
npx playwright test e2e/*rls.spec.ts

# Run specific role tests
npx playwright test e2e/rep.rls.spec.ts e2e/call-transcripts.rls.spec.ts e2e/stakeholders.rls.spec.ts
npx playwright test e2e/manager.rls.spec.ts
npx playwright test e2e/admin.rls.spec.ts

# Run coaching sessions RLS tests (all roles)
npx playwright test e2e/coaching-sessions.rls.spec.ts
```

### Run tests in UI mode (recommended for development)
```bash
npx playwright test --ui
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
```

### View test report
```bash
npx playwright show-report
```

## Visual Regression Tests

### Update baseline screenshots
When UI changes are intentional, update the baseline screenshots:
```bash
npx playwright test --update-snapshots
```

### Visual test categories
- `visual/auth-visual.spec.ts` - Auth page screenshots
- `visual/components-visual.spec.ts` - Dashboard and form components
- `visual/loading-states-visual.spec.ts` - Loading, skeleton, empty, and error states
- `visual/responsive-visual.spec.ts` - Responsive layouts across viewports

### Screenshot comparison settings
- `maxDiffPixels: 100` - Allow up to 100 different pixels
- `threshold: 0.2` - Color difference threshold (0-1)
- Screenshots are stored in `e2e/__snapshots__/`

## Test Structure

### Core Test Files
- `fixtures/test-fixtures.ts` - Page objects and test utilities
- `fixtures/database-fixtures.ts` - Database helpers and assertions
- `auth.spec.ts` - Authentication flow tests
- `call-submission.spec.ts` - Call transcript submission tests
- `database-validation.spec.ts` - Database integrity and validation tests
- `navigation.spec.ts` - Navigation and routing tests

### RLS Security Tests

Row-Level Security (RLS) tests are critical for validating data isolation between users:

**Rep Role Tests:**
- `rep.rls.spec.ts` - Row-Level Security tests for prospects table
- `call-transcripts.rls.spec.ts` - Row-Level Security tests for call_transcripts table
- `stakeholders.rls.spec.ts` - Row-Level Security tests for stakeholders table

**Manager Role Tests:**
- `manager.rls.spec.ts` - Row-Level Security tests for team-based access control

**Admin Role Tests:**
- `admin.rls.spec.ts` - Row-Level Security tests for full cross-team access

**Multi-Role Table Tests:**
- `coaching-sessions.rls.spec.ts` - Row-Level Security tests for coaching_sessions table across all roles (Rep, Manager, Admin)

**What These Tests Validate:**

*For Rep Role:*
- Reps can only access their own prospects, calls, and stakeholders
- Reps cannot access data from other reps
- Direct URL manipulation cannot bypass security

*For Manager Role:*
- Managers can access their team members' data
- Managers cannot access data from other teams
- Team isolation is enforced across all resource types
- Managers cannot escalate to admin privileges

*For Admin Role:*
- Admins can access all data across all teams
- Admins can access data from all users (reps and managers)
- Admin access cannot be restricted by team-based or user-based RLS
- Admins have full visibility across the entire organization

*Common Security Checks:*
- Database-level RLS policies are correctly enforced
- Edge cases are handled securely:
  - Browser back button after redirect
  - Query parameters and bypass attempts
  - Rapid switching between authorized/unauthorized resources
  - Multiple tabs or windows
  - Session persistence
- API responses do not leak unauthorized data

**Why RLS Tests Matter:**
- Prevent privilege escalation attacks
- Ensure data privacy and compliance (team-based isolation)
- Validate that database policies match application logic
- Catch security regressions before production
- Test security at both UI and database layers
- Verify role-based access control works correctly

**Complete RLS Test Coverage:**
This test suite provides comprehensive security validation across all user roles:
- **Rep Tests**: Validate individual user isolation (my data only)
- **Manager Tests**: Validate team-based isolation (my team's data only)
- **Admin Tests**: Validate full system access (all data across all teams)
- **Cross-Role Tests**: Verify privilege escalation is prevented
- **Edge Cases**: Browser navigation, query parameters, session persistence, multiple tabs

## Writing New Tests

### Basic UI Tests

1. Import fixtures:
   ```typescript
   import { test, expect } from './fixtures/test-fixtures';
   ```

2. Use page objects for common interactions:
   ```typescript
   test('example', async ({ authPage, dashboardPage }) => {
     await authPage.goto();
     await authPage.login('user@example.com', 'password');
     await dashboardPage.fillTranscript('...');
   });
   ```

### Database Validation Tests

Use database fixtures to validate backend state:

```typescript
import { test, expect } from './fixtures/test-fixtures';

test('validate prospect creation', async ({ page, db, dbAssert }) => {
  // Get user from database
  const user = await db.getUserByEmail('test@example.com');
  
  // Perform UI actions
  await page.goto('/rep');
  // ... interact with UI
  
  // Validate database state
  const prospect = await dbAssert.expectProspectExists(user.id, 'Company Name');
  expect(prospect.status).toBe('active');
  
  // Cleanup test data
  await db.cleanupTestData(user.id, 'Test');
});
```

### Database Helper Methods

**User & Profile:**
- `getUserByEmail(email)` - Get user profile
- `getUserRole(userId)` - Get user's role

**Prospects:**
- `getProspectByName(repId, name)` - Find prospect
- `getProspectById(prospectId)` - Get prospect by ID
- `countProspects(repId)` - Count prospects

**Call Transcripts:**
- `getCallTranscriptById(callId)` - Get call
- `getCallTranscriptsByProspect(prospectId)` - Get all prospect calls
- `waitForAnalysisComplete(callId)` - Wait for AI analysis

**Follow-Ups & Activities:**
- `getFollowUps(prospectId)` - Get follow-ups
- `countPendingFollowUps(repId)` - Count pending
- `getStakeholders(prospectId)` - Get stakeholders
- `getActivities(prospectId)` - Get activities

**Coaching Sessions:**
- `getCoachingSessionById(sessionId)` - Get coaching session by ID
- `getCoachingSessionsForRep(repId)` - Get all sessions for a rep
- `countCoachingSessions(managerId)` - Count sessions created by manager

**Cleanup:**
- `cleanupTestProspects(repId, pattern)` - Remove test prospects
- `cleanupTestCalls(repId, pattern)` - Remove test calls
- `cleanupTestData(repId, pattern)` - Remove all test data

### Database Assertions

- `expectProspectExists(repId, name)` - Assert prospect exists
- `expectCallTranscriptExists(callId)` - Assert call exists
- `expectAnalysisCompleted(callId)` - Assert analysis done
- `expectFollowUpsGenerated(prospectId)` - Assert follow-ups created
- `expectStakeholderExists(prospectId, name)` - Assert stakeholder exists
- `expectUserHasRole(userId, role)` - Assert user role

## CI Integration

Tests run automatically in CI. Set these environment variables:
- `BASE_URL` - The application URL to test against
- `TEST_USER_EMAIL` - Test user email
- `TEST_USER_PASSWORD` - Test user password
- `CI=true` - Enables CI-specific settings

## Notes

- Tests requiring authentication will skip if test credentials are not configured
- Mobile viewport tests use iPhone SE dimensions (375x667)
- Screenshots are captured on test failure
