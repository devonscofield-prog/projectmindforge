# Component Library

This document provides a comprehensive reference for all reusable components.

## Table of Contents

- [UI Components](#ui-components)
- [Layout Components](#layout-components)
- [Form Components](#form-components)
- [Data Display Components](#data-display-components)
- [Feedback Components](#feedback-components)

---

## UI Components

All base UI components are built on [shadcn/ui](https://ui.shadcn.com/) and located in `src/components/ui/`.

### Button

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// Loading state
<Button disabled={isPending}>
  {isPending && <Loader2 className="animate-spin mr-2" />}
  Save
</Button>
```

### Card

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Dialog

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Description of what this dialog does.
      </DialogDescription>
    </DialogHeader>
    <div>Dialog body content</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Sheet (Side Panel)

```tsx
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button>Open Panel</Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>Panel Title</SheetTitle>
      <SheetDescription>Panel description</SheetDescription>
    </SheetHeader>
    <div>Panel content</div>
  </SheetContent>
</Sheet>
```

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="details">Details content</TabsContent>
  <TabsContent value="settings">Settings content</TabsContent>
</Tabs>
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
```

### StatusBadge

Custom status badge with semantic colors.

```tsx
import { StatusBadge } from '@/components/ui/status-badge';

<StatusBadge status="active" />
<StatusBadge status="pending" />
<StatusBadge status="completed" />
<StatusBadge status="error" />
```

### KPICard

Display key performance indicators.

```tsx
import { KPICard } from '@/components/ui/kpi-card';

<KPICard
  title="Total Revenue"
  value="$125,000"
  change="+12.5%"
  trend="up"
  icon={<DollarSign />}
/>
```

---

## Layout Components

### AppLayout

Main application layout with sidebar navigation.

```tsx
import { AppLayout } from '@/components/layout/AppLayout';

<AppLayout>
  <PageContent />
</AppLayout>
```

### MobileBottomNav

Mobile navigation bar (renders only on mobile).

```tsx
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

// Automatically included in AppLayout
```

### CollapsibleSection

Expandable/collapsible content section.

```tsx
import { CollapsibleSection } from '@/components/ui/collapsible-section';

<CollapsibleSection 
  title="Advanced Options" 
  defaultOpen={false}
>
  <div>Hidden content revealed on expand</div>
</CollapsibleSection>
```

---

## Form Components

### Input

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email"
    type="email"
    placeholder="Enter email"
    value={value}
    onChange={(e) => setValue(e.target.value)}
  />
</div>
```

### Select

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### AccountCombobox

Searchable account/prospect selector.

```tsx
import { AccountCombobox } from '@/components/forms/AccountCombobox';

<AccountCombobox
  value={selectedAccountId}
  onValueChange={setSelectedAccountId}
  repId={currentRepId}
/>
```

### StakeholderCombobox

Searchable stakeholder selector.

```tsx
import { StakeholderCombobox } from '@/components/forms/StakeholderCombobox';

<StakeholderCombobox
  value={selectedStakeholderId}
  onValueChange={setSelectedStakeholderId}
  prospectId={prospectId}
/>
```

### Form with React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Your full name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

## Data Display Components

### Table

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><StatusBadge status={item.status} /></TableCell>
        <TableCell>
          <Button size="sm">Edit</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### PaginationControls

Pagination with page size selector.

```tsx
import { PaginationControls } from '@/components/ui/pagination-controls';

<PaginationControls
  currentPage={page}
  totalPages={totalPages}
  pageSize={pageSize}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

### EmptyState

Display when no data is available.

```tsx
import { EmptyState } from '@/components/ui/empty-state';

<EmptyState
  icon={<FileSearch className="h-12 w-12" />}
  title="No results found"
  description="Try adjusting your search or filters"
  action={
    <Button onClick={clearFilters}>Clear Filters</Button>
  }
/>
```

### Skeleton Loading States

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TableSkeleton,
  CardSkeleton,
  FormSkeleton 
} from '@/components/ui/skeletons';

// Basic skeleton
<Skeleton className="h-4 w-[200px]" />

// Table skeleton
<TableSkeleton rows={5} columns={4} />

// Card skeleton
<CardSkeleton />
```

---

## Feedback Components

### Toast Notifications

```tsx
import { toast } from 'sonner';

// Success
toast.success('Changes saved successfully');

// Error
toast.error('Failed to save changes');

// Warning
toast.warning('Please review before continuing');

// Info
toast.info('New updates available');

// With description
toast.success('Profile updated', {
  description: 'Your changes have been saved',
});

// With action
toast.error('Failed to save', {
  action: {
    label: 'Retry',
    onClick: () => handleRetry(),
  },
});
```

### Progress Bar

```tsx
import { Progress } from '@/components/ui/progress';

<Progress value={75} className="w-full" />
```

### ProgressBar (Custom)

```tsx
import { ProgressBar } from '@/components/ui/progress-bar';

<ProgressBar 
  value={75} 
  max={100}
  label="Completion"
  showPercentage
/>
```

### RateLimitCountdown

Display time remaining until rate limit resets.

```tsx
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';

<RateLimitCountdown 
  resetTime={rateLimitResetTime}
  onReset={() => setCanRetry(true)}
/>
```

---

## Error Boundaries

### ComponentErrorBoundary

Catch errors in a component tree.

```tsx
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';

<ComponentErrorBoundary
  fallback={<div>Something went wrong</div>}
  onReset={() => window.location.reload()}
>
  <PotentiallyFailingComponent />
</ComponentErrorBoundary>
```

### QueryErrorBoundary

Error boundary integrated with React Query.

```tsx
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';

<QueryErrorBoundary>
  <ComponentUsingQueries />
</QueryErrorBoundary>
```

---

## Navigation Components

### PreloadLink

Link that preloads route on hover.

```tsx
import { PreloadLink } from '@/components/PreloadLink';

<PreloadLink to="/rep/prospects" className="nav-link">
  Prospects
</PreloadLink>
```

### NavLink

Navigation link with active state styling.

```tsx
import { NavLink } from '@/components/NavLink';

<NavLink 
  to="/dashboard" 
  icon={<Home />}
>
  Dashboard
</NavLink>
```

---

## Coaching Components

### CoachingPatternCard

Display a coaching pattern with trends.

```tsx
import { CoachingPatternCard } from '@/components/coaching/CoachingPatternCard';

<CoachingPatternCard
  title="Discovery Questions"
  score={7.5}
  previousScore={6.8}
  trend="improving"
  insights={['Good open-ended questions', 'Need more follow-up']}
/>
```

### TrendCard

Display metric with trend indicator.

```tsx
import { TrendCard } from '@/components/coaching/TrendCard';

<TrendCard
  title="Call Score"
  value={8.2}
  previousValue={7.5}
  format="number"
/>
```

---

## Prospect Components

### StakeholderCard

Display stakeholder information.

```tsx
import { StakeholderCard } from '@/components/prospects/StakeholderCard';

<StakeholderCard
  stakeholder={stakeholder}
  onEdit={() => setEditing(true)}
  onViewDetails={() => setDetailsOpen(true)}
/>
```

### FollowUpItem

Display a follow-up with actions.

```tsx
import { FollowUpItem } from '@/components/prospects/FollowUpItem';

<FollowUpItem
  followUp={followUp}
  onComplete={handleComplete}
  onDismiss={handleDismiss}
/>
```

### StakeholderRelationshipMap

Visual relationship map between stakeholders.

```tsx
import { StakeholderRelationshipMap } from '@/components/prospects/StakeholderRelationshipMap';

<StakeholderRelationshipMap
  stakeholders={stakeholders}
  relationships={relationships}
/>
```

---

## Mobile Components

### MobileCallCard

Call card optimized for mobile display.

```tsx
import { MobileCallCard } from '@/components/calls/MobileCallCard';

<MobileCallCard
  call={call}
  onClick={() => navigate(`/calls/${call.id}`)}
/>
```

### MobileProspectCard

Prospect card optimized for mobile.

```tsx
import { MobileProspectCard } from '@/components/prospects/MobileProspectCard';

<MobileProspectCard
  prospect={prospect}
  onTap={() => navigate(`/rep/prospects/${prospect.id}`)}
/>
```

### SwipeableCard

Card with swipe gestures for actions.

```tsx
import { SwipeableCard } from '@/components/ui/swipeable-card';

<SwipeableCard
  onSwipeLeft={() => handleDismiss()}
  onSwipeRight={() => handleComplete()}
  leftAction={<X className="text-destructive" />}
  rightAction={<Check className="text-success" />}
>
  <CardContent />
</SwipeableCard>
```

### PullToRefresh

Pull-to-refresh gesture handler.

```tsx
import { PullToRefresh } from '@/components/ui/pull-to-refresh';

<PullToRefresh onRefresh={async () => await refetchData()}>
  <ScrollableContent />
</PullToRefresh>
```

---

## Design System

### Using Design Tokens

Always use semantic design tokens from the design system:

```tsx
// ✅ Correct - using semantic tokens
<div className="bg-background text-foreground">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// ❌ Wrong - hardcoded colors
<div className="bg-white text-black">
  <h1 className="text-blue-500">Title</h1>
</div>
```

### Available Tokens

| Token | Usage |
|-------|-------|
| `background` | Page/card backgrounds |
| `foreground` | Primary text color |
| `primary` | Brand color, CTAs |
| `primary-foreground` | Text on primary |
| `secondary` | Secondary UI elements |
| `muted` | Muted backgrounds |
| `muted-foreground` | Secondary text |
| `accent` | Accent elements |
| `destructive` | Error/danger states |
| `border` | Border color |
| `ring` | Focus ring color |
