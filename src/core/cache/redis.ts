/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simulated In-Memory Redis Key-Value Store with TTL & List support
export interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

class RedisMock {
  private store = new Map<string, CacheEntry>();
  // Sliding window rate limiter logs: Map of key -> timestamp array
  private rateLimitWindows = new Map<string, number[]>();
  private logs: { timestamp: Date; type: string; key: string; status: string; detail?: string }[] = [];

  public getLogs() {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
  }

  private addLog(type: 'GET' | 'SET' | 'EXPIRE' | 'DEL' | 'RATE_LIMIT', key: string, status: string, detail?: string) {
    this.logs.unshift({
      timestamp: new Date(),
      type,
      key,
      status,
      detail
    });
    if (this.logs.length > 100) this.logs.pop();
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.addLog('GET', key, 'MISS');
      return null;
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.addLog('GET', key, 'EXPIRED');
      return null;
    }
    this.addLog('GET', key, 'HIT');
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiresAt });
    this.addLog('SET', key, 'OK', ttlSeconds ? `TTL: ${ttlSeconds}s` : undefined);
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    const deleted = this.store.delete(key) ? 1 : 0;
    this.addLog('DEL', key, deleted ? 'DELETED' : 'NOT_FOUND');
    return deleted;
  }

  public async flush(): Promise<'OK'> {
    this.store.clear();
    this.rateLimitWindows.clear();
    this.addLog('DEL', '*', 'FLUSH_ALL');
    return 'OK';
  }

  /**
   * Sliding window rate limiting implementation
   * Replicates Redis sliding window rate limits (e.g. MULTI, ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE, EXEC)
   */
  public async isRateLimited(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ limited: boolean; currentCount: number; ttl: number }> {
    const now = Date.now();
    let timestamps = this.rateLimitWindows.get(key) || [];

    // Filter out old timestamps outside the sliding window
    const minTimestamp = now - windowMs;
    timestamps = timestamps.filter(ts => ts > minTimestamp);

    const isLimitExceeded = timestamps.length >= limit;

    if (!isLimitExceeded) {
      timestamps.push(now);
      this.rateLimitWindows.set(key, timestamps);
    }

    const currentCount = timestamps.length;
    const ttl = timestamps.length > 0 ? Math.max(0, Math.round((timestamps[0] + windowMs - now) / 1000)) : 0;

    const status = isLimitExceeded ? 'BLOCKED' : 'ALLOWED';
    this.addLog('RATE_LIMIT', key, status, `Count: ${currentCount}/${limit} within ${windowMs / 1000}s`);

    return {
      limited: isLimitExceeded,
      currentCount,
      ttl
    };
  }
}

export const redis = new RedisMock();
export default redis;
