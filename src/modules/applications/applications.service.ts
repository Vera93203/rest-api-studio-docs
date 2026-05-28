/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import prisma from '../../core/database/prisma.js';
import bullQueue from '../../core/queue/bullmq.js';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../../core/errors/AppError.js';

export interface SubmitApplicationInput {
  jobId: string;
  coverLetter?: string;
  resumeUrl?: string; // Optional custom resume or defaults to candidate's profile asset
}

export class ApplicationService {
  /**
   * Fetch all applications for a candidate (USER) or for a job listing (recruiter / admin)
   */
  public async getApplications(actor: { userId: string; role: string; companyId?: string | null }, filterJobId?: string) {
    if (actor.role === 'USER') {
      const apps = await prisma.application.findMany({ where: { userId: actor.userId } });
      const jobs = await prisma.job.findMany();
      return apps.map(app => ({
        ...app,
        job: jobs.find(j => j.id === app.jobId) || null
      }));
    }

    if (actor.role === 'COMPANY_REP') {
      if (!actor.companyId) {
        throw new ForbiddenError("Your user account has not yet linked to any corporate profile.");
      }

      let apps = await prisma.application.findMany();
      const jobs = await prisma.job.findMany({ where: { companyId: actor.companyId } });
      const companyJobIds = jobs.map(j => j.id);

      // Filter applications only targeting this company's listings
      let matchedApps = apps.filter(a => companyJobIds.includes(a.jobId));

      if (filterJobId) {
        matchedApps = matchedApps.filter(a => a.jobId === filterJobId);
      }

      const users = await prisma.user.findMany();
      return matchedApps.map(app => ({
        ...app,
        job: jobs.find(j => j.id === app.jobId) || null,
        candidate: users.find(u => u.id === app.userId) ? {
          id: app.userId,
          fullName: users.find(u => u.id === app.userId)!.fullName,
          email: users.find(u => u.id === app.userId)!.email
        } : null
      }));
    }

    if (actor.role === 'ADMIN') {
      const apps = await prisma.application.findMany();
      const jobs = await prisma.job.findMany();
      const users = await prisma.user.findMany();
      return apps.map(app => ({
        ...app,
        job: jobs.find(j => j.id === app.jobId) || null,
        candidate: users.find(u => u.id === app.userId) ? {
          id: app.userId,
          fullName: users.find(u => u.id === app.userId)!.fullName,
          email: users.find(u => u.id === app.userId)!.email
        } : null
      }));
    }

    throw new ForbiddenError("Insufficient rights to view index applications ledger.");
  }

  /**
   * Submit application to job listing role
   */
  public async apply(input: SubmitApplicationInput, userId: string) {
    // Confirm user exists and doesn't apply to their own job or re-apply twice
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) {
      throw new NotFoundError(`Unable to locate job vacancy matching ID ${input.jobId}`);
    }

    const existing = await prisma.application.findUnique({
      where: {
        userId_jobId: { userId, jobId: input.jobId }
      }
    });

    if (existing) {
      if (existing.status === 'WITHDRAWN') {
        // Reactivate past withdrawn request
        const reactivated = await prisma.application.update({
          where: { id: existing.id },
          data: {
            status: 'APPLIED',
            coverLetter: input.coverLetter || existing.coverLetter,
            resumeUrl: input.resumeUrl || existing.resumeUrl
          }
        });
        return reactivated;
      }
      throw new ConflictError("You have already submitted an active application for this job posting.");
    }

    // Capture standard candidate resume links if unspecified in application
    let finalResume = input.resumeUrl;
    if (!finalResume) {
      const profile = await prisma.profile.findUnique({ where: { userId } });
      finalResume = profile?.resumeUrl || undefined;
    }

    if (!finalResume) {
      throw new ValidationError("No professional resume attachment found on profile or provided with application.");
    }

    const app = await prisma.application.create({
      data: {
        userId,
        jobId: input.jobId,
        status: 'APPLIED',
        coverLetter: input.coverLetter || null,
        resumeUrl: finalResume
      }
    });

    // Queue real-time Recruiter update task via bullMQ
    await bullQueue.add('send_job_application_notification', {
      jobId: job.id,
      userId,
      applicationId: app.id
    });

    return app;
  }

  /**
   * Withdraw active job listing interest
   */
  public async withdraw(id: string, userId: string) {
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Application record could not be found.");
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError("You do not have access authorization to modify this candidate process.");
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: 'WITHDRAWN' }
    });

    return updated;
  }

  /**
   * Status Pipeline Tracker Updates (Recruiters / Administrative)
   */
  public async transitionStatus(
    id: string,
    status: 'APPLIED' | 'REVIEWED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN',
    user: { userId: string; role: string; companyId?: string | null }
  ) {
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Application node missing.");
    }

    // Role checks
    if (user.role === 'COMPANY_REP') {
      const job = await prisma.job.findUnique({ where: { id: existing.jobId } });
      if (!job || job.companyId !== user.companyId) {
        throw new ForbiddenError("Corporate user is not connected to target corporate listings.");
      }
    } else if (user.role !== 'ADMIN') {
      throw new ForbiddenError("Insufficient rights to escalate application phases.");
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status }
    });

    return updated;
  }
}

export const applicationService = new ApplicationService();
export default applicationService;
