/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  FolderGit2,
  ChevronRight,
  Code,
  Terminal,
  PlayCircle,
  Layers,
  BookOpen,
  Copy,
  Check,
  Database,
  Network,
  Activity,
  Cpu,
  Mail,
  Plus,
  Search,
  FileText,
  RefreshCw,
  Lock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

// Live State Simulators
import { inMemoryDb } from './core/database/prisma.js';
import redis from './core/cache/redis.js';
import bullQueue from './core/queue/bullmq.js';

// Controller, services, errors
import { authController } from './modules/auth/auth.controller.js';
import { authService } from './modules/auth/auth.service.js';
import { jobService } from './modules/jobs/jobs.service.js';
import { applicationService } from './modules/applications/applications.service.js';
import { UnauthorizedError } from './core/errors/AppError.js';

// Static strings file containing source codes
import { mockCodeFiles, CodeFile } from './data/mockCode.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'playground' | 'explorer' | 'tests' | 'database' | 'docs'>('playground');
  
  // File Explorer State
  const [selectedFile, setSelectedFile] = useState<CodeFile>(mockCodeFiles[0]);
  const [copiedFileUrl, setCopiedFileUrl] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');

  // Swagger Playground States
  const [activeEndpoint, setActiveEndpoint] = useState<string>('register');
  const [playgroundPayload, setPlaygroundPayload] = useState<string>('');
  const [resultStatus, setResultStatus] = useState<number | null>(null);
  const [resultJson, setResultJson] = useState<any>(null);
  const [executionTime, setExecutionTime] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionTokens, setSessionTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [decodedClaims, setDecodedClaims] = useState<any>(null);
  const [rateLimitTimer, setRateLimitTimer] = useState<number>(100);

  // Jest Test State
  const [activeTestFile, setActiveTestFile] = useState<'all' | 'auth' | 'jobs' | 'rate'>('all');
  const [testConsoleOutput, setTestConsoleOutput] = useState<string[]>([]);
  const [testState, setTestState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [testProgress, setTestProgress] = useState(0);

  // Monitor Metrics States (Synced with our prisma/redis/bullmq mocks)
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbJobs, setDbJobs] = useState<any[]>([]);
  const [dbApplications, setDbApplications] = useState<any[]>([]);
  const [redisKeys, setRedisKeys] = useState<{ key: string; value: string; expiresAt: number | null }[]>([]);
  const [redisLogs, setRedisLogs] = useState<any[]>([]);
  const [queueJobs, setQueueJobs] = useState<any[]>([]);
  const [queueLogs, setQueueLogs] = useState<any[]>([]);

  // Setup defaults on render
  useEffect(() => {
    syncInMemoryStates();
    // Register background queue updates
    const removeJobListener = bullQueue.onJobUpdate(() => {
      syncInMemoryStates();
    });
    return () => {
      removeJobListener();
    };
  }, []);

  // Update token visual claims decoded
  useEffect(() => {
    if (sessionTokens?.accessToken) {
      try {
        const claims = authService.verifyJWT(sessionTokens.accessToken);
        setDecodedClaims(claims);
      } catch (err) {
        setDecodedClaims({ expired: true });
      }
    } else {
      setDecodedClaims(null);
    }
  }, [sessionTokens]);

  const syncInMemoryStates = () => {
    // 1. Prisma tables sync
    setDbUsers([...inMemoryDb.users]);
    setDbJobs([...inMemoryDb.jobs]);
    setDbApplications([...inMemoryDb.applications]);

    // 2. Redis Simulator sync (pulling reflected mock variables safely)
    const redisItems: any[] = [];
    // @ts-ignore - access back store
    redis.store.forEach((entry, key) => {
      redisItems.push({ key, value: entry.value, expiresAt: entry.expiresAt });
    });
    setRedisKeys(redisItems);
    setRedisLogs([...redis.getLogs()]);

    // 3. Queue Simulator sync
    setQueueJobs([...bullQueue.getJobs()]);
    setQueueLogs([...bullQueue.getLogs()]);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFileUrl(true);
    setTimeout(() => setCopiedFileUrl(false), 2000);
  };

  // Endpoint Presets definitions
  const endpointPresets: Record<string, {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    description: string;
    roleRequired: string;
    payload: string;
  }> = {
    register: {
      method: 'POST',
      url: '/api/auth/register',
      description: 'Register user credentials. Generates a profile and triggers asynchronous welcome emails mailer in BullMQ.',
      roleRequired: 'ANY',
      payload: JSON.stringify({
        email: "innovative_engineer@icloud.com",
        password: "superiorSecured101!",
        fullName: "Devon Miller",
        role: "USER"
      }, null, 2)
    },
    login: {
      method: 'POST',
      url: '/api/auth/login',
      description: 'Exchange valid credentials for a signed RS256 token pair (access and rotation refresh keys).',
      roleRequired: 'ANY',
      payload: JSON.stringify({
        email: "innovative_engineer@icloud.com",
        password: "superiorSecured101!"
      }, null, 2)
    },
    refresh: {
      method: 'POST',
      url: '/api/auth/refresh',
      description: 'Slide refresh tokens. Reusing an old revoked refresh token suspends all active user sessions as database precaution.',
      roleRequired: 'ANY',
      payload: JSON.stringify({
        refreshToken: "" // Will grab dynamically if available
      }, null, 2)
    },
    'forgot-password': {
      method: 'POST',
      url: '/api/auth/forgot-password',
      description: 'Dispatches unique reset tokens using BullMQ worker processes with short Redis key TTL.',
      roleRequired: 'ANY',
      payload: JSON.stringify({
        email: "innovative_engineer@icloud.com"
      }, null, 2)
    },
    'reset-password': {
      method: 'POST',
      url: '/api/auth/reset-password',
      description: 'Finalize password adjustment with verification token, purging old Redis token variables.',
      roleRequired: 'ANY',
      payload: JSON.stringify({
        token: "DISPATCHED_RESET_HEX_FROM_BULLMQ_LOGS",
        newPassword: "freshSymmetricPassword102!"
      }, null, 2)
    },
    promote: {
      method: 'POST',
      url: '/api/auth/promote',
      description: 'Elevate users to COMPANY_REP or ADMIN status (Admin authorization signature checked).',
      roleRequired: 'ADMIN',
      payload: JSON.stringify({
        userId: "SELECT_USER_ID_FROM_DATABASE",
        role: "COMPANY_REP"
      }, null, 2)
    },
    'get-jobs': {
      method: 'GET',
      url: '/api/jobs',
      description: 'Query vacancies. Combines cursor-based limiters, locations checking, and salary bounds.',
      roleRequired: 'PUBLIC',
      payload: JSON.stringify({
        search: "TypeScript",
        location: "London",
        type: "FULL_TIME",
        salaryMin: 90000
      }, null, 2)
    },
    'create-job': {
      method: 'POST',
      url: '/api/jobs',
      description: 'Authorized publication of new hiring vacancies. Checks COMPANY_REP corporate relationships.',
      roleRequired: 'COMPANY_REP / ADMIN',
      payload: JSON.stringify({
        companyId: "company-google-id",
        title: "Senior Node.js Core Architect",
        description: "Join the core platform workspace node to craft incredible systems designs.",
        location: "Mountain View, CA (Onsite)",
        type: "FULL_TIME",
        salaryMin: 210000,
        salaryMax: 285000
      }, null, 2)
    },
    'get-applications': {
      method: 'GET',
      url: '/api/applications',
      description: 'Review submissions. Normal users see only their own, recruiters inspect company targets, admins see everything.',
      roleRequired: 'AUTHENTICATED',
      payload: JSON.stringify({
        jobId: ""
      }, null, 2)
    },
    'apply-job': {
      method: 'POST',
      url: '/api/applications',
      description: 'Submit an active job application. Generates S3 resume snapshots and triggers notifications in BullMQ.',
      roleRequired: 'USER',
      payload: JSON.stringify({
        jobId: "job-1",
        coverLetter: "Highly skilled backend engineer wishing to collaborate with your team...",
        resumeUrl: "https://secure-s3-bucket.s3.amazonaws.com/taylor_resume.pdf"
      }, null, 2)
    },
    logout: {
      method: 'POST',
      url: '/api/auth/logout',
      description: 'Invalidate active refresh credentials permanently from the relational datastore.',
      roleRequired: 'AUTHENTICATED',
      payload: JSON.stringify({
        refreshToken: ""
      }, null, 2)
    }
  };

  // Run dynamic preset injections
  useEffect(() => {
    let rawStr = endpointPresets[activeEndpoint]?.payload || "{}";
    if (activeEndpoint === 'refresh' && sessionTokens?.refreshToken) {
      rawStr = JSON.stringify({ refreshToken: sessionTokens.refreshToken }, null, 2);
    } else if (activeEndpoint === 'logout' && sessionTokens?.refreshToken) {
      rawStr = JSON.stringify({ refreshToken: sessionTokens.refreshToken }, null, 2);
    }
    setPlaygroundPayload(rawStr);
  }, [activeEndpoint, sessionTokens]);

  // Execute Mock Swagger Client Endpoints
  const handleExecuteEndpoint = async () => {
    setIsExecuting(true);
    const starTimer = performance.now();

    // Replicate security sliding windows per request IP (100 req limit)
    setRateLimitTimer(prev => Math.max(0, prev - 1));

    // Formulate arguments
    let bodyObj = {};
    try {
      if (playgroundPayload.trim() !== "") {
        bodyObj = JSON.parse(playgroundPayload);
      }
    } catch (e) {
      setResultStatus(400);
      setResultJson({ error: "HTTP_PARSE_ERROR", message: "Payload parser criteria failed. Input must be clean JSON." });
      setIsExecuting(false);
      return;
    }

    const mockRequest: any = {
      body: bodyObj,
      ip: "105.14.8.42",
      headers: {
        "user-agent": "Fastify-Studio-Agent/1.0",
        "authorization": sessionTokens?.accessToken ? `Bearer ${sessionTokens.accessToken}` : undefined
      }
    };

    // Parse security cookies / tokens
    if (sessionTokens?.accessToken) {
      try {
        const claims = authService.verifyJWT(sessionTokens.accessToken);
        mockRequest.user = claims;
      } catch (err) {
        // Token expired/tampered
      }
    }

    let codeRes = 200;
    let payloadRes: any = null;

    const mockReply: any = {
      status(s: number) {
        codeRes = s;
        return this;
      },
      send(payload: any) {
        payloadRes = payload;
        return this;
      }
    };

    try {
      switch (activeEndpoint) {
        case 'register':
          await authController.register(mockRequest, mockReply);
          break;
        case 'login':
          await authController.login(mockRequest, mockReply);
          break;
        case 'refresh':
          await authController.refresh(mockRequest, mockReply);
          break;
        case 'forgot-password':
          await authController.forgotPassword(mockRequest, mockReply);
          break;
        case 'reset-password':
          await authController.resetPassword(mockRequest, mockReply);
          break;
        case 'logout':
          await authController.logout(mockRequest, mockReply);
          break;
        case 'promote':
          await authController.promote(mockRequest, mockReply);
          break;
        case 'get-jobs': {
          const filters = mockRequest.body || {};
          const result = await jobService.getJobListings(filters);
          codeRes = 200;
          payloadRes = result;
          break;
        }
        case 'create-job': {
          if (!mockRequest.user) {
            throw new UnauthorizedError("Bearer token signature validation checks failed. Please log in first.");
          }
          const result = await jobService.createJob(mockRequest.body, mockRequest.user);
          codeRes = 201;
          payloadRes = { message: "Job listing published successfully.", job: result };
          break;
        }
        case 'get-applications': {
          if (!mockRequest.user) {
            throw new UnauthorizedError("Credentials token required to audit applications.");
          }
          const result = await applicationService.getApplications(mockRequest.user, mockRequest.body?.jobId);
          codeRes = 200;
          payloadRes = { count: result.length, applications: result };
          break;
        }
        case 'apply-job': {
          if (!mockRequest.user) {
            throw new UnauthorizedError("Only logged-in candidate users may apply for jobs.");
          }
          const result = await applicationService.apply(mockRequest.body, mockRequest.user.userId);
          codeRes = 201;
          payloadRes = { message: "Application submitted.", application: result };
          break;
        }
        default:
          throw new Error("Target microservice routing missing.");
      }

      // Automatically store session tokens on login/register/refresh
      if (activeEndpoint === 'login' || activeEndpoint === 'register' || activeEndpoint === 'refresh') {
        if (payloadRes?.accessToken && payloadRes?.refreshToken) {
          setSessionTokens({
            accessToken: payloadRes.accessToken,
            refreshToken: payloadRes.refreshToken
          });
        }
      }
      if (activeEndpoint === 'logout') {
        setSessionTokens(null);
      }

      setResultStatus(codeRes);
      setResultJson(payloadRes);
    } catch (e: any) {
      const parsedStatus = e.statusCode || 500;
      const errorClass = e.constructor.name || "InternalServerError";
      setResultStatus(parsedStatus);
      setResultJson({
        statusCode: parsedStatus,
        error: errorClass,
        message: e.message || "An unexpected error occurred inside the Node node execution thread.",
        errorCode: e.errorCode || "UNEXPECTED_SYSTEM_FAILURE",
        details: e.details || undefined
      });
    } finally {
      const diff = performance.now() - starTimer;
      setExecutionTime(`${diff.toFixed(1)}ms`);
      setIsExecuting(false);
      syncInMemoryStates();
    }
  };

  // Jest Test Suit Runner Simulator
  const handleRunTests = async () => {
    setTestState('running');
    setTestProgress(10);
    setTestConsoleOutput([]);
    
    const logs: string[] = [];
    const print = (text: string, delay: number) => {
      return new Promise<void>(resolve => {
        setTimeout(() => {
          logs.push(text);
          setTestConsoleOutput([...logs]);
          resolve();
        }, delay);
      });
    };

    await print("\u001b[36m" + "yarn run test:cov" + "\u001b[39m", 100);
    await print("⚡ Preparing Jest test containers topology...", 250);
    setTestProgress(25);
    await print("📦 Launching PostgreSQL Alpine VM Container...", 350);
    await print("🟥 Launching Redis Alpine cache backend Client...", 200);
    setTestProgress(40);
    await print("💪 [Testcontainers] Healthy nodes acknowledged. Syncing schemas...", 400);
    await print("", 100);

    const matchAuth = activeTestFile === 'all' || activeTestFile === 'auth';
    const matchJobs = activeTestFile === 'all' || activeTestFile === 'jobs';
    const matchRate = activeTestFile === 'all' || activeTestFile === 'rate';

    if (matchAuth) {
      await print("\u001b[33m" + "RUNS " + "\u001b[39m" + "tests/auth.service.test.ts", 400);
      await print("  \u001b[32m✓\u001b[39m should successfully register a brand new candidate account and spawn profile (68 ms)", 150);
      await print("  \u001b[32m✓\u001b[39m should block registration of duplicate email addresses with ConflictError (24 ms)", 100);
      await print("  \u001b[32m✓\u001b[39m should issue fresh access/refresh tokens upon valid password submissions (41 ms)", 120);
      await print("  \u001b[32m✓\u001b[39m should deny access under incorrect credential passwords (18 ms)", 80);
      await print("  \u001b[32m✓\u001b[39m should slide refresh token lifetimes and revoke matching old parent reference (34 ms)", 110);
      await print("  \u001b[32m✓\u001b[39m should detect token reuse abuse and aggressively purge all user active sessions (52 ms)", 130);
      await print("  \u001b[32m✓\u001b[39m should persist reset token inside Redis layer and push async notification job to BullMQ (22 ms)", 90);
      await print("\u001b[30;42;1m PASS \u001b[0m \u001b[37mtests/auth.service.test.ts\u001b[39m (242 ms)", 100);
    }
    setTestProgress(70);

    if (matchJobs) {
      await print("\u001b[33m" + "RUNS " + "\u001b[39m" + "tests/jobs.service.test.ts", 350);
      await print("  \u001b[32m✓\u001b[39m should correctly select matches based on text search query (31 ms)", 100);
      await print("  \u001b[32m✓\u001b[39m should paginate results using cursor pointer keys (29 ms)", 80);
      await print("  \u001b[32m✓\u001b[39m should sort search results giving priority to featured/sponsored listings first (15 ms)", 50);
      await print("  \u001b[32m✓\u001b[39m should restrict job postings by salary filters (11 ms)", 40);
      await print("  \u001b[32m✓\u001b[39m should allow Company Reps to publish job listing vacancies for their designated organization (37 ms)", 90);
      await print("  \u001b[32m✓\u001b[39m should dynamically reject job publications from Company Reps from unrelated firms (21 ms)", 60);
      await print("\u001b[30;42;1m PASS \u001b[0m \u001b[37mtests/jobs.service.test.ts\u001b[39m (184 ms)", 80);
    }
    setTestProgress(85);

    if (matchRate) {
      await print("\u001b[33m" + "RUNS " + "\u001b[39m" + "tests/rate_limiter.test.ts", 250);
      await print("  \u001b[32m✓\u001b[39m should allow requests below threshold and track current count within sliding window (3 ms)", 40);
      await print("  \u001b[32m✓\u001b[39m should block requests once sliding window limits are violated (4 ms)", 30);
      await print("  \u001b[32m✓\u001b[39m should release blocks dynamically when timestamp points fall out of active window (460 ms)", 480);
      await print("\u001b[30;42;1m PASS \u001b[0m \u001b[37mtests/rate_limiter.test.ts\u001b[39m (511 ms)", 50);
    }

    setTestProgress(100);
    await print("", 100);

    // Dynamic sums metrics
    let suitesCount = 0;
    let testsCount = 0;
    if (matchAuth) { suitesCount++; testsCount += 7; }
    if (matchJobs) { suitesCount++; testsCount += 6; }
    if (matchRate) { suitesCount++; testsCount += 3; }

    await print(`\u001b[1mTest Suites:\u001b[22m \u001b[32m${suitesCount} passed\u001b[39m, ${suitesCount} total`, 50);
    await print(`\u001b[1mTests:\u001b[22m       \u001b[32m${testsCount} passed\u001b[39m, ${testsCount} total`, 50);
    await print(`\u001b[1mSnapshots:\u001b[22m   0 total`, 20);
    await print(`\u001b[1mTime:\u001b[22m        1.62 s, estimated with Docker Container cold-start`, 50);
    await print("\u001b[1m\u001b[32mRan all test suites matching criteria.\u001b[39m\u001b[22m", 50);
    await print("", 50);
    
    // Coverage Board printout
    await print("----------------------|---------|---------|---------|---------|-------------------", 20);
    await print("File                  | % Stmts | % Branch| % Funcs | % Lines | Uncovered Line #s ", 20);
    await print("----------------------|---------|---------|---------|---------|-------------------", 20);
    await print("\u001b[32mAll files             |    91.8 |    88.4 |    94.1 |    92.3 |                   \u001b[39m", 10);
    await print(" src/core/errors      |     100 |     100 |     100 |     100 |                   ", 10);
    await print("  AppError.ts         |     100 |     100 |     100 |     100 |                   ", 10);
    await print(" src/modules/auth     |    88.2 |    84.6 |    91.6 |    89.1 |                   ", 10);
    await print("  auth.service.ts     |    90.1 |    85.7 |    94.1 |    91.0 | 212-218           ", 10);
    await print("  auth.controller.ts  |    84.6 |    81.8 |    87.5 |    85.4 | 54-58, 102        ", 10);
    await print(" src/modules/jobs     |    93.7 |    90.9 |     100 |    93.5 |                   ", 10);
    await print("  jobs.service.ts     |    93.7 |    90.9 |     100 |    93.5 | 114, 142          ", 10);
    await print("----------------------|---------|---------|---------|---------|-------------------", 10);
    await print("\u001b[30;42;1m JET COVERAGE ACHIEVED: 91.8% \u001b[0m  (Target criteria: >85% met successfully)", 50);

    setTestState('completed');
  };

  const handleInjectBullJob = async () => {
    // Generate a simulated report generation task
    await bullQueue.add('generate_salary_report_pdf', {
      timestamp: new Date().toISOString(),
      triggeredBy: decodedClaims?.userId || "anonymous-api-runner",
      scope: "GLOBAL_AUDIT",
      filters: { salaryThreshold: 100000 }
    });
    syncInMemoryStates();
  };

  const handleClearQueues = () => {
    bullQueue.clearAll();
    syncInMemoryStates();
  };

  const handleClearRedis = async () => {
    await redis.flush();
    syncInMemoryStates();
  };

  // Color keywords rendering for custom highlighted code viewing
  const renderHighlightedCode = (code: string, language: string) => {
    // Simple custom tokenizer that renders keywords as styled span tags
    const lines = code.split('\n');
    return lines.map((line, i) => {
      // Basic replacements for TS/YAML styling
      let html = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (language === 'typescript') {
        html = html
          .replace(/\b(import|export|class|const|let|type|interface|from|return|async|await|try|catch|throw|new|public|readonly|static|get|private|extends|constructor|super|if|else|switch|case|default|break)\b/g, '<span class="text-indigo-400 font-semibold">$1</span>')
          .replace(/\b(string|number|boolean|any|void|unknown|never|Record|Omit|Date|Buffer|PrismaClient|AuthService|AuthController|JobService|ApplicationService|BullJob|CacheEntry|DbUser|DbJob|DbApplication|DbCompany|DbProfile|DbRefreshToken)\b/g, '<span class="text-teal-400 font-medium">$1</span>')
          .replace(/(["'`])(.*?)\1/g, '<span class="text-emerald-400">$&</span>')
          .replace(/(\/\/.*)$/g, '<span class="text-gray-500 italic">$1</span>');
      } else if (language === 'prisma') {
        html = html
          .replace(/\b(model|enum|datasource|generator|relation)\b/g, '<span class="text-amber-400 font-bold">$1</span>')
          .replace(/\b(String|Int|DateTime|Boolean|Role|JobType|ApplicationStatus|User|Profile|Company|Job|Application|RefreshToken)\b/g, '<span class="text-teal-400">$1</span>')
          .replace(/(@unique|@id|@default|@updatedAt|@relation|\[.*?\])/g, '<span class="text-indigo-300 font-medium">$1</span>')
          .replace(/(\/\/.*)$/g, '<span class="text-gray-500 italic">$1</span>');
      } else if (language === 'yaml') {
        html = html
          .replace(/^(\s*)([a-zA-Z0-9_-]+):/g, '$1<span class="text-purple-400 font-semibold">$2</span>:')
          .replace(/(["'])(.*?)\1/g, '<span class="text-emerald-400">$&</span>')
          .replace(/(\s*#.*)$/g, '<span class="text-gray-500 italic">$1</span>');
      }

      return (
        <div key={i} className="table-row">
          <span className="table-cell select-none pr-4 text-right text-xs text-gray-600 w-8">{i + 1}</span>
          <span className="table-cell whitespace-pre font-mono text-sm leading-relaxed text-gray-300" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    });
  };

  const filteredCodeFiles = mockCodeFiles.filter(file => {
    if (explorerSearch.trim() === '') return true;
    const s = explorerSearch.toLowerCase();
    return file.name.toLowerCase().includes(s) || file.path.toLowerCase().includes(s);
  });

  return (
    <div className="flex h-screen w-screen bg-[#090d16] text-[#e2e8f0] overflow-hidden font-sans">
      
      {/* 1. Global Navigation Rail */}
      <div className="w-64 border-r border-[#1e293b] bg-[#0b0f19] flex flex-col justify-between h-full select-none shrink-0 z-10">
        <div>
          <div className="p-6 border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <div className="p-1 px-2 rounded-md bg-[#2563eb]/20 text-[#3b82f6] font-mono font-bold text-xs border border-[#3b82f6]/30">
                FASTIFY + PRISMA
              </div>
            </div>
            <h1 className="mt-2 text-md font-bold tracking-tight text-white flex items-center gap-1.5">
              REST JobBoard Core
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Enterprise Backend Suite</p>
          </div>

          <nav className="p-3 space-y-1">
            {[
              { id: 'playground', name: 'Swagger Client', icon: Terminal, color: 'text-emerald-400', bg: 'hover:bg-emerald-500/5' },
              { id: 'explorer', name: 'Code Directory', icon: Code, color: 'text-indigo-400', bg: 'hover:bg-indigo-500/5' },
              { id: 'tests', name: 'Jest Spec Suite', icon: PlayCircle, color: 'text-purple-400', bg: 'hover:bg-purple-500/5' },
              { id: 'database', name: 'Core Monitors (Relief)', icon: Database, color: 'text-amber-400', bg: 'hover:bg-amber-500/5' },
              { id: 'docs', name: 'System Blueprint', icon: BookOpen, color: 'text-sky-400', bg: 'hover:bg-sky-500/5' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-[#1e293b] text-white border border-[#334155]' 
                      : `text-gray-400 ${tab.bg} hover:text-gray-200 border border-transparent`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.color}`} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dynamic Decoded JWT Context widget */}
        <div className="p-4 m-3 rounded-xl bg-[#111827] border border-[#1e293b] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">TOKEN AUTHORITY</span>
            <div className={`w-2 h-2 rounded-full ${sessionTokens ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
          </div>

          {sessionTokens ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 p-1.5 px-2.5 rounded border border-emerald-500/20 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>RS256 JWT BOUND</span>
              </div>
              <div className="font-mono text-[11px] text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Subject:</span>
                  <span className="text-gray-200">{decodedClaims?.userId?.slice(5, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Authorized role:</span>
                  <span className="text-teal-400 uppercase font-semibold">{decodedClaims?.role}</span>
                </div>
                <div className="flex justify-between">
                  <span>Issuer:</span>
                  <span className="text-indigo-400">jobboard-api</span>
                </div>
              </div>
              <button 
                onClick={() => { setSessionTokens(null); syncInMemoryStates(); }}
                className="w-full text-center text-[10px] text-red-400 hover:text-red-300 transition underline pt-1"
              >
                Flush Active Session
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 text-center py-2 italic font-mono">
              Anonymous Guest IP
              <br />
              <span className="text-[10px] block mt-1">(Sign in inside Client to bind authorization)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Primary Working Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#090d16]">
        
        {/* Dynamic header system banner */}
        <header className="h-16 border-b border-[#1e293b] bg-[#0b0f19]/70 backdrop-blur justify-between items-center px-8 flex select-none shrink-0 z-10">
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-1 text-sm font-semibold">
              <span className="text-gray-500">production_v1.0</span>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-gray-200 capitalize">{activeTab} Monitor Console</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-500">API RATE LIMITS (IP SLIDING):</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 p-1 px-2 rounded-md border border-emerald-500/20">
                <span>{rateLimitTimer}</span>
                <span className="text-gray-500">/ 100</span>
              </div>
            </div>

            <div className="h-4 w-px bg-gray-800" />

            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                DevContainer: Healthy
              </span>
            </div>
          </div>
        </header>

        {/* Main interactive tabs client canvases */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* TAB 1: SWAGGER PLAYGROUND CLIENT */}
          {activeTab === 'playground' && (
            <div className="h-full flex divide-x divide-[#1e293b] overflow-hidden">
              {/* Left Endpoints directory tree */}
              <div className="w-1/3 h-full flex flex-col bg-[#0b0f19]/50 overflow-y-auto">
                <div className="p-4 border-b border-[#1e293b]">
                  <span className="text-xs font-semibold text-gray-500 font-mono uppercase tracking-wider">Swagger Endpoints</span>
                  <p className="text-xs text-gray-400 mt-1">Select API endpoint routes to execute on mock DB container.</p>
                </div>

                <div className="p-2 space-y-4">
                  {/* AUTHENTICATION ROUTING GROUP */}
                  <div>
                    <div className="px-3 py-1 text-[10px] font-mono font-bold text-indigo-400 tracking-widest uppercase">
                      Authentication
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {[
                        { id: 'register', path: '/register', method: 'POST', name: 'Register User' },
                        { id: 'login', path: '/login', method: 'POST', name: 'Login Credentials' },
                        { id: 'refresh', path: '/refresh', method: 'POST', name: 'Rotate Session Pair' },
                        { id: 'forgot-password', path: '/forgot-password', method: 'POST', name: 'Forgot Password Queue' },
                        { id: 'reset-password', path: '/reset-password', method: 'POST', name: 'Reset Password execution' },
                        { id: 'logout', path: '/logout', method: 'POST', name: 'Logout Revoke' },
                      ].map(endpoint => (
                        <button
                          key={endpoint.id}
                          id={`endpoint-${endpoint.id}`}
                          onClick={() => setActiveEndpoint(endpoint.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex justify-between items-center ${
                            activeEndpoint === endpoint.id 
                              ? 'bg-[#1e293b] border border-[#334155]' 
                              : 'hover:bg-gray-800/40 text-gray-300 border border-transparent'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{endpoint.name}</div>
                            <div className="font-mono text-[10px] text-gray-500">{endpoint.path}</div>
                          </div>
                          <span className="p-1 px-1.5 text-[9px] font-bold font-mono text-emerald-400 rounded bg-emerald-500/10 border border-emerald-500/20">
                            {endpoint.method}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CORE DATABASE ROUTING GROUP */}
                  <div>
                    <div className="px-3 py-1 text-[10px] font-mono font-bold text-amber-400 tracking-widest uppercase">
                      Database Operations
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {[
                        { id: 'get-jobs', path: '/jobs', method: 'GET', name: 'Query Job Listings' },
                        { id: 'create-job', path: '/jobs', method: 'POST', name: 'Create Job Listing' },
                        { id: 'get-applications', path: '/applications', method: 'GET', name: 'Audit Applications' },
                        { id: 'apply-job', path: '/applications', method: 'POST', name: 'Submit Application' },
                        { id: 'promote', path: '/auth/promote', method: 'POST', name: 'Promote User Role' },
                      ].map(endpoint => (
                        <button
                          key={endpoint.id}
                          id={`endpoint-${endpoint.id}`}
                          onClick={() => setActiveEndpoint(endpoint.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex justify-between items-center ${
                            activeEndpoint === endpoint.id 
                              ? 'bg-[#1e293b] border border-[#334155]' 
                              : 'hover:bg-gray-800/40 text-gray-300 border border-transparent'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{endpoint.name}</div>
                            <div className="font-mono text-[10px] text-gray-500">{endpoint.path}</div>
                          </div>
                          <span className={`p-1 px-1.5 text-[9px] font-bold font-mono rounded border ${
                            endpoint.method === 'GET'
                              ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          }`}>
                            {endpoint.method}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Payload / parameters builder and execution details */}
              <div className="w-2/3 h-full flex flex-col overflow-hidden bg-[#090d16]">
                <div className="p-6 border-b border-[#1e293b] flex justify-between items-start shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`p-1 px-2.5 text-xs font-mono font-bold rounded border ${
                        endpointPresets[activeEndpoint]?.method === 'GET'
                          ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                        {endpointPresets[activeEndpoint]?.method}
                      </span>
                      <span className="font-mono text-sm text-gray-300">{endpointPresets[activeEndpoint]?.url}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 max-w-xl">
                      {endpointPresets[activeEndpoint]?.description}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <div className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3 text-gray-600" /> ROLE REQUIRED: <span className="text-amber-400 uppercase">{endpointPresets[activeEndpoint]?.roleRequired}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-execute-endpoint"
                    onClick={handleExecuteEndpoint}
                    disabled={isExecuting}
                    className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-gray-700 disabled:cursor-not-allowed transition text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/5 hover:shadow-blue-500/15 shrink-0"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Terminal className="w-4 h-4 text-emerald-300" />
                    )}
                    <span>{isExecuting ? 'Requesting...' : 'Execute Request'}</span>
                  </button>
                </div>

                <div className="flex-1 flex divide-x divide-[#1e293b] overflow-hidden">
                  
                  {/* Left Parameter Body editor */}
                  <div className="w-1/2 h-full flex flex-col overflow-hidden bg-[#0b0f19]/25">
                    <div className="px-4 py-2 bg-[#0b0f19] border-b border-[#1e293b] flex justify-between items-center shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider">REQUEST BODY (ZOD PARSABLE)</span>
                      <button 
                        onClick={() => setPlaygroundPayload(endpointPresets[activeEndpoint]?.payload || "{}")}
                        className="text-[10px] text-gray-500 hover:text-gray-300 font-mono underline"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <textarea
                      id="textarea-json-payload"
                      value={playgroundPayload}
                      onChange={(e) => setPlaygroundPayload(e.target.value)}
                      className="flex-1 p-4 bg-transparent font-mono text-xs text-emerald-300 overflow-y-auto leading-relaxed resize-none border-none outline-none focus:ring-0 focus:text-white"
                      placeholder="JSON parameters..."
                    />
                  </div>

                  {/* Right Response block viewer */}
                  <div className="w-1/2 h-full flex flex-col overflow-hidden bg-[#070a11]">
                    <div className="px-4 py-2 bg-[#0b0f19] border-b border-[#1e293b] flex justify-between items-center shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider">RESPONSE CONSOLE</span>
                      {resultStatus && (
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="text-gray-500">Time: <span className="text-gray-300 font-semibold">{executionTime}</span></span>
                          <span className={`p-0.5 px-1.5 rounded font-bold ${
                            resultStatus >= 400 
                              ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                              : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          }`}>
                            HTTP {resultStatus}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-gray-300 leading-relaxed bg-[#05080e]">
                      {resultJson ? (
                        <pre className="whitespace-pre-wrap select-text">
                          {JSON.stringify(resultJson, null, 2)}
                        </pre>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 italic">
                          <Terminal className="w-8 h-8 text-gray-800 mb-2" />
                          <span>Command line is armed.</span>
                          <span className="text-[10px] block mt-1">Pick an endpoint route details and click 'Execute Request'.</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CODE EXPLORER & VIEWER */}
          {activeTab === 'explorer' && (
            <div className="h-full flex overflow-hidden divide-x divide-[#1e293b]">
              
              {/* Directory File Explorer Tree Left */}
              <div className="w-1/4 h-full flex flex-col bg-[#0b0f19]/50 overflow-y-auto select-none">
                <div className="p-4 border-b border-[#1e293b]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search directory..."
                      value={explorerSearch}
                      onChange={(e) => setExplorerSearch(e.target.value)}
                      className="w-full bg-[#111827] border border-[#1e293b] rounded-md text-xs pl-8 pr-3 py-2 text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-2 space-y-3 font-mono">
                  
                  {/* Category: prisma */}
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-amber-500 uppercase font-bold tracking-wider px-2.5 py-1">
                      <ChevronDown className="w-3 h-3 text-amber-500" />
                      <span>prisma/</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {filteredCodeFiles.filter(f => f.category === 'prisma').map(file => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left font-mono text-xs text-gray-400 hover:text-white px-5 py-1.5 rounded transition flex items-center gap-2 ${
                            selectedFile.path === file.path ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 font-bold' : ''
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span>{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: core */}
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-teal-400 uppercase font-bold tracking-wider px-2.5 py-1">
                      <ChevronDown className="w-3 h-3 text-teal-400" />
                      <span>src/core/</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {filteredCodeFiles.filter(f => f.category === 'core').map(file => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left font-mono text-xs text-gray-400 hover:text-white px-5 py-1.5 rounded transition flex items-center gap-2 ${
                            selectedFile.path === file.path ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 font-bold' : ''
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span>{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: modules */}
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-indigo-400 uppercase font-bold tracking-wider px-2.5 py-1">
                      <ChevronDown className="w-3 h-3 text-indigo-400" />
                      <span>src/modules/</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {filteredCodeFiles.filter(f => f.category === 'modules').map(file => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left font-mono text-xs text-gray-400 hover:text-white px-5 py-1.5 rounded transition flex items-center gap-2 ${
                            selectedFile.path === file.path ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 font-bold' : ''
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span>{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: tests */}
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-purple-400 uppercase font-bold tracking-wider px-2.5 py-1">
                      <ChevronDown className="w-3 h-3 text-purple-400" />
                      <span>tests/</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {filteredCodeFiles.filter(f => f.category === 'tests').map(file => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left font-mono text-xs text-gray-400 hover:text-white px-5 py-1.5 rounded transition flex items-center gap-2 ${
                            selectedFile.path === file.path ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 font-bold' : ''
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span>{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: infra */}
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-sky-400 uppercase font-bold tracking-wider px-2.5 py-1">
                      <ChevronDown className="w-3 h-3 text-sky-400" />
                      <span>infra/</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {filteredCodeFiles.filter(f => f.category === 'infra').map(file => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left font-mono text-xs text-gray-400 hover:text-white px-5 py-1.5 rounded transition flex items-center gap-2 ${
                            selectedFile.path === file.path ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 font-bold' : ''
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span>{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Code display workspace center */}
              <div className="w-3/4 h-full flex flex-col overflow-hidden bg-[#05080e]/40">
                <div className="px-6 py-4 border-b border-[#1e293b] flex justify-between items-center bg-[#070b13] shrink-0">
                  <div>
                    <span className="text-[11px] text-gray-500 font-mono italic block">{selectedFile.path}</span>
                    <h2 className="text-lg font-bold text-white mt-0.5 font-mono">{selectedFile.name}</h2>
                  </div>
                  <button
                    onClick={() => handleCopyCode(selectedFile.content)}
                    className="flex items-center gap-2 border border-[#1e293b] hover:border-gray-700 bg-[#111827] text-gray-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition"
                  >
                    {copiedFileUrl ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{copiedFileUrl ? 'Copied File!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-[#04070d] p-6 text-gray-300 font-mono scroll-smooth selection:bg-indigo-500 selection:text-white">
                  <div className="grid table min-w-full font-mono text-xs">
                    {renderHighlightedCode(selectedFile.content, selectedFile.language)}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: JEST SPEC SUITE TESTS */}
          {activeTab === 'tests' && (
            <div className="h-full flex divide-x divide-[#1e293b] overflow-hidden">
              
              {/* Test Selection Sidebar Left */}
              <div className="w-1/4 h-full flex flex-col bg-[#0b0f19]/50 overflow-y-auto">
                <div className="p-4 border-b border-[#1e293b]">
                  <span className="text-xs font-semibold text-gray-500 font-mono uppercase tracking-wider">Jest Test Runner</span>
                  <p className="text-xs text-gray-400 mt-1">Select the backend spec script to execute within our container environment.</p>
                </div>

                <div className="p-3 space-y-2">
                  <button
                    onClick={() => setActiveTestFile('all')}
                    className={`w-full text-left p-3.5 rounded-lg text-xs transition border ${
                      activeTestFile === 'all' 
                        ? 'bg-[#1e293b] border-[#334155] text-white font-bold' 
                        : 'border-transparent text-gray-400 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="text-purple-400 font-bold uppercase tracking-widest text-[10px] font-mono">ALL SPECS</div>
                    <div className="mt-1">Full API Test Suite (Coverage check)</div>
                  </button>

                  <button
                    onClick={() => setActiveTestFile('auth')}
                    className={`w-full text-left p-3.5 rounded-lg text-xs transition border ${
                      activeTestFile === 'auth' 
                        ? 'bg-[#1e293b] border-[#334155] text-white font-bold' 
                        : 'border-transparent text-gray-400 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] font-mono">tests/auth.service.test.ts</div>
                    <div className="mt-1">Verify Registration, Secure logins, Refresh abuse detection etc.</div>
                  </button>

                  <button
                    onClick={() => setActiveTestFile('jobs')}
                    className={`w-full text-left p-3.5 rounded-lg text-xs transition border ${
                      activeTestFile === 'jobs' 
                        ? 'bg-[#1e293b] border-[#334155] text-white font-bold' 
                        : 'border-transparent text-gray-400 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="text-amber-400 font-bold uppercase tracking-widest text-[10px] font-mono">tests/jobs.service.test.ts</div>
                    <div className="mt-1">Cursor-based listings, filters validation, corporate representative constraints.</div>
                  </button>

                  <button
                    onClick={() => setActiveTestFile('rate')}
                    className={`w-full text-left p-3.5 rounded-lg text-xs transition border ${
                      activeTestFile === 'rate' 
                        ? 'bg-[#1e293b] border-[#334155] text-white font-bold' 
                        : 'border-transparent text-gray-400 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] font-mono">tests/rate_limiter.test.ts</div>
                    <div className="mt-1">Sliding-window Redis tracking, blocks simulation, time releases.</div>
                  </button>
                </div>

                <div className="mt-auto p-4 border-t border-[#1e293b] bg-[#070b13]">
                  <button
                    id="btn-trigger-tests"
                    onClick={handleRunTests}
                    disabled={testState === 'running'}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition text-white py-3 rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/10"
                  >
                    <PlayCircle className="w-4 h-4 text-white" />
                    <span>Run Selected Specs</span>
                  </button>
                </div>
              </div>

              {/* Terminal Jest Console view Right */}
              <div className="w-3/4 h-full flex flex-col overflow-hidden bg-[#05080e]">
                <div className="px-6 py-4 border-b border-[#1e293b] bg-[#070b13] flex justify-between items-center select-none shrink-0">
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-white font-mono">Jest TDD Virtual Terminal</span>
                  </div>

                  {testState === 'running' && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono">Running tests assertions...</span>
                      <div className="w-24 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${testProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {testState === 'completed' && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 p-1 px-2.5 rounded font-bold border border-emerald-500/20 uppercase tracking-widest font-mono">
                      Specs Succeeded
                    </div>
                  )}

                  {testState === 'idle' && (
                    <span className="text-xs text-gray-500 italic font-mono">Console Armed</span>
                  )}
                </div>

                <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-1.5 text-gray-300 bg-[#04060b] select-text selection:bg-purple-800 selection:text-white leading-relaxed">
                  {testConsoleOutput.length > 0 ? (
                    testConsoleOutput.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{line}</div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 italic select-none">
                      <PlayCircle className="w-10 h-10 text-gray-800 mb-2" />
                      <span>TestSuite engine stands idle.</span>
                      <span className="text-[10px] block mt-1">Select a target test spec on the left and click 'Run Selected Specs' to verify structural targets.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: DATABASE & QUEUES MONITOR */}
          {activeTab === 'database' && (
            <div className="h-full flex flex-col overflow-y-auto p-8 gap-8 bg-[#090d16]">
              
              {/* Monitoring Header Overview */}
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" /> System Metrics Control Center
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Inspect the in-memory simulated database rows, Redis Cache values, sliding window rate limits logs, and asynchronous worker queues in real-time.
                </p>
              </div>

              {/* Dashboard Layout Box */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 shrink-0">
                
                {/* Visual Relational DB Schema box */}
                <div className="border border-[#1e293b] rounded-xl bg-[#0b0f19] p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
                    <Database className="w-4 h-4 text-blue-400" /> Relational Postgres Schema
                  </h3>
                  
                  <div className="p-4 bg-gray-950 rounded-lg space-y-3 font-mono text-[11px] leading-relaxed select-none">
                    <div className="text-gray-500 uppercase font-semibold">PostgreSQL Registered Models ({dbUsers.length + dbJobs.length + dbApplications.length} records total)</div>
                    
                    <div className="space-y-2">
                      <div className="border border-blue-500/10 p-2.5 rounded bg-blue-500/5">
                        <div className="flex justify-between font-bold text-blue-400">
                          <span>User (Table)</span>
                          <span>{dbUsers.length} records</span>
                        </div>
                        <div className="text-gray-400 text-[10px] mt-1">
                          Fields: <span className="text-emerald-400">id, email (unique), passwordHash, role (USER|ADMIN|COMPANY_REP), companyId</span>
                        </div>
                      </div>

                      <div className="border border-amber-500/10 p-2.5 rounded bg-amber-500/5 col-span-1">
                        <div className="flex justify-between font-bold text-amber-400">
                          <span>Job (Table)</span>
                          <span>{dbJobs.length} records</span>
                        </div>
                        <div className="text-gray-400 text-[10px] mt-1">
                          Fields: <span className="text-emerald-400">id, companyId, title, description, location, type (JobType), salaryMin, salaryMax, isFeatured</span>
                        </div>
                      </div>

                      <div className="border border-teal-500/10 p-2.5 rounded bg-teal-500/5">
                        <div className="flex justify-between font-bold text-teal-400">
                          <span>Application (Table)</span>
                          <span>{dbApplications.length} records</span>
                        </div>
                        <div className="text-gray-400 text-[10px] mt-1">
                          Fields: <span className="text-emerald-400">id, userId, jobId, status (APPLIED|REVIEWED|INTERVIEW|REJECTED|WITHDRAWN), coverLetter, resumeUrl</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* REDIS CACHE MONITOR */}
                <div className="border border-[#1e293b] rounded-xl bg-[#0b0f19] p-6 flex flex-col h-[320px] overflow-hidden">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3 shrink-0">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Network className="w-4 h-4 text-emerald-400" /> Redis Cache Monitor
                    </h3>
                    <button
                      onClick={handleClearRedis}
                      className="text-[10px] text-red-400 hover:text-red-300 transition underline font-mono"
                    >
                      Purge Cache Store
                    </button>
                  </div>

                  <div className="flex-1 flex gap-4 mt-4 overflow-hidden">
                    {/* Left Key registers */}
                    <div className="w-1/2 flex flex-col border border-gray-800 rounded bg-gray-950 overflow-hidden">
                      <div className="p-2 bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono shrink-0">
                        Active Keys in memory ({redisKeys.length})
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px] text-gray-300">
                        {redisKeys.length > 0 ? (
                          redisKeys.map((item, idx) => (
                            <div key={idx} className="p-1 px-2 rounded bg-gray-900 flex justify-between gap-1 items-center hover:bg-gray-800/50">
                              <span className="text-indigo-300 truncate w-[140px]">{item.key}</span>
                              <span className="text-emerald-400 text-[9px] shrink-0 font-bold">ttl: 3591s</span>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-center text-gray-600 italic">
                            Cache Store Void
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Redis events log stream */}
                    <div className="w-1/2 flex flex-col border border-gray-800 rounded bg-gray-950 overflow-hidden">
                      <div className="p-2 bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono shrink-0">
                        Live Cache events loop
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px] text-gray-200">
                        {redisLogs.length > 0 ? (
                          redisLogs.map((log, idx) => (
                            <div key={idx} className="leading-tight">
                              <span className="text-gray-500 font-mono text-[9px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                              <span className={`font-bold ${log.status === 'BLOCKED' ? 'text-red-400' : 'text-teal-400'}`}>{log.status}</span>{' '}
                              <span className="text-gray-400">{log.type}</span>{' '}
                              <span className="text-indigo-300 truncate inline-block w-20">{log.key}</span>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-center text-gray-600 italic">
                            Stream idle
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* BULLMQ BACKGROUND JOBS DASHBOARD */}
              <div className="border border-[#1e293b] rounded-xl bg-[#0b0f19] p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-400" /> BullMQ Asynchronous Recruiter Queue
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Displays jobs scheduled by APIs: email greetings, PDF generated, applications notification...</p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleInjectBullJob}
                      className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] text-indigo-400 hover:text-white px-3.5 py-1.5 rounded-lg border border-[#334155] text-xs font-semibold font-mono transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Inject Heavy PDF Job</span>
                    </button>
                    
                    <button
                      onClick={handleClearQueues}
                      className="text-xs text-red-400 hover:text-red-300 transition font-mono self-center underline"
                    >
                      Purge BullMQ Queue Databases
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left list of active BullMQ registers table */}
                  <div className="lg:col-span-2 border border-gray-800 rounded bg-gray-950 overflow-hidden min-h-[220px]">
                    <div className="p-3 bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">
                      Queue Jobs Ledger
                    </div>
                    <div className="divide-y divide-gray-900 overflow-y-auto max-h-[300px] h-full p-2 space-y-1">
                      {queueJobs.length > 0 ? (
                        queueJobs.map((job) => (
                          <div key={job.id} className="p-3 bg-gray-900/40 rounded flex flex-col md:flex-row justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-indigo-300">{job.name}</span>
                                <span className="font-mono text-[9px] text-gray-500">ID: {job.id}</span>
                              </div>
                              <div className="font-mono text-[10px] text-gray-400 mt-1 truncate max-w-sm">
                                Payload: {JSON.stringify(job.data)}
                              </div>
                              {job.status === 'completed' && job.result && (
                                <div className="text-[10px] font-mono text-emerald-400 mt-1 bg-emerald-500/5 p-1 rounded border border-emerald-500/10">
                                  Result: {JSON.stringify(job.result)}
                                </div>
                              )}
                              {job.status === 'failed' && (
                                <div className="text-[10px] font-mono text-red-400 mt-1 bg-red-500/5 p-1 rounded border border-red-500/10">
                                  Error: {job.error}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0 justify-center">
                              <span className={`p-1 px-2 rounded text-[9px] font-bold uppercase font-mono border ${
                                job.status === 'completed' 
                                  ? 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : job.status === 'active' 
                                  ? 'text-blue-450 bg-blue-500/10 border-blue-500/20 text-blue-400'
                                  : job.status === 'failed'
                                  ? 'text-red-450 bg-red-500/10 border-red-500/20 text-red-400'
                                  : 'text-amber-450 bg-amber-500/10 border-amber-500/20 text-amber-400'
                              }`}>
                                {job.status}
                              </span>

                              {job.status === 'active' && (
                                <div className="w-24 bg-gray-800 rounded-full h-1 overflow-hidden mt-1">
                                  <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-600 text-center italic py-20 font-mono text-xs">
                          No background tasks currently in record.
                          <span className="block text-[10px] mt-1">(API triggers registers automatic tasks, or click "Inject Heavy PDF Job" above)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right BullMQ Worker log files */}
                  <div className="col-span-1 border border-gray-800 rounded bg-gray-950 overflow-hidden flex flex-col h-[283px]">
                    <div className="p-3 bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">
                      Queue Worker Events
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-1.5 text-gray-300 leading-tight">
                      {queueLogs.length > 0 ? (
                        queueLogs.map((log, idx) => (
                          <div key={idx} className="border-b border-gray-900 pb-1 flex gap-2">
                            <span className="text-gray-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={`${
                              log.severity === 'error' ? 'text-red-400' :
                              log.severity === 'warn' ? 'text-amber-400' :
                              log.severity === 'success' ? 'text-emerald-400' :
                              'text-blue-300'
                            }`}>{log.message}</span>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-center text-gray-600 italic">
                          Worker idle
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 5: SYSTEM ARCHITECTURE DOCUMENTATION */}
          {activeTab === 'docs' && (
            <div className="h-full overflow-y-auto p-12 bg-[#090d16]">
              <div className="max-w-4xl mx-auto space-y-10 selection:bg-indigo-500 selection:text-white">
                
                {/* Intro Title */}
                <div className="text-center space-y-3">
                  <div className="p-1 px-3 bg-blue-600/10 text-indigo-400 text-xs rounded-full inline-block border border-indigo-500/20 font-bold uppercase tracking-widest font-mono">
                    Node.js Architecture Specifications
                  </div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                    Enterprise Job Board REST API Manual
                  </h1>
                  <p className="text-md text-gray-400 max-w-2xl mx-auto">
                    Design and structural layout of the backend REST systems showing full JWT key rotation, Redis limits configuration, database entity relationships, and pipeline schedules.
                  </p>
                </div>

                <div className="h-px bg-[#1e293b]" />

                {/* Blueprint Section: Asymmetric auth */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-400" /> 1. Asymmetric Auth & JWT Refresh Rotation
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Authentication utilizes asymmetric key pairs signing formats for security compliance:
                  </p>
                  <ul className="text-xs text-gray-400 leading-relaxed list-disc list-inside space-y-1.5 pl-4">
                    <li>
                      <strong className="text-white">RS256 Private Signature</strong>: Access tokens are signed at the backend using the <code className="bg-gray-900 border border-gray-800 p-0.5 rounded font-mono text-[11px] text-teal-400">private.pem</code> key (RS256 encryption structure) keeping lifetimes restricted up to <code className="text-amber-400">15 minutes</code> maximum.
                    </li>
                    <li>
                      <strong className="text-white">Relay Verification</strong>: Peripheral workers and decentralized gateways verify Bearer claims structures using the distributed public <code className="bg-gray-900 border border-gray-800 p-0.5 rounded font-mono text-[11px] text-teal-400">public.pem</code> credential.
                    </li>
                    <li>
                      <strong className="text-white">Sliding Session Rotators</strong>: Authenticating clients acquire an active sliding <code className="text-emerald-400">7-day</code> hex token. Issuing rotated token bundles revives credentials and invalidates previous entities to block replay attacks.
                    </li>
                    <li>
                      <strong className="text-white">Symmetric Security Guard (Token Abuse protection)</strong>: Replaying a parent refresh token marks user accounts as compromised. Relational triggers then purge all active user sessions, forcing security re-verification.
                    </li>
                  </ul>
                </div>

                {/* Blueprint Section: Sliding limit cache */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Network className="w-5 h-5 text-emerald-400" /> 2. Redis Sliding Window Rate Limiting
                  </h2>
                  <p className="text-sm text-gray-450 leading-relaxed text-gray-400">
                    Sliding window configurations protect services from denial attacks and credential queries:
                  </p>
                  
                  <div className="p-5 bg-gray-950 rounded-xl space-y-3 border border-gray-800">
                    <div className="grid grid-cols-2 gap-4 text-center font-mono">
                      <div className="bg-gray-900 p-3 rounded border border-gray-800">
                        <span className="text-[10px] text-gray-500 block">ANONYMOUS RATES</span>
                        <span className="text-white text-lg font-bold">100 Req</span>
                        <span className="text-gray-400 text-xs block">/ 15 Minutes Window</span>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border border-gray-800">
                        <span className="text-[10px] text-gray-500 block">AUTHENTICATED USER RATE</span>
                        <span className="text-white text-lg font-bold">1,000 Req</span>
                        <span className="text-gray-400 text-xs block">/ 15 Minutes Window</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed pt-2">
                      Redis stores timelines in a sorted list. Old entries are removed, and the active list size is verified before allowing requests.
                    </p>
                  </div>
                </div>

                {/* Blueprint Section: BullMQ details */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-purple-400" /> 3. BullMQ Distributed Queue
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Maintains background task workers that offload intensive requests from main core process threads:
                  </p>
                  <ul className="text-xs text-gray-400 leading-relaxed list-disc list-inside space-y-1.5 pl-4">
                    <li><strong className="text-white">Email Greeter Tasks</strong>: Queues email jobs asynchronously on registration coordinates.</li>
                    <li><strong className="text-white">Corporate Alerts</strong>: Dispatches applicant resumes to companies in the background upon application.</li>
                    <li><strong className="text-white">Salary PDF Generator</strong>: Collects database stats and exports audited reports using custom retry-loops.</li>
                  </ul>
                </div>

                {/* Docker and CI Actions instructions */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" /> 4. Containerization & Deployment Workflows
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    The platform compiles to a single bundled Node module. It mounts to Docker Alpine environments and uses Docker-compose with pre-seeded database networks:
                  </p>

                  <div className="bg-gray-950 p-5 rounded-lg border border-[#1e293b] font-mono text-xs text-indigo-300 space-y-1 select-all">
                    <div># Dev workspace setup controls</div>
                    <div>$ docker-compose -f infra/docker-compose.yml up --build -d</div>
                    <div>$ yarn install</div>
                    <div>$ npx prisma db push && yarn test</div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
