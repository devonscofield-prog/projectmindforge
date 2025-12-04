/**
 * RAG V2 Chunking Utilities
 * Speaker-aware, recursive chunking with overlap for transcript processing
 */

// Constants used across the chunking system
export const CHUNK_SIZE = 2000;
export const CHUNK_OVERLAP = 200;

/**
 * Speaker-aware recursive text chunking
 * Priority: Speaker turns > Paragraph breaks > Sentence boundaries
 */
export function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Priority splitters: Speaker turns first, then paragraphs, then sentences
  const speakerPattern = /(?=\n\n(?:REP|PROSPECT):)/gi;
  const paragraphPattern = /\n\n+/;
  const sentencePattern = /(?<=[.!?])\s+/;

  // Step 1: Split by speaker turns first (preserves speaker labels)
  let sections = text.split(speakerPattern).filter(s => s.trim().length > 0);

  // Step 2: Further split any oversized sections by paragraphs
  sections = recursiveSplit(sections, paragraphPattern, CHUNK_SIZE * 1.5);

  // Step 3: Further split any still-oversized sections by sentences
  sections = recursiveSplit(sections, sentencePattern, CHUNK_SIZE * 1.5);

  // Step 4: Final chunking with overlap
  return mergeWithOverlap(sections);
}

/**
 * Recursively split sections that exceed maxSize using the given pattern
 */
function recursiveSplit(sections: string[], pattern: RegExp, maxSize: number): string[] {
  const result: string[] = [];

  for (const section of sections) {
    if (section.length <= maxSize) {
      result.push(section);
    } else {
      // Split and filter empty strings
      const parts = section.split(pattern).filter(s => s.trim().length > 0);
      
      if (parts.length === 1) {
        // Pattern didn't split further, keep as is
        result.push(section);
      } else {
        result.push(...parts);
      }
    }
  }

  return result;
}

/**
 * Merge sections into chunks with overlap, respecting CHUNK_SIZE
 */
function mergeWithOverlap(sections: string[]): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    const combinedLength = buffer.length + (buffer ? 2 : 0) + trimmedSection.length;

    if (combinedLength <= CHUNK_SIZE) {
      // Section fits in current buffer
      buffer += (buffer ? '\n\n' : '') + trimmedSection;
    } else {
      // Push current buffer if it has content
      if (buffer.length > 0) {
        chunks.push(buffer.trim());
      }

      // Start new buffer with overlap from previous
      if (buffer.length > CHUNK_OVERLAP) {
        const overlapText = buffer.slice(-CHUNK_OVERLAP).trim();
        buffer = overlapText + '\n\n' + trimmedSection;
      } else {
        buffer = trimmedSection;
      }

      // Handle sections larger than CHUNK_SIZE (force split)
      while (buffer.length > CHUNK_SIZE) {
        chunks.push(buffer.slice(0, CHUNK_SIZE).trim());
        const overlap = buffer.slice(CHUNK_SIZE - CHUNK_OVERLAP, CHUNK_SIZE);
        buffer = overlap + buffer.slice(CHUNK_SIZE);
      }
    }
  }

  // Push remaining buffer
  if (buffer.trim().length > 0) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

/**
 * Generate embedding using Supabase.ai gte-small model
 * Returns PostgreSQL array string format for direct database insertion
 * 
 * NOTE: This function is designed to run in Supabase Edge Function environment
 * where Supabase.ai is available globally
 */
export async function generateEmbedding(
  text: string,
  supabaseAi: { Session: new (model: string) => { run: (text: string, options: { mean_pool: boolean; normalize: boolean }) => Promise<number[]> } }
): Promise<string> {
  const embeddingModel = new supabaseAi.Session('gte-small');

  const embedding: number[] = await embeddingModel.run(text, {
    mean_pool: true,
    normalize: true,
  });

  // Format as PostgreSQL array string: {0.123, -0.456, ...}
  return `{${embedding.join(',')}}`;
}

/**
 * Utility to format embedding array for PostgreSQL
 * Use when you already have the number array
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `{${embedding.join(',')}}`;
}
