import { FastifyInstance } from 'fastify';
import { query as dbQuery, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import {
  submitAndWait,
  submitBatchAndWait,
  type TestCaseInput,
  type TestCaseResult,
} from '../services/judge0.service.js';
import type { ExecuteRequest, SubmitRequest, Language } from '@vyro/types';

export async function executeRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /execute/run — run code without persisting (single stdin)
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

  // POST /execute/run-all — run against all visible test cases using batch API
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

      if (visibleCases.length === 0) {
        return reply.send({ data: [] });
      }

      try {
        // Submit all visible cases via batch API simultaneously.
        // submitBatchAndWait handles compile-error propagation internally.
        const testInputs: TestCaseInput[] = visibleCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: false,
        }));

        const batchResults = await submitBatchAndWait(code, languageId as Language, testInputs);

        // Attach original input/expectedOutput to each result for the frontend
        const enriched = batchResults.map((r, i) => ({
          ...r,
          input: visibleCases[i].input,
          expectedOutput: visibleCases[i].expectedOutput,
        }));

        return reply.send({ data: enriched });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed';
        return reply.code(500).send({ error: message });
      }
    }
  );

  // POST /execute/verify — run against ALL test cases (hidden + visible), used by AI verify
  fastify.post<{ Body: { code: string; languageId: number; problemId: string } }>(
    '/verify',
    { preHandler: authenticate },
    async (request, reply) => {
      const { code, languageId, problemId } = request.body;

      const problem = await queryOne<{
        test_cases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      }>('SELECT test_cases FROM problems WHERE id = $1', [problemId]);

      if (!problem) {
        return reply.code(404).send({ error: 'Problem not found' });
      }

      const allCases = problem.test_cases;

      if (allCases.length === 0) {
        return reply.send({ data: [] });
      }

      try {
        const testInputs: TestCaseInput[] = allCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
        }));

        const batchResults = await submitBatchAndWait(code, languageId as Language, testInputs);

        const enriched = batchResults.map((r, i) => ({
          ...r,
          input: allCases[i].input,
          expectedOutput: allCases[i].expectedOutput,
        }));

        return reply.send({ data: enriched });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed';
        return reply.code(500).send({ error: message });
      }
    }
  );

  // POST /execute/submit — submit against problem test cases
  fastify.post<{ Body: SubmitRequest }>(
    '/submit',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { code, languageId, problemId, roomId } = request.body;

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

      // Run against all test cases asynchronously using batch API
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
  testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>
): Promise<void> {
  if (testCases.length === 0) {
    await dbQuery(`UPDATE submissions SET status = $1 WHERE id = $2`, ['accepted', submissionId]);
    return;
  }

  // Submit all test cases via batch API.
  // Compile errors are detected from the results themselves.
  const testInputs: TestCaseInput[] = testCases.map((tc) => ({
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
  }));

  const results = await submitBatchAndWait(code, languageId, testInputs);

  // Find first non-passing case to determine verdict
  let firstFail: TestCaseResult | null = null;
  let testsPassed = 0;
  let totalTimeMs = 0;
  let maxMemoryKb = 0;

  for (const r of results) {
    if (r.passed) {
      testsPassed++;
      totalTimeMs += r.timeMs ?? 0;
      maxMemoryKb = Math.max(maxMemoryKb, r.memoryKb ?? 0);
    } else if (!firstFail) {
      firstFail = r;
    }
  }

  const allPassed = testsPassed === results.length;

  let finalStatus: string;
  if (allPassed) {
    finalStatus = 'accepted';
  } else if (firstFail) {
    finalStatus = firstFail.verdict;
  } else {
    finalStatus = 'wrong_answer';
  }

  const failStdout = firstFail ? firstFail.actual : (results[results.length - 1]?.actual ?? '');
  const failStderr = firstFail ? (firstFail.error ?? '') : '';

  await dbQuery(
    `UPDATE submissions
     SET status = $1, stdout = $2, stderr = $3, time_ms = $4, memory_kb = $5
     WHERE id = $6`,
    [finalStatus, failStdout, failStderr, totalTimeMs, maxMemoryKb, submissionId]
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
