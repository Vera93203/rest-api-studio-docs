/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import prisma from '../../core/database/prisma.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../core/errors/AppError.js';

export interface CreateCompanyInput {
  name: string;
  description: string;
  website?: string;
  location: string;
}

export class CompanyService {
  /**
   * List all companies
   */
  public async getCompanies() {
    return prisma.company.findMany();
  }

  /**
   * Detail check using direct slug matching
   */
  public async getCompanyBySlug(slug: string) {
    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) {
      throw new NotFoundError(`No company profile registered on slug '${slug}'`);
    }

    const jobs = await prisma.job.findMany({ where: { companyId: company.id } });

    return {
      company,
      activePostings: jobs
    };
  }

  /**
   * Register corporate employer client account
   */
  public async createCompany(input: CreateCompanyInput, userId: string) {
    const existing = await prisma.company.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ValidationError("A corporate profiles has already loaded on this business name");
    }

    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const company = await prisma.company.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        location: input.location,
        website: input.website || null,
        logoUrl: null
      }
    });

    // Pair user as Company Representative
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'COMPANY_REP',
        companyId: company.id
      }
    });

    return company;
  }

  /**
   * S3 file assets mock logic
   */
  public async uploadLogo(companyId: string, logoFilename: string, fileBufferBase64: string, userId: string) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundError("Target business records missing");
    }

    // Auth validation
    const userObj = await prisma.user.findUnique({ where: { id: userId } });
    if (!userObj || userObj.role !== 'ADMIN' && userObj.companyId !== companyId) {
      throw new ForbiddenError("Not authorized to manage this company's assets");
    }

    // S3 simulated upload path
    const secureS3Url = `https://corporate-assets.s3.amazonaws.com/logos/${companyId}_${Date.now()}_${logoFilename}`;
    
    // Write link back to SQL table
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: secureS3Url }
    });

    return {
      logoUrl: secureS3Url,
      company: updated
    };
  }

  /**
   * Verified Badge Escalation system (Admin Privilege)
   */
  public async setVerificationState(id: string, isVerified: boolean) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundError("Cannot locate target business register profile");
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { isVerified }
    });

    return updated;
  }
}

export const companyService = new CompanyService();
export default companyService;
