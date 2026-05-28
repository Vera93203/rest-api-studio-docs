/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import prisma from '../../core/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../../core/errors/AppError.js';
import type { DbJob } from '../../core/database/prisma.js';

export interface CreateJobInput {
  companyId: string;
  title: string;
  description: string;
  location: string;
  type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
  salaryMin?: number;
  salaryMax?: number;
}

export interface JobQueryFilters {
  search?: string;
  location?: string;
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
  salaryMin?: number;
  limit?: number;
  cursor?: string;
}

export class JobService {
  /**
   * Fetch jobs with filters and simulated cursor pagination & full-text scoring
   */
  public async getJobListings(filters: JobQueryFilters) {
    const limit = filters.limit || 10;
    let allJobs = await prisma.job.findMany();

    // Map company info for complete responses
    const companies = await prisma.company.findMany();
    const hydratedJobs = allJobs.map(job => ({
      ...job,
      company: companies.find(c => c.id === job.companyId) || null
    }));

    let filtered = hydratedJobs;

    // Filter locations
    if (filters.location) {
      const q = filters.location.toLowerCase();
      filtered = filtered.filter(j => j.location.toLowerCase().includes(q));
    }

    // Filter job types
    if (filters.type) {
      filtered = filtered.filter(j => j.type === filters.type);
    }

    // Filter salary ranges
    if (filters.salaryMin) {
      filtered = filtered.filter(j => j.salaryMax !== null && j.salaryMax >= filters.salaryMin!);
    }

    // Perform text queries
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(j => 
        j.title.toLowerCase().includes(q) || 
        j.description.toLowerCase().includes(q) ||
        (j.company && j.company.name.toLowerCase().includes(q))
      );
    }

    // Sort: Featured jobs first, then by date desc
    filtered.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Pagination via cursor
    let startIndex = 0;
    if (filters.cursor) {
      const cursorIdx = filtered.findIndex(j => j.id === filters.cursor);
      if (cursorIdx !== -1) {
        startIndex = cursorIdx + 1;
      }
    }

    const paginated = filtered.slice(startIndex, startIndex + limit);
    const nextCursor = paginated.length === limit ? paginated[paginated.length - 1].id : null;

    return {
      jobs: paginated,
      meta: {
        count: paginated.length,
        totalCandidatesMatched: filtered.length,
        nextCursor
      }
    };
  }

  /**
   * Retrieves a single job post by ID with full relations
   */
  public async getJobById(id: string) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundError(`Job listing not found with ID ${id}`);
    }

    const company = await prisma.company.findUnique({ where: { id: job.companyId } });
    const applications = await prisma.application.findMany({ where: { jobId: id } });

    return {
      ...job,
      company,
      _count: {
        applications: applications.length
      }
    };
  }

  /**
   * Launch new job listing (Company Rep check)
   */
  public async createJob(input: CreateJobInput, user: { userId: string; role: string; companyId?: string | null }) {
    if (user.role !== 'COMPANY_REP' && user.role !== 'ADMIN') {
      throw new ForbiddenError("Only corporate representatives or administrators may issue job vacancy notes.");
    }

    // Authenticate representation linkage
    if (user.role === 'COMPANY_REP') {
      const freshUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!freshUser || !freshUser.companyId || freshUser.companyId !== input.companyId) {
        throw new ForbiddenError("You are not registered as an authorized recruitment editor for this company profile.");
      }
    }

    const job = await prisma.job.create({
      data: {
        companyId: input.companyId,
        title: input.title,
        description: input.description,
        location: input.location,
        type: input.type,
        salaryMin: input.salaryMin || null,
        salaryMax: input.salaryMax || null
      }
    });

    return job;
  }

  /**
   * Update Job details
   */
  public async updateJob(id: string, updates: Partial<CreateJobInput>, user: { userId: string; role: string }) {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Target vacant record does not exist");
    }

    if (user.role === 'COMPANY_REP') {
      const freshUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!freshUser || freshUser.companyId !== existing.companyId) {
        throw new ForbiddenError("You are not authorized to update this company's postings.");
      }
    } else if (user.role !== 'ADMIN') {
      throw new ForbiddenError("Insufficient command clearances.");
    }

    const updated = await prisma.job.update({
      where: { id },
      data: updates
    });

    return updated;
  }

  /**
   * Delete job posting
   */
  public async deleteJob(id: string, user: { userId: string; role: string }) {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Target listing does not exist");
    }

    if (user.role === 'COMPANY_REP') {
      const freshUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!freshUser || freshUser.companyId !== existing.companyId) {
        throw new ForbiddenError("Corporate user is not connected to target corporate listings.");
      }
    } else if (user.role !== 'ADMIN') {
      throw new ForbiddenError("Administrative privileges requested.");
    }

    await prisma.job.delete({ where: { id } });
    return { evicted: true };
  }

  /**
   * Promote to sponsor / featured category (Admin authorization)
   */
  public async setFeaturedStatus(id: string, isFeatured: boolean) {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Listing not found to sponsor");
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { isFeatured }
    });

    return updated;
  }
}

export const jobService = new JobService();
export default jobService;
