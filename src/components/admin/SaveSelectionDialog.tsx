import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

const log = createLogger('SaveSelectionDialog');
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormInput,
  FormTextarea,
  FormSwitch,
  SubmitButton,
} from '@/components/ui/form-fields';
import { Save, Link, Copy, Check } from 'lucide-react';

interface FilterState {
  dateRange: { from: Date; to: Date };
  selectedTeamId: string;
  selectedRepId: string;
  accountSearch: string;
  selectedCallTypes: string[];
}

interface SaveSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcriptIds: string[];
  filters: FilterState;
  onSaved?: (selectionId: string) => void;
}

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

export function SaveSelectionDialog({
  open,
  onOpenChange,
  transcriptIds,
  filters,
  onSaved,
}: SaveSelectionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [savedShareToken, setSavedShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const shareToken = isShared ? generateShareToken() : null;
      
      const filtersPayload = {
        dateRange: {
          from: filters.dateRange.from.toISOString(),
          to: filters.dateRange.to.toISOString(),
        },
        selectedTeamId: filters.selectedTeamId,
        selectedRepId: filters.selectedRepId,
        accountSearch: filters.accountSearch,
        selectedCallTypes: filters.selectedCallTypes,
      };

      const { data, error } = await supabase
        .from('admin_transcript_selections')
        .insert({
          admin_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          transcript_ids: transcriptIds,
          filters: filtersPayload as unknown as Json,
          share_token: shareToken,
          is_shared: isShared,
        })
        .select('id, share_token')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-saved-selections'] });
      toast.success('Selection saved successfully');
      
      if (data.share_token) {
        setSavedShareToken(data.share_token);
      } else {
        onOpenChange(false);
        resetForm();
      }
      
      onSaved?.(data.id);
    },
    onError: (error) => {
      log.error('Save selection error', { error });
      toast.error('Failed to save selection');
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsShared(false);
    setSavedShareToken(null);
    setCopied(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const getShareUrl = () => {
    if (!savedShareToken) return '';
    return `${window.location.origin}/admin/transcripts?share=${savedShareToken}`;
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    toast.success('Share link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Save Selection
          </DialogTitle>
          <DialogDescription>
            Save this transcript selection for quick access later.
            {transcriptIds.length} transcripts selected.
          </DialogDescription>
        </DialogHeader>

        {savedShareToken ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center py-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Your selection has been saved with a shareable link!
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={getShareUrl()}
                className="text-xs"
              />
              <Button size="icon" variant="outline" onClick={copyShareUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Other admins with this link can view your selection
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <FormInput
              label="Name"
              placeholder="e.g., Q4 Demo Calls - Enterprise"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormTextarea
              label="Description (optional)"
              placeholder="Add notes about this selection..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <FormSwitch
              label="Create shareable link"
              description="Allow other admins to view this selection"
              icon={<Link className="h-4 w-4" />}
              checked={isShared}
              onCheckedChange={setIsShared}
              variant="card"
            />
          </div>
        )}

        <DialogFooter>
          {savedShareToken ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <SubmitButton
                onClick={() => saveMutation.mutate()}
                disabled={!name.trim()}
                isLoading={saveMutation.isPending}
                loadingText="Saving..."
              >
                Save Selection
              </SubmitButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
