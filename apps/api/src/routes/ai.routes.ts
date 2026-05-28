/**
 * AI routes — exposes DeepSeek v4 Pro (NVIDIA NIM) features via REST endpoints.
 *
 * All endpoints require authentication and stream responses using
 * Server-Sent Events (SSE) for real-time AI output in the browser.
 *
 * Endpoints:
 *   POST /ai/hint     — Non-spoiler hint for a problem
 *   POST /ai/explain  — Step-by-step code explanation
 *   POST /ai/review   — Code review with bug/style checks
 *   POST /ai/debug    — Debug help for errors
 *   POST /ai/chat     — Free-form multi-turn chat
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import {
  streamHint,
  streamExplain,
  streamReview,
  streamDebug,
  streamChat,
  getAiStatus,
  type AiMessage,
} from '../services/ai.service.js';

// ── Input validation helpers ──────────────────────────────────────────────────

const MAX_CODE_LENGTH = 10_000;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_LENGTH = 20;

function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLen);
}

function sanitizeHistory(history: unknown): AiMessage[] {
  if (!Array.isArray(history)) return [];
  const validRoles = new Set(['user', 'assistant', 'system']);
  return history
    .filter(
      (m): m is AiMessage =>
        typeof m === 'object' &&
        m !== null &&
        validRoles.has((m as AiMessage).role) &&
        typeof (m as AiMessage).content === 'string',
    )
    .slice(-MAX_HISTORY_LENGTH)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

// ── SSE stream helper ─────────────────────────────────────────────────────────

function setupSSE(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });
}

function sendSSEChunk(reply: FastifyReply, data: string): void {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSSE(reply: FastifyReply): void {
  reply.raw.write('data: [DONE]\n\n');
  reply.raw.end();
}

function sendSSEError(reply: FastifyReply, message: string): void {
  reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
  reply.raw.end();
}

// ── Route definitions ─────────────────────────────────────────────────────────

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /ai/hint
  fastify.post<{
    Body: {
      problemTitle: string;
      problemDescription: string;
      userCode: string;
      language: string;
    };
  }>('/hint', { preHandler: authenticate }, async (request, reply) => {
    const { problemTitle, problemDescription, userCode, language } = request.body;

    if (!problemTitle || !userCode || !language) {
      return reply.code(400).send({ error: 'Missing required fields: problemTitle, userCode, language' });
    }

    setupSSE(reply);
    try {
      await streamHint({
        problemTitle: sanitizeString(problemTitle, 200),
        problemDescription: sanitizeString(problemDescription, 3000),
        userCode: sanitizeString(userCode, MAX_CODE_LENGTH),
        language: sanitizeString(language, 30),
        onChunk: (text) => sendSSEChunk(reply, text),
        onDone: () => endSSE(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI hint stream error');
      sendSSEError(reply, 'AI service temporarily unavailable');
    }
  });

  // POST /ai/explain
  fastify.post<{
    Body: { userCode: string; language: string };
  }>('/explain', { preHandler: authenticate }, async (request, reply) => {
    const { userCode, language } = request.body;

    if (!userCode || !language) {
      return reply.code(400).send({ error: 'Missing required fields: userCode, language' });
    }

    setupSSE(reply);
    try {
      await streamExplain({
        userCode: sanitizeString(userCode, MAX_CODE_LENGTH),
        language: sanitizeString(language, 30),
        onChunk: (text) => sendSSEChunk(reply, text),
        onDone: () => endSSE(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI explain stream error');
      sendSSEError(reply, 'AI service temporarily unavailable');
    }
  });

  // POST /ai/review
  fastify.post<{
    Body: { userCode: string; language: string; problemTitle?: string };
  }>('/review', { preHandler: authenticate }, async (request, reply) => {
    const { userCode, language, problemTitle } = request.body;

    if (!userCode || !language) {
      return reply.code(400).send({ error: 'Missing required fields: userCode, language' });
    }

    setupSSE(reply);
    try {
      await streamReview({
        userCode: sanitizeString(userCode, MAX_CODE_LENGTH),
        language: sanitizeString(language, 30),
        problemTitle: problemTitle ? sanitizeString(problemTitle, 200) : undefined,
        onChunk: (text) => sendSSEChunk(reply, text),
        onDone: () => endSSE(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI review stream error');
      sendSSEError(reply, 'AI service temporarily unavailable');
    }
  });

  // POST /ai/debug
  fastify.post<{
    Body: { userCode: string; language: string; errorOutput: string; stdin?: string };
  }>('/debug', { preHandler: authenticate }, async (request, reply) => {
    const { userCode, language, errorOutput, stdin } = request.body;

    if (!userCode || !language || !errorOutput) {
      return reply.code(400).send({ error: 'Missing required fields: userCode, language, errorOutput' });
    }

    setupSSE(reply);
    try {
      await streamDebug({
        userCode: sanitizeString(userCode, MAX_CODE_LENGTH),
        language: sanitizeString(language, 30),
        errorOutput: sanitizeString(errorOutput, 2000),
        stdin: stdin ? sanitizeString(stdin, 1000) : undefined,
        onChunk: (text) => sendSSEChunk(reply, text),
        onDone: () => endSSE(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI debug stream error');
      sendSSEError(reply, 'AI service temporarily unavailable');
    }
  });

  // POST /ai/chat
  fastify.post<{
    Body: {
      message: string;
      history?: AiMessage[];
      codeContext?: string;
      language?: string;
    };
  }>('/chat', { preHandler: authenticate }, async (request, reply) => {
    const { message, history, codeContext, language } = request.body;

    if (!message?.trim()) {
      return reply.code(400).send({ error: 'Missing required field: message' });
    }

    setupSSE(reply);
    try {
      await streamChat({
        userMessage: sanitizeString(message, MAX_MESSAGE_LENGTH),
        history: sanitizeHistory(history),
        codeContext: codeContext ? sanitizeString(codeContext, MAX_CODE_LENGTH) : undefined,
        language: language ? sanitizeString(language, 30) : undefined,
        onChunk: (text) => sendSSEChunk(reply, text),
        onDone: () => endSSE(reply),
      });
    } catch (err) {
      fastify.log.error({ err }, 'AI chat stream error');
      sendSSEError(reply, 'AI service temporarily unavailable');
    }
  });

  // GET /ai/status — health check for AI service (no auth required)
  fastify.get('/status', async (_request, reply) => {
    const status = await getAiStatus();
    return reply.send(status);
  });
}
