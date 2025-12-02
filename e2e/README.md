# E2E Tests

This directory contains end-to-end tests using Playwright, including visual regression tests.

## Prerequisites

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Set up test environment variables:
   ```bash
   export TEST_USER_EMAIL="your-test-user@example.com"
   export TEST_USER_PASSWORD="your-test-password"
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
npx playwright test e2e/rep.rls.spec.ts e2e/call-transcripts.rls.spec.ts
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
- `rep.rls.spec.ts` - Row-Level Security tests for prospects table
- `call-transcripts.rls.spec.ts` - Row-Level Security tests for call_transcripts table

These tests validate that:
- Users can only access their own data
- Direct URL manipulation cannot bypass security
- Database-level RLS policies are correctly enforced
- Edge cases (back button, query params, rapid attempts) are handled securely

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
