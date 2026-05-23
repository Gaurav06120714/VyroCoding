'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Play, Send, ChevronDown, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Language, LANGUAGE_NAMES, type Problem, type ExecutionResult } from '@vyro/types';
import { problemsApi, executeApi, submissionsApi, type ProblemSubmission } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { ProblemStatement } from '@/components/problems/ProblemStatement';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { OutputPanel } from '@/components/editor/OutputPanel';

const LANGUAGES = Object.entries(LANGUAGE_NAMES).map(([id, name]) => ({
  id: parseInt(id) as Language,
  name,
}));

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProblemPage() {
  const { slug } = useParams<{ slug: string }>();
  const [problem, setProblem]                         = useState<Problem | null>(null);
  const [loading, setLoading]                         = useState(true);
  const [code, setCode]                               = useState('');
  const [language, setLanguage]                       = useState<Language>(Language.JavaScript);
  const [isRunning, setIsRunning]                     = useState(false);
  const [result, setResult]                           = useState<ExecutionResult | null>(null);
  const [showLangMenu, setShowLangMenu]               = useState(false);
  const [activeTab, setActiveTab]                     = useState<'statement' | 'output' | 'submissions'>('statement');
  const [submissions, setSubmissions]                 = useState<ProblemSubmission[]>([]);
  const [subsLoading, setSubsLoading]                 = useState(false);
  const [subsLoaded, setSubsLoaded]                   = useState(false);

  useEffect(() => {
    problemsApi.get(slug).then((res) => {
      setProblem(res.data);
      setCode(res.data.starterCode[language] ?? '');
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (problem) setCode(problem.starterCode[language] ?? '');
  }, [language, problem]);

  const loadSubmissions = useCallback(async () => {
    if (subsLoaded || subsLoading) return;
    setSubsLoading(true);
    try {
      const res = await submissionsApi.forProblem(slug);
      setSubmissions(res.data);
      setSubsLoaded(true);
    } catch {
      // Not authenticated or no submissions — ok
      setSubsLoaded(true);
    } finally {
      setSubsLoading(false);
    }
  }, [slug, subsLoaded, subsLoading]);

  const handleTabChange = useCallback((tab: 'statement' | 'output' | 'submissions') => {
    setActiveTab(tab);
    if (tab === 'submissions') loadSubmissions();
  }, [loadSubmissions]);

  const handleRun = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setActiveTab('output');
    try {
      const res = await executeApi.run({
        code,
        languageId: language,
        stdin: problem.testCases[0]?.input ?? '',
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setActiveTab('output');
    try {
      const { data } = await executeApi.submit({
        code,
        languageId: language,
        problemId: problem.id,
      });
      const poll = async (id: string, attempts = 0): Promise<void> => {
        if (attempts > 20) return;
        await new Promise((r) => setTimeout(r, 500));
        const subRes = await executeApi.getSubmission(id);
        if (subRes.data.status === 'processing' || subRes.data.status === 'pending') {
          return poll(id, attempts + 1);
        }
        setResult({
          token: id,
          status: { id: 0, description: subRes.data.status },
          stdout: subRes.data.stdout ?? undefined,
          stderr: subRes.data.stderr ?? undefined,
          timeMs: subRes.data.timeMs ?? undefined,
          memoryKb: subRes.data.memoryKb ?? undefined,
          submissionStatus: subRes.data.status as ExecutionResult['submissionStatus'],
        });
        // Refresh submissions list
        setSubsLoaded(false);
      };
      await poll(data.submissionId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas">
        <Loader2 className="w-6 h-6 animate-spin text-ink-subtle" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas">
        <p className="text-sm text-ink-subtle">Problem not found.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-canvas overflow-hidden">

      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="h-12 bg-surface2 border-b border-hairline flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-ink truncate max-w-xs">{problem.title}</h1>
          <Badge variant={problem.difficulty as 'easy' | 'medium' | 'hard'}>
            {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 bg-surface1 border border-hairline text-ink text-sm rounded-md px-3 py-1.5 hover:border-hairline-strong transition-colors"
            >
              {LANGUAGE_NAMES[language]}
              <ChevronDown className="w-3 h-3 text-ink-tertiary" />
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface1 border border-hairline rounded-lg py-1 z-50">
                {LANGUAGES.map(({ id, name }) => (
                  <button
                    key={id}
                    onClick={() => { setLanguage(id); setShowLangMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface2 ${language === id ? 'text-primary-hover' : 'text-ink-muted'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 bg-surface1 border border-hairline text-ink-muted text-sm rounded-md px-3 py-1.5 hover:text-ink hover:border-hairline-strong transition-colors disabled:opacity-40"
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-easy" />}
            Run
          </button>

          <button
            onClick={handleSubmit}
            disabled={isRunning}
            className="flex items-center gap-1.5 bg-primary text-white text-sm rounded-md px-3 py-1.5 hover:bg-primary-hover transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            Submit
          </button>
        </div>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — problem statement 40% */}
        <div className="w-[40%] bg-surface1 border-r border-hairline flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-hairline shrink-0">
            {(['statement', 'submissions', 'output'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'text-ink border-primary'
                    : 'text-ink-subtle border-transparent hover:text-ink-muted'
                }`}
              >
                {tab === 'statement' ? 'Description' : tab === 'submissions' ? 'Submissions' : 'Output'}
              </button>
            ))}

            {/* Result status badge in tab bar */}
            {result && activeTab === 'output' && (
              <div className="ml-auto flex items-center px-3">
                <Badge variant={result.submissionStatus === 'accepted' ? 'ai-done' : 'ai-thinking'}>
                  {result.submissionStatus === 'accepted' ? 'Accepted' : result.status.description}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'statement' ? (
              <ProblemStatement problem={problem} />
            ) : activeTab === 'submissions' ? (
              <div className="h-full overflow-y-auto">
                {subsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-5 h-5 animate-spin text-ink-subtle" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-xs text-ink-tertiary">No submissions yet. Submit your solution above.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-surface1">
                      <tr className="border-b border-hairline">
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-ink-subtle px-4 py-2.5">Status</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-ink-subtle px-4 py-2.5">Language</th>
                        <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-ink-subtle px-4 py-2.5">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => {
                        const accepted = sub.status === 'accepted';
                        return (
                          <tr
                            key={sub.id}
                            className="border-b border-hairline last:border-b-0 hover:bg-surface2 transition-colors cursor-pointer"
                            onClick={() => setCode(sub.code)}
                            title="Click to load this code into editor"
                          >
                            <td className="px-4 py-2.5">
                              <span className={`flex items-center gap-1.5 text-xs font-medium ${accepted ? 'text-easy' : 'text-hard'}`}>
                                {accepted ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {accepted ? 'Accepted' : sub.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-ink-subtle">
                              {LANGUAGE_NAMES[sub.languageId as Language] ?? `Lang ${sub.languageId}`}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-ink-tertiary">
                              {timeAgo(sub.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="h-full p-4">
                <OutputPanel result={result} isRunning={isRunning} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — editor 60% */}
        <div className="flex-1 overflow-hidden bg-canvas">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
