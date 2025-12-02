# RLS Test Setup Guide

This guide helps you set up and run the comprehensive RLS security tests.

## Test Modes

The RLS tests support two modes:

- **Full Testing Mode**: When `SUPABASE_SERVICE_ROLE_KEY` is available, all tests run including database-level RLS verification
- **UI-Only Mode**: Without the service key, UI/browser security tests still run, but database-level tests are automatically skipped with clear messages

> ⚠️ **Note**: In Lovable Cloud, the service role key is not directly accessible for security reasons. This means database-level tests will be skipped, but **all UI security tests will still validate RLS policies** through browser behavior and API responses.

## Quick Setup

### Step 1: Get Your Service Role Key (Optional)

For full database-level test coverage, you need the Supabase service role key.

**Note**: This is optional. Tests will run without it, skipping only database queries.

**To get your service role key (if available):**
1. Check if it exists in your backend secrets as `SUPABASE_SERVICE_ROLE_KEY`
2. If not available, that's OK - UI tests will still run and validate security

### Step 2: Run Tests

You can run tests with or without the service role key:

#### Option A: Run Without Service Key (UI Tests Only)

```bash
# Just run the tests - database tests will skip automatically
npx playwright test e2e/coaching-sessions.rls.spec.ts

# All UI security tests will pass, database tests will show as "skipped"
```

#### Option B: Use the Test Script (With Service Key)

```bash
# Make the script executable
chmod +x scripts/run-rls-tests.sh

# Edit the script to add your service role key
# Replace 'your-service-role-key-here' with your actual key

# Run all RLS tests
./scripts/run-rls-tests.sh

# Run specific tests
./scripts/run-rls-tests.sh e2e/coaching-sessions.rls.spec.ts

# Run in UI mode
./scripts/run-rls-tests.sh --ui
```

#### Option C: Export Variables Manually (With Service Key)

```bash
# Set environment variables (copy-paste all at once)
export VITE_SUPABASE_URL="https://wuquclmippzuejqbcksl.supabase.co"
export TEST_USER_EMAIL="rep.east.1@example.com"
export TEST_USER_PASSWORD="password123"
export MANAGER_A_EMAIL="manager.east@example.com"
export MANAGER_A_PASSWORD="password123"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="password123"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run tests
npx playwright test e2e/*rls.spec.ts
```

#### Option D: One-Line Command (With Service Key)

```bash
SUPABASE_SERVICE_ROLE_KEY="your-key" TEST_USER_EMAIL="rep.east.1@example.com" TEST_USER_PASSWORD="password123" MANAGER_A_EMAIL="manager.east@example.com" MANAGER_A_PASSWORD="password123" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="password123" npx playwright test e2e/*rls.spec.ts
```

## Test Coverage

### All RLS Tests (~100+ test cases)
```bash
npx playwright test e2e/*rls.spec.ts
```

### By Role
```bash
# Rep tests (prospects, calls, stakeholders)
npx playwright test e2e/rep.rls.spec.ts e2e/call-transcripts.rls.spec.ts e2e/stakeholders.rls.spec.ts

# Manager tests (team-based access)
npx playwright test e2e/manager.rls.spec.ts

# Admin tests (cross-team access)
npx playwright test e2e/admin.rls.spec.ts

# Coaching sessions (all roles)
npx playwright test e2e/coaching-sessions.rls.spec.ts
```

### Run in UI Mode (Recommended for First Run)
```bash
npx playwright test e2e/*rls.spec.ts --ui
```

## Test Users (Demo Data)

These users should already exist in your database:

| Role    | Email                    | Password    | Team          |
|---------|--------------------------|-------------|---------------|
| Rep     | rep.east.1@example.com   | password123 | Enterprise East |
| Rep     | rep.west.1@example.com   | password123 | Enterprise West |
| Manager | manager.east@example.com | password123 | Enterprise East |
| Manager | manager.west@example.com | password123 | Enterprise West |
| Admin   | admin@example.com        | password123 | N/A           |

## Troubleshooting

### "Database operations require SUPABASE_SERVICE_ROLE_KEY" (Skipped Tests)
- This is expected if you don't have the service role key
- UI tests still validate security - database tests are just extra verification
- If you see this message, most tests should still pass (only DB queries skip)

### Error: "Missing Supabase credentials"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set if you want full test coverage
- Check that the key is correct (no extra spaces)
- Or just run without it - UI tests will still validate RLS

### Error: "User not found" or "Invalid login credentials"
- Verify demo users exist in your database
- Check that passwords match the seeded data
- Run the demo data seed script if needed

### Tests Fail on "Session not found"
- Ensure coaching sessions exist with the expected IDs
- Check that the test IDs in the spec files match your database

### Connection Timeouts
- Make sure your app is running: `npm run dev`
- Check that Supabase project is accessible
- Verify network connectivity

## Security Note

⚠️ **Never commit your service role key to version control!**

The test script uses environment variables to keep credentials secure. The service role key should always remain secret.

## Next Steps

After tests pass:
- Review the test output for any warnings
- Check coverage reports
- Update test data if needed
- Add new RLS tests for new features
