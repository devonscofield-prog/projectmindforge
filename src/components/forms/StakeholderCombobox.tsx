import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, User, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { listStakeholdersForProspect, influenceLevelOptions, type StakeholderInfluenceLevel } from '@/api/stakeholders';

interface StakeholderComboboxProps {
  prospectId: string | null;
  value: string;
  selectedStakeholderId: string | null;
  onChange: (stakeholderName: string, stakeholderId: string | null) => void;
  influenceLevel: StakeholderInfluenceLevel;
  onInfluenceLevelChange: (level: StakeholderInfluenceLevel) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function StakeholderCombobox({
  prospectId,
  value,
  selectedStakeholderId,
  onChange,
  influenceLevel,
  onInfluenceLevelChange,
  placeholder = 'Select or type stakeholder...',
  disabled = false,
}: StakeholderComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch stakeholders when prospectId changes
  const { data: stakeholders = [], isLoading } = useQuery({
    queryKey: ['prospect-stakeholders', prospectId],
    queryFn: () => listStakeholdersForProspect(prospectId!),
    enabled: !!prospectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Check if current search value is a new stakeholder
  const isNewStakeholder = searchValue.trim() && 
    !stakeholders.some(s => s.name.toLowerCase() === searchValue.trim().toLowerCase());

  const handleSelect = (stakeholderName: string, stakeholderId: string | null) => {
    onChange(stakeholderName.trim(), stakeholderId);
    setOpen(false);
    setSearchValue('');
  };

  const handleCreateNew = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim(), null);
      setOpen(false);
      setSearchValue('');
    }
  };

  const filteredStakeholders = stakeholders.filter(s =>
    !searchValue || s.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="flex gap-2">
      {/* Stakeholder Name Combobox */}
      <div className="flex-1 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Select or create stakeholder"
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              {value ? (
                <span className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{value}</span>
                  {!selectedStakeholderId && value && (
                    <span className="text-xs text-muted-foreground">(new)</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder={!prospectId ? "Type stakeholder name..." : "Search stakeholders..."} 
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
                          onClick={handleCreateNew}
                          className="flex items-center gap-2 w-full p-2 text-sm hover:bg-accent rounded cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          Create "{searchValue.trim()}"
                        </button>
                      ) : !prospectId ? (
                        'Type a stakeholder name for this new account.'
                      ) : stakeholders.length === 0 ? (
                        'No stakeholders yet. Type a name to add one.'
                      ) : (
                        'No matching stakeholders.'
                      )}
                    </CommandEmpty>
                    {filteredStakeholders.length > 0 && (
                      <CommandGroup heading="Stakeholders">
                        {filteredStakeholders.map((stakeholder) => (
                          <CommandItem
                            key={stakeholder.id}
                            value={stakeholder.name}
                            onSelect={() => handleSelect(stakeholder.name, stakeholder.id)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                value === stakeholder.name ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {stakeholder.is_primary_contact ? (
                                <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{stakeholder.name}</div>
                                {stakeholder.job_title && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {stakeholder.job_title}
                                  </div>
                                )}
                              </div>
                              {stakeholder.is_primary_contact && (
                                <span className="text-xs text-muted-foreground shrink-0">Primary</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {isNewStakeholder && (
                      <CommandGroup heading="Add New">
                        <CommandItem onSelect={handleCreateNew}>
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

      {/* Role/Influence Level Selector */}
      <Select
        value={influenceLevel}
        onValueChange={(v) => onInfluenceLevelChange(v as StakeholderInfluenceLevel)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] shrink-0" aria-label="Stakeholder role">
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
  );
}
