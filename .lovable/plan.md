

# Add MindForge Account Links to Reminder Emails

## Overview

Add a link to each task in the reminder emails that takes the user directly to the Account page in MindForge. This allows users to:
1. Click directly to the account
2. Use the Sales Coach to generate a recap email
3. Complete the task quickly

Currently, the email shows "Account: {name}" with an optional Salesforce link. We'll add a second link to open the account in MindForge.

---

## Current State

The `taskHtml` function currently generates:
```html
<div style="...">
  <div style="font-weight: 500;">🔴 Call John about pricing</div>
  <div style="font-size: 13px; color: #666; margin-top: 4px;">
    Account: Acme Corp <a href="salesforce-link">Open in Salesforce →</a>
  </div>
</div>
```

---

## Proposed Change

Add a MindForge account link alongside the existing Salesforce link:

```html
<div style="...">
  <div style="font-weight: 500;">🔴 Call John about pricing</div>
  <div style="font-size: 13px; color: #666; margin-top: 4px;">
    Account: <a href="https://projectmindforge.lovable.app/rep/prospects/abc123">Acme Corp</a>
    <a href="salesforce-link">Open in Salesforce →</a>
  </div>
</div>
```

The account name itself becomes a clickable link that opens the MindForge account page, making it intuitive and easy to find.

---

## Implementation

### File: `supabase/functions/send-task-reminders/index.ts`

**1. Update `taskHtml` function signature**

Add `prospectId` parameter to the function:

```typescript
function taskHtml(
  followUp: FollowUp, 
  accountName: string, 
  prospectId: string,  // NEW
  salesforceLink: string | null, 
  priorityEmoji: Record<string, string>
): string
```

**2. Update `taskHtml` function body**

Add the MindForge account link:

```typescript
function taskHtml(followUp: FollowUp, accountName: string, prospectId: string, salesforceLink: string | null, priorityEmoji: Record<string, string>): string {
  const emoji = priorityEmoji[followUp.priority] || "🔵";
  
  // MindForge account link - always available since prospect_id is required
  const mindforgeAccountUrl = `https://projectmindforge.lovable.app/rep/prospects/${prospectId}`;
  const accountNameHtml = `<a href="${mindforgeAccountUrl}" target="_blank" style="color: #6366f1; text-decoration: none; font-weight: 500;">${accountName}</a>`;
  
  const salesforceLinkHtml = salesforceLink 
    ? `<a href="${salesforceLink}" target="_blank" style="color: #6366f1; text-decoration: none; font-size: 12px; margin-left: 8px;">Open in Salesforce →</a>`
    : '';
  
  return `
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; border-left: 3px solid ${followUp.priority === "high" ? "#dc2626" : followUp.priority === "medium" ? "#d97706" : "#2563eb"};">
      <div style="font-weight: 500;">${emoji} ${followUp.title}</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">
        Account: ${accountNameHtml}${salesforceLinkHtml}
      </div>
    </div>
  `;
}
```

**3. Update all calls to `taskHtml`**

Update the three places where `taskHtml` is called (overdue, dueToday, dueTomorrow sections) to pass the `prospect_id`:

```typescript
// Before:
${reminders.overdue.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], reminders.prospectSalesforceLinks[f.prospect_id], priorityEmoji)).join("")}

// After:
${reminders.overdue.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], f.prospect_id, reminders.prospectSalesforceLinks[f.prospect_id], priorityEmoji)).join("")}
```

---

## Email Visual Preview

### Before:
```
🔴 Call John about pricing follow-up
Account: Acme Corp  Open in Salesforce →
```

### After:
```
🔴 Call John about pricing follow-up
Account: Acme Corp  Open in Salesforce →
         ↑ (clickable, opens MindForge)
```

The account name "Acme Corp" becomes a link to `/rep/prospects/{id}` styled in the primary brand color, making it clear it's clickable while keeping the layout clean.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-task-reminders/index.ts` | Update `taskHtml` function to add MindForge account link, update all three call sites |

---

## Result

1. **Direct account access** - Click the account name to go directly to the MindForge account page
2. **Sales Coach ready** - Land on the account page where Sales Coach is available to generate emails
3. **Both links available** - Salesforce link remains for CRM actions, MindForge link for AI-assisted follow-up
4. **Clean design** - Account name itself is the link, keeping the email uncluttered
5. **Rep-focused URL** - Uses `/rep/prospects/:id` since reminders go to reps

