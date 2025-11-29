import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
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
import { listProspectsForRep, type Prospect } from '@/api/prospects';

interface AccountComboboxProps {
  repId: string;
  value: string;
  selectedProspectId: string | null;
  onChange: (accountName: string, prospectId: string | null, salesforceLink?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AccountCombobox({
  repId,
  value,
  selectedProspectId,
  onChange,
  placeholder = 'Select or type account...',
  disabled = false,
}: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch prospects for the rep
  useEffect(() => {
    async function fetchProspects() {
      if (!repId) return;
      setLoading(true);
      try {
        const data = await listProspectsForRep(repId);
        setProspects(data);
      } catch (error) {
        console.error('Failed to fetch prospects:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProspects();
  }, [repId]);

  // Get unique account names with their prospect IDs and salesforce links
  const accountOptions = prospects.reduce<{ accountName: string; prospectId: string; salesforceLink: string | null }[]>((acc, prospect) => {
    const accountName = prospect.account_name || prospect.prospect_name;
    if (!acc.find(a => a.accountName.toLowerCase() === accountName.toLowerCase())) {
      acc.push({ accountName, prospectId: prospect.id, salesforceLink: prospect.salesforce_link });
    }
    return acc;
  }, []);

  // Check if current search value is a new account
  const isNewAccount = searchValue.trim() && 
    !accountOptions.some(a => a.accountName.toLowerCase() === searchValue.trim().toLowerCase());

  const handleSelect = (accountName: string, prospectId: string | null, salesforceLink?: string | null) => {
    onChange(accountName, prospectId, salesforceLink);
    setOpen(false);
    setSearchValue('');
  };

  const handleCreateNew = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim(), null, null);
      setOpen(false);
      setSearchValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{value}</span>
              {!selectedProspectId && value && (
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
            placeholder="Search accounts..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Loading accounts...
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
                  ) : (
                    'No accounts found. Type to create new.'
                  )}
                </CommandEmpty>
                {accountOptions.length > 0 && (
                  <CommandGroup heading="Existing Accounts">
                    {accountOptions
                      .filter(a => 
                        !searchValue || 
                        a.accountName.toLowerCase().includes(searchValue.toLowerCase())
                      )
                      .map((account) => (
                        <CommandItem
                          key={account.prospectId}
                          value={account.accountName}
                          onSelect={() => handleSelect(account.accountName, account.prospectId, account.salesforceLink)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              value === account.accountName ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                          {account.accountName}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
                {isNewAccount && (
                  <CommandGroup heading="Create New">
                    <CommandItem onSelect={handleCreateNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchValue.trim()}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
