import { env } from '../config/env.js';

import { Queue, Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';

const QUEUE_NAME = 'code-execution';

function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || 'localhost',
      port: u.port ? parseInt(u.port, 10) : 6379,
      password: u.password || undefined,
      db: u.pathname && u.pathname.length > 1 ? parseInt(u.pathname.slice(1), 10) : undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisConnection = parseRedisUrl(env.REDIS_URL) as unknown as Redis;

export interface ExecutionJobData {
  submissionId: string;
  userId: string;
  username: string;
  problemId: string;
  roomId?: string;
  code: string;
  languageId: number;
  testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
}

export interface ExecutionJobResult {
  submissionId: string;
  status: string;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  timeMs?: number;
  memoryKb?: number;
  testsPassed: number;
  testsTotal: number;
}

let executionQueue: Queue<ExecutionJobData, ExecutionJobResult> | null = null;

export function getExecutionQueue(): Queue<ExecutionJobData, ExecutionJobResult> {
  if (!executionQueue) {
    executionQueue = new Queue<ExecutionJobData, ExecutionJobResult>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return executionQueue;
}

export async function enqueueExecution(data: ExecutionJobData): Promise<string> {
  const queue = getExecutionQueue();
  const job = await queue.add('execute', data, {
    jobId: data.submissionId,
    priority: data.roomId ? 1 : 2, 
  });
  return job.id ?? data.submissionId;
}

let worker: Worker | null = null;

export function startExecutionWorker(): void {
  if (worker) return;

  worker = new Worker<ExecutionJobData, ExecutionJobResult>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData, ExecutionJobResult>) => {
      const { submissionId, code, languageId, testCases, roomId, userId, username } = job.data;

      const { submitAndWait, submitBatchAndWait } = await import('./judge0.service.js');
      const { SubmissionStatus } = await import('@vyro/types');
      const { query } = await import('../db/client.js');
      const { publishToRoom } = await import('./pubsub.service.js');
      const { Language } = await import('@vyro/types');

      if (roomId) {
        await publishToRoom(roomId, {
          type: 'execution-start',
          submissionId,
          userId,
          username,
        });
      }

      await query(
        'UPDATE submissions SET status = $1 WHERE id = $2',
        ['processing', submissionId]
      );

      if (testCases.length === 0) {
        await query('UPDATE submissions SET status = $1 WHERE id = $2', ['accepted', submissionId]);
        return {
          submissionId,
          status: 'accepted',
          testsPassed: 0,
          testsTotal: 0,
        };
      }

      const preCheck = await submitAndWait(
        code,
        languageId as typeof Language[keyof typeof Language],
        testCases[0].input,
        20,
        500
      );

      if (preCheck.submissionStatus === SubmissionStatus.CompileError) {
        const compileErr = preCheck.compileOutput ?? preCheck.stderr ?? 'Compile error';
        await query(
          `UPDATE submissions SET status = $1, stderr = $2 WHERE id = $3`,
          ['compile_error', compileErr, submissionId]
        );

        const jobResult: ExecutionJobResult = {
          submissionId,
          status: 'compile_error',
          compileOutput: compileErr,
          testsPassed: 0,
          testsTotal: testCases.length,
        };

        if (roomId) {
          await publishToRoom(roomId, {
            type: 'execution-complete',
            ...jobResult,
            userId,
            username,
          });
        }

        return jobResult;
      }

      const batchResults = await submitBatchAndWait(
        code,
        languageId as typeof Language[keyof typeof Language],
        testCases,
        30,
        800
      );

      let testsPassed = 0;
      let totalTimeMs = 0;
      let maxMemoryKb = 0;
      let firstFailIdx = -1;

      for (let i = 0; i < batchResults.length; i++) {
        const r = batchResults[i];
        if (r.passed) {
          testsPassed++;
          totalTimeMs += r.timeMs ?? 0;
          maxMemoryKb = Math.max(maxMemoryKb, r.memoryKb ?? 0);
        } else if (firstFailIdx === -1) {
          firstFailIdx = i;
        }
      }

      const allPassed = testsPassed === batchResults.length;
      const firstFail = firstFailIdx >= 0 ? batchResults[firstFailIdx] : null;

      let finalStatus: string;
      if (allPassed) {
        finalStatus = 'accepted';
      } else if (firstFail) {
        finalStatus = firstFail.verdict;
      } else {
        finalStatus = 'wrong_answer';
      }

      const failStdout = firstFail ? firstFail.actual : (batchResults[batchResults.length - 1]?.actual ?? '');
      const failStderr = firstFail ? (firstFail.error ?? '') : '';

      await query(
        `UPDATE submissions
         SET status = $1, stdout = $2, stderr = $3, time_ms = $4, memory_kb = $5
         WHERE id = $6`,
        [finalStatus, failStdout, failStderr, totalTimeMs, maxMemoryKb, submissionId]
      );

      if (allPassed) {
        await query(
          `UPDATE users SET problems_solved = problems_solved + 1
           WHERE id = $1
           AND NOT EXISTS (
             SELECT 1 FROM submissions
             WHERE user_id = $1 AND problem_id = $2 AND status = 'accepted' AND id != $3
           )`,
          [userId, job.data.problemId, submissionId]
        );
      }

      const jobResult: ExecutionJobResult = {
        submissionId,
        status: finalStatus,
        stdout: failStdout,
        stderr: failStderr,
        timeMs: totalTimeMs || undefined,
        memoryKb: maxMemoryKb || undefined,
        testsPassed,
        testsTotal: batchResults.length,
      };

      if (roomId) {
        await publishToRoom(roomId, {
          type: 'execution-complete',
          ...jobResult,
          userId,
          username,
        });
      }

      return jobResult;
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[queue] job ${job.id} completed: ${job.returnvalue?.status}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[queue] job ${job?.id} failed:`, err.message);
  });

  console.log('[queue] Execution worker started');
}
