import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
          chat_context: chatContext as any,
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
      queryClient.invalidateQueries({ queryKey: ['admin-saved-insights'] });
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
      console.error('Save insight error:', error);
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
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Common objections in enterprise deals"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Insight Content</Label>
              <Textarea
                id="content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={6}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                You can edit the content before saving
              </p>
            </div>

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

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="share" className="font-medium flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Create shareable link
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow other admins to view this insight
                </p>
              </div>
              <Switch
                id="share"
                checked={isShared}
                onCheckedChange={setIsShared}
              />
            </div>
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
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title.trim() || !editedContent.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Insight'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
