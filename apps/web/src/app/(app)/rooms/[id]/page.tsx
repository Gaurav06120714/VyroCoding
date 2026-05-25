'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Play, Send, ChevronDown, Loader2 } from 'lucide-react';
import { Language, LANGUAGE_NAMES, type Problem, type ExecutionResult, type ChatMessage } from '@vyro/types';
import { roomsApi, executeApi, roomsApi2, executeApiExt, type TestCaseResult } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRoomStore } from '@/store/room.store';
import { useToastStore } from '@/store/toast.store';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useRoomWebSocket } from '@/hooks/useRoomWebSocket';
import { ProblemStatement } from '@/components/problems/ProblemStatement';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { RoomChat } from '@/components/room/RoomChat';
import { RoomUsers } from '@/components/room/RoomUsers';
import { RoomHeader } from '@/components/room/RoomHeader';
import { RoomScoreboard } from '@/components/room/RoomScoreboard';
import { PresenceBar } from '@/components/room/PresenceBar';
import { LiveCursors } from '@/components/room/LiveCursors';
import { ExecutionFeed } from '@/components/room/ExecutionFeed';
import { ReactionOverlay } from '@/components/room/ReactionOverlay';

const LANGUAGES = Object.entries(LANGUAGE_NAMES).map(([id, name]) => ({
  id: parseInt(id) as Language,
  name,
}));

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'bg-[#27a644]',
  medium: 'bg-[#f5a623]',
  hard:   'bg-[#cf2d56]',
};

// Deterministic color from userId
const CURSOR_COLORS = ['#828fff','#4ade80','#f59e0b','#f472b6','#22d3ee','#a78bfa','#fb923c','#34d399'];
function userColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length];
}

interface RoomProblem {
  id: string; slug: string; title: string; difficulty: string; sort_order?: number;
}
interface ScoreboardEntry {
  id: string; status: string; time_ms: number | null; language_id: number;
  created_at: string; username: string; user_id: string;
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
  const [timerEndTime, setTimerEndTime]         = useState<string | null>(null);
  const [lastSubmission, setLastSubmission]     = useState<ScoreboardEntry | null>(null);
  const [editorHeight, setEditorHeight]         = useState(400);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const myColor = user ? userColor(user.id) : '#828fff';

  // ── Phase 2: WebSocket hook ───────────────────────────────────────────────
  const {
    wsStatus,
    wsRef,
    remoteCursors,
    presenceUsers,
    executionFeed,
    reactions,
    sendCode,
    sendCursor,
    sendTyping,
    sendChat,
    sendReaction,
    sendLanguageChange,
  } = useRoomWebSocket({
    roomId: id,
    userId: user?.id ?? '',
    username: user?.username ?? 'Guest',
    color: myColor,
    language,
    onCodeUpdate: (newCode) => setCode(newCode),
    onProblemChanged: (slug, problemId, title) => {
      loadProblem(slug);
      setActiveProblemId(problemId);
      addToast({ message: `Problem changed${title ? ` to ${title}` : ''}`, type: 'info', icon: '📋' });
    },
    onChatMessage: (msg) => addMessage(msg),
    onTimerStart: (endTime) => {
      setTimerEndTime(endTime);
      addToast({ message: 'Timer started!', type: 'info', icon: '⏱' });
    },
    onSubmissionResult: ({ userId: uid, username: uname, status, problemTitle, timeMs, languageId }) => {
      if (status === 'accepted') {
        addToast({
          message: `${uname} solved ${problemTitle ?? 'the problem'}!`,
          type: 'success',
          icon: '🎉',
        });
        setLastSubmission({
          id: `${Date.now()}-${Math.random()}`,
          status: 'accepted',
          time_ms: timeMs ?? null,
          language_id: languageId ?? 0,
          created_at: new Date().toISOString(),
          username: uname,
          user_id: uid,
        });
      }
    },
  });

  // ── Voice chat (uses upgraded wsRef from hook) ────────────────────────────
  const {
    inVoice, micMuted, participants: voiceParticipants, micError,
    joinVoice, leaveVoice, toggleMute,
  } = useVoiceChat(id, user?.id ?? '', user?.username ?? '', wsRef.current);

  // ── Load problem ──────────────────────────────────────────────────────────
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

  // ── Initial room load ─────────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Sync language change ──────────────────────────────────────────────────
  useEffect(() => {
    if (problem) setCode(problem.starterCode[language] ?? '');
  }, [language, problem]);

  // ── Measure editor container for cursor overlay ───────────────────────────
  useEffect(() => {
    if (!editorContainerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setEditorHeight(entry.contentRect.height);
    });
    observer.observe(editorContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Code change: sync + send cursor + typing indicator ───────────────────
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    sendCode(newCode);
    sendTyping(true);
    // Clear typing indicator after 1s of inactivity
    clearTimeout((handleCodeChange as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleCodeChange as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => sendTyping(false), 1000
    );
  }, [sendCode, sendTyping]);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    setShowLangMenu(false);
    sendLanguageChange(lang);
  }, [sendLanguageChange]);

  const handleSelectProblem = useCallback(async (p: RoomProblem) => {
    await loadProblem(p.slug);
    setActiveProblemId(p.id);
    setBottomTab('problem');
    if (room && user && room.hostId === user.id) {
      try { await roomsApi2.setActiveProblem(id, p.id); }
      catch (e) { console.error('Failed to set active problem', e); }
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
    sendChat(content);
    addMessage(msg);
  }, [id, user, sendChat, addMessage]);

  const handleRun = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setTestResults(null);
    setResult(null);
    setBottomTab('output');
    try {
      const res = await executeApiExt.runAll({ code, languageId: language, problemId: problem.id });
      setTestResults(res.data);
    } catch {
      try {
        const res = await executeApi.run({ code, languageId: language, stdin: problem.testCases[0]?.input ?? '' });
        setResult(res.data);
      } catch (err) { console.error(err); }
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setBottomTab('output');
    try {
      const { data } = await executeApi.submit({ code, languageId: language, problemId: problem.id, roomId: id });
      const poll = async (subId: string, attempts = 0): Promise<void> => {
        if (attempts > 30) return;
        await new Promise((r) => setTimeout(r, 600));
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

        if (subRes.data.status === 'accepted' && user) {
          // Backend broadcast handles room notification via BullMQ queue
          addToast({ message: `You solved ${problem.title}!`, type: 'success', icon: '🎉' });
        }
      };
      await poll(data.submissionId);
    } catch (err) { console.error(err); }
    finally { setIsRunning(false); }
  }, [code, language, problem, id, user, addToast]);

  const handleTimerEnd = useCallback(async () => {
    addToast({ message: "Time's Up!", type: 'error', icon: '⏰' });
    if (room && user && room.hostId === user.id) {
      try { await roomsApi2.setStatus(id, 'ended'); }
      catch (e) { console.error(e); }
    }
  }, [id, room, user, addToast]);

  // ── Loading / not found ───────────────────────────────────────────────────
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

        {/* LEFT — problem list + problem description (30%) */}
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
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary-hover shrink-0" />}
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
              <div className="h-full">
                <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
              </div>
            )}
          </div>
        </div>

        {/* CENTER — editor (50%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor toolbar */}
          <div className="h-10 bg-[#161b22] border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0">
            {/* Left: language selector + presence */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-1.5 bg-[#0d1117] border border-white/[0.08] text-white/80 text-xs rounded-md px-2.5 py-1.5 hover:border-white/20 transition-colors"
                >
                  {LANGUAGE_NAMES[language]}
                  <ChevronDown className="w-3 h-3 text-white/30" />
                </button>
                {showLangMenu && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-[#161b22] border border-white/[0.08] rounded-lg py-1 z-50 shadow-xl">
                    {LANGUAGES.map(({ id: lid, name }) => (
                      <button
                        key={lid}
                        onClick={() => handleLanguageChange(lid)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 ${language === lid ? 'text-[#828fff]' : 'text-white/60'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Presence bar */}
              <PresenceBar
                users={presenceUsers}
                currentUserId={user?.id ?? ''}
                currentUsername={user?.username ?? ''}
                currentColor={myColor}
                wsStatus={wsStatus}
              />
            </div>

            {/* Right: reaction + run/submit */}
            <div className="flex items-center gap-2 shrink-0">
              <ReactionOverlay reactions={reactions} onSendReaction={sendReaction} />
              <button
                onClick={handleRun}
                disabled={isRunning || !problem}
                className="flex items-center gap-1.5 text-xs bg-[#0d1117] border border-white/[0.08] text-white/60 px-3 py-1 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 text-[#27a644]" />}
                Run
              </button>
              <button
                onClick={handleSubmit}
                disabled={isRunning || !problem}
                className="flex items-center gap-1.5 text-xs bg-[#828fff] text-white px-3 py-1 rounded-md hover:bg-[#9da6ff] transition-colors disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                Submit
              </button>
            </div>
          </div>

          {/* Monaco editor + live cursors overlay */}
          <div ref={editorContainerRef} className="flex-1 overflow-hidden relative">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              language={language}
              height="100%"
              onCursorChange={sendCursor}
            />
            <LiveCursors cursors={remoteCursors} editorHeight={editorHeight} />
            <ExecutionFeed items={executionFeed} currentUserId={user?.id ?? ''} />
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
