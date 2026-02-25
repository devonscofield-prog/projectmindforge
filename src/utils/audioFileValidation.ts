export const AUDIO_MIME_TYPES = [
  'audio/mpeg',      // .mp3
  'audio/wav',       // .wav
  'audio/x-wav',     // .wav alternate
  'audio/mp4',       // .m4a
  'audio/x-m4a',     // .m4a alternate
  'audio/webm',      // .webm
  'audio/ogg',       // .ogg
] as const;

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'] as const;
export const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_AUDIO_SIZE_DISPLAY = '100 MB';

export interface AudioFileValidation {
  isValid: boolean;
  error: string | null;
  fileType: string | null;
  fileSizeMB: number;
}

/**
 * Validates an audio file by checking MIME type, file extension, and size.
 * @param file - The File object to validate
 * @returns Validation result with error message if invalid
 */
export function validateAudioFile(file: File): AudioFileValidation {
  const fileSizeMB = file.size / (1024 * 1024);

  // Check MIME type
  const isValidMime = (AUDIO_MIME_TYPES as readonly string[]).includes(file.type);

  // Check file extension as fallback
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  const isValidExtension = (AUDIO_EXTENSIONS as readonly string[]).includes(
    extension as (typeof AUDIO_EXTENSIONS)[number],
  );

  if (!isValidMime && !isValidExtension) {
    return {
      isValid: false,
      error: `Unsupported file type "${file.type || extension}". Accepted formats: ${AUDIO_EXTENSIONS.join(', ')}`,
      fileType: file.type || null,
      fileSizeMB,
    };
  }

  // Check file size
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the ${MAX_AUDIO_SIZE_DISPLAY} limit.`,
      fileType: file.type || null,
      fileSizeMB,
    };
  }

  return {
    isValid: true,
    error: null,
    fileType: file.type || null,
    fileSizeMB,
  };
}

/**
 * Formats a byte count into a human-readable string.
 * @param bytes - The number of bytes
 * @returns Formatted string (e.g., "45.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Gets the duration of an audio file in seconds by creating an Audio element.
 * Returns null if duration cannot be determined (e.g., unsupported format, decode error).
 * @param file - The audio File object
 * @returns Duration in seconds, or null on error
 */
export function getAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      const duration = isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    };

    const onError = () => {
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = objectUrl;
  });
}
