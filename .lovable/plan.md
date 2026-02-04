

# Improve Chat Input Fields for Longer Prompts

## Overview

Currently, all three chat components use a single-line `<Input>` component that only shows about one line of text at a time. This makes it difficult to see what you've typed, especially for longer prompts loaded from suggestions.

The solution is to replace the `<Input>` components with auto-expanding `<Textarea>` components that:
- Start at a single line height (similar to current behavior)
- Automatically expand as you type more content (up to a maximum height)
- Support Shift+Enter for new lines
- Submit on Enter (without Shift)

---

## Implementation Plan

### 1. Sales Coach Chat

**File**: `src/components/prospects/SalesCoachChat.tsx`

Changes needed:
- Import `Textarea` instead of/alongside `Input`
- Replace the `<Input>` with a `<Textarea>`
- Add auto-resize logic using a `useEffect` or `useCallback`
- Update the ref type from `HTMLInputElement` to `HTMLTextAreaElement`
- Adjust container styling to accommodate multi-line input

The textarea will:
- Start at ~40px height (single line)
- Expand automatically up to ~120px (about 4-5 lines)
- Use `resize-none` to prevent manual resizing
- Have `rows={1}` as the initial row count

### 2. Sales Assistant Chat

**File**: `src/components/SalesAssistantChat.tsx`

Same changes:
- Replace `<Input>` with auto-expanding `<Textarea>`
- Update ref type
- Adjust container for flex alignment

### 3. Transcript Chat Input (for consistency)

**File**: `src/components/admin/transcript-chat/ChatInput.tsx`

Same pattern:
- Replace `<Input>` with auto-expanding `<Textarea>`
- Update the `inputRef` prop type in the interface

---

## Technical Details

### Auto-Resize Logic

Each textarea will use a simple auto-resize pattern:

```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null);

// Auto-resize on input change
useEffect(() => {
  const textarea = textareaRef.current;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }
}, [input]);
```

### Keyboard Handling

The existing `handleKeyDown` logic already handles Enter to submit. We need to add Shift+Enter support for new lines:

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit(e);
  }
  // Shift+Enter allows new line (default textarea behavior)
};
```

### Textarea Styling

```tsx
<Textarea
  ref={textareaRef}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Ask your sales coach..."
  disabled={isLoading || isRateLimited}
  rows={1}
  className="flex-1 min-h-[40px] max-h-[120px] border-0 bg-transparent 
             focus-visible:ring-0 focus-visible:ring-offset-0 
             placeholder:text-muted-foreground/60 resize-none py-2.5"
/>
```

### Container Adjustment

Change the flex container from `items-center` to `items-end` so the send button aligns to the bottom as the textarea expands:

```tsx
<div className="flex gap-2.5 items-end bg-muted/30 rounded-xl p-1.5 ...">
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/prospects/SalesCoachChat.tsx` | Replace Input with auto-expanding Textarea, update ref type, add resize logic |
| `src/components/SalesAssistantChat.tsx` | Replace Input with auto-expanding Textarea, update ref type, add resize logic |
| `src/components/admin/transcript-chat/ChatInput.tsx` | Replace Input with auto-expanding Textarea, update prop types |

---

## User Experience

**Before:**
- Single-line input that scrolls horizontally
- Hard to see full prompt content
- Can't add line breaks

**After:**
- Multi-line textarea that grows with content
- See up to 4-5 lines at once
- Shift+Enter creates new lines
- Enter still submits the message
- Better visibility of loaded suggestion prompts

---

## Result

1. **Better visibility** - Users can see up to 4-5 lines of their prompt at once
2. **Multi-line support** - Shift+Enter allows line breaks for structured prompts
3. **Consistent behavior** - All three chat components work the same way
4. **Maintained aesthetics** - Same premium styling, just taller when needed

