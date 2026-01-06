// Device ID generation and management for MFA trusted devices
// Uses multi-layer persistence: localStorage + cookie fallback

const DEVICE_ID_KEY = 'mfa_device_id';
const DEVICE_ID_COOKIE = 'mfa_did';
const TRUST_DAYS = 30;

/**
 * Generate a unique device ID based on browser characteristics
 * This creates a reasonably unique fingerprint for the device
 */
function generateDeviceId(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    // Add a random component to ensure uniqueness
    crypto.randomUUID(),
  ];
  
  // Create a hash-like string from components
  const fingerprint = components.join('|');
  
  // Convert to a base64-like identifier
  return btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

/**
 * Persist device ID to both localStorage and cookie
 */
function persistDeviceId(deviceId: string): void {
  // Save to localStorage
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  
  // Save to cookie (30 day expiry, same as trust period)
  const expires = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${DEVICE_ID_COOKIE}=${deviceId}; expires=${expires}; path=/; SameSite=Strict`;
}

/**
 * Get or create the device ID for this browser
 * Uses multi-layer persistence: localStorage → cookie → generate new
 */
export function getDeviceId(): string {
  // 1. Try localStorage first (fastest)
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  // 2. If not in localStorage, try cookie fallback
  if (!deviceId) {
    deviceId = getCookie(DEVICE_ID_COOKIE);
    if (deviceId) {
      // Restore to localStorage for faster access next time
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
  }
  
  // 3. If still not found, generate new
  if (!deviceId) {
    deviceId = generateDeviceId();
  }
  
  // Always sync to both storage locations
  persistDeviceId(deviceId);
  
  return deviceId;
}

/**
 * Get a human-readable device name based on user agent
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  
  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // Detect Browser
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  
  return `${browser} on ${os}`;
}

/**
 * Clear the device ID (for testing or reset purposes)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
}
