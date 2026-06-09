import OpenAI from 'openai';
import { env } from '../config/env.js';
import {
  isOllamaRunning,
  listModels,
  pickCodingModel,
  startOllamaDaemon,
} from './ollama.service.js';

interface AiProvider {
  client: OpenAI;
  model: string;
  provider: string;
}

let _cachedProvider: AiProvider | null = null;
let _cacheExpiry = 0;

export function clearProviderCache(): void {
  _cachedProvider = null;
  _cacheExpiry = 0;
}

export async function detectAiProvider(): Promise<AiProvider> {
  const now = Date.now();
  if (_cachedProvider && now < _cacheExpiry) return _cachedProvider;

  try {
    let running = await isOllamaRunning(800);

    if (!running) {
      await startOllamaDaemon();
      running = await isOllamaRunning(2000);
    }

    if (running) {
      const models     = await listModels();
      const activeModel = pickCodingModel(models);

      if (activeModel) {
        const result: AiProvider = {
          client: new OpenAI({ apiKey: 'ollama', baseURL: 'http://127.0.0.1:11434/v1' }),
          model: activeModel,
          provider: 'Ollama (Local)',
        };
        _cachedProvider = result;
        _cacheExpiry    = now + 60_000;
        return result;
      }
    }
  } catch {
    
  }

  if (!env.NVIDIA_API_KEY) {
    throw new Error(
      'No AI provider available. Install Ollama (https://ollama.com) or ' +
      'set NVIDIA_API_KEY in your .env for cloud access.',
    );
  }

  const nimResult: AiProvider = {
    client: new OpenAI({ apiKey: env.NVIDIA_API_KEY, baseURL: env.NVIDIA_BASE_URL }),
    model: env.AI_MODEL,
    provider: 'NVIDIA NIM (Remote)',
  };
  _cachedProvider = nimResult;
  _cacheExpiry    = now + 60_000;
  return nimResult;
}

export async function getAiStatus() {
  try {
    const { model, provider } = await detectAiProvider();
    return { available: true, model, provider };
  } catch (err) {
    return {
      available: false,
      model: 'none',
      provider: 'none',
      error: err instanceof Error ? err.message : 'AI service unavailable',
    };
  }
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamOptions {
  onChunk: (text: string) => void;
  onDone?: () => void;
}

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 400,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code ?? '';
      const isRetryable =
        RETRYABLE_CODES.has(code) ||
        (err instanceof Error && /connection|timeout|reset/i.test(err.message));

      if (!isRetryable || attempt === maxAttempts - 1) break;

      clearProviderCache();
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

const TIMEOUT_OLLAMA_MS = 120_000;
const TIMEOUT_NIM_MS    =  60_000;

export async function streamCompletion(
  messages: AiMessage[],
  opts: StreamOptions,
  temperature = 0.6,
): Promise<void> {
  await withRetry(async () => {
    const { client, model, provider } = await detectAiProvider();

    const isOllama    = provider.includes('Ollama');
    const timeoutMs   = isOllama ? TIMEOUT_OLLAMA_MS : TIMEOUT_NIM_MS;

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature,
      top_p: 0.95,
      max_tokens: 8192,
      stream: true,
    };

    if (!isOllama && model.toLowerCase().includes('deepseek')) {
      requestBody['extra_body'] = { chat_template_kwargs: { thinking: false } };
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => {
      controller.abort(new Error(`AI request timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    try {
      const stream = await (client.chat.completions.create as Function)({
        ...requestBody,
        signal: controller.signal,
      });

      let receivedAny = false;
      for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) { opts.onChunk(text); receivedAny = true; }
      }

      if (!receivedAny && isOllama) {
        clearProviderCache();
        throw Object.assign(new Error('Empty response from Ollama — retrying'), { code: 'ECONNRESET' });
      }

      opts.onDone?.();
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

const SYSTEM_BASE = `You are an expert competitive programming assistant embedded inside VyroCoding, a real-time collaborative coding platform.
You help developers understand algorithms, debug code, and improve their solutions.
Be concise, precise, and technical. Use code blocks with language tags when showing code.
Never reveal the full solution unless the user explicitly asks for it.`;

export async function streamHint(opts: {
  problemTitle: string;
  problemDescription: string;
  userCode: string;
  language: string;
  onChunk: (t: string) => void;
  onDone?: () => void;
}): Promise<void> {
  const messages: AiMessage[] = [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `I'm stuck on this problem:

**Problem:** ${opts.problemTitle}

${opts.problemDescription.slice(0, 2000)}

**My current code (${opts.language}):**
\`\`\`${opts.language.toLowerCase()}
${opts.userCode.slice(0, 3000)}
\`\`\`

Give me a small, non-spoiler hint that nudges me in the right direction. Do NOT show the solution or write the code for me.`,
    },
  ];
  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.7);
}

export async function streamExplain(opts: {
  userCode: string;
  language: string;
  onChunk: (t: string) => void;
  onDone?: () => void;
}): Promise<void> {
  const messages: AiMessage[] = [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Explain what this ${opts.language} code does, step by step:

\`\`\`${opts.language.toLowerCase()}
${opts.userCode.slice(0, 4000)}
\`\`\`

Be concise. Cover: what it does, the algorithm/approach, time/space complexity if relevant.`,
    },
  ];
  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.3);
}

export async function streamReview(opts: {
  userCode: string;
  language: string;
  problemTitle?: string;
  onChunk: (t: string) => void;
  onDone?: () => void;
}): Promise<void> {
  const messages: AiMessage[] = [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Review my ${opts.language} code${opts.problemTitle ? ` for "${opts.problemTitle}"` : ''}:

\`\`\`${opts.language.toLowerCase()}
${opts.userCode.slice(0, 4000)}
\`\`\`

Check for: bugs, edge cases missed, off-by-one errors, performance issues, and style improvements.
Format your response with clear sections.`,
    },
  ];
  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.4);
}

export async function streamDebug(opts: {
  userCode: string;
  language: string;
  errorOutput: string;
  stdin?: string;
  onChunk: (t: string) => void;
  onDone?: () => void;
}): Promise<void> {
  const messages: AiMessage[] = [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `My ${opts.language} code has an error. Help me debug it.

**Code:**
\`\`\`${opts.language.toLowerCase()}
${opts.userCode.slice(0, 3000)}
\`\`\`

**Error / Wrong Output:**
\`\`\`
${opts.errorOutput.slice(0, 1000)}
\`\`\`
${opts.stdin ? `\n**Input used:**\n\`\`\`\n${opts.stdin.slice(0, 500)}\n\`\`\`` : ''}

Identify the bug, explain why it happens, and suggest a fix (don't rewrite the whole thing unless necessary).`,
    },
  ];
  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.3);
}

// ── Feature: Free chat ────────────────────────────────────────────────────────

export async function streamChat(opts: {
  history: AiMessage[];
  userMessage: string;
  codeContext?: string;
  language?: string;
  onChunk: (t: string) => void;
  onDone?: () => void;
}): Promise<void> {
  const systemMsg: AiMessage = {
    role: 'system',
    content: SYSTEM_BASE +
      (opts.codeContext
        ? `\n\nThe user is currently working on this ${opts.language ?? ''} code:\n\`\`\`${opts.language?.toLowerCase() ?? ''}\n${opts.codeContext.slice(0, 2000)}\n\`\`\``
        : ''),
  };

  const messages: AiMessage[] = [
    systemMsg,
    ...opts.history.slice(-10),
    { role: 'user', content: opts.userMessage },
  ];

  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.7);
}
