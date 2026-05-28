import { ExecutionResult, Language, SubmissionStatus } from '@vyro/types';
import { env } from '../config/env.js';

const JUDGE0_API_URL = env.JUDGE0_API_URL;
const JUDGE0_API_KEY = env.JUDGE0_API_KEY;

export const LANGUAGES: Record<Language, { id: Language; name: string; monacoId: string }> = {
  [Language.JavaScript]: { id: Language.JavaScript, name: 'JavaScript (Node.js 18)', monacoId: 'javascript' },
  [Language.Python]:     { id: Language.Python,     name: 'Python 3',                monacoId: 'python' },
  [Language.Cpp]:        { id: Language.Cpp,        name: 'C++ (GCC 9.2)',           monacoId: 'cpp' },
  [Language.Java]:       { id: Language.Java,       name: 'Java (OpenJDK 13)',       monacoId: 'java' },
  [Language.TypeScript]: { id: Language.TypeScript, name: 'TypeScript',              monacoId: 'typescript' },
  [Language.Go]:         { id: Language.Go,         name: 'Go',                      monacoId: 'go' },
  [Language.Rust]:       { id: Language.Rust,       name: 'Rust',                    monacoId: 'rust' },
};

// Judge0 status IDs → our status
const JUDGE0_STATUS_MAP: Record<number, SubmissionStatus> = {
  1:  SubmissionStatus.Processing,
  2:  SubmissionStatus.Processing,
  3:  SubmissionStatus.Accepted,
  4:  SubmissionStatus.WrongAnswer,
  5:  SubmissionStatus.TimeLimitExceeded,
  6:  SubmissionStatus.CompileError,
  7:  SubmissionStatus.RuntimeError,
  8:  SubmissionStatus.RuntimeError,
  9:  SubmissionStatus.RuntimeError,
  10: SubmissionStatus.RuntimeError,
  11: SubmissionStatus.RuntimeError,
  12: SubmissionStatus.RuntimeError,
  13: SubmissionStatus.RuntimeError,
  14: SubmissionStatus.MemoryLimitExceeded,
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (JUDGE0_API_KEY && JUDGE0_API_URL.includes('rapidapi')) {
    Object.assign(headers, {
      'X-RapidAPI-Key': JUDGE0_API_KEY,
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
    });
  }
  return headers;
}

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString('utf-8');
}

// ── Output normalization ──────────────────────────────────────────────────────

export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+$/, '')
    .trim();
}

export function outputsMatch(actual: string, expected: string): boolean {
  const a = normalizeOutput(actual);
  const e = normalizeOutput(expected);

  // 1. Exact match
  if (a === e) return true;

  // 2. JSON-normalized match
  try {
    const pa = JSON.parse(a);
    const pe = JSON.parse(e);
    if (JSON.stringify(pa) === JSON.stringify(pe)) return true;
  } catch {
    // not valid JSON — continue
  }

  // 3. Numeric epsilon match (for single float outputs)
  const fa = parseFloat(a);
  const fe = parseFloat(e);
  if (!isNaN(fa) && !isNaN(fe) && isFinite(fa) && isFinite(fe)) {
    if (Math.abs(fa - fe) < 1e-9) return true;
  }

  return false;
}

// ── Code wrapping (per-language stdin→function→stdout harness) ────────────────

/**
 * Wraps user code with a stdin→function→stdout harness.
 * The test case input is always a JSON array of arguments.
 */
export function wrapCode(code: string, languageId: Language): string {
  switch (languageId) {
    case Language.JavaScript: {
      const match = code.match(/function\s+(\w+)\s*\(/) ?? code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\(.*?\)\s*=>)/);
      if (!match) return code;
      const fnName = match[1];
      return (
        code.trimEnd() +
        `\n\nconst __input = require('fs').readFileSync('/dev/stdin','utf8').trim();\n` +
        `const __args = JSON.parse(__input);\n` +
        `const __fn = ${fnName};\n` +
        `const __result = __fn(...(Array.isArray(__args) ? __args : [__args]));\n` +
        `process.stdout.write(JSON.stringify(__result) + '\\n');\n`
      );
    }

    case Language.TypeScript: {
      const match = code.match(/function\s+(\w+)\s*\(/) ?? code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\(.*?\)\s*=>)/);
      if (!match) return code;
      const fnName = match[1];
      return (
        `// @ts-nocheck\n` +
        code.trimEnd() +
        `\n\nconst __input = require('fs').readFileSync('/dev/stdin','utf8').trim();\n` +
        `const __args = JSON.parse(__input);\n` +
        `const __fn = ${fnName};\n` +
        `const __result = __fn(...(Array.isArray(__args) ? __args : [__args]));\n` +
        `process.stdout.write(JSON.stringify(__result) + '\\n');\n`
      );
    }

    case Language.Python: {
      const match = code.match(/def\s+(\w+)\s*\(/);
      if (!match) return code;
      const fnName = match[1];
      return (
        `import sys, json\n` +
        code.trimEnd() +
        `\n\n__args = json.loads(sys.stdin.read().strip())\n` +
        `if not isinstance(__args, list): __args = [__args]\n` +
        `__result = ${fnName}(*__args)\n` +
        `print(json.dumps(__result, separators=(',', ':')))\n`
      );
    }

    case Language.Cpp: {
      // If code already has int main(), use as-is (standard competitive style)
      if (/int\s+main\s*\(/.test(code)) return code;
      // Detect first non-main function name for the harness
      const fnMatch = code.match(/(?:int|long long|string|bool|double|vector\s*<[^>]+>)\s+(\w+)\s*\(/);
      const fnName = fnMatch?.[1] ?? 'solution';
      // Minimal JSON-array stdin reader for common types
      return (
        `#include <bits/stdc++.h>\n` +
        `#include <sstream>\n` +
        `using namespace std;\n` +
        code.trimEnd() +
        `\n// Auto-generated harness\n` +
        `int main() {\n` +
        `  ios::sync_with_stdio(false);\n` +
        `  cin.tie(nullptr);\n` +
        `  // Read raw JSON line and pass as single string — problem starter should define main()\n` +
        `  // For function-only solutions, the harness calls ${fnName}() with no args\n` +
        `  // Users should add int main() to their solution for full control\n` +
        `  auto result = ${fnName}();\n` +
        `  cout << result << "\\n";\n` +
        `  return 0;\n` +
        `}\n`
      );
    }

    case Language.Java: {
      // If code already has public static void main, use as-is
      if (/public\s+static\s+void\s+main\s*\(/.test(code)) return code;
      // Java function-only solutions are rare in competitive programming;
      // wrap in a Solution class with a main that instantiates and calls the first method
      const methodMatch = code.match(/public\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/);
      const methodName = methodMatch?.[1] ?? 'solve';
      return (
        `import java.util.*;\nimport java.io.*;\n` +
        code.trimEnd() +
        `\n// Auto-generated harness\nclass Main {\n` +
        `  public static void main(String[] args) throws Exception {\n` +
        `    // For full control, add public static void main() to your solution\n` +
        `    System.out.println(new Solution().${methodName}());\n` +
        `  }\n}\n`
      );
    }

    case Language.Go: {
      // If code already has func main(), use as-is
      if (/func\s+main\s*\(\s*\)/.test(code)) return code;
      return code;
    }

    case Language.Rust: {
      // If code already has fn main(), use as-is
      if (/fn\s+main\s*\(\s*\)/.test(code)) return code;
      return code;
    }

    default:
      return code;
  }
}

// ── Single submission ─────────────────────────────────────────────────────────

export async function submitCode(
  code: string,
  languageId: Language,
  stdin: string = ''
): Promise<string> {
  const wrappedCode = wrapCode(code, languageId);
  const response = await fetch(
    `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=false`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        language_id: languageId,
        source_code: base64Encode(wrappedCode),
        stdin: base64Encode(stdin),
        cpu_time_limit: 2,
        memory_limit: 256000,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Judge0 submit failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}

export async function getResult(token: string): Promise<ExecutionResult> {
  const response = await fetch(
    `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true`,
    {
      method: 'GET',
      headers: buildHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Judge0 result fetch failed: ${response.status}`);
  }

  const data = await response.json() as {
    status: { id: number; description: string };
    stdout?: string;
    stderr?: string;
    compile_output?: string;
    message?: string;
    time?: string;
    memory?: number;
  };

  const submissionStatus =
    JUDGE0_STATUS_MAP[data.status.id] ?? SubmissionStatus.RuntimeError;

  return {
    token,
    status: data.status,
    stdout: data.stdout ? base64Decode(data.stdout) : undefined,
    stderr: data.stderr ? base64Decode(data.stderr) : undefined,
    compileOutput: data.compile_output ? base64Decode(data.compile_output) : undefined,
    message: data.message,
    timeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : undefined,
    memoryKb: data.memory,
    submissionStatus,
  };
}

export async function submitAndWait(
  code: string,
  languageId: Language,
  stdin: string = '',
  maxAttempts = 20,
  pollIntervalMs = 500
): Promise<ExecutionResult> {
  const token = await submitCode(code, languageId, stdin);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const result = await getResult(token);
    if (result.status.id > 2) {
      return result;
    }
  }

  return {
    token,
    status: { id: 5, description: 'Time Limit Exceeded' },
    submissionStatus: SubmissionStatus.TimeLimitExceeded,
  };
}

// ── Batch submission ──────────────────────────────────────────────────────────

interface BatchSubmission {
  language_id: number;
  source_code: string;
  stdin: string;
  cpu_time_limit: number;
  memory_limit: number;
}

export async function submitBatch(submissions: BatchSubmission[]): Promise<string[]> {
  const response = await fetch(
    `${JUDGE0_API_URL}/submissions/batch?base64_encoded=true&wait=false`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ submissions }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Judge0 batch submit failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as Array<{ token: string }>;
  return data.map((d) => d.token);
}

export async function getBatchResults(tokens: string[]): Promise<ExecutionResult[]> {
  const tokenStr = tokens.join(',');
  const response = await fetch(
    `${JUDGE0_API_URL}/submissions/batch?tokens=${tokenStr}&base64_encoded=true`,
    {
      method: 'GET',
      headers: buildHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Judge0 batch result fetch failed: ${response.status}`);
  }

  const data = await response.json() as {
    submissions: Array<{
      token: string;
      status: { id: number; description: string };
      stdout?: string;
      stderr?: string;
      compile_output?: string;
      message?: string;
      time?: string;
      memory?: number;
    }>;
  };

  return data.submissions.map((sub) => ({
    token: sub.token,
    status: sub.status,
    stdout: sub.stdout ? base64Decode(sub.stdout) : undefined,
    stderr: sub.stderr ? base64Decode(sub.stderr) : undefined,
    compileOutput: sub.compile_output ? base64Decode(sub.compile_output) : undefined,
    message: sub.message,
    timeMs: sub.time ? Math.round(parseFloat(sub.time) * 1000) : undefined,
    memoryKb: sub.memory,
    submissionStatus: JUDGE0_STATUS_MAP[sub.status.id] ?? SubmissionStatus.RuntimeError,
  }));
}

export interface TestCaseInput {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface TestCaseResult {
  passed: boolean;
  verdict: 'accepted' | 'wrong_answer' | 'runtime_error' | 'compile_error' | 'time_limit_exceeded' | 'memory_limit_exceeded';
  timeMs: number | null;
  memoryKb: number | null;
  actual: string;
  expected: string;
  error?: string;
  isHidden?: boolean;
}

/**
 * Submit all test cases at once via batch API and poll until all finish.
 * Returns per-test verdict with normalized output comparison.
 *
 * If the first result has a compile error (status 6), the same error is
 * propagated to all test cases immediately — no need for a separate pre-check.
 */
export async function submitBatchAndWait(
  code: string,
  languageId: Language,
  testCases: TestCaseInput[],
  maxPollAttempts = 30,
  pollIntervalMs = 800
): Promise<TestCaseResult[]> {
  if (testCases.length === 0) return [];

  const wrappedCode = wrapCode(code, languageId);
  const encoded = base64Encode(wrappedCode);

  const submissions: BatchSubmission[] = testCases.map((tc) => ({
    language_id: languageId,
    source_code: encoded,
    stdin: base64Encode(tc.input),
    cpu_time_limit: 2,
    memory_limit: 256000,
  }));

  const tokens = await submitBatch(submissions);

  // Poll until all submissions are done (status.id > 2 means finished)
  let results: ExecutionResult[] = [];
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    results = await getBatchResults(tokens);

    // Fast-path: if first result has compile error, all will — stop polling
    if (results[0]?.status.id === 6) break;

    const allDone = results.every((r) => r.status.id > 2);
    if (allDone) break;
  }

  const mapResult = (result: ExecutionResult, tc: TestCaseInput): TestCaseResult => {
    const statusId = result.status.id;
    const actual = result.stdout ?? '';
    const expected = tc.expectedOutput;

    let verdict: TestCaseResult['verdict'];
    let passed = false;

    if (statusId === 6) {
      verdict = 'compile_error';
    } else if (statusId === 5) {
      verdict = 'time_limit_exceeded';
    } else if (statusId === 14) {
      verdict = 'memory_limit_exceeded';
    } else if (statusId >= 7 && statusId <= 13) {
      verdict = 'runtime_error';
    } else if (statusId === 3) {
      if (outputsMatch(actual, expected)) {
        verdict = 'accepted';
        passed = true;
      } else {
        verdict = 'wrong_answer';
      }
    } else {
      // Still in queue after max polls — treat as TLE
      verdict = 'time_limit_exceeded';
    }

    return {
      passed,
      verdict,
      timeMs: result.timeMs ?? null,
      memoryKb: result.memoryKb ?? null,
      actual: normalizeOutput(actual),
      expected: normalizeOutput(expected),
      error: result.stderr ?? result.compileOutput ?? undefined,
      isHidden: tc.isHidden,
    };
  };

  // If first result has compile error, propagate to all without waiting
  if (results[0]?.status.id === 6) {
    const compileErr: TestCaseResult = mapResult(results[0], testCases[0]);
    return testCases.map((tc, i) =>
      i === 0
        ? compileErr
        : {
            ...compileErr,
            expected: normalizeOutput(tc.expectedOutput),
            isHidden: tc.isHidden,
            error: compileErr.error ?? 'Compile error (not run)',
          }
    );
  }

  return results.map((result, i) => mapResult(result, testCases[i]));
}
