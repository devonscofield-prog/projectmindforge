import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const log = createLogger('SaveInsightDialog');
import { Json } from '@/integrations/supabase/types';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FormInput,
  FormTextarea,
  FormSwitch,
  SubmitButton,
} from '@/components/ui/form-fields';
import { Lightbulb, Link, Copy, Check, X } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SaveInsightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  chatContext: ChatMessage[];
  selectionId?: string | null;
  onSaved?: (insightId: string) => void;
}

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

export function SaveInsightDialog({
  open,
  onOpenChange,
  content,
  chatContext,
  selectionId,
  onSaved,
}: SaveInsightDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [editedContent, setEditedContent] = useState(content);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [savedShareToken, setSavedShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset edited content when dialog opens with new content
  useState(() => {
    setEditedContent(content);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const shareToken = isShared ? generateShareToken() : null;
      
      const { data, error } = await supabase
        .from('admin_chat_insights')
        .insert({
          admin_id: user.id,
          selection_id: selectionId || null,
          title: title.trim(),
          content: editedContent.trim(),
          chat_context: chatContext as unknown as Json,
          tags: tags.length > 0 ? tags : null,
          share_token: shareToken,
          is_shared: isShared,
        })
        .select('id, share_token')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-insights-list'] });
      toast.success('Insight saved successfully');
      
      if (data.share_token) {
        setSavedShareToken(data.share_token);
      } else {
        onOpenChange(false);
        resetForm();
      }
      
      onSaved?.(data.id);
    },
    onError: (error) => {
      log.error('Save insight error', { error });
      toast.error('Failed to save insight');
    },
  });

  const resetForm = () => {
    setTitle('');
    setEditedContent(content);
    setTags([]);
    setTagInput('');
    setIsShared(false);
    setSavedShareToken(null);
    setCopied(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const getShareUrl = () => {
    if (!savedShareToken) return '';
    return `${window.location.origin}/admin/transcripts?insight=${savedShareToken}`;
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    toast.success('Share link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Save Insight
          </DialogTitle>
          <DialogDescription>
            Save this analysis insight for future reference or to share with other admins.
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
              Your insight has been saved with a shareable link!
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
              Other admins with this link can view your insight
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <FormInput
              label="Title"
              placeholder="e.g., Common objections in enterprise deals"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            
            <FormTextarea
              label="Insight Content"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={6}
              className="text-sm"
              description="You can edit the content before saving"
            />

            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <FormSwitch
              label="Create shareable link"
              description="Allow other admins to view this insight"
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
                disabled={!title.trim() || !editedContent.trim()}
                isLoading={saveMutation.isPending}
                loadingText="Saving..."
              >
                Save Insight
              </SubmitButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
