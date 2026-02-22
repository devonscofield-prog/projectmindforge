/**
 * Agent-Level Response Cache
 *
 * Content-addressed caching for agent results using SHA-256 hash of transcript content.
 * If the transcript hasn't changed (same hash), agent results are reused without LLM calls.
 *
 * Cache is stored on the ai_call_analysis row's raw_json field under a `_agent_cache` key,
 * keyed by `${agentName}:${contentHash}`.
 */

/**
 * Compute SHA-256 hash of transcript content.
 * Returns a hex string suitable for cache keys.
 */
export async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache entry stored per agent result.
 */
export interface AgentCacheEntry {
  contentHash: string;
  result: unknown;
  cachedAt: string;
}

/**
 * The full cache object stored in raw_json._agent_cache
 */
export type AgentCacheMap = Record<string, AgentCacheEntry>;

/**
 * Check for a cached agent result.
 * Returns the cached result if the content hash matches, null otherwise.
 */
export function getCachedAgentResult(
  agentCache: AgentCacheMap | undefined,
  agentName: string,
  contentHash: string
): unknown | null {
  if (!agentCache) return null;
  const entry = agentCache[agentName];
  if (!entry) return null;
  if (entry.contentHash !== contentHash) return null;
  return entry.result;
}

/**
 * Set a cached agent result in the cache map (in-memory).
 * The caller is responsible for persisting the updated cache map to the database.
 */
export function setCachedAgentResult(
  agentCache: AgentCacheMap,
  agentName: string,
  contentHash: string,
  result: unknown
): void {
  agentCache[agentName] = {
    contentHash,
    result,
    cachedAt: new Date().toISOString(),
  };
}
