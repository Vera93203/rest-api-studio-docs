/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Name must be at least 2 characters long'),
  role: z.enum(['USER', 'COMPANY_REP']).optional().default('USER'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const promoteUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: z.enum(['USER', 'ADMIN', 'COMPANY_REP']),
});

// TypeScript compiler inferences
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PromoteUserInput = z.infer<typeof promoteUserSchema>;

// Swagger Response Schemas descriptors
export const authResponseSchema = {
  description: 'Successful authentication payload',
  type: 'object',
  properties: {
    accessToken: { type: 'string', description: 'JWT Access token (RS256, 15m lifetime)' },
    refreshToken: { type: 'string', description: 'Secure rotation Refresh token (7d lifetime)' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        fullName: { type: 'string' },
        role: { type: 'string', enum: ['USER', 'ADMIN', 'COMPANY_REP'] },
      },
    },
  },
};
