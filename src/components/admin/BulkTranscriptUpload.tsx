import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Trash2, Users, Calendar, Tag, AlertTriangle, User, X, RefreshCw, ExternalLink, Link2, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Separator import removed - unused
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { toast } from 'sonner';
import { useBulkUpload, FileMetadata } from '@/hooks/useBulkUpload';
import { ProcessingMode } from '@/api/bulkUpload';
import { useProfilesBasic } from '@/hooks/useProfiles';
import { callTypeOptions, CallType } from '@/constants/callTypes';
import { cn } from '@/lib/utils';

export function BulkTranscriptUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const {
    extractedFiles,
    fileMetadata,
    isExtracting,
    extractionError,
    extractionProgress,
    extractZip,
    updateFileMetadata,
    applyToAll,
    removeFile,
    clearFiles,
    uploadMutation,
    transcriptStatuses,
    uploadedTranscriptIds,
    processingMode,
    setProcessingMode,
  } = useBulkUpload();
  
  const { data: profiles, isLoading: profilesLoading } = useProfilesBasic();
  
  // ============= Bulk Apply State =============
  // Note: Bulk uploads never create accounts - only store metadata
  const [bulkRepId, setBulkRepId] = useState('');
  const [bulkCallType, setBulkCallType] = useState<CallType>('first_demo');
  const [bulkCallTypeOther, setBulkCallTypeOther] = useState('');
  const [bulkCallDate, setBulkCallDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkStakeholderName, setBulkStakeholderName] = useState('');
  const [bulkSalesforceLink, setBulkSalesforceLink] = useState('');
  
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
    if (bulkStakeholderName.trim()) updates.stakeholderName = bulkStakeholderName.trim();
    if (bulkSalesforceLink.trim()) updates.salesforceLink = bulkSalesforceLink.trim();
    // Handle callTypeOther
    if (bulkCallType === 'other' && bulkCallTypeOther.trim()) {
      updates.callTypeOther = bulkCallTypeOther.trim();
    } else {
      updates.callTypeOther = '';
    }
    
    applyToAll(updates);
    toast.success('Applied to all files');
  }, [bulkRepId, bulkCallType, bulkCallTypeOther, bulkCallDate, bulkStakeholderName, bulkSalesforceLink, applyToAll]);

  // ============= Upload Handler =============
  
  const handleUploadClick = useCallback(() => {
    // Validate all files have required metadata - only repId is required
    // Bulk uploads never create accounts, so account/stakeholder names are optional metadata
    const invalidFiles = extractedFiles.filter(file => {
      const meta = fileMetadata.get(file.fileName);
      return !meta?.repId;
    });
    
    if (invalidFiles.length > 0) {
      toast.error(`${invalidFiles.length} file(s) missing required Rep assignment`);
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmDialog(true);
  }, [extractedFiles, fileMetadata]);
  
  const handleConfirmUpload = useCallback(() => {
    setShowConfirmDialog(false);
    uploadMutation.mutate();
  }, [uploadMutation]);

  // ============= Retry Failed Upload =============
  
  const handleRetryUpload = useCallback(() => {
    uploadMutation.reset();
    setShowConfirmDialog(true);
  }, [uploadMutation]);

  // ============= Compute Stats =============
  
  // Valid = has repId assigned (only required field)
  const validCount = extractedFiles.filter(f => {
    const meta = fileMetadata.get(f.fileName);
    return !!meta?.repId;
  }).length;
  
  const completedCount = transcriptStatuses?.filter(s => 
    s.analysis_status === 'completed' || s.analysis_status === 'skipped'
  ).length || 0;
  const processingCount = transcriptStatuses?.filter(s => 
    s.analysis_status === 'pending' || s.analysis_status === 'processing'
  ).length || 0;
  const errorCount = transcriptStatuses?.filter(s => s.analysis_status === 'error').length || 0;
  
  // Show timeout warning for large uploads
  const LARGE_UPLOAD_THRESHOLD = 50;
  const showTimeoutWarning = extractedFiles.length > LARGE_UPLOAD_THRESHOLD;
  
  // Determine what to show in results based on processing mode
  const showAnalysisStats = uploadMutation.data?.summary.analysisQueued || uploadMutation.data?.summary.analysisFailed;
  const showIndexingStats = uploadMutation.data?.summary.indexingQueued || uploadMutation.data?.summary.indexingFailed;
  
  return (
    <div className="space-y-6">
      {/* Upload Results Summary */}
      {uploadMutation.isSuccess && uploadMutation.data && (
        <Alert variant={uploadMutation.data.summary.insertFailed > 0 ? 'destructive' : 'default'}>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Upload Complete</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span>Total: {uploadMutation.data.summary.total}</span>
              <span className="text-green-600">Inserted: {uploadMutation.data.summary.inserted}</span>
              {showAnalysisStats && (
                <span className="text-blue-600">Analysis Queued: {uploadMutation.data.summary.analysisQueued}</span>
              )}
              {showIndexingStats && (
                <span className="text-purple-600">Indexing Queued: {uploadMutation.data.summary.indexingQueued}</span>
              )}
              {uploadMutation.data.summary.insertFailed > 0 && (
                <>
                  <span className="text-destructive">Failed: {uploadMutation.data.summary.insertFailed}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetryUpload}
                    className="ml-auto"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Upload
                  </Button>
                </>
              )}
              {uploadMutation.data.summary.inserted > 0 && (
                <Button variant="outline" size="sm" asChild className="ml-auto">
                  <Link to="/admin/transcript-analysis?source=bulk_upload">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Uploaded Transcripts
                  </Link>
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Processing Progress */}
      {uploadedTranscriptIds.length > 0 && transcriptStatuses && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {processingMode === 'analyze' ? 'Analysis Progress' : 'Indexing Progress'}
            </CardTitle>
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
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                {extractionProgress ? (
                  <>
                    <p className="text-muted-foreground mb-2">
                      Extracting file {extractionProgress.current} of {extractionProgress.total}
                    </p>
                    <Progress 
                      value={(extractionProgress.current / extractionProgress.total) * 100} 
                      className="w-64 h-2 mb-2"
                    />
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {extractionProgress.currentFileName}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading ZIP file...</p>
                )}
              </div>
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
                  <CardDescription>
                    Apply metadata to all files. Only Rep is required. Transcripts are indexed for search but not linked to accounts.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={clearFiles}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Processing Mode Selector */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium mb-3 block">Processing Mode</Label>
                <RadioGroup
                  value={processingMode}
                  onValueChange={(v) => setProcessingMode(v as ProcessingMode)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    processingMode === 'analyze' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}>
                    <RadioGroupItem value="analyze" id="mode-analyze" className="mt-0.5" />
                    <label htmlFor="mode-analyze" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Full Analysis
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Coaching insights, call notes, MEDDPICC scoring + RAG indexing
                      </p>
                    </label>
                  </div>
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    processingMode === 'index_only' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}>
                    <RadioGroupItem value="index_only" id="mode-index" className="mt-0.5" />
                    <label htmlFor="mode-index" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Search className="h-4 w-4 text-purple-500" />
                        Index Only (RAG)
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fast indexing for search only. No coaching analysis.
                      </p>
                    </label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Rep <span className="text-destructive">*</span>
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
                
                {/* Optional metadata fields */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Stakeholder Name (optional)
                  </Label>
                  <Input
                    value={bulkStakeholderName}
                    onChange={e => setBulkStakeholderName(e.target.value)}
                    placeholder="Contact name..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Call Date (optional)
                  </Label>
                  <Input
                    type="date"
                    value={bulkCallDate}
                    onChange={e => setBulkCallDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    Call Type (optional)
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
                
                {bulkCallType === 'other' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Other Call Type</Label>
                    <Input
                      value={bulkCallTypeOther}
                      onChange={e => setBulkCallTypeOther(e.target.value)}
                      placeholder="Describe call type..."
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    Salesforce Link (optional)
                  </Label>
                  <Input
                    value={bulkSalesforceLink}
                    onChange={e => setBulkSalesforceLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={handleApplyToAll} className="w-full">
                    Apply to All ({extractedFiles.length})
                  </Button>
                </div>
              </div>
              
              {/* Info note about bulk uploads */}
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Note About Bulk Uploads</AlertTitle>
                <AlertDescription>
                  Bulk uploaded transcripts are indexed for search but not linked to accounts. 
                  To link transcripts to accounts, submit them individually through the Call Submission form.
                </AlertDescription>
              </Alert>
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
                  {extractedFiles.map((file, _index) => {
                    const meta = fileMetadata.get(file.fileName);
                    const isValid = !!meta?.repId; // Only repId is required
                    
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
                          <div className="flex items-center gap-2">
                            {isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                Needs Rep
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFile(file.fileName)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                            <Label className="text-xs text-muted-foreground">Account</Label>
                            <Input
                              className="h-8"
                              value={meta?.accountName || ''}
                              onChange={e => updateFileMetadata(file.fileName, { accountName: e.target.value })}
                              placeholder="Company name"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Stakeholder</Label>
                            <Input
                              className="h-8"
                              value={meta?.stakeholderName || ''}
                              onChange={e => updateFileMetadata(file.fileName, { stakeholderName: e.target.value })}
                              placeholder="Contact name"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Call Date</Label>
                            <Input
                              type="date"
                              className="h-8"
                              value={meta?.callDate || ''}
                              onChange={e => updateFileMetadata(file.fileName, { callDate: e.target.value })}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Call Type</Label>
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
                        
                        {/* Other Call Type Input */}
                        {meta?.callType === 'other' && (
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Other Call Type Description</Label>
                            <Input
                              className="h-8 mt-1"
                              value={meta?.callTypeOther || ''}
                              onChange={e => updateFileMetadata(file.fileName, { callTypeOther: e.target.value })}
                              placeholder="Describe the call type..."
                            />
                          </div>
                        )}
                        
                        {/* Salesforce Link Input */}
                        <div className="mt-2">
                          <Label className="text-xs text-muted-foreground">Salesforce Link</Label>
                          <Input
                            className="h-8 mt-1"
                            value={meta?.salesforceLink || ''}
                            onChange={e => updateFileMetadata(file.fileName, { salesforceLink: e.target.value })}
                            placeholder="https://..."
                          />
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
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending || validCount === 0}
              variant="gradient"
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
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Upload</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to upload <strong>{validCount} transcript{validCount !== 1 ? 's' : ''}</strong>.
                </p>
                <p className="text-muted-foreground">
                  Transcripts will be indexed for search but not linked to accounts.
                </p>
                {showTimeoutWarning && (
                  <p className="text-amber-600">
                    Note: Large uploads may take several minutes to process.
                  </p>
                )}
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="font-medium flex items-center gap-2">
                    {processingMode === 'analyze' ? (
                      <>
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Full Analysis Mode
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 text-purple-500" />
                        Index Only Mode
                      </>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {processingMode === 'analyze' 
                      ? 'Transcripts will be analyzed for coaching insights and indexed for RAG search.'
                      : 'Transcripts will be indexed for RAG search only. No coaching analysis will run.'}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>
              Upload {validCount} Transcript{validCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
