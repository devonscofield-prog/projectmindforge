import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSDRStats, useSDRDailyTranscripts, useUploadSDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Phone, MessageSquare, TrendingUp, Loader2, FileText, FileUp, ClipboardPaste } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';


function SDRDashboard() {
  const { user } = useAuth();
  const { data: stats } = useSDRStats(user?.id);
  const { data: transcripts = [], isLoading: transcriptsLoading } = useSDRDailyTranscripts(user?.id);
  const uploadMutation = useUploadSDRTranscript();
  const [rawText, setRawText] = useState('');
  const [transcriptDate, setTranscriptDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUpload, setShowUpload] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalCallsToday ?? '—'}</p>
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
                  <p className="text-2xl font-bold">{stats?.meaningfulCallsToday ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalGradedCalls ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Graded Calls</p>
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

        {/* Recent Transcripts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            {transcriptsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : transcripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transcripts yet. Upload your first one above!</p>
            ) : (
              <div className="space-y-3">
                {transcripts.slice(0, 10).map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.total_calls_detected} calls detected • {t.meaningful_calls_count} meaningful
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        t.processing_status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                        t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {t.processing_status}
                      </span>
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
