import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { ANALYSIS_MODES } from '../transcript-analysis/analysisModesConfig';
import type { AnalysisMode, ModePreset } from '../transcript-analysis/analysisModesConfig';

interface ModeSelectorProps {
  selectedMode: AnalysisMode;
  activePreset: ModePreset | null;
  onModeChange: (modeId: string) => void;
}

export function ModeSelector({ selectedMode, activePreset, onModeChange }: ModeSelectorProps) {
  const ModeIcon = selectedMode.icon;

  return (
    <div className="pt-2">
      <Select value={selectedMode.id} onValueChange={onModeChange}>
        <SelectTrigger className="w-full bg-muted/50">
          <div className="flex items-center gap-2">
            <ModeIcon className="h-4 w-4 text-primary" />
            <SelectValue placeholder="Select analysis mode" />
            {activePreset && (
              <Badge variant="secondary" className="ml-auto text-xs">
                <Layers className="h-3 w-3 mr-1" />
                {activePreset.label}
              </Badge>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {ANALYSIS_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <SelectItem key={mode.id} value={mode.id}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span>{mode.label}</span>
                    <span className="text-xs text-muted-foreground">{mode.description}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
