/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BullJob {
  id: string;
  name: string;
  data: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  attempts: number;
  maxAttempts: number;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

class BullMockQueue {
  private jobs: BullJob[] = [];
  private listeners: ((job: BullJob) => void)[] = [];
  private logs: { timestamp: Date; message: string; severity: 'info' | 'warn' | 'success' | 'error' }[] = [];

  constructor() {
    this.addLog('BullMQ Connection initialized. Redis broker connected.', 'info');
  }

  public getJobs() {
    return this.jobs;
  }

  public getLogs() {
    return this.logs;
  }

  public clearAll() {
    this.jobs = [];
    this.logs = [];
    this.addLog('BullMQ Queue database purged.', 'warn');
  }

  private addLog(message: string, severity: 'info' | 'warn' | 'success' | 'error' = 'info') {
    this.logs.unshift({
      timestamp: new Date(),
      message,
      severity
    });
    if (this.logs.length > 100) this.logs.pop();
  }

  public onJobUpdate(callback: (job: BullJob) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify(job: BullJob) {
    this.listeners.forEach(cb => cb({ ...job }));
  }

  /**
   * Adds a brand new background job to BullMQ
   */
  public async add(name: string, data: any, opts: { attempts?: number } = {}): Promise<BullJob> {
    const job: BullJob = {
      id: `job-${Math.floor(Math.random() * 900000 + 100000)}`,
      name,
      data,
      status: 'waiting',
      progress: 0,
      attempts: 0,
      maxAttempts: opts.attempts || 3,
      createdAt: new Date()
    };

    this.jobs.unshift(job);
    this.addLog(`Added job '${name}' to queue. ID: ${job.id}`, 'info');
    this.notify(job);

    // Trigger async processing simulation
    this.processJobAsync(job.id);

    return job;
  }

  /**
   * Simulated Async bullmq-worker execution
   */
  private async processJobAsync(jobId: string) {
    // Small delay to simulate waiting stage
    await new Promise(resolve => setTimeout(resolve, 800));

    const job = this.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'waiting') return;

    job.status = 'active';
    job.attempts += 1;
    job.processedAt = new Date();
    this.addLog(`Worker accepted job [${job.name}] with ID: ${job.id} (Attempt ${job.attempts}/${job.maxAttempts})`, 'info');
    this.notify(job);

    // Update progress through timer loops
    const stepDuration = 400;
    for (let p = 25; p <= 100; p += 25) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const jCurrent = this.jobs.find(j => j.id === jobId);
      if (!jCurrent) return;
      jCurrent.progress = p;
      this.notify(jCurrent);
    }

    const finalJob = this.jobs.find(j => j.id === jobId);
    if (!finalJob) return;

    // Resolve or fail depending on simulated logic
    const shouldFail = job.name === 'generate_faulty_report' || (job.name === 'transcode_video' && job.attempts < 2);

    finalJob.finishedAt = new Date();
    if (shouldFail) {
      if (finalJob.attempts < finalJob.maxAttempts) {
        finalJob.status = 'waiting';
        finalJob.progress = 0;
        finalJob.error = 'Temporary processing error. Queued for automatic exponential retry.';
        this.addLog(`Job ${finalJob.id} failed temporary. Retrying in 2 seconds...`, 'warn');
        this.notify(finalJob);
        // Retry
        setTimeout(() => this.processJobAsync(jobId), 2000);
      } else {
        finalJob.status = 'failed';
        finalJob.error = 'Max retries exhausted. Failed to deliver payload.';
        this.addLog(`Job [${finalJob.name}] ID: ${finalJob.id} failed permanently. Error: ${finalJob.error}`, 'error');
        this.notify(finalJob);
      }
    } else {
      finalJob.status = 'completed';
      finalJob.result = this.generateSimulatedJobResult(finalJob.name, finalJob.data);
      this.addLog(`Completed job [${finalJob.name}] ID: ${finalJob.id} successfully.`, 'success');
      this.notify(finalJob);
    }
  }

  private generateSimulatedJobResult(name: string, data: any): any {
    switch (name) {
      case 'send_welcome_email':
        return { sent: true, recipient: data.email, template: 'welcome_v1', messageId: `msg-${Math.random().toString(36).substring(7)}` };
      case 'send_password_reset':
        return { sent: true, recipient: data.email, token: data.token, link: `${data.appUrl}/reset?token=${data.token}` };
      case 'send_job_application_notification':
        return { notifier: 'company_rep', jobId: data.jobId, candidateId: data.userId, deliveredAt: new Date() };
      case 'generate_salary_report_pdf':
        return { s3Url: `https://mock-s3-bucket.s3.amazonaws.com/reports/${Date.now()}_audit.pdf`, rowCount: 154, durationMs: 1600 };
      default:
        return { ok: true };
    }
  }
}

export const bullQueue = new BullMockQueue();
export default bullQueue;
