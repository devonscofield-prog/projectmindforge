/**
 * ScreenCapture utility for capturing screen frames as Base64 PNG images
 * Used in roleplay sessions to allow AI personas to "see" the rep's screen during demo practice
 */

export class ScreenCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private captureInterval: NodeJS.Timeout | null = null;
  private isCapturing = false;

  private onFrame: (base64Frame: string) => void;
  private onEnd: () => void;
  private intervalMs: number;
  private maxWidthPx: number;

  constructor(options: {
    onFrame: (base64Frame: string) => void;
    onEnd?: () => void;
    intervalMs?: number;
    maxWidthPx?: number;
  }) {
    this.onFrame = options.onFrame;
    this.onEnd = options.onEnd || (() => {});
    this.intervalMs = options.intervalMs || 4000; // Default 4 seconds
    this.maxWidthPx = options.maxWidthPx || 1024; // Max width for compression
  }

  /**
   * Request screen share permission and start capturing
   */
  async start(): Promise<boolean> {
    try {
      // Request screen share permission
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Handle user stopping screen share via browser UI
      const videoTrack = this.stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        console.log('Screen share ended by user');
        this.stop();
        this.onEnd();
      };

      // Create hidden video element to receive stream
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        this.videoElement!.onloadedmetadata = () => {
          this.videoElement!.play();
          resolve();
        };
      });

      // Create canvas for frame capture
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');

      // Start periodic capture
      this.isCapturing = true;
      this.captureInterval = setInterval(() => {
        this.captureFrame();
      }, this.intervalMs);

      // Capture first frame immediately
      this.captureFrame();

      console.log('Screen capture started, interval:', this.intervalMs, 'ms');
      return true;

    } catch (error) {
      console.error('Failed to start screen capture:', error);
      this.stop();
      return false;
    }
  }

  /**
   * Capture a single frame and send it via callback
   */
  private captureFrame(): void {
    if (!this.isCapturing || !this.videoElement || !this.canvas || !this.ctx) {
      return;
    }

    const video = this.videoElement;
    
    // Calculate scaled dimensions to keep image size reasonable
    const aspectRatio = video.videoHeight / video.videoWidth;
    const width = Math.min(video.videoWidth, this.maxWidthPx);
    const height = Math.round(width * aspectRatio);

    this.canvas.width = width;
    this.canvas.height = height;

    // Draw current video frame to canvas
    this.ctx.drawImage(video, 0, 0, width, height);

    // Convert to base64 PNG with compression
    // Using lower quality JPEG for smaller size
    const base64 = this.canvas.toDataURL('image/jpeg', 0.7);
    
    // Remove the data URL prefix to get just the base64 data
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    
    console.log(`Captured frame: ${width}x${height}, size: ${Math.round(base64Data.length / 1024)}KB`);
    
    this.onFrame(base64Data);
  }

  /**
   * Stop screen capture and release resources
   */
  stop(): void {
    this.isCapturing = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.canvas = null;
    this.ctx = null;

    console.log('Screen capture stopped');
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Get a preview of the current screen share for UI display
   */
  getPreviewStream(): MediaStream | null {
    return this.stream;
  }
}
