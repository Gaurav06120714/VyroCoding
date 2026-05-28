/**
 * Ollama Service — zero-config local AI management
 *
 * Responsibilities:
 *   1. Detect if Ollama binary is installed on the host machine
 *   2. Start `ollama serve` automatically if the daemon isn't running
 *   3. List available models and identify a suitable coding model
 *   4. Pull the preferred coding model if none is present (with SSE progress)
 *   5. Expose a rich status object consumed by the setup API and AI provider
 *
 * All network calls have explicit timeouts so nothing blocks the server.
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Constants ─────────────────────────────────────────────────────────────────

const OLLAMA_BASE = 'http://127.0.0.1:11434';

/** Ordered list of preferred coding models (first match wins). */
export const PREFERRED_MODELS = [
  'qwen2.5-coder:7b',
  'qwen2.5-coder:3b',
  'codellama:7b',
  'codellama:13b',
  'deepseek-coder:6.7b',
  'deepseek-coder:1.3b',
  'llama3.2:3b',
  'mistral:7b',
];

/** The model we'll auto-pull if the user has none. */
const DEFAULT_PULL_MODEL = 'qwen2.5-coder:7b';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  size: number;       // bytes
  modifiedAt: string;
}

export interface OllamaSetupStatus {
  /** Is the `ollama` binary present in PATH? */
  installed: boolean;
  /** Is the daemon responding on :11434? */
  running: boolean;
  /** All models currently on disk */
  models: OllamaModel[];
  /** Best coding model already available, or null */
  activeModel: string | null;
  /** The model we would pull if none is available */
  recommendedModel: string;
  /** Error message if anything went wrong */
  error?: string;
}

// ── Ollama binary detection ───────────────────────────────────────────────────

export async function isOllamaInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('ollama', ['--version'], { timeout: 3000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// ── Daemon health ─────────────────────────────────────────────────────────────

export async function isOllamaRunning(timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Start daemon ──────────────────────────────────────────────────────────────

let _serveProcess: ReturnType<typeof spawn> | null = null;

export async function startOllamaDaemon(): Promise<boolean> {
  if (await isOllamaRunning()) return true;

  const installed = await isOllamaInstalled();
  if (!installed) return false;

  return new Promise((resolve) => {
    _serveProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
    });
    _serveProcess.unref();

    // Poll until the daemon responds (up to 10 s)
    let attempts = 0;
    const interval = setInterval(async () => {
      if (await isOllamaRunning()) {
        clearInterval(interval);
        resolve(true);
      } else if (++attempts > 20) {
        clearInterval(interval);
        resolve(false);
      }
    }, 500);
  });
}

// ── Model listing ─────────────────────────────────────────────────────────────

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{ name: string; size: number; modified_at: string }>;
    };
    return (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));
  } catch {
    return [];
  }
}

// ── Pick best coding model ────────────────────────────────────────────────────

export function pickCodingModel(models: OllamaModel[]): string | null {
  const names = models.map((m) => m.name.toLowerCase());

  // Try preferred list first (exact prefix match)
  for (const pref of PREFERRED_MODELS) {
    if (names.some((n) => n.startsWith(pref.split(':')[0]))) {
      const match = models.find((m) =>
        m.name.toLowerCase().startsWith(pref.split(':')[0])
      );
      if (match) return match.name;
    }
  }

  // Any model that isn't an embedding model
  const chatModels = models.filter(
    (m) => !m.name.toLowerCase().includes('embed')
  );
  return chatModels[0]?.name ?? null;
}

// ── Pull model with streaming progress ───────────────────────────────────────

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
  done: boolean;
  error?: string;
}

/**
 * Pull a model from the Ollama registry.
 * Calls `onProgress` for each NDJSON line Ollama emits.
 * Returns true if the pull completed successfully.
 */
export async function pullModel(
  model: string,
  onProgress: (p: PullProgress) => void,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    // No timeout on pull — can take many minutes
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      onProgress({ status: 'error', done: true, error: `HTTP ${res.status}` });
      return false;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as {
            status?: string;
            digest?: string;
            total?: number;
            completed?: number;
            error?: string;
          };

          if (obj.error) {
            onProgress({ status: 'error', done: true, error: obj.error });
            return false;
          }

          const percent =
            obj.total && obj.completed
              ? Math.round((obj.completed / obj.total) * 100)
              : undefined;

          const isDone =
            obj.status === 'success' ||
            obj.status === 'already exists';

          onProgress({
            status: obj.status ?? 'pulling',
            digest: obj.digest,
            total: obj.total,
            completed: obj.completed,
            percent,
            done: isDone,
          });

          if (isDone) return true;
        } catch {
          // ignore malformed JSON line
        }
      }
    }

    return true;
  } catch (err) {
    onProgress({
      status: 'error',
      done: true,
      error: err instanceof Error ? err.message : 'Pull failed',
    });
    return false;
  }
}

// ── Full setup status ─────────────────────────────────────────────────────────

export async function getOllamaSetupStatus(): Promise<OllamaSetupStatus> {
  const installed = await isOllamaInstalled();

  if (!installed) {
    return {
      installed: false,
      running: false,
      models: [],
      activeModel: null,
      recommendedModel: DEFAULT_PULL_MODEL,
      error: 'Ollama is not installed on this machine.',
    };
  }

  const running = await isOllamaRunning();

  if (!running) {
    return {
      installed: true,
      running: false,
      models: [],
      activeModel: null,
      recommendedModel: DEFAULT_PULL_MODEL,
      error: 'Ollama is installed but the daemon is not running. Starting it now…',
    };
  }

  const models   = await listModels();
  const active   = pickCodingModel(models);

  return {
    installed: true,
    running: true,
    models,
    activeModel: active,
    recommendedModel: DEFAULT_PULL_MODEL,
  };
}

// ── Auto-pull smallest coding model ──────────────────────────────────────────

/**
 * Ordered list of models to try pulling when none is present.
 * Smallest first so the auto-pull completes quickly on first run.
 */
const AUTO_PULL_CANDIDATES = [
  'qwen2.5-coder:3b',   // ~2 GB — fast download
  'codellama:7b',        // ~3.8 GB
  'qwen2.5-coder:7b',   // ~4.7 GB
  'deepseek-coder:1.3b', // ~0.8 GB — tiny fallback
];

/**
 * Pull the smallest available coding model silently (no user confirmation).
 * Progress is logged via the `log` callback.
 * Returns the model name on success, null on failure.
 */
export async function autoPullCodingModel(
  log: (msg: string) => void,
): Promise<string | null> {
  for (const model of AUTO_PULL_CANDIDATES) {
    log(`[ollama] auto-pulling ${model}…`);
    const ok = await pullModel(model, (p) => {
      if (p.percent !== undefined && p.percent % 20 === 0) {
        log(`[ollama] pull ${model}: ${p.status} ${p.percent ?? ''}%`);
      }
      if (p.done && !p.error) {
        log(`[ollama] pull ${model}: complete`);
      }
    });
    if (ok) return model;
    log(`[ollama] pull ${model} failed — trying next…`);
  }
  return null;
}

// ── Boot-time auto-setup ──────────────────────────────────────────────────────

/**
 * Called once at server boot. Tries to:
 *   1. Start Ollama daemon if installed but not running
 *   2. Auto-pull the smallest coding model if none is present
 */
export async function bootOllamaSetup(log: (msg: string) => void): Promise<void> {
  const installed = await isOllamaInstalled();
  if (!installed) {
    log('[ollama] not installed — AI will use NVIDIA NIM fallback');
    return;
  }

  let running = await isOllamaRunning();

  if (!running) {
    log('[ollama] installed but not running — starting daemon…');
    running = await startOllamaDaemon();
    if (!running) {
      log('[ollama] could not start daemon — AI will use NVIDIA NIM fallback');
      return;
    }
    log('[ollama] daemon started');
  }

  const models = await listModels();
  const active = pickCodingModel(models);

  if (active) {
    log(`[ollama] running — active model: ${active}`);
    return;
  }

  // No coding model present — auto-pull the smallest one
  log('[ollama] no coding model found — auto-pulling smallest candidate…');
  const pulled = await autoPullCodingModel(log);
  if (pulled) {
    log(`[ollama] ready — auto-pulled model: ${pulled}`);
  } else {
    log('[ollama] auto-pull failed — AI will use NVIDIA NIM fallback if configured');
  }
}

// ── Full auto-setup (called from API route) ───────────────────────────────────

export interface AutoSetupResult {
  installed: boolean;
  started: boolean;
  modelPulled: string | null;
  activeModel: string | null;
  error?: string;
}

/**
 * End-to-end auto-setup: install check → daemon start → model pull.
 * Returns detailed result so the frontend can show targeted feedback.
 */
export async function runAutoSetup(
  log: (msg: string) => void,
  onPullProgress?: (p: PullProgress) => void,
): Promise<AutoSetupResult> {
  const installed = await isOllamaInstalled();
  if (!installed) {
    return { installed: false, started: false, modelPulled: null, activeModel: null,
      error: 'Ollama is not installed on this machine.' };
  }

  let running = await isOllamaRunning();
  if (!running) {
    log('[auto-setup] starting Ollama daemon…');
    running = await startOllamaDaemon();
  }

  if (!running) {
    return { installed: true, started: false, modelPulled: null, activeModel: null,
      error: 'Could not start Ollama daemon.' };
  }

  const models = await listModels();
  let active   = pickCodingModel(models);

  if (active) {
    return { installed: true, started: true, modelPulled: null, activeModel: active };
  }

  // Auto-pull smallest candidate
  for (const model of AUTO_PULL_CANDIDATES) {
    log(`[auto-setup] pulling ${model}…`);
    const ok = await pullModel(model, (p) => {
      onPullProgress?.(p);
    });
    if (ok) {
      active = model;
      return { installed: true, started: true, modelPulled: model, activeModel: model };
    }
  }

  return { installed: true, started: true, modelPulled: null, activeModel: null,
    error: 'Could not pull any coding model. Check your network connection.' };
}
