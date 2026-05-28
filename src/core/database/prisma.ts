/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simulated In-Memory Database State for the entire Job Board REST API
export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'USER' | 'ADMIN' | 'COMPANY_REP';
  createdAt: Date;
  updatedAt: Date;
  companyId?: string | null;
}

export interface DbProfile {
  id: string;
  userId: string;
  title: string | null;
  resumeUrl: string | null;
  bio: string | null;
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DbCompany {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  isVerified: boolean;
  website: string | null;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbJob {
  id: string;
  companyId: string;
  title: string;
  description: string;
  location: string;
  type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
  salaryMin: number | null;
  salaryMax: number | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbApplication {
  id: string;
  userId: string;
  jobId: string;
  status: 'APPLIED' | 'REVIEWED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
  coverLetter: string | null;
  resumeUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbRefreshToken {
  id: string;
  userId: string;
  token: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// Global In-Memory Store
class InMemoryStore {
  public users: DbUser[] = [];
  public profiles: DbProfile[] = [];
  public companies: DbCompany[] = [];
  public jobs: DbJob[] = [];
  public applications: DbApplication[] = [];
  public refreshTokens: DbRefreshToken[] = [];

  constructor() {
    this.seedDefaultData();
  }

  public seedDefaultData() {
    const googleId = "company-google-id";
    const netflixId = "company-netflix-id";
    const seedCompanies: DbCompany[] = [
      {
        id: googleId,
        name: "Google Inc.",
        slug: "google",
        description: "Organizing the world's information and making it universally accessible and useful. We build products that help people everywhere.",
        logoUrl: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?auto=format&fit=crop&q=80&w=250",
        isVerified: true,
        website: "https://google.com",
        location: "Mountain View, CA",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01")
      },
      {
        id: netflixId,
        name: "Netflix",
        slug: "netflix",
        description: "At Netflix, we want to entertain the world. Whatever your taste, and no matter where you live, we give you access to best-in-class TV series, documentaries, and feature films.",
        logoUrl: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&q=80&w=250",
        isVerified: true,
        website: "https://netflix.com",
        location: "Los Gatos, CA",
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-02")
      }
    ];

    const seedJobs: DbJob[] = [
      {
        id: "job-1",
        companyId: googleId,
        title: "Senior Software Engineer (TypeScript/Fastify)",
        description: "Looking for an expert backend software engineer to design microservices using Fastify, Prisma, and PostgreSQL. Experience in Redis and BullMQ is highly desirable. You will work on massive, enterprise-level scale applications.",
        location: "London, UK (Hybrid)",
        type: "FULL_TIME",
        salaryMin: 120000,
        salaryMax: 165000,
        isFeatured: true,
        createdAt: new Date("2026-05-15"),
        updatedAt: new Date("2026-05-15")
      },
      {
        id: "job-2",
        companyId: googleId,
        title: "Staff Developer Advocate (AI Studio & Gemini SDK)",
        description: "Evangelize Gemini API, Google AI Studio, and related tools. Help developers create high-performance AI-infused full-stack application nodes and custom agent pipelines. You will lead workshops, build sample architectures, and create educational resources.",
        location: "Remote, US",
        type: "REMOTE",
        salaryMin: 180000,
        salaryMax: 230000,
        isFeatured: true,
        createdAt: new Date("2026-05-20"),
        updatedAt: new Date("2026-05-20")
      },
      {
        id: "job-3",
        companyId: netflixId,
        title: "Platform Security Architect Node",
        description: "Secure platform operations, build JWT rotation middlewares, configure container runtimes, implement sliding window rate limiting in Redis, and deploy strict ingress controls on Cloud Run. Requires 8+ years in systems security.",
        location: "Los Gatos, CA",
        type: "FULL_TIME",
        salaryMin: 220000,
        salaryMax: 310000,
        isFeatured: false,
        createdAt: new Date("2026-05-24"),
        updatedAt: new Date("2026-05-24")
      }
    ];

    const seedUsers: DbUser[] = [
      {
        id: "user-admin",
        email: "admin@jobboard.io",
        fullName: "Alex Rivera (Lead Architect)",
        passwordHash: "$2b$10$7z.cE8gR/sT5w9YV84D2F.TveWhD/t23K6e6E3p0a5g1w1YVq6YRy", // bcrypt for "security101"
        role: "ADMIN",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01")
      },
      {
        id: "user-candidate",
        email: "candidate@jobboard.io",
        fullName: "Taylor Vance (Backend Dev)",
        passwordHash: "$2b$10$7z.cE8gR/sT5w9YV84D2F.TveWhD/t23K6e6E3p0a5g1w1YVq6YRy",
        role: "USER",
        createdAt: new Date("2026-02-15"),
        updatedAt: new Date("2026-02-15")
      }
    ];

    const seedProfiles: DbProfile[] = [
      {
        id: "profile-candidate",
        userId: "user-candidate",
        title: "Senior Backend Engineer",
        resumeUrl: "https://example.com/resumes/taylor_vance.pdf",
        bio: "Specializing in high-throughput microservices using Node.js, Fastify, PostgreSQL, and Redis. Open source contributor.",
        skills: ["Node.js", "TypeScript", "Fastify", "Prisma", "PostgreSQL", "Redis", "BullMQ", "Docker", "Jest"],
        createdAt: new Date("2026-02-15"),
        updatedAt: new Date("2026-02-15")
      }
    ];

    this.companies = seedCompanies;
    this.jobs = seedJobs;
    this.users = seedUsers;
    this.profiles = seedProfiles;
  }

  public clear() {
    this.users = [];
    this.profiles = [];
    this.companies = [];
    this.jobs = [];
    this.applications = [];
    this.refreshTokens = [];
  }
}

export const inMemoryDb = new InMemoryStore();

// Type-Safe Prisma SDK Mock Wrapper
export class PrismaClient {
  public get user() {
    return {
      findUnique: async (args: { where: { email?: string; id?: string } }) => {
        if (args.where.email) {
          return inMemoryDb.users.find(u => u.email === args.where.email) || null;
        }
        if (args.where.id) {
          return inMemoryDb.users.find(u => u.id === args.where.id) || null;
        }
        return null;
      },
      findMany: async () => {
        return inMemoryDb.users;
      },
      create: async (args: { data: Omit<DbUser, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const newUser: DbUser = {
          id: `user-${Math.random().toString(36).substring(2, 9)}`,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          fullName: args.data.fullName,
          role: args.data.role || 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
          companyId: args.data.companyId || null,
        };
        inMemoryDb.users.push(newUser);
        return newUser;
      },
      update: async (args: { where: { id: string }; data: Partial<DbUser> }) => {
        const uIdx = inMemoryDb.users.findIndex(u => u.id === args.where.id);
        if (uIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.users[uIdx], ...args.data, updatedAt: new Date() };
        inMemoryDb.users[uIdx] = updated;
        return updated;
      },
      delete: async (args: { where: { id: string } }) => {
        const uIdx = inMemoryDb.users.findIndex(u => u.id === args.where.id);
        if (uIdx === -1) throw new Error("not found");
        const removed = inMemoryDb.users[uIdx];
        inMemoryDb.users = inMemoryDb.users.filter(u => u.id !== args.where.id);
        return removed;
      }
    };
  }

  public get profile() {
    return {
      findUnique: async (args: { where: { userId: string } }) => {
        return inMemoryDb.profiles.find(p => p.userId === args.where.userId) || null;
      },
      create: async (args: { data: Omit<DbProfile, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const newProfile: DbProfile = {
          id: `profile-${Math.random().toString(36).substring(2, 9)}`,
          userId: args.data.userId,
          title: args.data.title || null,
          resumeUrl: args.data.resumeUrl || null,
          bio: args.data.bio || null,
          skills: args.data.skills || [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryDb.profiles.push(newProfile);
        return newProfile;
      },
      update: async (args: { where: { id?: string; userId?: string }; data: Partial<DbProfile> }) => {
        const pIdx = inMemoryDb.profiles.findIndex(p => {
          if (args.where.id) return p.id === args.where.id;
          if (args.where.userId) return p.userId === args.where.userId;
          return false;
        });
        if (pIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.profiles[pIdx], ...args.data, updatedAt: new Date() };
        inMemoryDb.profiles[pIdx] = updated;
        return updated;
      }
    };
  }

  public get company() {
    return {
      findUnique: async (args: { where: { id?: string; name?: string; slug?: string } }) => {
        if (args.where.id) return inMemoryDb.companies.find(c => c.id === args.where.id) || null;
        if (args.where.name) return inMemoryDb.companies.find(c => c.name === args.where.name) || null;
        if (args.where.slug) return inMemoryDb.companies.find(c => c.slug === args.where.slug) || null;
        return null;
      },
      findMany: async () => {
        return inMemoryDb.companies;
      },
      create: async (args: { data: Omit<DbCompany, 'id' | 'createdAt' | 'updatedAt' | 'isVerified'> }) => {
        const newCompany: DbCompany = {
          id: `company-${Math.random().toString(36).substring(2, 9)}`,
          name: args.data.name,
          slug: args.data.slug,
          description: args.data.description,
          logoUrl: args.data.logoUrl || null,
          isVerified: false,
          website: args.data.website || null,
          location: args.data.location,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryDb.companies.push(newCompany);
        return newCompany;
      },
      update: async (args: { where: { id: string }; data: Partial<DbCompany> }) => {
        const cIdx = inMemoryDb.companies.findIndex(c => c.id === args.where.id);
        if (cIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.companies[cIdx], ...args.data, updatedAt: new Date() };
        inMemoryDb.companies[cIdx] = updated;
        return updated;
      }
    };
  }

  public get job() {
    return {
      findUnique: async (args: { where: { id: string } }) => {
        return inMemoryDb.jobs.find(j => j.id === args.where.id) || null;
      },
      findMany: async (args?: { where?: { location?: string; type?: string; companyId?: string }; take?: number; skip?: number }) => {
        let results = [...inMemoryDb.jobs];
        if (args?.where) {
          if (args.where.location) {
            results = results.filter(j => j.location.toLowerCase().includes(args.where!.location!.toLowerCase()));
          }
          if (args.where.type) {
            results = results.filter(j => j.type === args.where!.type);
          }
          if (args.where.companyId) {
            results = results.filter(j => j.companyId === args.where!.companyId);
          }
        }
        return results;
      },
      create: async (args: { data: Omit<DbJob, 'id' | 'createdAt' | 'updatedAt' | 'isFeatured'> & { isFeatured?: boolean } }) => {
        const newJob: DbJob = {
          id: `job-${Math.random().toString(36).substring(2, 9)}`,
          companyId: args.data.companyId,
          title: args.data.title,
          description: args.data.description,
          location: args.data.location,
          type: args.data.type,
          salaryMin: args.data.salaryMin || null,
          salaryMax: args.data.salaryMax || null,
          isFeatured: args.data.isFeatured || false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryDb.jobs.push(newJob);
        return newJob;
      },
      update: async (args: { where: { id: string }; data: Partial<DbJob> }) => {
        const jIdx = inMemoryDb.jobs.findIndex(j => j.id === args.where.id);
        if (jIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.jobs[jIdx], ...args.data, updatedAt: new Date() };
        inMemoryDb.jobs[jIdx] = updated;
        return updated;
      },
      delete: async (args: { where: { id: string } }) => {
        const jIdx = inMemoryDb.jobs.findIndex(j => j.id === args.where.id);
        if (jIdx === -1) throw new Error("not found");
        const removed = inMemoryDb.jobs[jIdx];
        inMemoryDb.jobs = inMemoryDb.jobs.filter(j => j.id !== args.where.id);
        return removed;
      }
    };
  }

  public get application() {
    return {
      findUnique: async (args: { where: { userId_jobId?: { userId: string; jobId: string }; id?: string } }) => {
        if (args.where.userId_jobId) {
          const { userId, jobId } = args.where.userId_jobId;
          return inMemoryDb.applications.find(a => a.userId === userId && a.jobId === jobId) || null;
        }
        if (args.where.id) {
          return inMemoryDb.applications.find(a => a.id === args.where.id) || null;
        }
        return null;
      },
      findMany: async (args?: { where?: { userId?: string; jobId?: string } }) => {
        let results = [...inMemoryDb.applications];
        if (args?.where) {
          if (args.where.userId) {
            results = results.filter(a => a.userId === args.where!.userId);
          }
          if (args.where.jobId) {
            results = results.filter(a => a.jobId === args.where!.jobId);
          }
        }
        return results;
      },
      create: async (args: { data: Omit<DbApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: any } }) => {
        const newApp: DbApplication = {
          id: `app-${Math.random().toString(36).substring(2, 9)}`,
          userId: args.data.userId,
          jobId: args.data.jobId,
          status: args.data.status || 'APPLIED',
          coverLetter: args.data.coverLetter || null,
          resumeUrl: args.data.resumeUrl || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryDb.applications.push(newApp);
        return newApp;
      },
      update: async (args: { where: { id: string }; data: Partial<DbApplication> }) => {
        const aIdx = inMemoryDb.applications.findIndex(a => a.id === args.where.id);
        if (aIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.applications[aIdx], ...args.data, updatedAt: new Date() };
        inMemoryDb.applications[aIdx] = updated;
        return updated;
      },
      delete: async (args: { where: { id: string } }) => {
        const aIdx = inMemoryDb.applications.findIndex(a => a.id === args.where.id);
        if (aIdx === -1) throw new Error("not found");
        const removed = inMemoryDb.applications[aIdx];
        inMemoryDb.applications = inMemoryDb.applications.filter(a => a.id !== args.where.id);
        return removed;
      }
    };
  }

  public get refreshToken() {
    return {
      findUnique: async (args: { where: { token: string } }) => {
        return inMemoryDb.refreshTokens.find(r => r.token === args.where.token) || null;
      },
      create: async (args: { data: Omit<DbRefreshToken, 'id' | 'createdAt'> }) => {
        const newRt: DbRefreshToken = {
          id: `token-${Math.random().toString(36).substring(2, 9)}`,
          userId: args.data.userId,
          token: args.data.token,
          isRevoked: args.data.isRevoked || false,
          expiresAt: args.data.expiresAt,
          createdAt: new Date()
        };
        inMemoryDb.refreshTokens.push(newRt);
        return newRt;
      },
      update: async (args: { where: { id: string }; data: Partial<DbRefreshToken> }) => {
        const rIdx = inMemoryDb.refreshTokens.findIndex(r => r.id === args.where.id);
        if (rIdx === -1) throw new Error("not found");
        const updated = { ...inMemoryDb.refreshTokens[rIdx], ...args.data };
        inMemoryDb.refreshTokens[rIdx] = updated;
        return updated;
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        const initialCount = inMemoryDb.refreshTokens.length;
        inMemoryDb.refreshTokens = inMemoryDb.refreshTokens.filter(r => r.userId !== args.where.userId);
        return { count: initialCount - inMemoryDb.refreshTokens.length };
      }
    };
  }

  // Database transaction simulation
  public async $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    // In-Memory transaction is synchronous and straightforward
    return fn(this);
  }
}

export const prisma = new PrismaClient();
export default prisma;
