import { useState, useRef, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  useSDRTranscriptList,
  useSDRCallList,
  useUploadSDRTranscript,
  useRetrySDRTranscript,
} from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Phone, MessageSquare, TrendingUp, Loader2, FileUp, ClipboardPaste, RotateCcw, ArrowRight, CalendarCheck, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { gradeColors } from '@/constants/training';


// Grade order for sorting in distribution chart
const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function SDRDashboard() {
  const { user } = useAuth();
  const {
    data: transcripts = [],
  } = useSDRTranscriptList({
    sdrId: user?.id,
    enabled: !!user?.id,
    pollWhileProcessing: false,
  });
  const {
    data: recentTranscripts = [],
    isLoading: recentTranscriptsLoading,
    isError: recentTranscriptsError,
  } = useSDRTranscriptList({
    sdrId: user?.id,
    limit: 5,
    enabled: !!user?.id,
  });
  const { data: recentCalls = [] } = useSDRCallList({
    sdrId: user?.id,
    onlyMeaningful: true,
    orderBy: 'recency',
    limit: 100,
    enabled: !!user?.id,
  });
  const uploadMutation = useUploadSDRTranscript();
  const retryMutation = useRetrySDRTranscript();
  const [rawText, setRawText] = useState('');
  const [transcriptDate, setTranscriptDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [showUpload, setShowUpload] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText((ev.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    if (!rawText.trim()) return;
    uploadMutation.mutate({ rawText, transcriptDate }, {
      onSuccess: () => { setRawText(''); setFileName(null); setShowUpload(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    });
  };

  // Keep dashboard metrics on one consistent "today + recent graded calls" snapshot.
  const todayDate = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const todayTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.transcript_date === todayDate),
    [todayDate, transcripts],
  );
  const totalCallsToday = useMemo(
    () => todayTranscripts.reduce((sum, transcript) => sum + transcript.total_calls_detected, 0),
    [todayTranscripts],
  );
  const meaningfulCallsToday = useMemo(
    () => todayTranscripts.reduce((sum, transcript) => sum + transcript.meaningful_calls_count, 0),
    [todayTranscripts],
  );
  const conversationRate = totalCallsToday > 0
    ? Math.round((meaningfulCallsToday / totalCallsToday) * 100)
    : null;

  const gradedCallsWindow = useMemo(
    () => recentCalls.filter((call) => call.sdr_call_grades?.[0]),
    [recentCalls],
  );

  // Grade distribution chart data
  const gradeDistribution = useMemo(() => {
    const gradeCounts = gradedCallsWindow.reduce<Record<string, number>>((acc, call) => {
      const grade = call.sdr_call_grades?.[0]?.overall_grade;
      if (grade) acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return GRADE_ORDER
      .filter((grade) => gradeCounts[grade])
      .map(g => ({
        grade: g,
        count: gradeCounts[g],
        pct: Math.round((gradeCounts[g] / total) * 100),
      }));
  }, [gradedCallsWindow]);

  const avgScore = useMemo(() => {
    if (gradedCallsWindow.length === 0) return null;

    const total = gradedCallsWindow.reduce((sum, call) => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return sum;

      const dimensions = [
        grade.opener_score,
        grade.engagement_score,
        grade.objection_handling_score,
        grade.appointment_setting_score,
        grade.professionalism_score,
      ].filter((score): score is number => typeof score === 'number');

      if (dimensions.length === 0) return sum;
      return sum + dimensions.reduce((a, b) => a + b, 0) / dimensions.length;
    }, 0);

    return Math.round((total / gradedCallsWindow.length) * 10) / 10;
  }, [gradedCallsWindow]);

  // Recent graded calls for quick view
  const recentGradedCalls = useMemo(() => {
    return gradedCallsWindow.slice(0, 5);
  }, [gradedCallsWindow]);

  // Meetings set count
  const meetingsSet = useMemo(() => {
    return gradedCallsWindow.filter((call) => call.sdr_call_grades?.[0]?.meeting_scheduled === true).length;
  }, [gradedCallsWindow]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SDR Dashboard</h1>
            <p className="text-muted-foreground">Your cold call performance at a glance</p>
          </div>
          <Button variant="gradient" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Transcript
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalCallsToday}</p>
                  <p className="text-sm text-muted-foreground">Calls Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{meaningfulCallsToday}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{conversationRate !== null ? `${conversationRate}%` : '—'}</p>
                  <p className="text-sm text-muted-foreground">Connect Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{meetingsSet}</p>
                  <p className="text-sm text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Form */}
        {showUpload && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Daily Transcript</CardTitle>
              <CardDescription>Paste your full-day dialer transcript below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Transcript Date</Label>
                <Input type="date" value={transcriptDate} onChange={(e) => setTranscriptDate(e.target.value)} />
              </div>
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="paste" className="flex-1 gap-2">
                    <ClipboardPaste className="h-4 w-4" /> Paste Text
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex-1 gap-2">
                    <FileUp className="h-4 w-4" /> Upload File
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="paste">
                  <div className="space-y-2">
                    <Label>Transcript Text</Label>
                    <Textarea
                      placeholder="Paste your full-day transcript here..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="file">
                  <div className="space-y-3">
                    <Label>Select a .txt file</Label>
                    <div
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.text"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      {fileName ? (
                        <div>
                          <p className="font-medium">{fileName}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {rawText.length.toLocaleString()} characters loaded
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">Click to select a file</p>
                          <p className="text-sm text-muted-foreground mt-1">.txt files only</p>
                        </div>
                      )}
                    </div>
                    {rawText && fileName && (
                      <div className="space-y-1">
                        <Label>Preview</Label>
                        <pre className="bg-muted/30 rounded-md p-3 text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                          {rawText.slice(0, 500)}{rawText.length > 500 ? '…' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending || !rawText.trim()}>
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Process Transcript
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Two-column layout: Recent Calls + Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Graded Calls */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Graded Calls</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/sdr/history" className="text-muted-foreground hover:text-foreground">
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentGradedCalls.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No graded calls yet. Upload a transcript to get started!</p>
                ) : (
                  <div className="space-y-2">
                    {recentGradedCalls.map((call) => {
                      const grade = call.sdr_call_grades?.[0];
                      return (
                        <Link key={call.id} to={`/sdr/calls/${call.id}`} className="block">
                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{call.prospect_name || `Call #${call.call_index}`}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {call.prospect_company && `${call.prospect_company} • `}
                                  {grade?.call_summary?.slice(0, 80)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {grade?.meeting_scheduled === true && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Meeting</span>
                              )}
                              {grade && (
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                                  {grade.overall_grade}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Last {gradedCallsWindow.length} graded calls</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistribution.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">No grades yet</p>
              ) : (
                <div className="space-y-3">
                  {gradeDistribution.map(({ grade, count, pct }) => (
                    <div key={grade} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{grade}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${GRADE_BAR_COLORS[grade] || 'bg-muted-foreground'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transcripts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transcripts</CardTitle>
            {transcripts.length > 5 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/sdr/history" className="text-muted-foreground hover:text-foreground">
                  View All ({transcripts.length}) <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {recentTranscriptsError ? (
              <p className="text-destructive text-center py-8">Failed to load transcripts. Please try refreshing.</p>
            ) : recentTranscriptsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : recentTranscripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transcripts yet. Upload your first one above!</p>
            ) : (
              <div className="space-y-3">
                {recentTranscripts.map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.total_calls_detected} calls detected • {t.meaningful_calls_count} meaningful
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(t.processing_status === 'failed' || t.processing_status === 'partial') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setRetryingId(t.id);
                              retryMutation.mutate(t.id, { onSettled: () => setRetryingId(null) });
                            }}
                            disabled={retryingId === t.id}
                            className="h-7 px-2"
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${retryingId === t.id ? 'animate-spin' : ''}`} />
                            <span className="ml-1 text-xs">Retry</span>
                          </Button>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          t.processing_status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                          t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                          t.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {t.processing_status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default SDRDashboard;
