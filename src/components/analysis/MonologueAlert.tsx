import { AlertTriangle } from 'lucide-react';

interface MonologueAlertProps {
  violationCount: number;
  longestTurnWords: number;
}

export function MonologueAlert({ violationCount, longestTurnWords }: MonologueAlertProps) {
  return (
    <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-orange-700 dark:text-orange-400">
            Monologue Warning
          </h4>
          <p className="text-sm text-orange-600 dark:text-orange-300">
            {violationCount} monologue{violationCount > 1 ? 's' : ''} detected •
            Longest turn: {longestTurnWords} words
          </p>
        </div>
      </div>
    </div>
  );
}
