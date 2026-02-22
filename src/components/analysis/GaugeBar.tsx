import { cn } from '@/lib/utils';

interface GaugeBarProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  colorThresholds?: { good: number; fair: number };
}

export function GaugeBar({ value, max, label, sublabel, icon, colorThresholds }: GaugeBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const thresholds = colorThresholds ?? { good: 70, fair: 40 };

  const getColor = () => {
    if (percentage >= thresholds.good) return 'bg-green-500';
    if (percentage >= thresholds.fair) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold">{value}/{max}</span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
