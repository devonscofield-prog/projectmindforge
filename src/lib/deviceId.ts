// Device ID generation and management for MFA trusted devices
// Uses multi-layer persistence: localStorage + cookie + IndexedDB fallback

const DEVICE_ID_KEY = 'mfa_device_id';
const DEVICE_ID_COOKIE = 'mfa_did';
const TRUST_DAYS = 30;
const IDB_DB_NAME = 'mfa_device';
const IDB_STORE_NAME = 'device';

/**
 * Generate a deterministic device ID based on browser characteristics
 * This creates a stable fingerprint for the device (no random components)
 */
function generateDeviceId(): string {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    navigator.platform || 'unknown',
    nav.deviceMemory || 'unknown',
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
 * Persist device ID to localStorage and cookie
 */
function persistDeviceId(deviceId: string): void {
  // Save to localStorage
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch (e) {
    console.warn('[deviceId] localStorage not available');
  }
  
  // Save to cookie (30 day expiry, same as trust period)
  const expires = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${DEVICE_ID_COOKIE}=${deviceId}; expires=${expires}; path=/${secure}; SameSite=Lax`;
  
  // Also save to IndexedDB (fire-and-forget)
  saveDeviceIdToIndexedDB(deviceId).catch(() => {});
}

/**
 * Get device ID from IndexedDB (tertiary fallback)
 */
async function getDeviceIdFromIndexedDB(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(IDB_STORE_NAME, 'readonly');
          const store = tx.objectStore(IDB_STORE_NAME);
          const get = store.get('deviceId');
          get.onsuccess = () => resolve(get.result?.value || null);
          get.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save device ID to IndexedDB
 */
async function saveDeviceIdToIndexedDB(deviceId: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onerror = () => resolve();
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
          const store = tx.objectStore(IDB_STORE_NAME);
          store.put({ key: 'deviceId', value: deviceId });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
        }
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Get or create the device ID for this browser (synchronous version)
 * Uses multi-layer persistence: localStorage → cookie → generate new
 */
export function getDeviceId(): string {
  let deviceId: string | null = null;
  let source = 'generated';
  
  // 1. Try localStorage first (fastest)
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) source = 'localStorage';
  } catch {
    // localStorage not available
  }
  
  // 2. If not in localStorage, try cookie fallback
  if (!deviceId) {
    deviceId = getCookie(DEVICE_ID_COOKIE);
    if (deviceId) {
      source = 'cookie';
      // Restore to localStorage for faster access next time
      try {
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      } catch {
        // localStorage not available
      }
    }
  }
  
  // 3. If still not found, generate new deterministic ID
  if (!deviceId) {
    deviceId = generateDeviceId();
    source = 'generated';
  }
  
  // Log for debugging
  console.log(`[deviceId] Source: ${source}, ID: ${deviceId.substring(0, 8)}...`);
  
  // Always sync to storage locations
  persistDeviceId(deviceId);
  
  return deviceId;
}

/**
 * Async version that also checks IndexedDB
 * Call this during MFA verification for maximum persistence
 */
export async function getDeviceIdAsync(): Promise<string> {
  let deviceId: string | null = null;
  let source = 'generated';
  
  // 1. Try localStorage first
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) source = 'localStorage';
  } catch {
    // localStorage not available
  }
  
  // 2. Try cookie
  if (!deviceId) {
    deviceId = getCookie(DEVICE_ID_COOKIE);
    if (deviceId) source = 'cookie';
  }
  
  // 3. Try IndexedDB
  if (!deviceId) {
    deviceId = await getDeviceIdFromIndexedDB();
    if (deviceId) source = 'indexedDB';
  }
  
  // 4. Generate if still not found
  if (!deviceId) {
    deviceId = generateDeviceId();
    source = 'generated';
  }
  
  console.log(`[deviceId] Async source: ${source}, ID: ${deviceId.substring(0, 8)}...`);
  
  // Sync to all storage
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
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // localStorage not available
  }
  // Clear cookie
  document.cookie = `${DEVICE_ID_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
