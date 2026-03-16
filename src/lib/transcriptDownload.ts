import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { generateCSV } from '@/lib/csvParser';

interface TranscriptData {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  raw_text: string;
  rep_name?: string;
}

/**
 * Sanitize a string to be safe for use in filenames
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .substring(0, 50)              // Limit length
    .trim();
}

/**
 * Generate a descriptive filename for a transcript
 */
function generateFileName(transcript: TranscriptData): string {
  const date = transcript.call_date || 'unknown-date';
  const account = sanitizeFileName(transcript.account_name || 'Unknown_Account');
  const callType = sanitizeFileName(transcript.call_type || 'call');
  const rep = sanitizeFileName(transcript.rep_name || 'Unknown_Rep');
  
  return `${date}_${account}_${callType}_${rep}.txt`;
}

/**
 * Download a single transcript as a .txt file
 */
export function downloadSingleTranscript(transcript: TranscriptData): void {
  const fileName = generateFileName(transcript);
  const content = transcript.raw_text || '';
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download multiple transcripts as a ZIP file
 */
export async function downloadTranscriptsAsZip(transcripts: TranscriptData[]): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const fileNames = new Map<string, number>();
  
  for (const transcript of transcripts) {
    let fileName = generateFileName(transcript);
    
    // Handle duplicate filenames by appending a number
    const count = fileNames.get(fileName) || 0;
    if (count > 0) {
      const baseName = fileName.replace('.txt', '');
      fileName = `${baseName}_${count}.txt`;
    }
    fileNames.set(fileName, count + 1);
    
    const content = transcript.raw_text || '';
    zip.file(fileName, content);
  }
  
  const today = new Date().toISOString().split('T')[0];
  const zipFileName = `transcripts_${today}.zip`;
  
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download transcripts - single file for one, ZIP for multiple
 */
export async function downloadTranscripts(transcripts: TranscriptData[]): Promise<void> {
  if (transcripts.length === 0) return;
  
  if (transcripts.length === 1) {
    downloadSingleTranscript(transcripts[0]);
  } else {
    await downloadTranscriptsAsZip(transcripts);
  }
}

export interface BulkDownloadProgress {
  phase: 'fetching' | 'building' | 'done';
  fetched: number;
  total: number;
}

/**
 * Fetch ALL transcripts from the database (paginated) and download as a ZIP
 * containing an index.csv and individual .txt files.
 */
export async function downloadAllTranscriptsAsZip(
  onProgress?: (progress: BulkDownloadProgress) => void
): Promise<void> {
  const BATCH_SIZE = 500;
  let offset = 0;
  let totalCount = 0;
  const allTranscripts: TranscriptData[] = [];

  // Phase 1: Fetch all transcripts in batches
  do {
    onProgress?.({ phase: 'fetching', fetched: allTranscripts.length, total: totalCount || 0 });

    const { data, error } = await (supabase.rpc as Function)(
      'get_admin_transcripts',
      {
        p_from_date: '2000-01-01',
        p_to_date: '2099-12-31',
        p_limit: BATCH_SIZE,
        p_offset: offset,
      }
    );

    if (error) throw new Error(`Failed to fetch transcripts: ${error.message}`);

    const results = data as Array<{
      id: string;
      call_date: string;
      account_name: string | null;
      call_type: string | null;
      raw_text: string;
      rep_id: string;
      rep_name: string;
      team_name: string;
      total_count: number;
    }>;

    if (results.length === 0) break;

    if (totalCount === 0) {
      totalCount = results[0].total_count;
    }

    for (const r of results) {
      allTranscripts.push({
        id: r.id,
        call_date: r.call_date,
        account_name: r.account_name,
        call_type: r.call_type,
        raw_text: r.raw_text,
        rep_name: r.rep_name,
      });
    }

    offset += BATCH_SIZE;
  } while (allTranscripts.length < totalCount);

  if (allTranscripts.length === 0) {
    throw new Error('No transcripts found');
  }

  // Phase 2: Build ZIP
  onProgress?.({ phase: 'building', fetched: allTranscripts.length, total: allTranscripts.length });

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const fileNames = new Map<string, number>();
  const csvRows: Record<string, string>[] = [];

  for (const transcript of allTranscripts) {
    let fileName = generateFileName(transcript);

    // Handle duplicate filenames
    const count = fileNames.get(fileName) || 0;
    if (count > 0) {
      fileName = fileName.replace('.txt', `_${count}.txt`);
    }
    fileNames.set(fileName, count + 1);

    zip.file(fileName, transcript.raw_text || '');

    csvRows.push({
      filename: fileName,
      rep_name: transcript.rep_name || '',
      call_date: transcript.call_date || '',
      account_name: transcript.account_name || '',
      call_type: transcript.call_type || '',
    });
  }

  // Add index.csv
  const csvHeaders = ['filename', 'rep_name', 'call_date', 'account_name', 'call_type'];
  const csvContent = generateCSV(csvHeaders, csvRows);
  zip.file('index.csv', csvContent);

  const today = format(new Date(), 'yyyy-MM-dd');
  const zipFileName = `all_transcripts_${today}.zip`;

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  onProgress?.({ phase: 'done', fetched: allTranscripts.length, total: allTranscripts.length });
}
