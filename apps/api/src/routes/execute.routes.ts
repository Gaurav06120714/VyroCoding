import { FastifyInstance } from 'fastify';
import { query as dbQuery, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { submitCode, getResult, submitAndWait } from '../services/judge0.service.js';
import type { ExecuteRequest, SubmitRequest, Language } from '@vyro/types';

export async function executeRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /execute/run — run code without persisting
  fastify.post<{ Body: ExecuteRequest }>(
    '/run',
    { preHandler: authenticate },
    async (request, reply) => {
      const { code, languageId, stdin = '' } = request.body;

      try {
        const result = await submitAndWait(code, languageId as Language, stdin);
        return reply.send({ data: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed';
        return reply.code(500).send({ error: message });
      }
    }
  );

  // POST /execute/run-all — run against all visible test cases
  fastify.post<{ Body: { code: string; languageId: number; problemId: string } }>(
    '/run-all',
    { preHandler: authenticate },
    async (request, reply) => {
      const { code, languageId, problemId } = request.body;

      const problem = await queryOne<{
        test_cases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      }>('SELECT test_cases FROM problems WHERE id = $1', [problemId]);

      if (!problem) {
        return reply.code(404).send({ error: 'Problem not found' });
      }

      const visibleCases = problem.test_cases.filter((tc) => !tc.isHidden);

      const results: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        passed: boolean;
        timeMs: number | null;
        error?: string;
      }> = [];

      for (const tc of visibleCases) {
        try {
          const result = await submitAndWait(code, languageId as Language, tc.input);
          const actual = (result.stdout ?? '').trim();
          const expected = tc.expectedOutput.trim();
          results.push({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout ?? '',
            passed: result.submissionStatus === 'accepted' && actual === expected,
            timeMs: result.timeMs ?? null,
            error: result.stderr ?? result.compileOutput ?? undefined,
          });
        } catch (err) {
          results.push({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: '',
            passed: false,
            timeMs: null,
            error: err instanceof Error ? err.message : 'Execution failed',
          });
        }
      }

      return reply.send({ data: results });
    }
  );

  // POST /execute/submit — submit against problem test cases
  fastify.post<{ Body: SubmitRequest }>(
    '/submit',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { code, languageId, problemId, roomId } = request.body;

      // Get problem test cases
      const problem = await queryOne<{
        test_cases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      }>('SELECT test_cases FROM problems WHERE id = $1', [problemId]);

      if (!problem) {
        return reply.code(404).send({ error: 'Problem not found' });
      }

      const testCases = problem.test_cases;

      // Create pending submission
      const [submission] = await dbQuery<{ id: string }>(
        `INSERT INTO submissions (user_id, problem_id, room_id, language_id, code, status)
         VALUES ($1, $2, $3, $4, $5, 'processing')
         RETURNING id`,
        [userId, problemId, roomId ?? null, languageId, code]
      );

      // Run against each test case asynchronously
      runTestCases(submission.id, userId, problemId, code, languageId as Language, testCases)
        .catch((err) => console.error('Test case runner error:', err));

      return reply.code(202).send({ data: { submissionId: submission.id } });
    }
  );

  // GET /execute/submissions/:id — poll submission result
  fastify.get<{ Params: { id: string } }>(
    '/submissions/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const { userId } = request.user as { userId: string };

      const submission = await queryOne<{
        id: string;
        user_id: string;
        status: string;
        stdout: string | null;
        stderr: string | null;
        compile_output: string | null;
        time_ms: number | null;
        memory_kb: number | null;
        created_at: string;
      }>('SELECT id, user_id, status, stdout, stderr, compile_output, time_ms, memory_kb, created_at FROM submissions WHERE id = $1', [id]);

      if (!submission) return reply.code(404).send({ error: 'Submission not found' });
      if (submission.user_id !== userId) return reply.code(403).send({ error: 'Forbidden' });

      return reply.send({ data: submission });
    }
  );

  // GET /execute/status/:submissionId — returns current submission status
  fastify.get<{ Params: { submissionId: string } }>(
    '/status/:submissionId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { submissionId } = request.params;
      const { userId } = request.user as { userId: string };

      const submission = await queryOne<{
        id: string;
        user_id: string;
        status: string;
        stdout: string | null;
        stderr: string | null;
        compile_output: string | null;
        time_ms: number | null;
        memory_kb: number | null;
        created_at: string;
      }>(
        'SELECT id, user_id, status, stdout, stderr, compile_output, time_ms, memory_kb, created_at FROM submissions WHERE id = $1',
        [submissionId]
      );

      if (!submission) return reply.code(404).send({ error: 'Submission not found' });
      if (submission.user_id !== userId) return reply.code(403).send({ error: 'Forbidden' });

      return reply.send({ data: submission });
    }
  );
}

async function runTestCases(
  submissionId: string,
  userId: string,
  problemId: string,
  code: string,
  languageId: Language,
  testCases: Array<{ input: string; expectedOutput: string }>
): Promise<void> {
  let allPassed = true;
  let lastStdout = '';
  let lastStderr = '';
  let totalTimeMs = 0;
  let maxMemoryKb = 0;

  for (const tc of testCases) {
    const result = await submitAndWait(code, languageId, tc.input);

    const actualOutput = (result.stdout ?? '').trim();
    const expectedOutput = tc.expectedOutput.trim();

    if (result.submissionStatus !== 'accepted' || actualOutput !== expectedOutput) {
      allPassed = false;
      lastStdout = result.stdout ?? '';
      lastStderr = result.stderr ?? result.compileOutput ?? '';

      await dbQuery(
        `UPDATE submissions
         SET status = $1, stdout = $2, stderr = $3, time_ms = $4, memory_kb = $5
         WHERE id = $6`,
        [result.submissionStatus, lastStdout, lastStderr, result.timeMs ?? 0, result.memoryKb ?? 0, submissionId]
      );
      return;
    }

    lastStdout = result.stdout ?? '';
    totalTimeMs += result.timeMs ?? 0;
    maxMemoryKb = Math.max(maxMemoryKb, result.memoryKb ?? 0);
  }

  const finalStatus = allPassed ? 'accepted' : 'wrong_answer';

  await dbQuery(
    `UPDATE submissions
     SET status = $1, stdout = $2, time_ms = $3, memory_kb = $4
     WHERE id = $5`,
    [finalStatus, lastStdout, totalTimeMs, maxMemoryKb, submissionId]
  );

  // Update user's problems solved count on first acceptance
  if (allPassed) {
    await dbQuery(
      `UPDATE users SET problems_solved = problems_solved + 1
       WHERE id = $1
       AND NOT EXISTS (
         SELECT 1 FROM submissions
         WHERE user_id = $1 AND problem_id = $2 AND status = 'accepted' AND id != $3
       )`,
      [userId, problemId, submissionId]
    );
  }
}
