/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeFile {
  name: string;
  path: string;
  category: 'core' | 'modules' | 'prisma' | 'tests' | 'infra';
  language: 'typescript' | 'prisma' | 'yaml' | 'json';
  content: string;
}

export const mockCodeFiles: CodeFile[] = [
  {
    name: "AppError.ts",
    path: "src/core/errors/AppError.ts",
    category: "core",
    language: "typescript",
    content: `export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, any> | any[];

  constructor(message: string, statusCode: number = 500, errorCode: string = 'INTERNAL_ERROR', details?: Record<string, any> | any[]) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any> | any[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to access this resource') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Rate limit exceeded, please try again later') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}`
  },
  {
    name: "schema.prisma",
    path: "prisma/schema.prisma",
    category: "prisma",
    language: "prisma",
    content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
  COMPANY_REP
}

enum JobType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
  REMOTE
}

enum ApplicationStatus {
  APPLIED
  REVIEWED
  INTERVIEW
  OFFER
  REJECTED
  WITHDRAWN
}

model User {
  id            String             @id @default(uuid())
  email         String             @unique
  passwordHash  String
  fullName      String
  role          Role               @default(USER)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  
  // Relations
  profile       Profile?
  company       Company?           @relation(fields: [companyId], references: [id])
  companyId     String?
  applications  Application[]
  sessions      RefreshToken[]

  @@index([email])
}

model Profile {
  id         String   @id @default(uuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String?
  resumeUrl  String?
  bio        String?
  skills     String[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Company {
  id          String   @id @default(uuid())
  name        String   @unique
  slug        String   @unique
  description String
  logoUrl     String?
  isVerified  Boolean  @default(false)
  website     String?
  location    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  reps        User[]
  jobs        Job[]

  @@index([slug])
}

model Job {
  id           String        @id @default(uuid())
  companyId    String
  company      Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  title        String
  description  String
  location     String
  type         JobType       @default(FULL_TIME)
  salaryMin    Int?
  salaryMax    Int?
  isFeatured   Boolean       @default(false)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  applications Application[]

  @@index([companyId])
  @@index([location])
  @@index([type])
}

model Application {
  id        String            @id @default(uuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId     String
  job       Job               @relation(fields: [jobId], references: [id], onDelete: Cascade)
  status    ApplicationStatus @default(APPLIED)
  coverLetter String?
  resumeUrl   String?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([userId, jobId])
  @@index([userId])
  @@index([jobId])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  isRevoked Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([token])
  @@index([userId])
}`
  },
  {
    name: "auth.schema.ts",
    path: "src/modules/auth/auth.schema.ts",
    category: "modules",
    language: "typescript",
    content: `import { z } from 'zod';

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PromoteUserInput = z.infer<typeof promoteUserSchema>;

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
};`
  },
  {
    name: "auth.service.ts",
    path: "src/modules/auth/auth.service.ts",
    category: "modules",
    language: "typescript",
    content: `import crypto from 'node:crypto';
import prisma from '../../core/database/prisma';
import redis from '../../core/cache/redis';
import bullQueue from '../../core/queue/bullmq';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } from '../../core/errors/AppError';
import type { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema';

export class AuthService {
  private static readonly privateKeySim = "MOCK_RS256_PRIVATE_KEY_PEM_PRODUCTION_GRADE_SECRET";
  private static readonly publicKeySim = "MOCK_RS256_PUBLIC_KEY_PEM_PRODUCTION_GRADE_PUBLIC";

  private hashPassword(password: string): string {
    return crypto.createHmac('sha256', 'app-secret-salt').update(password).digest('hex');
  }

  private comparePassword(password: string, hash: string): boolean {
    const hashedInput = this.hashPassword(password);
    return crypto.timingSafeEqual(Buffer.from(hashedInput), Buffer.from(hash));
  }

  private generateJWT(payload: Record<string, any>, expiresInSeconds: number): string {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString('base64url');
    const enrichedPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iss: "jobboard-api-server",
    };
    const body = Buffer.from(JSON.stringify(enrichedPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', AuthService.privateKeySim).update(\`\${header}.\${body}\`).digest('base64url');
    return \`\${header}.\${body}.\${signature}\`;
  }

  public verifyJWT(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedError("Invalid token format");
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', AuthService.privateKeySim).update(\`\${header}.\${body}\`).digest('base64url');

    if (signature !== expectedSig) {
      throw new UnauthorizedError("JWT signature mismatch (RS256/asymmetric validation failed)");
    }

    const decodedPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedError("JWT token expired");
    }
    return decodedPayload;
  }

  private async issueAuthTokens(userId: string, role: string) {
    const accessToken = this.generateJWT({ userId, role }, 900); // 15 mins
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt, isRevoked: false }
    });
    return { accessToken, refreshToken };
  }

  public async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError("An account with this email address already exists");
    }

    const passwordHash = this.hashPassword(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, fullName: input.fullName, role: input.role || 'USER' }
    });

    await prisma.profile.create({
      data: { userId: user.id, title: null, resumeUrl: null, bio: null, skills: [] }
    });

    await bullQueue.add('send_welcome_email', { email: user.email, fullName: user.fullName });
    const tokens = await this.issueAuthTokens(user.id, user.role);

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      ...tokens
    };
  }

  public async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const match = this.comparePassword(input.password, user.passwordHash);
    if (!match) throw new UnauthorizedError("Invalid email or password");

    const tokens = await this.issueAuthTokens(user.id, user.role);
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      ...tokens
    };
  }

  public async rotateTokens(token: string) {
    const rotationRecord = await prisma.refreshToken.findUnique({ where: { token } });
    if (!rotationRecord) throw new UnauthorizedError("Refresh token not recognized");

    if (rotationRecord.isRevoked) {
      await prisma.refreshToken.deleteMany({ where: { userId: rotationRecord.userId } });
      throw new ForbiddenError("Breach detected! Refresh token reused. All active sessions terminated.");
    }

    if (rotationRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token has expired");
    }

    const user = await prisma.user.findUnique({ where: { id: rotationRecord.userId } });
    if (!user) throw new UnauthorizedError("User is no longer active");

    await prisma.refreshToken.update({
      where: { id: rotationRecord.id },
      data: { isRevoked: true }
    });

    const tokens = await this.issueAuthTokens(user.id, user.role);
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      ...tokens
    };
  }

  public async logout(token: string) {
    const rotationRecord = await prisma.refreshToken.findUnique({ where: { token } });
    if (rotationRecord) {
      await prisma.refreshToken.update({
        where: { id: rotationRecord.id },
        data: { isRevoked: true }
      });
    }
    return { success: true };
  }

  public async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { msg: 'Password reset link dispatched if email exists.' };

    const token = crypto.randomBytes(32).toString('hex');
    const redisKey = \`reset_token:\${token}\`;
    await redis.set(redisKey, user.id, 3600);

    await bullQueue.add('send_password_reset', { email: user.email, token, appUrl: "https://jobboard.io" });
    return { msg: 'Password reset link dispatched if email exists.', token_sent: token };
  }

  public async resetPassword(input: ResetPasswordInput) {
    const redisKey = \`reset_token:\${input.token}\`;
    const userId = await redis.get(redisKey);
    if (!userId) throw new ValidationError("Password reset token is invalid or has expired");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    const passwordHash = this.hashPassword(input.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await redis.del(redisKey);

    return { success: true };
  }
}`
  },
  {
    name: "auth.controller.ts",
    path: "src/modules/auth/auth.controller.ts",
    category: "modules",
    language: "typescript",
    content: `import { authService } from './auth.service';
import { registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema, promoteUserSchema } from './auth.schema';
import { ValidationError, TooManyRequestsError } from '../../core/errors/AppError';
import redis from '../../core/cache/redis';

export class AuthController {
  private async checkRateLimit(ip: string, isAuth: boolean) {
    const limit = isAuth ? 1000 : 100;
    const windowMs = 15 * 60 * 1000;
    const key = \`rate_limit:\${isAuth ? 'auth' : 'pub'}:\${ip}\`;

    const { limited, currentCount } = await redis.isRateLimited(key, limit, windowMs);
    if (limited) {
      throw new TooManyRequestsError(\`Rate limit exceeded (\${currentCount}/\${limit}). Try again in 15 minutes.\`);
    }
  }

  public register = async (req: any, reply: any) => {
    await this.checkRateLimit(req.ip, false);
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Inputs failed validation', parsed.error.format());

    const result = await authService.register(parsed.data);
    return reply.status(201).send({ message: "Registered successfully.", ...result });
  };

  public login = async (req: any, reply: any) => {
    await this.checkRateLimit(req.ip, false);
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Credentials required', parsed.error.format());

    const result = await authService.login(parsed.data);
    return reply.status(200).send({ message: "Authorization established.", ...result });
  };

  public refresh = async (req: any, reply: any) => {
    await this.checkRateLimit(req.ip, false);
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Token is required', parsed.error.format());

    const result = await authService.rotateTokens(parsed.data.refreshToken);
    return reply.status(200).send({ message: "Rotation transaction complete.", ...result });
  };

  public forgotPassword = async (req: any, reply: any) => {
    await this.checkRateLimit(req.ip, false);
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Email is required', parsed.error.format());

    const result = await authService.forgotPassword(parsed.data.email);
    return reply.status(200).send(result);
  };
}`
  },
  {
    name: "auth.routes.ts",
    path: "src/modules/auth/auth.routes.ts",
    category: "modules",
    language: "typescript",
    content: `import { authController } from './auth.controller';
import { authResponseSchema } from './auth.schema';

export async function authRoutes(fastify: any) {
  fastify.post('/register', {
    schema: {
      tags: ['Authentication'],
      summary: 'Register a new candidate or representative user',
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string', minLength: 2 },
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

  fastify.post('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Authenticate credentials to retrieve JWT pair',
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
}`
  },
  {
    name: "redis.ts",
    path: "src/core/cache/redis.ts",
    category: "core",
    language: "typescript",
    content: `export interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

class RedisMock {
  private store = new Map<string, CacheEntry>();
  private rateLimitWindows = new Map<string, number[]>();

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  public async isRateLimited(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    let timestamps = this.rateLimitWindows.get(key) || [];
    timestamps = timestamps.filter(ts => ts > now - windowMs);

    const isLimitExceeded = timestamps.length >= limit;
    if (!isLimitExceeded) {
      timestamps.push(now);
      this.rateLimitWindows.set(key, timestamps);
    }
    return {
      limited: isLimitExceeded,
      currentCount: timestamps.length,
      ttl: timestamps.length > 0 ? Math.max(0, Math.round((timestamps[0] + windowMs - now) / 1000)) : 0
    };
  }
}`
  },
  {
    name: "auth.service.test.ts",
    path: "tests/auth.service.test.ts",
    category: "tests",
    language: "typescript",
    content: `import { authService } from '../src/modules/auth/auth.service';
import { inMemoryDb } from '../src/core/database/prisma';
import redis from '../src/core/cache/redis';

describe('AuthService Suite', () => {
  beforeEach(async () => {
    inMemoryDb.clear();
    await redis.flush();
  });

  it('should successfully register a brand new candidate account', async () => {
    const result = await authService.register({
      email: 'candidate@test.io',
      password: 'securePassword99!',
      fullName: 'John Doe'
    });
    expect(result.user.email).toBe('candidate@test.io');
    expect(result.accessToken).toBeDefined();
  });

  it('should detect token reuse and Terminate all user sessions', async () => {
    const reg = await authService.register({
      email: 'hacker@target.io',
      password: 'passwordSec',
      fullName: 'Plain Joe'
    });

    const initialToken = reg.refreshToken;
    await authService.rotateTokens(initialToken);

    await expect(authService.rotateTokens(initialToken)).rejects.toThrow(
      /Breach detected/
    );
  });
});`
  },
  {
    name: "docker-compose.yml",
    path: "infra/docker-compose.yml",
    category: "infra",
    language: "yaml",
    content: `version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: infra/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/jobboard?schema=public
      - REDIS_URL=redis://redis:6379/0
      - JWT_PRIVATE_KEY_RS256=/app/keys/private.pem
      - JWT_PUBLIC_KEY_RS256=/app/keys/public.pem
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: jobboard
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:`
  },
  {
    name: "ci-cd.yml",
    path: ".github/workflows/ci-cd.yml",
    category: "infra",
    language: "yaml",
    content: `name: Production CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  audit-and-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: jobboard_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Code Node
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Monolith Dependencies
        run: npm ci

      - name: Verify ESLint & Codestyle Strictness
        run: npm run lint

      - name: Sync database migrations (Prisma DB Push)
        run: npx prisma db push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/jobboard_test

      - name: Run Test Suite with Coverage
        run: npm run test:cov
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/jobboard_test
          REDIS_URL: redis://localhost:6379/0

      - name: Upload Test Coverage artifacts
        uses: actions/upload-artifact@v4
        with:
          name: Jest-HTML-Coverage-Status
          path: coverage/`
  }
];
