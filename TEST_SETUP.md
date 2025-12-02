# RLS Test Setup Guide

This guide helps you set up and run the comprehensive RLS security tests.

## Quick Setup

### Step 1: Get Your Service Role Key

You need the Supabase service role key for database-level test validation.

**To get your service role key:**
1. The key is already stored as a secret in your Lovable Cloud backend
2. You can find it in the secrets: `SUPABASE_SERVICE_ROLE_KEY`
3. Copy the value to use in your test environment

### Step 2: Run Tests

#### Option A: Use the Test Script (Easiest)

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

#### Option B: Export Variables Manually

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

#### Option C: One-Line Command

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

### Error: "Missing Supabase credentials"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set
- Check that the key is correct (no extra spaces)

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
