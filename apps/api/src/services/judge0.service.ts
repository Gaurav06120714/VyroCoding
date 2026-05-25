import { ExecutionResult, Language, SubmissionStatus } from '@vyro/types';
import dotenv from 'dotenv';

dotenv.config();

const JUDGE0_API_URL = process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY ?? '';

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
  // Only add RapidAPI headers if using the RapidAPI endpoint
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

/**
 * Wraps user code with a stdin→function→stdout harness.
 * The test case input is always a JSON array of arguments.
 * We extract the function name from the first line and call it.
 */
function wrapCode(code: string, languageId: Language): string {
  if (languageId === Language.JavaScript || languageId === Language.TypeScript) {
    // Extract function name: "function myFunc(" → "myFunc"
    const match = code.match(/function\s+(\w+)\s*\(/);
    if (!match) return code; // can't wrap, return as-is
    const fnName = match[1];
    return (
      code.trimEnd() +
      `\n\nconst __a=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8').trim());` +
      `\nconsole.log(JSON.stringify(${fnName}(...(Array.isArray(__a)?__a:[__a]))));`
    );
  }
  // Python/others already have wrapper in starter code or handle stdin themselves
  return code;
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString('utf-8');
}

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
        memory_limit: 128000,
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
      // Status > 2 means finished (3=Accepted, 4=WA, etc.)
      return result;
    }
  }

  return {
    token,
    status: { id: 5, description: 'Time Limit Exceeded' },
    submissionStatus: SubmissionStatus.TimeLimitExceeded,
  };
}
