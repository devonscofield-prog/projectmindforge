import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { activityTypeLabels, activityIcons } from './constants';
import type { ProspectActivity, ProspectActivityType } from '@/api/prospects';

interface ProspectActivityLogProps {
  activities: ProspectActivity[];
  onAddActivity: (activity: { type: ProspectActivityType; description: string; date: string }) => Promise<unknown>;
}

// Limited activity types for logging
const allowedActivityTypes: { value: ProspectActivityType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Phone Call' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meeting', label: 'Other' },
];

export function ProspectActivityLog({ activities, onAddActivity }: ProspectActivityLogProps) {
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'note' as ProspectActivityType,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onAddActivity(newActivity);
      setIsAddActivityOpen(false);
      setNewActivity({ type: 'note', description: '', date: new Date().toISOString().split('T')[0] });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Track your interactions</CardDescription>
        </div>
        <Dialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Activity Type</label>
                <Select
                  value={newActivity.type}
                  onValueChange={(v) => setNewActivity({ ...newActivity, type: v as ProspectActivityType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedActivityTypes.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={newActivity.date}
                  onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes about this activity..."
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Logging...' : 'Log Activity'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activities logged yet
          </p>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => {
              const ActivityIcon = activityIcons[activity.activity_type];
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="p-1.5 rounded-full bg-muted shrink-0">
                    <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {activityTypeLabels[activity.activity_type]}
                    </p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(activity.activity_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
