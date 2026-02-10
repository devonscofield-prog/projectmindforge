

# Fix: Change Daily Report Delivery Time to 5 PM

## Problem
The daily report config has `delivery_time` set to `08:00` (8 AM), so the report fires before any calls have happened that day, resulting in an empty email. It should be `17:00` (5 PM) to recap the day's calls.

## Fix
Update the `daily_report_configs` row to set `delivery_time = '17:00'`.

This is a single SQL update -- no code changes needed. The edge function already correctly matches the user's local hour against `delivery_time`, so changing the value is all that's required.

## Technical Details

Run the following update:

```sql
UPDATE daily_report_configs
SET delivery_time = '17:00', updated_at = now()
WHERE user_id = 'af4e7fe0-2165-4530-893b-0f665dfacd20';
```

Alternatively, you can change this yourself in the app under **Reporting > Daily Email** settings -- just switch the delivery time dropdown to 5:00 PM.

No edge function or frontend code changes are needed.
