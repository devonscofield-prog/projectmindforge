

# Add Rate Limiting to All Unprotected Backend Functions

## Overview

A security audit found that 24+ backend functions lack rate limiting, leaving them vulnerable to abuse (API cost exhaustion, denial-of-service, brute-force attacks). This plan adds rate limiting to every unprotected function using the existing shared pattern.

## Functions to Update

The functions fall into three categories based on risk and appropriate limits:

### High Priority -- User-Facing AI Functions (expensive per call)
These call AI APIs and are the most costly to abuse.

| Function | Limit | Window |
|---|---|---|
| account-research | 10 req | 1 min |
| competitor-research | 10 req | 1 min |
| generate-sales-assets | 10 req | 1 min |
| generate-call-follow-up-suggestions | 10 req | 1 min |
| roleplay-grade-session | 10 req | 1 min |
| calculate-deal-heat | 10 req | 1 min |
| calculate-account-heat | 10 req | 1 min |
| analyze-performance | 10 req | 1 min |

### Medium Priority -- Auth/Admin Functions (security-sensitive)
These modify user accounts and should have stricter limits.

| Function | Limit | Window |
|---|---|---|
| generate-password-reset-otp | 5 req | 15 min |
| complete-password-reset | 5 req | 15 min |
| invite-user | 10 req | 1 min |
| delete-user | 5 req | 1 min |
| set-user-password | 5 req | 1 min |
| reset-user-password | 5 req | 1 min |
| admin-reset-mfa | 5 req | 1 min |
| seed-demo-data | 3 req | 1 min |
| reanalyze-call | 10 req | 1 min |
| reset-test-passwords | 3 req | 1 min |
| unsubscribe-report | 10 req | 1 min |
| upload-product-knowledge | 10 req | 1 min |

### Lower Priority -- Background/Cron Functions (verify_jwt = false)
These are typically called by cron jobs or internal services. Rate limiting by IP/source adds a safety net.

| Function | Limit | Window |
|---|---|---|
| scrape-product-knowledge | 5 req | 1 min |
| process-product-knowledge | 5 req | 1 min |
| submit-call-transcript | 20 req | 1 min |
| send-task-reminders | 5 req | 1 min |
| send-daily-report | 5 req | 1 min |
| trigger-pending-analyses | 5 req | 1 min |
| cleanup-stuck-sessions | 5 req | 1 min |
| roleplay-abandon-session | 10 req | 1 min |
| send-performance-alert | 10 req | 1 min |
| check-performance-alerts | 5 req | 1 min |

## Implementation Approach

Each function will get the same inline rate-limiting pattern already used throughout the codebase (in-memory Map with sliding window). The pattern is:

1. Add rate limit constants and the `checkRateLimit` function at the top of the file
2. Extract user ID from the JWT token (for authenticated functions) or use a fallback identifier like IP or "cron" for unauthenticated functions
3. Check rate limit early in the request handler, returning 429 with `Retry-After` header if exceeded

No new shared modules or dependencies are needed -- each function gets a self-contained rate limiter matching the existing convention.

## Technical Details

For **authenticated functions** (verify_jwt = true), the user ID is extracted from the JWT:
```text
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '') || '';
let userId = 'anonymous';
try {
  const payload = JSON.parse(atob(token.split('.')[1]));
  userId = payload.sub || 'anonymous';
} catch { /* use anonymous */ }
```

For **unauthenticated/cron functions** (verify_jwt = false), rate limiting uses a global key:
```text
const rateLimitKey = 'global'; // or extract from x-forwarded-for header
```

The 429 response format is consistent:
```text
{ "error": "Rate limit exceeded. Please try again later." }
Headers: Retry-After: <seconds>
```

## Scope

- ~30 edge function files modified (adding rate limiting code)
- No database changes
- No frontend changes
- No new dependencies

