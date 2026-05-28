/**
 * AI routes — Ollama-first with NVIDIA NIM fallback
 *
 * Endpoints:
 *   GET  /ai/status              — Which provider / model is active
 *   GET  /ai/ollama/setup        — Full Ollama installation + model status
 *   POST /ai/ollama/start        — Start the Ollama daemon (if installed)
 *   POST /ai/ollama/pull         — SSE: pull the recommended model with progress
 *   POST /ai/ollama/auto-setup   — SSE: full zero-click auto-setup (start + pull)
 *   POST /ai/hint                — Non-spoiler hint (SSE)
 *   POST /ai/explain             — Code explanation (SSE)
 *   POST /ai/review              — Code review (SSE)
 *   POST /ai/debug               — Debug help (SSE)
 *   POST /ai/chat                — Free-form multi-turn chat (SSE)
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import {
  streamHint, streamExplain, streamReview, streamDebug, streamChat,
  getAiStatus, clearProviderCache, streamCompletion, type AiMessage,
} from '../services/ai.service.js';
import {
  getOllamaSetupStatus, startOllamaDaemon, pullModel, isOllamaRunning,
  PREFERRED_MODELS, runAutoSetup,
} from '../services/ollama.service.js';
import { queryOne } from '../db/client.js';
import { submitBatchAndWait, submitAndWait, normalizeOutput } from '../services/judge0.service.js';
import type { Language } from '@vyro/types';
import { SubmissionStatus } from '@vyro/types';

// ── Validation ────────────────────────────────────────────────────────────────

const MAX_CODE    = 10_000;
const MAX_MSG     = 2_000;
const MAX_HISTORY = 20;

function sanitize(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLen);
}

function sanitizeHistory(history: unknown): AiMessage[] {
  if (!Array.isArray(history)) return [];
  const validRoles = new Set(['user', 'assistant', 'system']);
  return history
    .filter(
      (m): m is AiMessage =>
        typeof m === 'object' && m !== null &&
        validRoles.has((m as AiMessage).role) &&
        typeof (m as AiMessage).content === 'string',
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG) }));
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseOpen(reply: FastifyReply): void {
  // Carry forward CORS headers that @fastify/cors set via reply.header() —
  // reply.raw.writeHead() bypasses Fastify's header store, so we must merge them manually.
  const fastifyHeaders = reply.getHeaders();
  const corsHeaders: Record<string, string> = {};
  for (const key of Object.keys(fastifyHeaders)) {
    if (key.toLowerCase().startsWith('access-control') || key.toLowerCase() === 'vary') {
      const v = fastifyHeaders[key];
      if (v !== undefined) corsHeaders[key] = String(v);
    }
  }
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
    'X-Accel-Buffering': 'no',
    ...corsHeaders,
  });
}

function sseChunk(reply: FastifyReply, data: string): void {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sseDone(reply: FastifyReply): void {
  reply.raw.write('data: [DONE]\n\n');
  reply.raw.end();
}

function sseError(reply: FastifyReply, message: string): void {
  reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
  reply.raw.end();
}

function sseJson(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /ai/status ──────────────────────────────────────────────────────────
  fastify.get('/status', async (_req, reply) => {
    const status = await getAiStatus();
    return reply.send(status);
  });

  // ── GET /ai/ollama/setup ────────────────────────────────────────────────────
  // Returns detailed Ollama installation state for the frontend setup modal.
  fastify.get('/ollama/setup', async (_req, reply) => {
    const status = await getOllamaSetupStatus();
    return reply.send(status);
  });

  // ── POST /ai/ollama/start ───────────────────────────────────────────────────
  // Attempt to start the Ollama daemon in the background.
  fastify.post('/ollama/start', async (_req, reply) => {
    const alreadyRunning = await isOllamaRunning();
    if (alreadyRunning) {
      clearProviderCache();
      return reply.send({ success: true, message: 'Ollama is already running.' });
    }

    const started = await startOllamaDaemon();
    clearProviderCache();
    if (started) {
      return reply.send({ success: true, message: 'Ollama daemon started.' });
    }
    return reply
      .code(503)
      .send({ success: false, error: 'Could not start Ollama daemon.' });
  });

  // ── POST /ai/ollama/pull ────────────────────────────────────────────────────
  // SSE stream: pulls the requested model (or recommended default) with progress.
  fastify.post<{ Body: { model?: string } }>('/ollama/pull', async (request, reply) => {
    const targetModel = request.body?.model ?? PREFERRED_MODELS[0];

    // Validate model name — allow only alphanumeric + colon + dot + dash
    if (!/^[\w:.-]+$/.test(targetModel) || targetModel.length > 100) {
      return reply.code(400).send({ error: 'Invalid model name.' });
    }

    sseOpen(reply);
    sseJson(reply, 'start', { model: targetModel });

    const ok = await pullModel(targetModel, (progress) => {
      sseJson(reply, 'progress', progress);
    });

    if (ok) {
      clearProviderCache();
      sseJson(reply, 'complete', { model: targetModel, success: true });
    } else {
      sseJson(reply, 'error', { model: targetModel, success: false });
    }
    reply.raw.end();
  });

  // ── POST /ai/ollama/auto-setup ─────────────────────────────────────────────
  // SSE stream: full zero-click setup — start daemon + pull smallest model.
  // Stages emitted: 'checking' | 'starting' | 'pulling' | 'complete' | 'error'
  fastify.post('/ollama/auto-setup', async (_request, reply) => {
    sseOpen(reply);
    sseJson(reply, 'stage', { stage: 'checking', message: 'Checking Ollama installation…' });

    const result = await runAutoSetup(
      (msg) => fastify.log.info(msg),
      (progress) => {
        sseJson(reply, 'pull-progress', progress);
        if (progress.done && !progress.error) {
          sseJson(reply, 'stage', { stage: 'complete', message: 'Model ready' });
        }
      },
    );

    if (result.error && !result.activeModel) {
      sseJson(reply, 'error', { error: result.error, ...result });
    } else {
      clearProviderCache();
      sseJson(reply, 'complete', result);
    }
    reply.raw.end();
  });

  // ── POST /ai/hint ───────────────────────────────────────────────────────────
  fastify.post<{
    Body: { problemTitle: string; problemDescription: string; userCode: string; language: string };
  }>('/hint', { preHandler: authenticate }, async (request, reply) => {
    const { problemTitle, problemDescription, userCode, language } = request.body;
    if (!problemTitle || !userCode || !language)
      return reply.code(400).send({ error: 'Missing required fields: problemTitle, userCode, language' });

    sseOpen(reply);
    try {
      await streamHint({
        problemTitle:       sanitize(problemTitle, 200),
        problemDescription: sanitize(problemDescription, 3000),
        userCode:           sanitize(userCode, MAX_CODE),
        language:           sanitize(language, 30),
        onChunk: (t) => sseChunk(reply, t),
        onDone:  () => sseDone(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI hint error');
      sseError(reply, 'AI service temporarily unavailable. Please try again.');
    }
  });

  // ── POST /ai/explain ────────────────────────────────────────────────────────
  fastify.post<{ Body: { userCode: string; language: string } }>(
    '/explain', { preHandler: authenticate }, async (request, reply) => {
      const { userCode, language } = request.body;
      if (!userCode || !language)
        return reply.code(400).send({ error: 'Missing required fields: userCode, language' });

      sseOpen(reply);
      try {
        await streamExplain({
          userCode: sanitize(userCode, MAX_CODE),
          language: sanitize(language, 30),
          onChunk: (t) => sseChunk(reply, t),
          onDone:  () => sseDone(reply),
        });
      } catch (err) {
        fastify.log.error({ err }, 'AI explain error');
        sseError(reply, 'AI service temporarily unavailable. Please try again.');
      }
    },
  );

  // ── POST /ai/review ─────────────────────────────────────────────────────────
  fastify.post<{ Body: { userCode: string; language: string; problemTitle?: string } }>(
    '/review', { preHandler: authenticate }, async (request, reply) => {
      const { userCode, language, problemTitle } = request.body;
      if (!userCode || !language)
        return reply.code(400).send({ error: 'Missing required fields: userCode, language' });

      sseOpen(reply);
      try {
        await streamReview({
          userCode:     sanitize(userCode, MAX_CODE),
          language:     sanitize(language, 30),
          problemTitle: problemTitle ? sanitize(problemTitle, 200) : undefined,
          onChunk: (t) => sseChunk(reply, t),
          onDone:  () => sseDone(reply),
        });
      } catch (err) {
        fastify.log.error({ err }, 'AI review error');
        sseError(reply, 'AI service temporarily unavailable. Please try again.');
      }
    },
  );

  // ── POST /ai/debug ──────────────────────────────────────────────────────────
  fastify.post<{
    Body: { userCode: string; language: string; errorOutput: string; stdin?: string };
  }>('/debug', { preHandler: authenticate }, async (request, reply) => {
    const { userCode, language, errorOutput, stdin } = request.body;
    if (!userCode || !language || !errorOutput)
      return reply.code(400).send({ error: 'Missing required fields: userCode, language, errorOutput' });

    sseOpen(reply);
    try {
      await streamDebug({
        userCode:    sanitize(userCode, MAX_CODE),
        language:    sanitize(language, 30),
        errorOutput: sanitize(errorOutput, 2000),
        stdin:       stdin ? sanitize(stdin, 1000) : undefined,
        onChunk: (t) => sseChunk(reply, t),
        onDone:  () => sseDone(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI debug error');
      sseError(reply, 'AI service temporarily unavailable. Please try again.');
    }
  });

  // ── POST /ai/solve ──────────────────────────────────────────────────────────
  // Generates a verified AI solution for a problem, with up to 3 retry attempts.
  // Streams the final verified solution code via SSE.
  fastify.post<{
    Body: {
      problemTitle: string;
      problemDescription: string;
      problemId: string;
      language: string;
      languageId: number;
      starterCode?: string;
    };
  }>('/solve', { preHandler: authenticate }, async (request, reply) => {
    const { problemTitle, problemDescription, problemId, language, languageId, starterCode } = request.body;
    if (!problemTitle || !problemDescription || !problemId || !language || !languageId) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    const problem = await queryOne<{
      test_cases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
    }>('SELECT test_cases FROM problems WHERE id = $1', [problemId]);

    if (!problem) {
      return reply.code(404).send({ error: 'Problem not found' });
    }

    // Only use visible test cases for verification during solve
    const visibleCases = problem.test_cases.filter((tc) => !tc.isHidden);

    sseOpen(reply);

    const MAX_RETRIES = 3;
    let lastCode = '';
    let lastFailureContext = '';

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Build the prompt
      const retrySection = lastFailureContext
        ? `\n\nYour previous solution failed:\n${lastFailureContext}\n\nFix the issue above.`
        : '';

      const solveMessages: AiMessage[] = [
        {
          role: 'system',
          content: `You are an expert competitive programmer. Write correct, efficient solutions.
Always output ONLY a single fenced code block with the language tag (e.g. \`\`\`python ... \`\`\`).
No explanations outside the code block. The solution must be self-contained and handle stdin/stdout automatically when run via the judge harness.`,
        },
        {
          role: 'user',
          content: `Solve this problem in ${language}:

**Title:** ${sanitize(problemTitle, 200)}

**Description:**
${sanitize(problemDescription, 3000)}

${starterCode ? `**Starter code:**\n\`\`\`${language.toLowerCase()}\n${sanitize(starterCode, 2000)}\n\`\`\`` : ''}${retrySection}

Output ONLY a single \`\`\`${language.toLowerCase()} ... \`\`\` code block with the complete solution function.`,
        },
      ];

      // Collect full streamed response
      let fullResponse = '';
      try {
        await streamCompletion(
          solveMessages,
          {
            onChunk: (t) => {
              fullResponse += t;
              sseChunk(reply, t);
            },
          },
          0.2
        );
      } catch (err) {
        sseError(reply, 'AI service error during solve: ' + (err instanceof Error ? err.message : String(err)));
        return;
      }

      // Extract code block
      const codeMatch = fullResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if (!codeMatch) {
        // No code block found — retry
        lastFailureContext = 'No code block found in response. Output ONLY a fenced code block.';
        continue;
      }

      lastCode = codeMatch[1].trim();

      // Verify against visible test cases (skip if none)
      if (visibleCases.length === 0) break;

      try {
        const testResults = await submitBatchAndWait(
          lastCode,
          languageId as Language,
          visibleCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput }))
        );

        const firstFail = testResults.find((r) => !r.passed);
        if (firstFail?.verdict === 'compile_error') {
          lastFailureContext = `Compile error:\n${firstFail.error ?? 'Unknown compile error'}`;
          continue;
        }
        if (!firstFail) {
          // All visible tests passed — done
          sseJson(reply, 'verified', { passed: true, attempts: attempt + 1 });
          sseDone(reply);
          return;
        }

        // Build failure context for next retry
        const failIdx = testResults.indexOf(firstFail);
        lastFailureContext =
          `Test case ${failIdx + 1} failed.\n` +
          `Input: ${visibleCases[failIdx].input}\n` +
          `Expected: ${normalizeOutput(firstFail.expected)}\n` +
          `Got: ${normalizeOutput(firstFail.actual)}\n` +
          (firstFail.error ? `Error: ${firstFail.error}` : '');
      } catch (err) {
        lastFailureContext = 'Execution error: ' + (err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    // Emit final result even if not all tests passed after retries
    sseJson(reply, 'verified', { passed: false, attempts: MAX_RETRIES });
    sseDone(reply);
  });

  // ── POST /ai/verify-solution ─────────────────────────────────────────────────
  // Verifies a given solution against all test cases and returns detailed results.
  fastify.post<{
    Body: { code: string; languageId: number; problemId: string };
  }>('/verify-solution', { preHandler: authenticate }, async (request, reply) => {
    const { code, languageId, problemId } = request.body;
    if (!code || !languageId || !problemId) {
      return reply.code(400).send({ error: 'Missing required fields: code, languageId, problemId' });
    }

    const problem = await queryOne<{
      test_cases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
    }>('SELECT test_cases FROM problems WHERE id = $1', [problemId]);

    if (!problem) {
      return reply.code(404).send({ error: 'Problem not found' });
    }

    const allCases = problem.test_cases;
    if (allCases.length === 0) {
      return reply.send({ data: { results: [], allPassed: true } });
    }

    try {
      const preCheck = await submitAndWait(code, languageId as Language, allCases[0].input);
      if (preCheck.submissionStatus === SubmissionStatus.CompileError) {
        return reply.send({
          data: {
            results: allCases.map((tc) => ({
              passed: false,
              verdict: 'compile_error',
              timeMs: null,
              memoryKb: null,
              actual: '',
              expected: normalizeOutput(tc.expectedOutput),
              error: preCheck.compileOutput ?? preCheck.stderr ?? 'Compile error',
              isHidden: tc.isHidden ?? false,
            })),
            allPassed: false,
          },
        });
      }

      const results = await submitBatchAndWait(
        code,
        languageId as Language,
        allCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
        }))
      );

      const allPassed = results.every((r) => r.passed);
      return reply.send({ data: { results, allPassed } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      return reply.code(500).send({ error: message });
    }
  });

  // ── POST /ai/chat ───────────────────────────────────────────────────────────
  fastify.post<{
    Body: { message: string; history?: AiMessage[]; codeContext?: string; language?: string };
  }>('/chat', { preHandler: authenticate }, async (request, reply) => {
    const { message, history, codeContext, language } = request.body;
    if (!message?.trim())
      return reply.code(400).send({ error: 'Missing required field: message' });

    sseOpen(reply);
    try {
      await streamChat({
        userMessage: sanitize(message, MAX_MSG),
        history:     sanitizeHistory(history),
        codeContext: codeContext ? sanitize(codeContext, MAX_CODE) : undefined,
        language:    language    ? sanitize(language, 30)         : undefined,
        onChunk: (t) => sseChunk(reply, t),
        onDone:  () => sseDone(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI chat error');
      sseError(reply, 'AI service temporarily unavailable. Please try again.');
    }
  });
}
