/**
 * Execution dispatcher.
 *
 * Routes code execution to the right backend by language:
 *   - VyroLang  -> native VyroVM (vyro.service)
 *   - everything else -> Judge0 (judge0.service)
 *
 * Exposes the same `submitAndWait` / `submitBatchAndWait` surface the worker and
 * routes already use, so wiring in VyroLang is a one-line import swap.
 */
import { Language } from '@vyro/types';
import type { ExecutionResult } from '@vyro/types';

import * as judge0 from './judge0.service.js';
import * as vyro from './vyro.service.js';
import type { TestCaseInput, TestCaseResult } from './judge0.service.js';

export type { TestCaseInput, TestCaseResult } from './judge0.service.js';

export async function submitAndWait(
  code: string,
  languageId: Language,
  stdin = '',
  maxAttempts = 20,
  pollIntervalMs = 500,
): Promise<ExecutionResult> {
  if (languageId === Language.Vyro) {
    return vyro.submitAndWait(code, stdin);
  }
  return judge0.submitAndWait(code, languageId, stdin, maxAttempts, pollIntervalMs);
}

export async function submitBatchAndWait(
  code: string,
  languageId: Language,
  testCases: TestCaseInput[],
  maxPollAttempts = 30,
  pollIntervalMs = 800,
): Promise<TestCaseResult[]> {
  if (languageId === Language.Vyro) {
    return vyro.submitBatchAndWait(code, testCases);
  }
  return judge0.submitBatchAndWait(code, languageId, testCases, maxPollAttempts, pollIntervalMs);
}
