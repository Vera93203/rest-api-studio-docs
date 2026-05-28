/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authService } from '../src/modules/auth/auth.service.js';
import { inMemoryDb } from '../src/core/database/prisma.js';
import redis from '../src/core/cache/redis.js';
import bullQueue from '../src/core/queue/bullmq.js';

describe('AuthService Integration & Unit Suite', () => {
  beforeEach(async () => {
    // Purge database and caches before every test run
    inMemoryDb.clear();
    await redis.flush();
    bullQueue.clearAll();
  });

  describe('User Registration Protocol', () => {
    it('should successfully register a brand new candidate account and spawn profile', async () => {
      const email = 'candidate.tests@jobboard.io';
      const result = await authService.register({
        email,
        password: 'securePassword99!',
        fullName: 'Candidate Test Unit',
        role: 'USER'
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe('USER');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Ensure Profile table was properly seeded
      const spawnedProfile = inMemoryDb.profiles.find(p => p.userId === result.user.id);
      expect(spawnedProfile).toBeDefined();
      expect(spawnedProfile!.skills).toBeInstanceOf(Array);

      // Verify that a welcomes job was queued
      const queueJobs = bullQueue.getJobs();
      expect(queueJobs.length).toBe(1);
      expect(queueJobs[0].name).toBe('send_welcome_email');
      expect(queueJobs[0].data.email).toBe(email);
    });

    it('should block registration of duplicate email addresses with ConflictError', async () => {
      const payload = {
        email: 'duplicate@test.com',
        password: 'somePassword123!',
        fullName: 'Original User',
        role: 'USER' as const
      };

      // First call succeeds
      await authService.register(payload);

      // Second call fails with unique constraint
      await expect(authService.register(payload)).rejects.toThrow(
        /already exists/
      );
    });
  });

  describe('Identity Verification & Authorization Credentials', () => {
    it('should issue fresh access/refresh tokens upon valid password submissions', async () => {
      const email = 'login.test@jobboard.io';
      const rawPassword = 'superPassword11!';

      // Register first
      await authService.register({
        email,
        password: rawPassword,
        fullName: 'Login Tester',
        role: 'USER'
      });

      // Login
      const loginPayload = await authService.login({
        email,
        password: rawPassword
      });

      expect(loginPayload.accessToken).toBeDefined();
      expect(loginPayload.refreshToken).toBeDefined();
      expect(loginPayload.user.email).toBe(email);
    });

    it('should deny access under incorrect credential passwords', async () => {
      const email = 'denied.test@jobboard.io';
      await authService.register({
        email,
        password: 'correctPassword!',
        fullName: 'Shield User',
        role: 'USER'
      });

      await expect(authService.login({
        email,
        password: 'incorrectPassword!'
      })).rejects.toThrow(/Invalid email or password/);
    });
  });

  describe('Secure Refresh Token Rotation', () => {
    it('should slide refresh token lifetimes and revoke matching old parent reference', async () => {
      const result = await authService.register({
        email: 'rotate@jobboard.io',
        password: 'passwordSecret',
        fullName: 'Rotation User',
        role: 'USER'
      });

      const firstRefreshToken = result.refreshToken;

      // Executing rotate token pair
      const rotated = await authService.rotateTokens(firstRefreshToken);

      expect(rotated.refreshToken).not.toBe(firstRefreshToken);
      expect(rotated.accessToken).toBeDefined();

      // Old token must reflect revoked state
      const oldRecord = inMemoryDb.refreshTokens.find(token => token.token === firstRefreshToken);
      expect(oldRecord?.isRevoked).toBe(true);
    });

    it('should detect token reuse abuse and aggressively purge all user active sessions', async () => {
      const registration = await authService.register({
        email: 'abuse.detect@jobboard.io',
        password: 'passwordSecret',
        fullName: 'Hacker Target',
        role: 'USER'
      });

      const tokenRef = registration.refreshToken;

      // First slide completes successfully
      const firstRotation = await authService.rotateTokens(tokenRef);
      expect(firstRotation.refreshToken).toBeDefined();

      // Attacker attempts to play back the old firstRefreshToken
      await expect(authService.rotateTokens(tokenRef)).rejects.toThrow(
        /Breach detected/
      );

      // Verify all refresh tokens belonging to this candidate are evicted from table
      const remainingTokens = inMemoryDb.refreshTokens.filter(t => t.userId === registration.user.id);
      expect(remainingTokens.length).toBe(0);
    });
  });

  describe('Out-Of-Band Password Recovery Queue flow', () => {
    it('should persist reset token inside Redis layer and push async notification job to BullMQ', async () => {
      const signup = await authService.register({
        email: 'recovery@jobboard.io',
        password: 'originalPassword',
        fullName: 'Recovery User',
        role: 'USER'
      });

      const recoveryRequest = await authService.forgotPassword('recovery@jobboard.io');
      expect(recoveryRequest.token_sent).toBeDefined();

      // Ensure value matches record and is saved under proper Redis key with sliding window limits
      const cacheValue = await redis.get(`reset_token:${recoveryRequest.token_sent}`);
      expect(cacheValue).toBe(signup.user.id);

      // Assert queue notification logs
      const queueJobs = bullQueue.getJobs();
      const sendResetJob = queueJobs.find(job => job.name === 'send_password_reset');
      expect(sendResetJob).toBeDefined();
      expect(sendResetJob!.data.token).toBe(recoveryRequest.token_sent);
    });
  });
});
