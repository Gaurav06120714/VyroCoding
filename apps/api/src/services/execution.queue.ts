/**
 * BullMQ execution queue — async code execution with result broadcasting.
 * Jobs flow: enqueue → Judge0 → store result → broadcast to room via Pub/Sub
 */
import { Queue, Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = 'code-execution';

// ── Job payload ────────────────────────────────────────────────────────────────

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

// ── Queue singleton ────────────────────────────────────────────────────────────

let executionQueue: Queue<ExecutionJobData, ExecutionJobResult> | null = null;

export function getExecutionQueue(): Queue<ExecutionJobData, ExecutionJobResult> {
  if (!executionQueue) {
    executionQueue = new Queue<ExecutionJobData, ExecutionJobResult>(QUEUE_NAME, {
      connection: { host: 'localhost', port: 6379 } as unknown as Redis,
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

// ── Enqueue helper ─────────────────────────────────────────────────────────────

export async function enqueueExecution(data: ExecutionJobData): Promise<string> {
  const queue = getExecutionQueue();
  const job = await queue.add('execute', data, {
    jobId: data.submissionId,
    priority: data.roomId ? 1 : 2, // Room submissions get higher priority
  });
  return job.id ?? data.submissionId;
}

// ── Worker (runs in the same process for simplicity; extract to separate worker for scale) ───

let worker: Worker | null = null;

export function startExecutionWorker(): void {
  if (worker) return;

  worker = new Worker<ExecutionJobData, ExecutionJobResult>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData, ExecutionJobResult>) => {
      const { submissionId, code, languageId, testCases, roomId, userId, username } = job.data;

      const { submitAndWait, wrapCode } = await import('./judge0.service.js');
      const { query } = await import('../db/client.js');
      const { publishToRoom } = await import('./pubsub.service.js');
      const { Language } = await import('@vyro/types');

      // Broadcast execution-start to room
      if (roomId) {
        await publishToRoom(roomId, {
          type: 'execution-start',
          submissionId,
          userId,
          username,
        });
      }

      // Update DB status to processing
      await query(
        'UPDATE submissions SET status = $1 WHERE id = $2',
        ['processing', submissionId]
      );

      // Run against all test cases
      let passed = 0;
      let lastResult: Awaited<ReturnType<typeof submitAndWait>> | null = null;

      const visibleCases = testCases.filter((tc) => !tc.isHidden);

      for (const tc of visibleCases) {
        try {
          const wrappedCode = wrapCode(code, languageId as Language);
          const result = await submitAndWait(wrappedCode, languageId as Language, tc.input, 20, 500);
          lastResult = result;
          const actual = (result.stdout ?? '').trim();
          if (result.submissionStatus === 'accepted' && actual === tc.expectedOutput.trim()) {
            passed++;
          } else {
            break; // Stop on first failure (like LeetCode)
          }
        } catch {
          break;
        }
      }

      const allPassed = passed === visibleCases.length;
      const finalStatus = lastResult?.submissionStatus === 'runtime_error'
        ? 'runtime_error'
        : lastResult?.submissionStatus === 'compile_error'
        ? 'compile_error'
        : lastResult?.submissionStatus === 'time_limit_exceeded'
        ? 'time_limit_exceeded'
        : allPassed ? 'accepted' : 'wrong_answer';

      // Update DB with final result
      await query(
        `UPDATE submissions
         SET status = $1, stdout = $2, stderr = $3, time_ms = $4, memory_kb = $5
         WHERE id = $6`,
        [
          finalStatus,
          lastResult?.stdout ?? null,
          lastResult?.stderr ?? null,
          lastResult?.timeMs ?? null,
          lastResult?.memoryKb ?? null,
          submissionId,
        ]
      );

      // Update user stats if accepted
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
        stdout: lastResult?.stdout,
        stderr: lastResult?.stderr,
        compileOutput: lastResult?.compileOutput,
        timeMs: lastResult?.timeMs,
        memoryKb: lastResult?.memoryKb,
        testsPassed: passed,
        testsTotal: visibleCases.length,
      };

      // Broadcast result to room
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
      connection: { host: 'localhost', port: 6379 } as unknown as Redis,
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
