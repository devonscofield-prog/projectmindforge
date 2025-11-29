import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Flame,
  ExternalLink,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Linkedin,
  Presentation,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getProspectById,
  updateProspect,
  listActivitiesForProspect,
  createProspectActivity,
  getCallsForProspect,
  type Prospect,
  type ProspectActivity,
  type ProspectStatus,
  type ProspectActivityType,
} from '@/api/prospects';
import {
  listStakeholdersForProspect,
  type Stakeholder,
} from '@/api/stakeholders';
import {
  listRelationshipsForProspect,
  type StakeholderRelationship,
} from '@/api/stakeholderRelationships';
import { StakeholderCard } from '@/components/prospects/StakeholderCard';
import { AddStakeholderDialog } from '@/components/prospects/AddStakeholderDialog';
import { StakeholderDetailSheet } from '@/components/prospects/StakeholderDetailSheet';
import { StakeholderRelationshipMap } from '@/components/prospects/StakeholderRelationshipMap';

const statusLabels: Record<ProspectStatus, string> = {
  active: 'Active',
  won: 'Won',
  lost: 'Lost',
  dormant: 'Dormant',
};

const activityTypeLabels: Record<ProspectActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  linkedin: 'LinkedIn',
  demo: 'Demo',
};

const activityIcons: Record<ProspectActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: MessageSquare,
  linkedin: Linkedin,
  demo: Presentation,
};

function HeatScoreDisplay({ score }: { score: number | null }) {
  if (score === null) return null;

  let colorClass = 'text-muted-foreground bg-muted';
  if (score >= 8) colorClass = 'text-red-600 bg-red-100 dark:bg-red-900/30';
  else if (score >= 6) colorClass = 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
  else if (score >= 4) colorClass = 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
  else colorClass = 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}>
      <Flame className="h-5 w-5" />
      <div>
        <p className="text-sm font-medium">Heat Score</p>
        <p className="text-lg font-bold">{score}/10</p>
      </div>
    </div>
  );
}

export default function ProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<StakeholderRelationship[]>([]);
  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [calls, setCalls] = useState<{ id: string; call_date: string; call_type: string | null; analysis_status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isAddStakeholderOpen, setIsAddStakeholderOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [isStakeholderSheetOpen, setIsStakeholderSheetOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'note' as ProspectActivityType,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) loadProspectData();
  }, [id]);

  const loadProspectData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [prospectData, stakeholdersData, relationshipsData, activitiesData, callsData] = await Promise.all([
        getProspectById(id),
        listStakeholdersForProspect(id),
        listRelationshipsForProspect(id),
        listActivitiesForProspect(id),
        getCallsForProspect(id),
      ]);

      if (!prospectData) {
        toast({ title: 'Account not found', variant: 'destructive' });
        navigate('/rep/prospects');
        return;
      }

      setProspect(prospectData);
      setStakeholders(stakeholdersData);
      setRelationships(relationshipsData);
      setActivities(activitiesData);
      setCalls(callsData);
    } catch (error) {
      console.error('Failed to load prospect:', error);
      toast({ title: 'Failed to load account', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!prospect) return;
    
    try {
      await updateProspect(prospect.id, { status: newStatus });
      setProspect({ ...prospect, status: newStatus });
      toast({ title: 'Status updated' });
    } catch (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleAddActivity = async () => {
    if (!prospect || !user?.id) return;
    
    setIsSubmitting(true);
    try {
      const activity = await createProspectActivity({
        prospectId: prospect.id,
        repId: user.id,
        activityType: newActivity.type,
        description: newActivity.description || undefined,
        activityDate: newActivity.date,
      });

      setActivities([activity, ...activities]);
      setIsAddActivityOpen(false);
      setNewActivity({ type: 'note', description: '', date: new Date().toISOString().split('T')[0] });
      toast({ title: 'Activity logged' });
    } catch (error) {
      toast({ title: 'Failed to log activity', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStakeholderClick = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setIsStakeholderSheetOpen(true);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get primary stakeholder name for display
  const primaryStakeholder = stakeholders.find(s => s.is_primary_contact);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!prospect) {
    return null;
  }

  const aiInfo = prospect.ai_extracted_info;
  const followUps = prospect.suggested_follow_ups || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header - Now shows Account Name as primary */}
        <div className="flex items-start justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              onClick={() => navigate('/rep/prospects')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Accounts
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {prospect.account_name || prospect.prospect_name}
                </h1>
                {primaryStakeholder && (
                  <p className="text-muted-foreground">
                    Primary: {primaryStakeholder.name}
                    {primaryStakeholder.job_title && ` • ${primaryStakeholder.job_title}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={prospect.status} onValueChange={(v) => handleStatusChange(v as ProspectStatus)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {prospect.salesforce_link && (
              <Button variant="outline" asChild>
                <a href={prospect.salesforce_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <HeatScoreDisplay score={prospect.heat_score} />
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Potential Revenue</p>
                  <p className="text-lg font-bold">{formatCurrency(prospect.potential_revenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Stakeholders</p>
                  <p className="text-lg font-bold">{stakeholders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-lg font-bold">{calls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stakeholders Section - NEW */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Stakeholders
                  </CardTitle>
                  <CardDescription>
                    Key contacts at this account
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsAddStakeholderOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {stakeholders.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No stakeholders yet</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setIsAddStakeholderOpen(true)}
                    >
                      Add First Stakeholder
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stakeholders.map((stakeholder) => (
                      <StakeholderCard
                        key={stakeholder.id}
                        stakeholder={stakeholder}
                        onClick={() => handleStakeholderClick(stakeholder)}
                        onPrimaryChanged={loadProspectData}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Relationship Map */}
            {user?.id && (
              <StakeholderRelationshipMap
                stakeholders={stakeholders}
                relationships={relationships}
                prospectId={prospect.id}
                repId={user.id}
                onRelationshipsChanged={loadProspectData}
                onStakeholderClick={handleStakeholderClick}
              />
            )}

            {/* AI Insights */}
            {aiInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-primary" />
                    AI Insights
                  </CardTitle>
                  <CardDescription>
                    Extracted from call transcripts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aiInfo.business_context && (
                    <div>
                      <h4 className="font-medium mb-1">Business Context</h4>
                      <p className="text-sm text-muted-foreground">{aiInfo.business_context}</p>
                    </div>
                  )}
                  {aiInfo.pain_points && aiInfo.pain_points.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Pain Points</h4>
                      <ul className="space-y-1">
                        {aiInfo.pain_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInfo.decision_process && (
                    <div>
                      <h4 className="font-medium mb-2">Decision Process</h4>
                      <div className="text-sm space-y-1">
                        {aiInfo.decision_process.timeline && (
                          <p><span className="text-muted-foreground">Timeline:</span> {aiInfo.decision_process.timeline}</p>
                        )}
                        {aiInfo.decision_process.budget_signals && (
                          <p><span className="text-muted-foreground">Budget:</span> {aiInfo.decision_process.budget_signals}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {aiInfo.competitors_mentioned && aiInfo.competitors_mentioned.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-1">Competitors Mentioned</h4>
                      <div className="flex flex-wrap gap-2">
                        {aiInfo.competitors_mentioned.map((comp, i) => (
                          <Badge key={i} variant="outline">{comp}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Suggested Follow-ups */}
            {followUps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Suggested Follow-ups</CardTitle>
                  <CardDescription>
                    AI-recommended questions and actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {followUps.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Call History */}
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>
                  All calls with this account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {calls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No calls recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {calls.map((call) => (
                      <Link
                        key={call.id}
                        to={`/calls/${call.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {call.call_type ? call.call_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Call'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(call.call_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={call.analysis_status === 'completed' ? 'secondary' : 'outline'}>
                          {call.analysis_status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Activity Timeline */}
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
                            {Object.entries(activityTypeLabels).map(([value, label]) => (
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
                        onClick={handleAddActivity}
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

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(prospect.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Contact</span>
                  <span>
                    {prospect.last_contact_date
                      ? format(new Date(prospect.last_contact_date), 'MMM d, yyyy')
                      : '—'}
                  </span>
                </div>
                {prospect.salesforce_link && (
                  <div className="pt-2">
                    <a
                      href={prospect.salesforce_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View in Salesforce
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Stakeholder Dialog */}
      {user?.id && prospect && (
        <AddStakeholderDialog
          open={isAddStakeholderOpen}
          onOpenChange={setIsAddStakeholderOpen}
          prospectId={prospect.id}
          repId={user.id}
          onStakeholderAdded={loadProspectData}
        />
      )}

      {/* Stakeholder Detail Sheet */}
      <StakeholderDetailSheet
        stakeholder={selectedStakeholder}
        open={isStakeholderSheetOpen}
        onOpenChange={setIsStakeholderSheetOpen}
        onUpdated={loadProspectData}
        onDeleted={loadProspectData}
      />
    </AppLayout>
  );
}