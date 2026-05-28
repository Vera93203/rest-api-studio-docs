/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import redis from '../src/core/cache/redis.js';

describe('Sliding Window Rate Limiter Engine Spec', () => {
  beforeEach(async () => {
    await redis.flush();
  });

  it('should allow requests below threshold and track current count within sliding window', async () => {
    const pubIpKey = 'rate_limit:pub:192.168.1.1';
    const limit = 5;
    const windowMs = 1000; // 1 second sliding window for easier test duration

    for (let i = 1; i <= limit; i++) {
      const check = await redis.isRateLimited(pubIpKey, limit, windowMs);
      expect(check.limited).toBe(false);
      expect(check.currentCount).toBe(i);
    }
  });

  it('should block requests once sliding window limits are violated', async () => {
    const badIpKey = 'rate_limit:pub:10.0.0.5';
    const limit = 3;
    const windowMs = 5000;

    // Fill up allowance
    await redis.isRateLimited(badIpKey, limit, windowMs);
    await redis.isRateLimited(badIpKey, limit, windowMs);
    await redis.isRateLimited(badIpKey, limit, windowMs);

    // 4th request must trigger rate block
    const blockCheck = await redis.isRateLimited(badIpKey, limit, windowMs);
    expect(blockCheck.limited).toBe(true);
    expect(blockCheck.currentCount).toBe(3);
    expect(blockCheck.ttl).toBeGreaterThan(0);
  });

  it('should release blocks dynamically when timestamp points fall out of active window', async () => {
    const transientKey = 'rate_limit:pub:4.4.4.4';
    const limit = 2;
    const windowMs = 400; // very fast window for testing sliding transitions

    // Hit limit
    const hit1 = await redis.isRateLimited(transientKey, limit, windowMs);
    const hit2 = await redis.isRateLimited(transientKey, limit, windowMs);
    expect(hit1.limited).toBe(false);
    expect(hit2.limited).toBe(false);

    // Immediate 3rd hit should block
    const blockHit = await redis.isRateLimited(transientKey, limit, windowMs);
    expect(blockHit.limited).toBe(true);

    // Sleep for sliding window duration to expire oldest timestamps
    await new Promise(resolve => setTimeout(resolve, 450));

    // Request should be allowed again
    const finalHit = await redis.isRateLimited(transientKey, limit, windowMs);
    expect(finalHit.limited).toBe(false);
  });
});
