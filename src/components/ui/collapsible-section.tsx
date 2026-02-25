import { useState, memo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// Button available if needed
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Only collapse on mobile (md:always open) */
  mobileOnly?: boolean;
}

export const CollapsibleSection = memo(function CollapsibleSection({
  title,
  description,
  icon,
  badge,
  action,
  children,
  defaultOpen = false,
  className,
  mobileOnly = true,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (mobileOnly) {
    return (
      <Card className={className}>
        {/* Desktop: Always show content */}
        <div className="hidden md:block">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                {icon}
                {title}
                {badge}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {action}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </div>

        {/* Mobile: Collapsible */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="md:hidden">
          <CardHeader className="p-4">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    <span className="truncate">{title}</span>
                    {badge}
                  </CardTitle>
                  {description && (
                    <CardDescription className="text-xs mt-1 line-clamp-1">
                      {description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Always collapsible (both mobile and desktop)
  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  {icon}
                  <span className="truncate">{title}</span>
                  {badge}
                </CardTitle>
                {description && (
                  <CardDescription className="text-xs mt-1 line-clamp-1">
                    {description}
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});
