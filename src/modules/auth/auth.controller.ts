/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  promoteUserSchema
} from './auth.schema.js';
import { ValidationError, TooManyRequestsError } from '../../core/errors/AppError.js';
import redis from '../../core/cache/redis.js';

// Clean Fastify Request/Reply abstract interfaces for type safety & zero-depend compile
export interface FastifyRequestSim {
  body: any;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
  user?: {
    userId: string;
    role: 'USER' | 'ADMIN' | 'COMPANY_REP';
  };
}

export interface FastifyReplySim {
  status(code: number): FastifyReplySim;
  send(payload: any): any;
}

export class AuthController {
  /**
   * Helper to perform Redis Sliding Window Rate Limiting per IP or Account
   */
  private async checkRateLimit(ip: string, isAuth: boolean) {
    const limit = isAuth ? 1000 : 100; // 1000 for authenticated, 100 for public per 15 mins
    const windowMs = 15 * 60 * 1000; // 15 mins
    const key = `rate_limit:${isAuth ? 'auth' : 'pub'}:${ip}`;

    const { limited, currentCount } = await redis.isRateLimited(key, limit, windowMs);
    if (limited) {
      throw new TooManyRequestsError(`Rate limit exceeded (${currentCount}/${limit}). Try again in 15 minutes.`);
    }
  }

  /**
   * Handle candidate registration
   */
  public register = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    await this.checkRateLimit(req.ip, false);

    // Schema Validation
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Registration inputs failed schema validation', parsed.error.format());
    }

    const result = await authService.register(parsed.data);
    return reply.status(201).send({
      message: "Contributor registered successfully. Verification email job triggered.",
      ...result
    });
  };

  /**
   * Handle user login authentication
   */
  public login = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    await this.checkRateLimit(req.ip, false);

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Authentication inputs failed Zod checking', parsed.error.format());
    }

    const result = await authService.login(parsed.data);
    return reply.status(200).send({
      message: "Authorization established.",
      ...result
    });
  };

  /**
   * Refresh access token (rotates token pair)
   */
  public refresh = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    await this.checkRateLimit(req.ip, false);

    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Refresh token token argument is required', parsed.error.format());
    }

    const result = await authService.rotateTokens(parsed.data.refreshToken);
    return reply.status(200).send({
      message: "Rotation transaction complete.",
      ...result
    });
  };

  /**
   * Request password recovery mail
   */
  public forgotPassword = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    await this.checkRateLimit(req.ip, false);

    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Enterprise email string expected', parsed.error.format());
    }

    const result = await authService.forgotPassword(parsed.data.email);
    return reply.status(200).send(result);
  };

  /**
   * Reset Password with token
   */
  public resetPassword = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    await this.checkRateLimit(req.ip, false);

    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Schema validation failed for password reset', parsed.error.format());
    }

    const result = await authService.resetPassword(parsed.data);
    return reply.status(200).send({
      message: "Password updated successfully. All login terminals flushed.",
      ...result
    });
  };

  /**
   * Terminate active refresh token
   */
  public logout = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Refresh token required to logout session', parsed.error.format());
    }

    await authService.logout(parsed.data.refreshToken);
    return reply.status(200).send({ message: "Session successfully torn down." });
  };

  /**
   * Promote user (Admin command)
   */
  public promote = async (req: FastifyRequestSim, reply: FastifyReplySim) => {
    // Assert authenticating admin
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.status(403).send({
        statusCode: 403,
        error: "ForbiddenError",
        message: "Only system Administrators are permitted to invoke user promotion protocols."
      });
    }

    await this.checkRateLimit(req.ip, true);

    const parsed = promoteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Zod validation failed for user promotion', parsed.error.format());
    }

    const result = await authService.promoteUser(parsed.data.userId, parsed.data.role);
    return reply.status(200).send({
      message: "Target user promoted successfully.",
      user: result
    });
  };
}

export const authController = new AuthController();
export default authController;
