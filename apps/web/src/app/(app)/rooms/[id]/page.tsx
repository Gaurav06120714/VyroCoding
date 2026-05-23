'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Play, Send, ChevronDown, Loader2, Eye } from 'lucide-react';
import { Language, LANGUAGE_NAMES, type Problem, type ExecutionResult, type ChatMessage } from '@vyro/types';
import { roomsApi, executeApi, roomsApi2, executeApiExt, type TestCaseResult } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRoomStore } from '@/store/room.store';
import { useToastStore } from '@/store/toast.store';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { ProblemStatement } from '@/components/problems/ProblemStatement';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { RoomChat } from '@/components/room/RoomChat';
import { RoomUsers } from '@/components/room/RoomUsers';
import { RoomHeader } from '@/components/room/RoomHeader';
import { RoomScoreboard } from '@/components/room/RoomScoreboard';

const LANGUAGES = Object.entries(LANGUAGE_NAMES).map(([id, name]) => ({
  id: parseInt(id) as Language,
  name,
}));

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'bg-[#27a644]',
  medium: 'bg-[#f5a623]',
  hard:   'bg-[#cf2d56]',
};

interface RoomProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  sort_order?: number;
}

interface ScoreboardEntry {
  id: string;
  status: string;
  time_ms: number | null;
  language_id: number;
  created_at: string;
  username: string;
  user_id: string;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { room, setRoom, participants, setParticipants, messages, addMessage } = useRoomStore();
  const { addToast } = useToastStore();

  const [problem, setProblem]                   = useState<Problem | null>(null);
  const [roomProblems, setRoomProblems]         = useState<RoomProblem[]>([]);
  const [activeProblemId, setActiveProblemId]   = useState<string | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [code, setCode]                         = useState('');
  const [language, setLanguage]                 = useState<Language>(Language.JavaScript);
  const [isRunning, setIsRunning]               = useState(false);
  const [result, setResult]                     = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults]           = useState<TestCaseResult[] | null>(null);
  const [showLangMenu, setShowLangMenu]         = useState(false);
  const [rightTab, setRightTab]                 = useState<'chat' | 'users' | 'scoreboard'>('chat');
  const [bottomTab, setBottomTab]               = useState<'problems' | 'problem' | 'output'>('problem');
  const [watcherCount, setWatcherCount]         = useState(0);
  const [timerEndTime, setTimerEndTime]         = useState<string | null>(null);
  const [lastSubmission, setLastSubmission]     = useState<ScoreboardEntry | null>(null);

  const wsRef       = useRef<WebSocket | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    inVoice, micMuted, participants: voiceParticipants, micError,
    joinVoice, leaveVoice, toggleMute,
  } = useVoiceChat(id, user?.id ?? '', user?.username ?? '', wsRef.current);

  const loadProblem = useCallback(async (slugOrId: string) => {
    try {
      const { problemsApi } = await import('@/lib/api');
      const pRes = await problemsApi.get(slugOrId);
      setProblem(pRes.data);
      setCode(pRes.data.starterCode[language] ?? '');
      setActiveProblemId(pRes.data.id);
    } catch (e) {
      console.error('Failed to load problem', e);
    }
  }, [language]);

  useEffect(() => {
    roomsApi.get(id).then(async (res) => {
      setRoom(res.data);
      setParticipants(res.data.participants ?? []);

      try {
        const pListRes = await roomsApi.problems(id);
        setRoomProblems(pListRes.data);
      } catch (e) {
        console.error('Failed to load room problems', e);
      }

      if (res.data.problemId) {
        await loadProblem(res.data.problem?.slug ?? res.data.problemId);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => { wsRef.current?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Wire up WebSocket
  useEffect(() => {
    if (!id) return;
    const BASE_WS = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws');
    const token = typeof window !== 'undefined' ? localStorage.getItem('vyro_token') ?? '' : '';
    const ws = new WebSocket(`${BASE_WS}/rooms/${id}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Announce presence for watcher count
      if (user) {
        ws.send(JSON.stringify({ type: 'presence', userId: user.id, username: user.username }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; [k: string]: unknown };

        if (msg.type === 'chat') {
          addMessage({
            id: `${Date.now()}-${Math.random()}`,
            roomId: id,
            userId: msg.userId as string,
            username: msg.username as string,
            content: msg.content as string,
            createdAt: msg.createdAt as string,
          });
        } else if (msg.type === 'problem-changed') {
          const slug = msg.slug as string;
          const title = msg.title as string | undefined;
          loadProblem(slug);
          setActiveProblemId(msg.problemId as string);
          addToast({ message: `Problem changed${title ? ` to ${title}` : ''}`, type: 'info', icon: '📋' });
        } else if (msg.type === 'code-update') {
          // Only apply if from someone else
          if (msg.userId !== user?.id) {
            setCode(msg.code as string);
          }
        } else if (msg.type === 'submission-result') {
          const status = msg.status as string;
          const username = msg.username as string;
          const problemTitle = msg.problemTitle as string | undefined;
          if (status === 'accepted') {
            addToast({
              message: `${username} solved ${problemTitle ?? 'the problem'}!`,
              type: 'success',
              icon: '🎉',
            });
            // Feed to scoreboard
            setLastSubmission({
              id: `${Date.now()}-${Math.random()}`,
              status: 'accepted',
              time_ms: msg.timeMs as number | null,
              language_id: msg.languageId as number,
              created_at: new Date().toISOString(),
              username,
              user_id: msg.userId as string,
            });
          }
        } else if (msg.type === 'timer-start') {
          setTimerEndTime(msg.endTime as string);
          addToast({ message: 'Timer started', type: 'info', icon: '⏱' });
        } else if (msg.type === 'presence') {
          setWatcherCount((c) => c + 1);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => { setWatcherCount(0); };

    return () => { ws.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced code sync
  useEffect(() => {
    if (!user || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      wsRef.current?.send(JSON.stringify({ type: 'code-update', code, userId: user.id }));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (problem) setCode(problem.starterCode[language] ?? '');
  }, [language, problem]);

  const handleSelectProblem = useCallback(async (p: RoomProblem) => {
    await loadProblem(p.slug);
    setActiveProblemId(p.id);
    setBottomTab('problem');

    if (room && user && room.hostId === user.id) {
      try {
        await roomsApi2.setActiveProblem(id, p.id);
      } catch (e) {
        console.error('Failed to set active problem', e);
      }
    }
  }, [id, room, user, loadProblem]);

  const handleSendMessage = useCallback((content: string) => {
    if (!user) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      roomId: id,
      userId: user.id,
      username: user.username,
      content,
      createdAt: new Date().toISOString(),
    };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', ...msg }));
    }
    addMessage(msg);
  }, [id, user, addMessage]);

  // Run against all visible test cases
  const handleRun = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setTestResults(null);
    setResult(null);
    setBottomTab('output');
    try {
      const res = await executeApiExt.runAll({
        code,
        languageId: language,
        problemId: problem.id,
      });
      setTestResults(res.data);
    } catch {
      // Fallback to single run on first test case
      try {
        const res = await executeApi.run({
          code,
          languageId: language,
          stdin: problem.testCases[0]?.input ?? '',
        });
        setResult(res.data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setBottomTab('output');
    try {
      const { data } = await executeApi.submit({
        code,
        languageId: language,
        problemId: problem.id,
        roomId: id,
      });
      const poll = async (subId: string, attempts = 0): Promise<void> => {
        if (attempts > 20) return;
        await new Promise((r) => setTimeout(r, 500));
        const subRes = await executeApi.getSubmission(subId);
        if (subRes.data.status === 'processing' || subRes.data.status === 'pending') {
          return poll(subId, attempts + 1);
        }
        const executionResult: ExecutionResult = {
          token: subId,
          status: { id: 0, description: subRes.data.status },
          stdout: subRes.data.stdout ?? undefined,
          stderr: subRes.data.stderr ?? undefined,
          timeMs: subRes.data.timeMs ?? undefined,
          memoryKb: subRes.data.memoryKb ?? undefined,
          submissionStatus: subRes.data.status as ExecutionResult['submissionStatus'],
        };
        setResult(executionResult);

        // Broadcast submission result to room
        if (subRes.data.status === 'accepted' && wsRef.current?.readyState === WebSocket.OPEN && user) {
          wsRef.current.send(JSON.stringify({
            type: 'submission-result',
            userId: user.id,
            username: user.username,
            status: 'accepted',
            problemId: problem.id,
            problemTitle: problem.title,
            timeMs: subRes.data.timeMs ?? null,
            languageId: language,
          }));
          addToast({ message: `You solved ${problem.title}!`, type: 'success', icon: '🎉' });
        }
      };
      await poll(data.submissionId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem, id, user, addToast]);

  const handleTimerEnd = useCallback(async () => {
    addToast({ message: "Time's Up!", type: 'error', icon: '⏰' });
    if (room && user && room.hostId === user.id) {
      try {
        await roomsApi2.setStatus(id, 'ended');
      } catch (e) {
        console.error('Failed to end room', e);
      }
    }
  }, [id, room, user, addToast]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-ink-subtle">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading room...</span>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas">
        <p className="text-sm text-ink-subtle">Room not found.</p>
      </div>
    );
  }

  const isHost = !!(user && room.hostId === user.id);

  return (
    <div className="h-screen flex flex-col bg-canvas overflow-hidden">
      <RoomHeader
        room={room}
        participantCount={participants.length}
        isHost={isHost}
        inVoice={inVoice}
        micMuted={micMuted}
        micError={micError}
        voiceParticipants={voiceParticipants}
        onJoinVoice={joinVoice}
        onLeaveVoice={leaveVoice}
        onToggleMute={toggleMute}
        timerEndTime={timerEndTime}
        onTimerEnd={handleTimerEnd}
      />

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — problem list + problem + output (30%) */}
        <div className="w-[30%] min-w-[260px] bg-surface1 border-r border-hairline flex flex-col overflow-hidden">
          <div className="flex border-b border-hairline shrink-0">
            {(['problems', 'problem', 'output'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                  bottomTab === tab
                    ? 'text-ink border-primary'
                    : 'text-ink-subtle border-transparent hover:text-ink-muted'
                }`}
              >
                {tab === 'problems' ? `Problems (${roomProblems.length})` : tab === 'problem' ? 'Description' : 'Output'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {bottomTab === 'problems' ? (
              <div className="h-full overflow-y-auto">
                {roomProblems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-ink-tertiary">No problems assigned.</p>
                  </div>
                ) : (
                  <ul className="py-1">
                    {roomProblems.map((p) => {
                      const isActive = p.id === activeProblemId;
                      return (
                        <li key={p.id}>
                          <button
                            onClick={() => handleSelectProblem(p)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                              isActive
                                ? 'bg-[rgba(94,106,210,0.12)] text-ink'
                                : 'text-ink-muted hover:bg-surface2 hover:text-ink'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${DIFFICULTY_COLOR[p.difficulty] ?? 'bg-ink-tertiary'}`} />
                            <span className="flex-1 text-xs truncate">{p.title}</span>
                            <span className={`text-[10px] font-medium shrink-0 ${
                              p.difficulty === 'easy' ? 'text-easy' :
                              p.difficulty === 'medium' ? 'text-medium' : 'text-hard'
                            }`}>
                              {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1, 3)}
                            </span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-hover shrink-0" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {isHost && (
                      <li className="px-3 py-2 border-t border-hairline mt-1">
                        <p className="text-[10px] text-ink-tertiary">Click a problem to broadcast to all participants.</p>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ) : bottomTab === 'problem' ? (
              problem ? (
                <ProblemStatement problem={problem} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-ink-tertiary">No problem assigned.</p>
                </div>
              )
            ) : (
              <div className="h-full p-4">
                <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
              </div>
            )}
          </div>
        </div>

        {/* CENTER — editor (50%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor toolbar */}
          <div className="h-10 bg-surface2 border-b border-hairline flex items-center justify-between px-3 shrink-0">
            {/* Left: language + Live badge */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-1.5 bg-surface1 border border-hairline text-ink text-xs rounded-md px-2.5 py-1.5 hover:border-hairline-strong transition-colors"
                >
                  {LANGUAGE_NAMES[language]}
                  <ChevronDown className="w-3 h-3 text-ink-tertiary" />
                </button>
                {showLangMenu && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-surface1 border border-hairline rounded-lg py-1 z-50">
                    {LANGUAGES.map(({ id: lid, name }) => (
                      <button
                        key={lid}
                        onClick={() => { setLanguage(lid); setShowLangMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface2 ${language === lid ? 'text-primary-hover' : 'text-ink-muted'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Watcher / live indicator */}
              {watcherCount > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-ink-tertiary">
                  <Eye className="w-3 h-3" />
                  <span>{watcherCount} watching</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-easy animate-pulse ml-0.5" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                disabled={isRunning || !problem}
                className="flex items-center gap-1.5 text-xs bg-surface1 border border-hairline text-ink-muted px-3 py-1 rounded-md hover:text-ink hover:border-hairline-strong transition-colors disabled:opacity-40"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 text-easy" />}
                Run
              </button>
              <button
                onClick={handleSubmit}
                disabled={isRunning || !problem}
                className="flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1 rounded-md hover:bg-primary-hover transition-colors disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                Submit
              </button>
            </div>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              height="100%"
            />
          </div>
        </div>

        {/* RIGHT — chat / users / scoreboard (20%) */}
        <div className="w-[20%] min-w-[200px] bg-surface1 border-l border-hairline flex flex-col overflow-hidden">
          <div className="flex border-b border-hairline shrink-0">
            {(['chat', 'users', 'scoreboard'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                  rightTab === tab ? 'text-ink border-primary' : 'text-ink-subtle border-transparent hover:text-ink-muted'
                }`}
              >
                {tab === 'users' ? `Users (${participants.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {rightTab === 'chat' ? (
              <RoomChat messages={messages} onSendMessage={handleSendMessage} />
            ) : rightTab === 'users' ? (
              <RoomUsers participants={participants} hostId={room.hostId} />
            ) : (
              <RoomScoreboard roomId={id} lastSubmissionResult={lastSubmission} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
