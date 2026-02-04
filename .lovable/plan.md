

# Load Prompts into Input Instead of Auto-Submitting

## Overview

When users click on suggested questions or quick actions in the Sales Coach chat, the prompt will be loaded into the input field instead of being sent immediately. This allows users to:
- Review the prompt before sending
- Edit or customize the prompt to their needs
- Feel more in control of the conversation

For consistency, I'll also apply this change to the Sales Assistant chat.

---

## Changes

### Sales Coach Chat

**File**: `src/components/prospects/SalesCoachChat.tsx`

There are three areas where clicking sends a message immediately that need to be updated:

1. **Quick Action Buttons** (line 703)
   - Current: `onClick={() => sendMessage(action.prompt)}`
   - New: `onClick={() => setInput(action.prompt)}`

2. **Recently Asked Questions** (line 728)
   - Current: `onClick={() => sendMessage(q)}`
   - New: `onClick={() => setInput(q)}`

3. **Category Questions** (line 781)
   - Current: `onClick={() => sendMessage(q)}`
   - New: `onClick={() => setInput(q)}`

Additionally, I'll add automatic focus to the input field after populating it so users can immediately review and send.

### Sales Assistant Chat

**File**: `src/components/SalesAssistantChat.tsx`

For consistency, update the quick action handler:

- Current (line 277-279):
  ```typescript
  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };
  ```
- New:
  ```typescript
  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
    inputRef.current?.focus();
  };
  ```

---

## Technical Details

### Helper Function (Optional Enhancement)

To ensure the input field is focused after loading a prompt, I'll create a simple helper:

```typescript
const loadPromptToInput = (prompt: string) => {
  setInput(prompt);
  // Focus the input so user can review/edit/send
  setTimeout(() => inputRef.current?.focus(), 50);
};
```

This can be used across all the click handlers for consistency.

---

## User Experience

**Before:**
1. User sees suggested question
2. User clicks → Message immediately sent
3. User waits for AI response

**After:**
1. User sees suggested question
2. User clicks → Prompt appears in input field
3. User reviews/edits the prompt (optional)
4. User presses Enter or clicks Send
5. User waits for AI response

This gives users more control and reduces the chance of accidentally sending a message they didn't intend to.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/prospects/SalesCoachChat.tsx` | Update 3 onClick handlers to use `setInput()` instead of `sendMessage()` |
| `src/components/SalesAssistantChat.tsx` | Update `handleQuickAction` to use `setInput()` instead of `sendMessage()` |

---

## Result

- Clicking any suggested question loads it into the input field
- Input field automatically receives focus
- User can edit the prompt before sending
- User sends the message by pressing Enter or clicking Send
- Both Sales Coach and Sales Assistant behave consistently

