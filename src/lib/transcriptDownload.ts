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
