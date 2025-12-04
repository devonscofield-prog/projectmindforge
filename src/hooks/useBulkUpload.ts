import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { CallType } from '@/constants/callTypes';
import {
  uploadBulkTranscripts,
  getTranscriptStatuses,
  BulkTranscriptItem,
  BulkUploadResponse,
  TranscriptStatus,
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
  accountName: string;
  stakeholderName: string;
  salesforceLink?: string;
}

export interface UseBulkUploadResult {
  // State
  extractedFiles: ExtractedFile[];
  fileMetadata: Map<string, FileMetadata>;
  uploadedTranscriptIds: string[];
  isExtracting: boolean;
  extractionError: string | null;
  
  // Actions
  extractZip: (file: File) => Promise<void>;
  updateFileMetadata: (fileName: string, metadata: Partial<FileMetadata>) => void;
  applyToAll: (metadata: Partial<Omit<FileMetadata, 'fileName'>>) => void;
  clearFiles: () => void;
  
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
const MAX_FILES = 100;
const POLL_INTERVAL = 5000; // 5 seconds

// ============= Hook Implementation =============

export function useBulkUpload(): UseBulkUploadResult {
  // Extracted files state
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [fileMetadata, setFileMetadata] = useState<Map<string, FileMetadata>>(new Map());
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  
  // Upload tracking
  const [uploadedTranscriptIds, setUploadedTranscriptIds] = useState<string[]>([]);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);

  // ============= ZIP Extraction =============
  
  const extractZip = useCallback(async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    
    try {
      const zip = await JSZip.loadAsync(file);
      const txtFiles: ExtractedFile[] = [];
      const newMetadata = new Map<string, FileMetadata>();
      
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
      for (const fileName of fileNames) {
        const zipEntry = zip.files[fileName];
        const content = await zipEntry.async('string');
        
        // Check file size
        const size = new Blob([content]).size;
        if (size > MAX_FILE_SIZE) {
          console.warn(`[useBulkUpload] File ${fileName} exceeds size limit (${size} bytes)`);
          continue;
        }
        
        // Extract just the filename without path
        const cleanFileName = fileName.split('/').pop() || fileName;
        
        txtFiles.push({
          fileName: cleanFileName,
          content,
          size,
        });
        
        // Initialize metadata with defaults
        const today = new Date().toISOString().split('T')[0];
        newMetadata.set(cleanFileName, {
          fileName: cleanFileName,
          repId: '',
          callDate: today,
          callType: 'first_demo',
          accountName: cleanFileName.replace(/\.txt$/i, ''),
          stakeholderName: '',
        });
      }
      
      setExtractedFiles(txtFiles);
      setFileMetadata(newMetadata);
      
      console.log(`[useBulkUpload] Extracted ${txtFiles.length} files`);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract ZIP file';
      console.error('[useBulkUpload] Extraction error:', error);
      setExtractionError(message);
      setExtractedFiles([]);
      setFileMetadata(new Map());
    } finally {
      setIsExtracting(false);
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
          callDate: meta.callDate,
          callType: meta.callType,
          callTypeOther: meta.callTypeOther,
          accountName: meta.accountName,
          stakeholderName: meta.stakeholderName,
          salesforceLink: meta.salesforceLink,
        });
      }
      
      if (transcripts.length === 0) {
        throw new Error('No valid transcripts to upload. Ensure all files have a Rep assigned.');
      }
      
      return uploadBulkTranscripts(transcripts);
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
    
    const allComplete = transcriptStatuses.every(
      s => s.analysis_status === 'completed' || s.analysis_status === 'error'
    );
    
    if (allComplete) {
      setIsPollingEnabled(false);
      const errorCount = transcriptStatuses.filter(s => s.analysis_status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`Analysis complete: ${errorCount} transcript(s) had errors`);
      } else {
        toast.success('All transcripts analyzed successfully!');
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
    
    // Actions
    extractZip,
    updateFileMetadata,
    applyToAll,
    clearFiles,
    
    // Upload mutation
    uploadMutation,
    
    // Status polling
    transcriptStatuses,
    isPolling,
    startPolling,
    stopPolling,
  };
}
