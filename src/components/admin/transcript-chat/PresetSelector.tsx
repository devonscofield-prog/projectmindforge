import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Layers, ArrowRight, Loader2, Share2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { MODE_PRESETS, getAnalysisModeById } from '../transcript-analysis/analysisModesConfig';
import { getIconComponent } from '../CreateCustomPresetDialog';
import type { ModePreset } from '../transcript-analysis/analysisModesConfig';
import type { CustomPreset } from '@/api/customPresets';

interface PresetSelectorProps {
  customPresets: CustomPreset[];
  isLoadingPresets: boolean;
  isLoading: boolean;
  isRateLimited: boolean;
  onPresetSelect: (preset: ModePreset) => void;
  onCustomPresetSelect: (preset: CustomPreset) => void;
  onCreatePreset: () => void;
  onEditPreset: (preset: CustomPreset) => void;
  onDeletePreset: (id: string) => void;
}

export function PresetSelector({
  customPresets,
  isLoadingPresets,
  isLoading,
  isRateLimited,
  onPresetSelect,
  onCustomPresetSelect,
  onCreatePreset,
  onEditPreset,
  onDeletePreset,
}: PresetSelectorProps) {
  return (
    <>
      {/* Built-in Presets */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
          <Layers className="h-3 w-3" />
          Comprehensive Reviews
        </p>
        <div className="grid gap-2">
          {MODE_PRESETS.map((preset) => {
            const PresetIcon = preset.icon;
            return (
              <button
                key={preset.id}
                onClick={() => onPresetSelect(preset)}
                disabled={isLoading || isRateLimited}
                className="flex items-start gap-3 p-3 text-left rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                <PresetIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{preset.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground block mt-0.5">{preset.description}</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {preset.modeIds.map(id => {
                      const mode = getAnalysisModeById(id);
                      if (!mode) return null;
                      const MIcon = mode.icon;
                      return (
                        <Badge key={id} variant="outline" className="text-[10px] py-0 gap-0.5">
                          <MIcon className="h-2.5 w-2.5" />
                          {mode.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
            <Plus className="h-3 w-3" />
            My Custom Presets
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreatePreset}
            className="h-6 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>
        
        {isLoadingPresets ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : customPresets.length === 0 ? (
          <button
            onClick={onCreatePreset}
            className="w-full flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground rounded-lg border border-dashed hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first custom preset
          </button>
        ) : (
          <div className="grid gap-2">
            {customPresets.map((preset) => {
              const PresetIcon = getIconComponent(preset.icon_name);
              return (
                <div
                  key={preset.id}
                  className="flex items-start gap-3 p-3 text-left rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <button
                    onClick={() => onCustomPresetSelect(preset)}
                    disabled={isLoading || isRateLimited}
                    className="flex-1 flex items-start gap-3 text-left disabled:opacity-50"
                  >
                    <PresetIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{preset.name}</span>
                        {preset.is_shared && (
                          <Share2 className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      {preset.description && (
                        <span className="text-xs text-muted-foreground block mt-0.5">{preset.description}</span>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {preset.mode_ids.map(id => {
                          const mode = getAnalysisModeById(id);
                          if (!mode) return null;
                          const MIcon = mode.icon;
                          return (
                            <Badge key={id} variant="outline" className="text-[10px] py-0 gap-0.5">
                              <MIcon className="h-2.5 w-2.5" />
                              {mode.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditPreset(preset)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeletePreset(preset.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
