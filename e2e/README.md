# E2E Tests

This directory contains end-to-end tests using Playwright, including visual regression tests.

## Prerequisites

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Set up test environment variables (optional):
   ```bash
   export TEST_USER_EMAIL="your-test-user@example.com"
   export TEST_USER_PASSWORD="your-test-password"
   ```

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

- `fixtures/test-fixtures.ts` - Page objects and test utilities
- `auth.spec.ts` - Authentication flow tests
- `call-submission.spec.ts` - Call transcript submission tests
- `navigation.spec.ts` - Navigation and routing tests

## Writing New Tests

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
