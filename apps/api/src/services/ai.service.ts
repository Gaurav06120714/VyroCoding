/**
 * AI service — DeepSeek v4 Pro via NVIDIA NIM
 *
 * Uses the OpenAI-compatible client so switching providers later requires
 * only changing env vars (base_url + model), not code.
 *
 * All methods accept an onChunk callback for streaming responses.
 * Set onChunk=undefined to collect the full response synchronously.
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';

// ── Auto-Detect AI Provider (Ollama Local vs NVIDIA NIM Remote) ───────────────

interface AiProvider {
  client: OpenAI;
  model: string;
  provider: string;
}

// Cache provider for 60 seconds so we don't re-probe Ollama on every request
let _cachedProvider: AiProvider | null = null;
let _cacheExpiry = 0;

export function clearProviderCache(): void {
  _cachedProvider = null;
  _cacheExpiry = 0;
}

export async function detectAiProvider(): Promise<AiProvider> {
  const now = Date.now();
  if (_cachedProvider && now < _cacheExpiry) {
    return _cachedProvider;
  }

  // 1. Attempt to connect to locally running Ollama instance (at default http://127.0.0.1:11434)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600); // 600ms quick ping timeout

    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      if (data.models && data.models.length > 0) {
        // Filter out non-chat embedding models (containing "embed")
        const chatModels = data.models.filter(
          m => !m.name.toLowerCase().includes('embed')
        );

        if (chatModels.length > 0) {
          // Prioritize known chat and programming models
          const prioritized = chatModels.find(m => {
            const name = m.name.toLowerCase();
            return (
              name.includes('coder') ||
              name.includes('deepseek') ||
              name.includes('r1') ||
              name.includes('qwen') ||
              name.includes('llama') ||
              name.includes('instruct') ||
              name.includes('chat')
            );
          });

          const localModel = prioritized ? prioritized.name : chatModels[0].name;
          const ollamaClient = new OpenAI({
            apiKey: 'ollama', // Ollama doesn't require a key but OpenAI client expects a non-empty string
            baseURL: 'http://127.0.0.1:11434/v1',
          });
          const result: AiProvider = {
            client: ollamaClient,
            model: localModel,
            provider: 'Ollama (Local)',
          };
          _cachedProvider = result;
          _cacheExpiry = Date.now() + 60_000; // cache 60s
          return result;
        }
      }
    }
  } catch {
    // Ollama is either not running locally or request timed out, fall through to remote
  }

  // 2. Fallback to configured NVIDIA NIM remote cloud provider
  if (!env.NVIDIA_API_KEY) {
    throw new Error(
      'AI assistant requires a local Ollama instance running at http://127.0.0.1:11434\n' +
        'OR a valid NVIDIA_API_KEY set in your .env file for cloud NIM access.',
    );
  }

  const nimClient = new OpenAI({
    apiKey: env.NVIDIA_API_KEY,
    baseURL: env.NVIDIA_BASE_URL,
  });

  const nimResult: AiProvider = {
    client: nimClient,
    model: env.AI_MODEL,
    provider: 'NVIDIA NIM (Remote)',
  };
  _cachedProvider = nimResult;
  _cacheExpiry = Date.now() + 60_000; // cache 60s
  return nimResult;
}

// Helper to query active AI health status dynamically
export async function getAiStatus() {
  try {
    const { model, provider } = await detectAiProvider();
    return {
      available: true,
      model,
      provider,
    };
  } catch (err) {
    return {
      available: false,
      model: 'none',
      provider: 'none',
      error: err instanceof Error ? err.message : 'AI service unavailable',
    };
  }
}

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_BASE = `You are an expert competitive programming assistant embedded inside VyroCoding, a real-time collaborative coding platform.
You help developers understand algorithms, debug code, and improve their solutions.
Be concise, precise, and technical. Use code blocks with language tags when showing code.
Never reveal the full solution unless the user explicitly asks for it.`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamOptions {
  onChunk: (text: string) => void;
  onDone?: () => void;
}

// ── Core streaming helper ─────────────────────────────────────────────────────

export async function streamCompletion(
  messages: AiMessage[],
  opts: StreamOptions,
  temperature = 0.6,
): Promise<void> {
  const { client, model, provider } = await detectAiProvider();

  const requestBody: any = {
    model,
    messages,
    temperature,
    top_p: 0.95,
    max_tokens: 16384,
    stream: true,
  };

  // Only pass thinking template args for DeepSeek models to avoid breaking other models (like Llama/Qwen)
  if (model.toLowerCase().includes('deepseek')) {
    requestBody.extra_body = { chat_template_kwargs: { thinking: false } };
  }

  const stream = await client.chat.completions.create(requestBody);

  for await (const chunk of stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) opts.onChunk(text);
  }
  opts.onDone?.();
}

// ── Feature: Hint ─────────────────────────────────────────────────────────────
// Gives a nudge toward the solution WITHOUT revealing the approach fully.

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

// ── Feature: Explain ──────────────────────────────────────────────────────────
// Explains what the user's current code does step-by-step.

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

// ── Feature: Review ───────────────────────────────────────────────────────────
// Reviews code for correctness, edge cases, and improvements.

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

// ── Feature: Debug ────────────────────────────────────────────────────────────
// Helps debug a wrong answer or runtime error.

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
// Multi-turn conversation with code context injected.

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
    // Keep last 10 turns to stay within context window
    ...opts.history.slice(-10),
    { role: 'user', content: opts.userMessage },
  ];

  return streamCompletion(messages, { onChunk: opts.onChunk, onDone: opts.onDone }, 0.7);
}
