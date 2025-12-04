import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Trash2, Users, Calendar, Tag, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useBulkUpload, FileMetadata } from '@/hooks/useBulkUpload';
import { useProfilesBasic } from '@/hooks/useProfiles';
import { callTypeOptions, CallType } from '@/constants/callTypes';
import { cn } from '@/lib/utils';

export function BulkTranscriptUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const {
    extractedFiles,
    fileMetadata,
    isExtracting,
    extractionError,
    extractZip,
    updateFileMetadata,
    applyToAll,
    clearFiles,
    uploadMutation,
    transcriptStatuses,
    uploadedTranscriptIds,
  } = useBulkUpload();
  
  const { data: profiles, isLoading: profilesLoading } = useProfilesBasic();
  
  // ============= Bulk Apply State =============
  const [bulkRepId, setBulkRepId] = useState('');
  const [bulkCallType, setBulkCallType] = useState<CallType>('first_demo');
  const [bulkCallDate, setBulkCallDate] = useState(new Date().toISOString().split('T')[0]);

  // ============= File Drop Handlers =============
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      extractZip(file);
    } else {
      toast.error('Please upload a ZIP file');
    }
  }, [extractZip]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      extractZip(file);
    }
  }, [extractZip]);
  
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ============= Bulk Apply =============
  
  const handleApplyToAll = useCallback(() => {
    const updates: Partial<Omit<FileMetadata, 'fileName'>> = {};
    if (bulkRepId) updates.repId = bulkRepId;
    if (bulkCallType) updates.callType = bulkCallType;
    if (bulkCallDate) updates.callDate = bulkCallDate;
    
    applyToAll(updates);
    toast.success('Applied to all files');
  }, [bulkRepId, bulkCallType, bulkCallDate, applyToAll]);

  // ============= Upload Handler =============
  
  const handleUpload = useCallback(() => {
    // Validate all files have required metadata
    const invalidFiles = extractedFiles.filter(file => {
      const meta = fileMetadata.get(file.fileName);
      return !meta?.repId || !meta?.accountName || !meta?.stakeholderName;
    });
    
    if (invalidFiles.length > 0) {
      toast.error(`${invalidFiles.length} file(s) missing required fields (Rep, Account, Stakeholder)`);
      return;
    }
    
    uploadMutation.mutate();
  }, [extractedFiles, fileMetadata, uploadMutation]);

  // ============= Compute Stats =============
  
  const validCount = extractedFiles.filter(f => {
    const meta = fileMetadata.get(f.fileName);
    return meta?.repId && meta?.accountName && meta?.stakeholderName;
  }).length;
  
  const completedCount = transcriptStatuses?.filter(s => s.analysis_status === 'completed').length || 0;
  const processingCount = transcriptStatuses?.filter(s => 
    s.analysis_status === 'pending' || s.analysis_status === 'processing'
  ).length || 0;
  const errorCount = transcriptStatuses?.filter(s => s.analysis_status === 'error').length || 0;
  
  // Show timeout warning for large uploads
  const LARGE_UPLOAD_THRESHOLD = 50;
  const showTimeoutWarning = extractedFiles.length > LARGE_UPLOAD_THRESHOLD;

  // ============= Render =============
  
  return (
    <div className="space-y-6">
      {/* Upload Results Summary */}
      {uploadMutation.isSuccess && uploadMutation.data && (
        <Alert variant={uploadMutation.data.summary.insertFailed > 0 ? 'destructive' : 'default'}>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Upload Complete</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-4 mt-2">
              <span>Total: {uploadMutation.data.summary.total}</span>
              <span className="text-green-600">Inserted: {uploadMutation.data.summary.inserted}</span>
              <span className="text-blue-600">Analysis Queued: {uploadMutation.data.summary.analysisQueued}</span>
              {uploadMutation.data.summary.insertFailed > 0 && (
                <span className="text-destructive">Failed: {uploadMutation.data.summary.insertFailed}</span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Analysis Progress */}
      {uploadedTranscriptIds.length > 0 && transcriptStatuses && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Analysis Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {completedCount} of {uploadedTranscriptIds.length} completed
                </span>
                <span className="text-muted-foreground">
                  {processingCount > 0 && `${processingCount} processing`}
                  {errorCount > 0 && ` • ${errorCount} errors`}
                </span>
              </div>
              <Progress 
                value={(completedCount / uploadedTranscriptIds.length) * 100} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drop Zone */}
      {extractedFiles.length === 0 && !uploadMutation.isSuccess && (
        <Card
          className={cn(
            'border-2 border-dashed transition-colors cursor-pointer',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {isExtracting ? (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Extracting ZIP file...</p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">Drop ZIP file here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse • Contains .txt transcript files
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Extraction Error */}
      {extractionError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Extraction Failed</AlertTitle>
          <AlertDescription>{extractionError}</AlertDescription>
        </Alert>
      )}

      {/* File List with Metadata */}
      {extractedFiles.length > 0 && !uploadMutation.isSuccess && (
        <>
          {/* Bulk Apply Controls */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Bulk Apply</CardTitle>
                  <CardDescription>Apply metadata to all files at once</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={clearFiles}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Rep
                  </Label>
                  <Select value={bulkRepId} onValueChange={setBulkRepId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rep..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profilesLoading ? (
                        <SelectItem value="_loading" disabled>Loading...</SelectItem>
                      ) : (
                        profiles?.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Call Date
                  </Label>
                  <Input
                    type="date"
                    value={bulkCallDate}
                    onChange={e => setBulkCallDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Call Type
                  </Label>
                  <Select value={bulkCallType} onValueChange={v => setBulkCallType(v as CallType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {callTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button onClick={handleApplyToAll} className="w-full">
                    Apply to All ({extractedFiles.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual File List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Extracted Files ({extractedFiles.length})
                  </CardTitle>
                  <CardDescription>
                    {validCount} of {extractedFiles.length} ready to upload
                  </CardDescription>
                </div>
                <Badge variant={validCount === extractedFiles.length ? 'default' : 'secondary'}>
                  {validCount === extractedFiles.length ? 'All Valid' : `${extractedFiles.length - validCount} Incomplete`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {extractedFiles.map((file, index) => {
                    const meta = fileMetadata.get(file.fileName);
                    const isValid = meta?.repId && meta?.accountName && meta?.stakeholderName;
                    
                    return (
                      <div key={file.fileName} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{file.fileName}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          {isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Incomplete
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Rep *</Label>
                            <Select
                              value={meta?.repId || ''}
                              onValueChange={v => updateFileMetadata(file.fileName, { repId: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {profiles?.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Account Name *</Label>
                            <Input
                              className="h-8"
                              value={meta?.accountName || ''}
                              onChange={e => updateFileMetadata(file.fileName, { accountName: e.target.value })}
                              placeholder="Company name"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Stakeholder *</Label>
                            <Input
                              className="h-8"
                              value={meta?.stakeholderName || ''}
                              onChange={e => updateFileMetadata(file.fileName, { stakeholderName: e.target.value })}
                              placeholder="Contact name"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Call Type</Label>
                            <Select
                              value={meta?.callType || 'first_demo'}
                              onValueChange={v => updateFileMetadata(file.fileName, { callType: v as CallType })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {callTypeOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Timeout Warning for Large Uploads */}
          {showTimeoutWarning && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-600">Large Upload Warning</AlertTitle>
              <AlertDescription className="text-amber-600/80">
                Uploading {extractedFiles.length} files may take longer than usual. 
                Consider uploading in smaller batches (50 or fewer) to avoid timeouts.
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={clearFiles}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || validCount === 0}
              className="min-w-[200px]"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {validCount} Transcript{validCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
