import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  User,
} from 'lucide-react';
import { type EmailLog } from '@/api/emailLogs';
import { cn } from '@/lib/utils';

interface EmailLogItemProps {
  email: EmailLog;
  onDelete: (id: string) => void;
}

export function EmailLogItem({ email, onDelete }: EmailLogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const isOutgoing = email.direction === 'outgoing';
  const displayDate = format(new Date(email.email_date), 'MMM d, yyyy');
  
  // Truncate body preview
  const bodyPreview = email.body.length > 150 
    ? email.body.substring(0, 150) + '...' 
    : email.body;

  return (
    <>
      <div
        className={cn(
          "border rounded-lg p-4 transition-all",
          isOutgoing 
            ? "border-l-4 border-l-blue-500 bg-blue-500/5" 
            : "border-l-4 border-l-green-500 bg-green-500/5"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Direction Icon */}
            <div
              className={cn(
                "flex-shrink-0 p-2 rounded-full",
                isOutgoing 
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" 
                  : "bg-green-500/20 text-green-600 dark:text-green-400"
              )}
            >
              {isOutgoing ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownLeft className="h-4 w-4" />
              )}
            </div>
            
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded",
                    isOutgoing 
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" 
                      : "bg-green-500/20 text-green-700 dark:text-green-300"
                  )}
                >
                  {isOutgoing ? 'Sent' : 'Received'}
                </span>
                <span className="text-xs text-muted-foreground">{displayDate}</span>
              </div>
              
              {/* Subject or Contact */}
              {email.subject && (
                <p className="font-medium mt-1 truncate">{email.subject}</p>
              )}
              
              {email.contact_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span>
                    {isOutgoing ? 'To: ' : 'From: '}
                    {email.contact_name}
                    {email.contact_email && ` <${email.contact_email}>`}
                  </span>
                </div>
              )}
              
              {/* Body Preview or Full */}
              <div className="mt-2">
                <pre
                  className={cn(
                    "text-sm whitespace-pre-wrap font-sans text-muted-foreground",
                    !isExpanded && "line-clamp-3"
                  )}
                >
                  {isExpanded ? email.body : bodyPreview}
                </pre>
              </div>
              
              {/* Notes */}
              {email.notes && isExpanded && (
                <div className="mt-3 p-2 bg-muted rounded text-sm">
                  <span className="font-medium">Notes: </span>
                  {email.notes}
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(email.id);
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
