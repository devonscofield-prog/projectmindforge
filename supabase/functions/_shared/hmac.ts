/**
 * HMAC Request Signing for Service-to-Service Communication
 * 
 * Provides an additional authentication layer beyond service role key validation.
 * Uses HMAC-SHA256 to sign request payloads with a shared secret.
 */

// ============================================================================
// HMAC SIGNATURE GENERATION & VALIDATION
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for a payload
 */
export async function generateHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate HMAC-SHA256 signature
 */
export async function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSignature = await generateHmacSignature(payload, secret);
    
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error('[HMAC] Signature validation error:', error);
    return false;
  }
}

// ============================================================================
// REQUEST SIGNING HEADERS
// ============================================================================

export interface SignedRequestHeaders {
  'X-Request-Signature': string;
  'X-Request-Timestamp': string;
  'X-Request-Nonce': string;
}

/**
 * Generate signed request headers for service-to-service calls
 */
export async function signRequest(
  body: string,
  serviceRoleKey: string
): Promise<SignedRequestHeaders> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  
  // Combine payload elements for signing
  const signaturePayload = `${timestamp}.${nonce}.${body}`;
  
  // Use first 32 chars of service role key as HMAC secret
  const secret = serviceRoleKey.substring(0, 32);
  const signature = await generateHmacSignature(signaturePayload, secret);
  
  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
  };
}

/**
 * Validate signed request from another edge function
 * Returns true if signature is valid and request is within time window
 */
export async function validateSignedRequest(
  headers: Headers,
  body: string,
  serviceRoleKey: string,
  maxAgeMs: number = 300000 // 5 minutes default
): Promise<{ valid: boolean; error?: string }> {
  const signature = headers.get('X-Request-Signature');
  const timestamp = headers.get('X-Request-Timestamp');
  const nonce = headers.get('X-Request-Nonce');
  
  // Check for required headers
  if (!signature || !timestamp || !nonce) {
    return { valid: false, error: 'Missing signature headers' };
  }
  
  // Validate timestamp to prevent replay attacks
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  const now = Date.now();
  if (now - requestTime > maxAgeMs) {
    return { valid: false, error: 'Request expired' };
  }
  
  if (requestTime > now + 60000) { // Allow 1 minute clock skew
    return { valid: false, error: 'Request timestamp in future' };
  }
  
  // Reconstruct and validate signature
  const signaturePayload = `${timestamp}.${nonce}.${body}`;
  const secret = serviceRoleKey.substring(0, 32);
  
  const isValid = await validateHmacSignature(signaturePayload, signature, secret);
  
  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  return { valid: true };
}

// ============================================================================
// HELPER FOR MAKING SIGNED REQUESTS
// ============================================================================

export interface SignedFetchOptions {
  method: 'POST' | 'PUT' | 'PATCH';
  body: Record<string, unknown>;
  serviceRoleKey: string;
}

/**
 * Make a signed fetch request to another edge function
 */
export async function signedFetch(
  url: string,
  options: SignedFetchOptions
): Promise<Response> {
  const bodyString = JSON.stringify(options.body);
  const signatureHeaders = await signRequest(bodyString, options.serviceRoleKey);
  
  return fetch(url, {
    method: options.method,
    headers: {
      'Authorization': `Bearer ${options.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...signatureHeaders,
    },
    body: bodyString,
  });
}

/**
 * Validate an incoming signed request (for receiving edge functions)
 * Call this in edge functions that receive service-to-service calls
 */
export async function requireValidSignature(
  req: Request,
  body: string
): Promise<Response | null> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Check if this is a signed request (has signature headers)
  const hasSignature = req.headers.has('X-Request-Signature');
  
  // If no signature headers, this might be a user request (not service-to-service)
  // Let the caller decide how to handle this case
  if (!hasSignature) {
    return null; // Caller should continue with normal auth
  }
  
  // Validate the signature
  const validation = await validateSignedRequest(
    req.headers,
    body,
    serviceRoleKey
  );
  
  if (!validation.valid) {
    console.warn('[HMAC] Invalid signature:', validation.error);
    return new Response(
      JSON.stringify({ error: 'Invalid request signature', details: validation.error }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return null; // Signature valid, proceed
}
