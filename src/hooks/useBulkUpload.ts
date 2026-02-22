import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CallType } from '@/constants/callTypes';
import {
  uploadBulkTranscripts,
  getTranscriptStatuses,
  BulkTranscriptItem,
  BulkUploadResponse,
  TranscriptStatus,
  ProcessingMode,
} from '@/api/bulkUpload';

// ============= Type Definitions =============

export interface ExtractedFile {
  fileName: string;
  content: string;
  size: number;
}

export interface FileMetadata {
  fileName: string;
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  accountName: string;      // May be empty in raw mode
  stakeholderName: string;  // May be empty in raw mode
  salesforceLink?: string;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  currentFileName: string;
}

export interface UseBulkUploadResult {
  // State
  extractedFiles: ExtractedFile[];
  fileMetadata: Map<string, FileMetadata>;
  uploadedTranscriptIds: string[];
  isExtracting: boolean;
  extractionError: string | null;
  extractionProgress: ExtractionProgress | null;
  processingMode: ProcessingMode;
  
  // Actions
  extractZip: (file: File) => Promise<void>;
  updateFileMetadata: (fileName: string, metadata: Partial<FileMetadata>) => void;
  applyToAll: (metadata: Partial<Omit<FileMetadata, 'fileName'>>) => void;
  removeFile: (fileName: string) => void;
  clearFiles: () => void;
  setProcessingMode: (mode: ProcessingMode) => void;
  
  // Upload mutation
  uploadMutation: ReturnType<typeof useMutation<BulkUploadResponse, Error, void>>;
  
  // Status polling
  transcriptStatuses: TranscriptStatus[] | undefined;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
}

// ============= Constants =============

const MAX_FILE_SIZE = 500 * 1024; // 500KB per file
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB total ZIP size
const MIN_TRANSCRIPT_LENGTH = 500; // Minimum 500 characters
const MAX_FILES = 100;
const POLL_INTERVAL = 5000; // 5 seconds

// ============= Helper Functions =============

/**
 * Generate a unique filename by appending a counter if duplicates exist
 */
function getUniqueFileName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  
  // Extract name and extension
  const lastDotIndex = baseName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? baseName.slice(0, lastDotIndex) : baseName;
  const ext = lastDotIndex > 0 ? baseName.slice(lastDotIndex) : '';
  
  let counter = 1;
  let uniqueName = `${name}_${counter}${ext}`;
  
  while (existingNames.has(uniqueName)) {
    counter++;
    uniqueName = `${name}_${counter}${ext}`;
  }
  
  return uniqueName;
}

// ============= Hook Implementation =============

export function useBulkUpload(): UseBulkUploadResult {
  // Extracted files state
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [fileMetadata, setFileMetadata] = useState<Map<string, FileMetadata>>(new Map());
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  
  // Upload tracking
  const [uploadedTranscriptIds, setUploadedTranscriptIds] = useState<string[]>([]);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  
  // Processing mode
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('analyze');

  // ============= ZIP Extraction =============
  
  const extractZip = useCallback(async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractionProgress(null);
    
    try {
      // Validate ZIP file size
      if (file.size > MAX_ZIP_SIZE) {
        throw new Error(`ZIP file too large. Maximum is ${MAX_ZIP_SIZE / 1024 / 1024}MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      }
      
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      const txtFiles: ExtractedFile[] = [];
      const newMetadata = new Map<string, FileMetadata>();
      const usedFileNames = new Set<string>();
      const skippedFiles: { name: string; reason: string }[] = [];
      
      // Filter for .txt files only
      const fileNames = Object.keys(zip.files).filter(name => 
        name.toLowerCase().endsWith('.txt') && !zip.files[name].dir
      );
      
      if (fileNames.length === 0) {
        throw new Error('No .txt files found in ZIP archive');
      }
      
      if (fileNames.length > MAX_FILES) {
        throw new Error(`Too many files. Maximum is ${MAX_FILES}, found ${fileNames.length}`);
      }
      
      // Extract each file
      for (let i = 0; i < fileNames.length; i++) {
        const fileName = fileNames[i];
        const baseFileName = fileName.split('/').pop() || fileName;
        
        // Update progress
        setExtractionProgress({
          current: i + 1,
          total: fileNames.length,
          currentFileName: baseFileName,
        });
        
        const zipEntry = zip.files[fileName];
        const content = await zipEntry.async('string');
        
        // Check file size
        const size = new Blob([content]).size;
        if (size > MAX_FILE_SIZE) {
          skippedFiles.push({ name: baseFileName, reason: `exceeds ${MAX_FILE_SIZE / 1024}KB limit` });
          console.warn(`[useBulkUpload] File ${fileName} exceeds size limit (${size} bytes)`);
          continue;
        }
        
        // Check minimum transcript length
        const trimmedContent = content.trim();
        if (trimmedContent.length < MIN_TRANSCRIPT_LENGTH) {
          skippedFiles.push({ name: fileName, reason: `too short (min ${MIN_TRANSCRIPT_LENGTH} chars)` });
          console.warn(`[useBulkUpload] File ${fileName} too short (${trimmedContent.length} chars)`);
          continue;
        }
        
        // Handle duplicates using baseFileName already defined above
        const uniqueFileName = getUniqueFileName(baseFileName, usedFileNames);
        usedFileNames.add(uniqueFileName);
        
        txtFiles.push({
          fileName: uniqueFileName,
          content: trimmedContent,
          size,
        });
        
        // Initialize metadata with defaults
        const today = new Date().toISOString().split('T')[0];
        newMetadata.set(uniqueFileName, {
          fileName: uniqueFileName,
          repId: '',
          callDate: today,
          callType: 'first_demo',
          accountName: uniqueFileName.replace(/\.txt$/i, '').replace(/_\d+$/, ''), // Remove counter from account name
          stakeholderName: '',
        });
      }
      
      if (txtFiles.length === 0) {
        throw new Error('No valid transcript files found. All files were either too large or too short.');
      }
      
      setExtractedFiles(txtFiles);
      setFileMetadata(newMetadata);
      
      // Show warning if some files were skipped
      if (skippedFiles.length > 0) {
        console.warn(`[useBulkUpload] Skipped ${skippedFiles.length} files:`, skippedFiles);
        toast.warning(`${skippedFiles.length} file(s) skipped: ${skippedFiles.map(f => f.reason).join(', ')}`);
      }
      
      console.log(`[useBulkUpload] Extracted ${txtFiles.length} files`);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract ZIP file';
      console.error('[useBulkUpload] Extraction error:', error);
      setExtractionError(message);
      setExtractedFiles([]);
      setFileMetadata(new Map());
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  }, []);

  // ============= Metadata Management =============
  
  const updateFileMetadata = useCallback((fileName: string, metadata: Partial<FileMetadata>) => {
    setFileMetadata(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(fileName);
      if (existing) {
        newMap.set(fileName, { ...existing, ...metadata });
      }
      return newMap;
    });
  }, []);
  
  const applyToAll = useCallback((metadata: Partial<Omit<FileMetadata, 'fileName'>>) => {
    setFileMetadata(prev => {
      const newMap = new Map(prev);
      for (const [fileName, existing] of newMap) {
        newMap.set(fileName, { ...existing, ...metadata });
      }
      return newMap;
    });
  }, []);
  
  const removeFile = useCallback((fileName: string) => {
    setExtractedFiles(prev => prev.filter(f => f.fileName !== fileName));
    setFileMetadata(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileName);
      return newMap;
    });
  }, []);
  
  const clearFiles = useCallback(() => {
    setExtractedFiles([]);
    setFileMetadata(new Map());
    setUploadedTranscriptIds([]);
    setExtractionError(null);
    setIsPollingEnabled(false);
  }, []);

  // ============= Upload Mutation =============
  
  const uploadMutation = useMutation<BulkUploadResponse, Error, void>({
    mutationFn: async () => {
      // Build transcript items from extracted files and metadata
      const transcripts: BulkTranscriptItem[] = [];
      
      for (const file of extractedFiles) {
        const meta = fileMetadata.get(file.fileName);
        if (!meta || !meta.repId) continue;
        
        transcripts.push({
          fileName: file.fileName,
          rawText: file.content,
          repId: meta.repId,
          // Only include optional fields if they have values
          ...(meta.callDate && { callDate: meta.callDate }),
          ...(meta.callType && { callType: meta.callType }),
          ...(meta.callTypeOther && { callTypeOther: meta.callTypeOther }),
          ...(meta.accountName?.trim() && { accountName: meta.accountName.trim() }),
          ...(meta.stakeholderName?.trim() && { stakeholderName: meta.stakeholderName.trim() }),
          ...(meta.salesforceLink?.trim() && { salesforceLink: meta.salesforceLink.trim() }),
        });
      }
      
      if (transcripts.length === 0) {
        throw new Error('No valid transcripts to upload. Ensure all files have a Rep assigned.');
      }
      
      return uploadBulkTranscripts(transcripts, processingMode);
    },
    onSuccess: (data) => {
      // Extract transcript IDs for status polling
      const ids = data.results
        .filter(r => r.transcriptId)
        .map(r => r.transcriptId!);
      
      setUploadedTranscriptIds(ids);
      
      // Auto-start polling if we have uploaded transcripts
      if (ids.length > 0) {
        setIsPollingEnabled(true);
      }
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  // ============= Status Polling =============
  
  const { data: transcriptStatuses, isLoading: isPolling } = useQuery({
    queryKey: ['bulk-upload-status', uploadedTranscriptIds],
    queryFn: () => getTranscriptStatuses(uploadedTranscriptIds),
    enabled: isPollingEnabled && uploadedTranscriptIds.length > 0,
    refetchInterval: POLL_INTERVAL,
    // Stop polling when all transcripts are completed or errored
    refetchIntervalInBackground: false,
  });
  
  const startPolling = useCallback(() => {
    if (uploadedTranscriptIds.length > 0) {
      setIsPollingEnabled(true);
    }
  }, [uploadedTranscriptIds.length]);
  
  const stopPolling = useCallback(() => {
    setIsPollingEnabled(false);
  }, []);

  // Auto-stop polling when all transcripts are processed
  useEffect(() => {
    if (!transcriptStatuses || !isPollingEnabled || transcriptStatuses.length === 0) return;
    
    // For index_only mode, we check for chunks; for analyze mode, we check analysis_status
    const allComplete = transcriptStatuses.every(
      s => s.analysis_status === 'completed' || s.analysis_status === 'error' || s.analysis_status === 'skipped'
    );
    
    if (allComplete) {
      setIsPollingEnabled(false);
      const errorCount = transcriptStatuses.filter(s => s.analysis_status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`Processing complete: ${errorCount} transcript(s) had errors`);
      } else {
        toast.success('All transcripts processed successfully!');
      }
    }
  }, [transcriptStatuses, isPollingEnabled]);

  return {
    // State
    extractedFiles,
    fileMetadata,
    uploadedTranscriptIds,
    isExtracting,
    extractionError,
    extractionProgress,
    processingMode,
    
    // Actions
    extractZip,
    updateFileMetadata,
    applyToAll,
    removeFile,
    clearFiles,
    setProcessingMode,
    
    // Upload mutation
    uploadMutation,
    
    // Status polling
    transcriptStatuses,
    isPolling,
    startPolling,
    stopPolling,
  };
}
