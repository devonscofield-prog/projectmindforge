import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, User, Crown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { listStakeholdersForProspect, influenceLevelOptions, influenceLevelLabels, type StakeholderInfluenceLevel } from '@/api/stakeholders';
import type { StakeholderEntry } from '@/api/aiCallAnalysis/types';

const MAX_STAKEHOLDERS = 10;

// Normalize stakeholder name: trim and collapse whitespace
const normalizeName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ');
};

interface MultiStakeholderSelectorProps {
  prospectId: string | null;
  stakeholders: StakeholderEntry[];
  onChange: (stakeholders: StakeholderEntry[]) => void;
  disabled?: boolean;
}

export function MultiStakeholderSelector({
  prospectId,
  stakeholders,
  onChange,
  disabled = false,
}: MultiStakeholderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [pendingInfluenceLevel, setPendingInfluenceLevel] = useState<StakeholderInfluenceLevel>('light_influencer');

  // Fetch existing stakeholders for this account
  const { data: existingStakeholders = [], isLoading } = useQuery({
    queryKey: ['prospect-stakeholders', prospectId],
    queryFn: () => listStakeholdersForProspect(prospectId!),
    enabled: !!prospectId,
    staleTime: 2 * 60 * 1000,
  });

  // Check if max stakeholders reached
  const isMaxReached = stakeholders.length >= MAX_STAKEHOLDERS;

  // Filter out already-added stakeholders with normalized comparison
  const availableStakeholders = existingStakeholders.filter(
    es => !stakeholders.some(s => 
      s.stakeholderId === es.id || 
      normalizeName(s.stakeholderName).toLowerCase() === normalizeName(es.name).toLowerCase()
    )
  );

  const filteredStakeholders = availableStakeholders.filter(s =>
    !searchValue || normalizeName(s.name).toLowerCase().includes(normalizeName(searchValue).toLowerCase())
  );

  const normalizedSearchValue = normalizeName(searchValue);
  const isNewStakeholder = normalizedSearchValue && 
    !existingStakeholders.some(s => normalizeName(s.name).toLowerCase() === normalizedSearchValue.toLowerCase()) &&
    !stakeholders.some(s => normalizeName(s.stakeholderName).toLowerCase() === normalizedSearchValue.toLowerCase());

  const handleAddStakeholder = (name: string, id: string | null) => {
    if (isMaxReached) return;
    const newEntry: StakeholderEntry = {
      stakeholderId: id,
      stakeholderName: normalizeName(name),
      influenceLevel: pendingInfluenceLevel,
    };
    onChange([...stakeholders, newEntry]);
    setSearchValue('');
    setOpen(false);
    setPendingInfluenceLevel('light_influencer');
  };

  const handleRemoveStakeholder = (index: number) => {
    onChange(stakeholders.filter((_, i) => i !== index));
  };

  const handleUpdateInfluenceLevel = (index: number, level: StakeholderInfluenceLevel) => {
    const updated = [...stakeholders];
    updated[index] = { ...updated[index], influenceLevel: level };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Added stakeholders list */}
      {stakeholders.length > 0 && (
        <div className="space-y-2">
          {stakeholders.map((stakeholder, index) => (
            <div 
              key={`${stakeholder.stakeholderName}-${index}`}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
            >
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0 truncate font-medium">
                {stakeholder.stakeholderName}
              </span>
              {!stakeholder.stakeholderId && (
                <Badge variant="outline" className="shrink-0 text-xs">new</Badge>
              )}
              {index === 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="shrink-0 text-xs cursor-help">Primary</Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">The primary stakeholder is the main point of contact for follow-ups and recap emails.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Select
                value={stakeholder.influenceLevel}
                onValueChange={(v) => handleUpdateInfluenceLevel(index, v as StakeholderInfluenceLevel)}
                disabled={disabled}
              >
                <SelectTrigger className="w-[130px] h-8 shrink-0" aria-label="Stakeholder role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {influenceLevelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleRemoveStakeholder(index)}
                disabled={disabled}
                aria-label={`Remove ${stakeholder.stakeholderName}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add stakeholder row */}
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-label="Add stakeholder"
                className="w-full justify-between font-normal"
                disabled={disabled || isMaxReached}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  Add stakeholder...
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder={!prospectId ? "Type stakeholder name..." : "Search or type new..."} 
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  {isLoading ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      Loading stakeholders...
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>
                        {searchValue.trim() ? (
                          <button
                            type="button"
                            onClick={() => handleAddStakeholder(searchValue.trim(), null)}
                            className="flex items-center gap-2 w-full p-2 text-sm hover:bg-accent rounded cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            Add "{searchValue.trim()}"
                          </button>
                        ) : !prospectId ? (
                          'Type a stakeholder name for this new account.'
                        ) : availableStakeholders.length === 0 && stakeholders.length > 0 ? (
                          'All stakeholders added. Type to create new.'
                        ) : (
                          'No stakeholders yet. Type a name to add one.'
                        )}
                      </CommandEmpty>
                      {filteredStakeholders.length > 0 && (
                        <CommandGroup heading="Existing Stakeholders">
                          {filteredStakeholders.map((stakeholder) => (
                            <CommandItem
                              key={stakeholder.id}
                              value={stakeholder.name}
                              onSelect={() => handleAddStakeholder(stakeholder.name, stakeholder.id)}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {stakeholder.is_primary_contact ? (
                                  <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{stakeholder.name}</div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {stakeholder.job_title && (
                                      <span className="truncate">{stakeholder.job_title}</span>
                                    )}
                                    {stakeholder.influence_level && (
                                      <Badge variant="outline" className="text-xs py-0">
                                        {influenceLevelLabels[stakeholder.influence_level]}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {isNewStakeholder && (
                        <CommandGroup heading="Add New">
                          <CommandItem onSelect={() => handleAddStakeholder(searchValue.trim(), null)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add "{searchValue.trim()}"
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Pending role selector for new additions */}
        <Select
          value={pendingInfluenceLevel}
          onValueChange={(v) => setPendingInfluenceLevel(v as StakeholderInfluenceLevel)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[130px] shrink-0" aria-label="Role for new stakeholder">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {influenceLevelOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stakeholders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add at least one stakeholder who was on this call.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {stakeholders.length}/{MAX_STAKEHOLDERS} stakeholders
        </p>
      )}
    </div>
  );
}
