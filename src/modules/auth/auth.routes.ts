/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authController } from './auth.controller.js';
import { authResponseSchema } from './auth.schema.js';

/**
 * Fastify standard Route mapping configuration containing full Swagger docs
 */
export async function authRoutes(fastify: any) {
  
  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      tags: ['Authentication'],
      summary: 'Register a new candidate or company representative user',
      description: 'Creates a user profile, hashes passwords using symmetric cryptography, and triggers an asynchronous email greeting task in BullMQ.',
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Unique contact email' },
          password: { type: 'string', minLength: 8, description: 'Min 8 characters password security' },
          fullName: { type: 'string', minLength: 2, description: 'Legal name of candidate user' },
          role: { type: 'string', enum: ['USER', 'COMPANY_REP'], default: 'USER' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: authResponseSchema.properties.user
          }
        }
      }
    }
  }, authController.register);

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Authenticate with email credentials to retrieve JWT pair',
      description: 'Validates candidate or admin identities using secure salt-padded matching. Distribute fresh JWT access and refresh tokens.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: authResponseSchema.properties.user
          }
        }
      }
    }
  }, authController.login);

  // POST /api/auth/refresh
  fastify.post('/refresh', {
    schema: {
      tags: ['Authentication'],
      summary: 'Revoke and rotate active Token Pairs securely',
      description: 'Slide refresh window safely. Features reactive abuse detection that invalidates all active sessions when token reuse is checked.',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', description: 'Hex refresh token issued during login/register' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: authResponseSchema.properties.user
          }
        }
      }
    }
  }, authController.refresh);

  // POST /api/auth/forgot-password
  fastify.post('/forgot-password', {
    schema: {
      tags: ['Authentication'],
      summary: 'Initiate password recovery flow',
      description: 'Dispatches unique recovery token via a secure BullMQ mail worker with a short TTL restriction.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            msg: { type: 'string' }
          }
        }
      }
    }
  }, authController.forgotPassword);

  // POST /api/auth/reset-password
  fastify.post('/reset-password', {
    schema: {
      tags: ['Authentication'],
      summary: 'Override password with verification token',
      description: 'Updates active schema state and purges current cached session nodes inside Redis.',
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', description: 'Token string parsed from recovery email link' },
          newPassword: { type: 'string', minLength: 8, description: 'Min 8 chars criteria' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            success: { type: 'boolean' }
          }
        }
      }
    }
  }, authController.resetPassword);

  // POST /api/auth/logout
  fastify.post('/logout', {
    schema: {
      tags: ['Authentication'],
      summary: 'Revoke session credentials',
      description: 'Explicitly invalidate JWT refresh records from core memory structures.',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, authController.logout);

  // POST /api/auth/promote (Admin Protected)
  fastify.post('/promote', {
    schema: {
      tags: ['Admin Management'],
      summary: 'Escalate client account roles (Admin authorization required)',
      description: 'Elevates accounts to ADMIN, USER, or COMPANY_REP states.',
      headers: {
        type: 'object',
        required: ['Authorization'],
        properties: {
          Authorization: { type: 'string', description: 'Bearer authorization header key code' }
        }
      },
      body: {
        type: 'object',
        required: ['userId', 'role'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'COMPANY_REP'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: authResponseSchema.properties.user
          }
        }
      }
    }
  }, authController.promote);
}
export default authRoutes;
