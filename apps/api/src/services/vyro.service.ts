/**
 * VyroLang execution service.
 *
 * Runs `.vy` programs natively through the VyroVM (`vyro` CLI built from
 * ../../VyroLang/impl) instead of Judge0. Mirrors the parts of the Judge0
 * service used by the execution worker and the run routes:
 *   - submitAndWait(code, stdin) -> ExecutionResult
 *   - submitBatchAndWait(code, testCases) -> TestCaseResult[]
 *
 * The competitive-programming I/O model is used: each test case's `input` is
 * piped to the program's stdin (VyroLang reads it with `input()`), and the
 * program's stdout is compared against `expectedOutput`.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ExecutionResult, SubmissionStatus } from '@vyro/types';
import { env } from '../config/env.js';
import {
  normalizeOutput,
  outputsMatch,
  type TestCaseInput,
  type TestCaseResult,
} from './judge0.service.js';

interface RawRun {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  timeMs: number;
}

/** Spawn the vyro binary on a source file, feeding `stdin`, with a timeout. */
function runVyroFile(file: string, stdin: string): Promise<RawRun> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(env.VYRO_BIN, ['run', file], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, env.VYRO_TIMEOUT_MS);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: `failed to launch vyro: ${err.message}`,
        exitCode: null,
        timedOut: false,
        timeMs: Date.now() - started,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut, timeMs: Date.now() - started });
    });

    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

/** Write code to a temp .vy file, run it, and clean up. */
async function runVyro(code: string, stdin: string): Promise<RawRun> {
  const dir = await mkdtemp(join(tmpdir(), 'vyro-'));
  const file = join(dir, 'main.vy');
  try {
    await writeFile(file, code, 'utf8');
    return await runVyroFile(file, stdin);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Classify a finished run into a submission status. */
function classify(run: RawRun): SubmissionStatus {
  if (run.timedOut) return SubmissionStatus.TimeLimitExceeded;
  if (run.exitCode === 0) return SubmissionStatus.Accepted;
  // The vyro CLI prints "runtime error: ..." for runtime faults; parse/compile
  // diagnostics look like "line N: ...". Distinguish the two.
  if (/runtime error/i.test(run.stderr)) return SubmissionStatus.RuntimeError;
  return SubmissionStatus.CompileError;
}

export async function submitAndWait(code: string, stdin = ''): Promise<ExecutionResult> {
  const run = await runVyro(code, stdin);
  const status = classify(run);

  const description =
    status === SubmissionStatus.Accepted
      ? 'Accepted'
      : status === SubmissionStatus.CompileError
        ? 'Compilation Error'
        : status === SubmissionStatus.TimeLimitExceeded
          ? 'Time Limit Exceeded'
          : 'Runtime Error';

  return {
    token: `vyro-${Date.now()}`,
    status: { id: -1, description },
    stdout: run.stdout || undefined,
    stderr: status === SubmissionStatus.RuntimeError ? run.stderr || undefined : undefined,
    compileOutput: status === SubmissionStatus.CompileError ? run.stderr || undefined : undefined,
    timeMs: run.timeMs,
    memoryKb: undefined,
    submissionStatus: status,
  };
}

export async function submitBatchAndWait(
  code: string,
  testCases: TestCaseInput[],
): Promise<TestCaseResult[]> {
  if (testCases.length === 0) return [];

  // Compile once up front so a compile error fails every case consistently.
  const probe = await runVyro(code, testCases[0].input);
  const probeStatus = classify(probe);
  if (probeStatus === SubmissionStatus.CompileError) {
    const error = probe.stderr || 'Compile error';
    return testCases.map((tc) => ({
      passed: false,
      verdict: 'compile_error',
      timeMs: null,
      memoryKb: null,
      actual: '',
      expected: normalizeOutput(tc.expectedOutput),
      error,
      isHidden: tc.isHidden,
    }));
  }

  const results: TestCaseResult[] = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    // Reuse the probe run for the first case to avoid running it twice.
    const run = i === 0 ? probe : await runVyro(code, tc.input);
    const status = classify(run);

    let verdict: TestCaseResult['verdict'];
    let passed = false;

    if (status === SubmissionStatus.TimeLimitExceeded) {
      verdict = 'time_limit_exceeded';
    } else if (status === SubmissionStatus.RuntimeError) {
      verdict = 'runtime_error';
    } else if (status === SubmissionStatus.CompileError) {
      verdict = 'compile_error';
    } else if (outputsMatch(run.stdout, tc.expectedOutput)) {
      verdict = 'accepted';
      passed = true;
    } else {
      verdict = 'wrong_answer';
    }

    results.push({
      passed,
      verdict,
      timeMs: run.timeMs,
      memoryKb: null,
      actual: normalizeOutput(run.stdout),
      expected: normalizeOutput(tc.expectedOutput),
      error: run.stderr || undefined,
      isHidden: tc.isHidden,
    });
  }

  return results;
}
