import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TalkRatioBar({ repPercentage }: { repPercentage: number }) {
  const prospectPercentage = 100 - repPercentage;
  const isIdeal = repPercentage >= 40 && repPercentage <= 60;

  return (
    <div className="space-y-2">
      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Rep: {repPercentage}%</span>
        <span className="text-muted-foreground">Prospect: {prospectPercentage}%</span>
      </div>

      {/* Stacked Bar with Ideal Range Labels */}
      <div className="relative">
        {/* Range Labels Above Bar */}
        <div className="relative h-4 mb-1">
          <span
            className="absolute text-[10px] text-muted-foreground/70 -translate-x-1/2"
            style={{ left: '40%' }}
          >
            40%
          </span>
          <span
            className="absolute text-[10px] text-muted-foreground/70 -translate-x-1/2"
            style={{ left: '60%' }}
          >
            60%
          </span>
        </div>

        <div className="relative h-6 w-full rounded-full bg-secondary overflow-hidden">
          {/* Rep portion */}
          <div
            className={cn(
              "absolute left-0 top-0 h-full transition-all",
              repPercentage > 60 ? "bg-orange-500" : repPercentage < 40 ? "bg-yellow-500" : "bg-primary"
            )}
            style={{ width: `${repPercentage}%` }}
          />
          {/* Prospect portion */}
          <div
            className="absolute right-0 top-0 h-full bg-green-500/80"
            style={{ width: `${prospectPercentage}%` }}
          />

          {/* Ideal Range Markers (40-60%) */}
          <div
            className="absolute top-0 h-full border-l-2 border-dashed border-foreground/50"
            style={{ left: '40%' }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 h-full border-l-2 border-dashed border-foreground/50"
            style={{ left: '60%' }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Ideal Range Label */}
      <div className="flex justify-center">
        <Badge variant={isIdeal ? "default" : "secondary"} className={cn(
          "text-xs",
          isIdeal && "bg-green-500 hover:bg-green-600"
        )}>
          {isIdeal ? "✓ Ideal Range" : "Target: 40-60%"}
        </Badge>
      </div>
    </div>
  );
}
