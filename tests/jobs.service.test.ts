/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jobService } from '../src/modules/jobs/jobs.service.js';
import { inMemoryDb } from '../src/core/database/prisma.js';

describe('Job module Search & Filter Spec', () => {
  const googleId = "company-google-id";
  const netflixId = "company-netflix-id";

  beforeEach(() => {
    // Standard state reset
    inMemoryDb.seedDefaultData();
  });

  describe('Job Search & Query Engine', () => {
    it('should correctly select matches based on text search query', async () => {
      const response = await jobService.getJobListings({ search: 'TypeScript' });
      expect(response.jobs.length).toBe(1);
      expect(response.jobs[0].title).toContain('TypeScript');
    });

    it('should paginate results using cursor pointer keys', async () => {
      // Fetch page 1
      const page1 = await jobService.getJobListings({ limit: 1 });
      expect(page1.jobs.length).toBe(1);
      expect(page1.meta.nextCursor).toBeDefined();

      const firstCursor = page1.meta.nextCursor!;

      // Fetch page 2 using cursor
      const page2 = await jobService.getJobListings({ limit: 1, cursor: firstCursor });
      expect(page2.jobs.length).toBe(1);
      expect(page2.jobs[0].id).not.toBe(page1.jobs[0].id);
    });

    it('should sort search results giving priority to featured/sponsored listings first', async () => {
      const response = await jobService.getJobListings({});
      
      // Seed details say first 2 jobs are featured
      expect(response.jobs[0].isFeatured).toBe(true);
      expect(response.jobs[1].isFeatured).toBe(true);
      expect(response.jobs[2].isFeatured).toBe(false);
    });

    it('should restrict job postings by salary filters', async () => {
      // Find jobs with max salary above 170,000
      const results = await jobService.getJobListings({ salaryMin: 170000 });
      expect(results.jobs.every(j => j.salaryMax !== null && j.salaryMax >= 170000)).toBe(true);
    });
  });

  describe('Corporation Security Protections', () => {
    it('should allow Company Reps to publish job listing vacancies for their designated organization link', async () => {
      const activeRep = {
        userId: "user-rep-id",
        role: "COMPANY_REP",
        companyId: googleId
      };

      // Add user rep record to database
      inMemoryDb.users.push({
        id: "user-rep-id",
        email: "recruiter@google.com",
        fullName: "Recruiter Bob",
        passwordHash: "hash",
        role: "COMPANY_REP",
        companyId: googleId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const beforeCount = inMemoryDb.jobs.length;

      const created = await jobService.createJob({
        companyId: googleId,
        title: "Junior TypeScript Engineer",
        description: "Need passionate junior developers.",
        location: "Hybrid, UK",
        type: "FULL_TIME",
        salaryMin: 50000,
        salaryMax: 70000
      }, activeRep);

      expect(created.id).toBeDefined();
      expect(inMemoryDb.jobs.length).toBe(beforeCount + 1);
    });

    it('should dynamically reject job publications from Company Reps from unrelated firms', async () => {
      const fraudulentRep = {
        userId: "user-fake-rep-id",
        role: "COMPANY_REP",
        companyId: netflixId
      };

      inMemoryDb.users.push({
        id: "user-fake-rep-id",
        email: "recruiter@fake.com",
        fullName: "Fake Bob",
        passwordHash: "hash",
        role: "COMPANY_REP",
        companyId: netflixId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await expect(jobService.createJob({
        companyId: googleId, // Trying to post to Google while representing Netflix
        title: "Malicious Insertion",
        description: "Fake post",
        location: "US",
        type: "REMOTE"
      }, fraudulentRep)).rejects.toThrow(/not registered as an authorized recruitment/);
    });
  });
});
