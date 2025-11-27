import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ActivityLog, ActivityType } from '@/types/database';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const activityTypeLabels: Record<ActivityType, string> = {
  cold_calls: 'Cold Calls',
  emails: 'Emails',
  linkedin: 'LinkedIn',
  demos: 'Demos',
  meetings: 'Meetings',
  proposals: 'Proposals',
};

const activityTypes = Object.keys(activityTypeLabels) as ActivityType[];

export default function RepActivity() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    activity_date: format(new Date(), 'yyyy-MM-dd'),
    activity_type: 'cold_calls' as ActivityType,
    count: 0,
    notes: '',
  });

  const fetchActivities = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('rep_id', user.id)
      .order('activity_date', { ascending: false })
      .limit(50);

    if (data) {
      setActivities(data as unknown as ActivityLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('activity_logs').insert({
      rep_id: user.id,
      activity_date: formData.activity_date,
      activity_type: formData.activity_type,
      count: formData.count,
      notes: formData.notes || null,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to log activity. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Activity Logged',
        description: 'Your activity has been recorded.',
      });
      setDialogOpen(false);
      setFormData({
        activity_date: format(new Date(), 'yyyy-MM-dd'),
        activity_type: 'cold_calls',
        count: 0,
        notes: '',
      });
      fetchActivities();
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Log</h1>
            <p className="text-muted-foreground mt-1">Track your daily sales activities</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Activity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activity_date">Date</Label>
                  <Input
                    id="activity_date"
                    type="date"
                    value={formData.activity_date}
                    onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity_type">Activity Type</Label>
                  <Select
                    value={formData.activity_type}
                    onValueChange={(value: ActivityType) => setFormData({ ...formData, activity_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {activityTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="count">Count</Label>
                  <Input
                    id="count"
                    type="number"
                    min="0"
                    value={formData.count}
                    onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">Log Activity</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{format(new Date(activity.activity_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{activityTypeLabels[activity.activity_type]}</TableCell>
                      <TableCell>{activity.count}</TableCell>
                      <TableCell className="max-w-xs truncate">{activity.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No activity logged yet. Start tracking your activities!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
