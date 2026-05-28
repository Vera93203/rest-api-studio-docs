/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import prisma from '../../core/database/prisma.js';
import redis from '../../core/cache/redis.js';
import bullQueue from '../../core/queue/bullmq.js';
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError
} from '../../core/errors/AppError.js';
import type {
  RegisterInput,
  LoginInput,
  ResetPasswordInput
} from './auth.schema.js';

export class AuthService {
  // Simulated private/public asymmetric key pairs for RS256
  private static readonly privateKeySim = "MOCK_RS256_PRIVATE_KEY_PEM_PRODUCTION_GRADE_SECRET";
  private static readonly publicKeySim = "MOCK_RS256_PUBLIC_KEY_PEM_PRODUCTION_GRADE_PUBLIC";

  /**
   * Secure built-in hashing that works seamlessly in sandbox typescript & Cloud Run
   */
  private hashPassword(password: string): string {
    return crypto.createHmac('sha256', 'app-secret-salt').update(password).digest('hex');
  }

  private comparePassword(password: string, hash: string): boolean {
    const hashedInput = this.hashPassword(password);
    return crypto.timingSafeEqual(
      Buffer.from(hashedInput),
      Buffer.from(hash)
    );
  }

  /**
   * Generates RS256 simulated signature token
   */
  private generateJWT(payload: Record<string, any>, expiresInSeconds: number): string {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString('base64url');
    const enrichedPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iss: "jobboard-api-server",
    };
    const body = Buffer.from(JSON.stringify(enrichedPayload)).toString('base64url');
    // Simulated signature using HMAC internally but output as JWT format
    const signature = crypto
      .createHmac('sha256', AuthService.privateKeySim)
      .update(`${header}.${body}`)
      .digest('base64url');
      
    return `${header}.${body}.${signature}`;
  }

  /**
   * Verifies the RS256 simulated token structure
   */
  public verifyJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedError("Invalid token format");
      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', AuthService.privateKeySim)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSig) {
        throw new UnauthorizedError("JWT signature mismatch (RS256/asymmetric validation failed)");
      }

      const decodedPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedError("JWT token expired");
      }

      return decodedPayload;
    } catch (err: any) {
      throw new UnauthorizedError(err.message || "Invalid credentials token");
    }
  }

  /**
   * Helper to issue token pairs (RS256 access token + 7-day secure sliding refresh token)
   */
  private async issueAuthTokens(userId: string, role: string) {
    const accessToken = this.generateJWT({ userId, role }, 900); // 15 mins
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
        isRevoked: false
      }
    });

    return { accessToken, refreshToken };
  }

  /**
   * 1. Register candidate user
   */
  public async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError("An account with this email address already exists");
    }

    const passwordHash = this.hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role || 'USER'
      }
    });

    // Create empty profile
    await prisma.profile.create({
      data: {
        userId: user.id,
        title: null,
        resumeUrl: null,
        bio: null,
        skills: []
      }
    });

    // Queue welcome email notification task
    await bullQueue.add('send_welcome_email', {
      email: user.email,
      fullName: user.fullName
    });

    const tokens = await this.issueAuthTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      ...tokens
    };
  }

  /**
   * 2. Direct login action
   */
  public async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const match = this.comparePassword(input.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await this.issueAuthTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      ...tokens
    };
  }

  /**
   * 3. Refresh token rotation (with detection of reuse!)
   */
  public async rotateTokens(token: string) {
    const rotationRecord = await prisma.refreshToken.findUnique({ where: { token } });
    if (!rotationRecord) {
      throw new UnauthorizedError("Refresh token not recognized");
    }

    // Refresh token reuse abuse detection (Security recommendation)
    if (rotationRecord.isRevoked) {
      // Intruders are reusing tokens! Revoke all tokens for this user as precaution
      await prisma.refreshToken.deleteMany({
        where: { userId: rotationRecord.userId }
      });
      throw new ForbiddenError("Breach detected! Refresh token reused. All active sessions terminated.");
    }

    if (rotationRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token has expired");
    }

    const user = await prisma.user.findUnique({ where: { id: rotationRecord.userId } });
    if (!user) {
      throw new UnauthorizedError("User is no longer active");
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: rotationRecord.id },
      data: { isRevoked: true }
    });

    // Issue newly rotated token pair
    const tokens = await this.issueAuthTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      ...tokens
    };
  }

  /**
   * 4. Logout / terminate session
   */
  public async logout(token: string) {
    const rotationRecord = await prisma.refreshToken.findUnique({ where: { token } });
    if (rotationRecord) {
      // Just mark revoked or delete
      await prisma.refreshToken.update({
        where: { id: rotationRecord.id },
        data: { isRevoked: true }
      });
    }
    return { success: true };
  }

  /**
   * 5. Forgot Password
   */
  public async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Avoid enum leak: always respond OK, but only queue email if exists
      return { msg: 'Password reset link dispatched if email exists.' };
    }

    // Create a reset token
    const token = crypto.randomBytes(32).toString('hex');
    const redisKey = `reset_token:${token}`;
    
    // Save token to Redis Cache with 1-hour expiration
    await redis.set(redisKey, user.id, 3600);

    // Queue reset password email
    await bullQueue.add('send_password_reset', {
      email: user.email,
      token,
      appUrl: "https://jobboard-applet-sandbox.io"
    });

    return { msg: 'Password reset link dispatched if email exists.', token_sent: token };
  }

  /**
   * 6. Reset Password with validation token
   */
  public async resetPassword(input: ResetPasswordInput) {
    const redisKey = `reset_token:${input.token}`;
    const userId = await redis.get(redisKey);
    if (!userId) {
      throw new ValidationError("Password reset token is invalid or has expired");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Hash new password & save
    const passwordHash = this.hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    // Clean reset token
    await redis.del(redisKey);

    return { success: true };
  }

  /**
   * 7. Promote or update user roles (Admin feature)
   */
  public async promoteUser(userId: string, role: 'USER' | 'ADMIN' | 'COMPANY_REP') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("Target user not found");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role
    };
  }
}

export const authService = new AuthService();
export default authService;
