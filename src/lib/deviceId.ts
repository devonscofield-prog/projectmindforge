// Device ID generation and management for MFA trusted devices

const DEVICE_ID_KEY = 'mfa_device_id';

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
 * Get or create the device ID for this browser
 * Stored in localStorage for persistence
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
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
