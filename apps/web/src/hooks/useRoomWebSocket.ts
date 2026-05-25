'use client';

/**
 * useRoomWebSocket — Phase 2 comprehensive WebSocket hook.
 * Handles: code-sync, cursor positions, typing, presence, chat,
 * execution streaming, submission results, voice signaling, reactions.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage } from '@vyro/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  line: number;
  column: number;
}

export interface PresenceUser {
  userId: string;
  username: string;
  color: string;
  language: number;
  isTyping: boolean;
  lastSeen: number;
}

export interface ExecutionFeedItem {
  id: string;
  type: 'start' | 'complete';
  submissionId: string;
  userId: string;
  username: string;
  status?: string;
  testsPassed?: number;
  testsTotal?: number;
  timeMs?: number;
  timestamp: number;
}

export interface RoomReaction {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

export type RoomMode = 'practice' | 'contest' | 'pair';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseRoomWebSocketOptions {
  roomId: string;
  userId: string;
  username: string;
  color?: string;
  language?: number;
  onCodeUpdate?: (code: string, userId: string) => void;
  onProblemChanged?: (slug: string, problemId: string, title?: string) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onTimerStart?: (endTime: string) => void;
  onModeChange?: (mode: RoomMode) => void;
  onSubmissionResult?: (entry: {
    userId: string; username: string; status: string;
    problemId: string; problemTitle?: string;
    timeMs?: number; languageId?: number;
  }) => void;
}

export interface UseRoomWebSocketReturn {
  wsStatus: WsStatus;
  wsRef: React.MutableRefObject<WebSocket | null>;
  remoteCursors: Map<string, RemoteCursor>;
  presenceUsers: PresenceUser[];
  executionFeed: ExecutionFeedItem[];
  reactions: RoomReaction[];
  sendCode: (code: string) => void;
  sendCursor: (line: number, column: number) => void;
  sendTyping: (isTyping: boolean) => void;
  sendChat: (content: string) => void;
  sendReaction: (emoji: string) => void;
  sendLanguageChange: (languageId: number) => void;
  clearReaction: (id: string) => void;
  clearFeedItem: (id: string) => void;
}

// ── Color palette for cursors ─────────────────────────────────────────────────

const CURSOR_COLORS = [
  '#828fff', '#4ade80', '#f59e0b', '#f472b6',
  '#22d3ee', '#a78bfa', '#fb923c', '#34d399',
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRoomWebSocket(opts: UseRoomWebSocketOptions): UseRoomWebSocketReturn {
  const {
    roomId, userId, username, color, language = 93,
    onCodeUpdate, onProblemChanged, onChatMessage,
    onPresenceUpdate, onTimerStart, onModeChange, onSubmissionResult,
  } = opts;

  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeDebounce    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount  = useRef(0);
  const isMounted       = useRef(true);

  const [wsStatus, setWsStatus]           = useState<WsStatus>('connecting');
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [executionFeed, setExecutionFeed] = useState<ExecutionFeedItem[]>([]);
  const [reactions, setReactions]         = useState<RoomReaction[]>([]);

  const myColor = color ?? getUserColor(userId);

  // ── Send helper ───────────────────────────────────────────────────────────
  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── Public senders ────────────────────────────────────────────────────────
  const sendCode = useCallback((code: string) => {
    if (codeDebounce.current) clearTimeout(codeDebounce.current);
    codeDebounce.current = setTimeout(() => {
      send({ type: 'code-update', code, userId, username });
    }, 250);
  }, [send, userId, username]);

  const sendCursor = useCallback((line: number, column: number) => {
    send({ type: 'cursor-update', userId, username, color: myColor, line, column });
  }, [send, userId, username, myColor]);

  const sendTyping = useCallback((isTyping: boolean) => {
    send({ type: 'typing', userId, username, isTyping });
  }, [send, userId, username]);

  const sendChat = useCallback((content: string) => {
    send({
      type: 'chat',
      id: `${Date.now()}-${Math.random()}`,
      roomId,
      userId,
      username,
      content,
      createdAt: new Date().toISOString(),
    });
  }, [send, roomId, userId, username]);

  const sendReaction = useCallback((emoji: string) => {
    send({ type: 'reaction', userId, username, emoji });
  }, [send, userId, username]);

  const sendLanguageChange = useCallback((languageId: number) => {
    send({ type: 'language-change', userId, username, languageId });
  }, [send, userId, username]);

  const clearReaction = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearFeedItem = useCallback((id: string) => {
    setExecutionFeed((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── Message handler ───────────────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(event.data as string); }
    catch { return; }

    switch (msg.type) {
      case 'code-update': {
        if (msg.userId !== userId) {
          onCodeUpdate?.(msg.code as string, msg.userId as string);
        }
        break;
      }
      case 'cursor-update': {
        if (msg.userId !== userId) {
          setRemoteCursors((prev) => {
            const next = new Map(prev);
            next.set(msg.userId as string, {
              userId: msg.userId as string,
              username: msg.username as string,
              color: (msg.color as string) ?? getUserColor(msg.userId as string),
              line: msg.line as number,
              column: msg.column as number,
            });
            return next;
          });
        }
        break;
      }
      case 'typing': {
        const typingUserId = msg.userId as string;
        if (typingUserId !== userId) {
          setPresenceUsers((prev) =>
            prev.map((u) =>
              u.userId === typingUserId ? { ...u, isTyping: msg.isTyping as boolean } : u
            )
          );
        }
        break;
      }
      case 'presence-sync': {
        const users = msg.users as PresenceUser[];
        setPresenceUsers(users.filter((u) => u.userId !== userId));
        onPresenceUpdate?.(users);
        break;
      }
      case 'user-joined': {
        const newUser: PresenceUser = {
          userId: msg.userId as string,
          username: msg.username as string,
          color: (msg.color as string) ?? getUserColor(msg.userId as string),
          language: (msg.language as number) ?? language,
          isTyping: false,
          lastSeen: Date.now(),
        };
        if (newUser.userId !== userId) {
          setPresenceUsers((prev) => {
            const without = prev.filter((u) => u.userId !== newUser.userId);
            return [...without, newUser];
          });
        }
        break;
      }
      case 'user-left': {
        const leftId = msg.userId as string;
        setPresenceUsers((prev) => prev.filter((u) => u.userId !== leftId));
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.delete(leftId);
          return next;
        });
        break;
      }
      case 'language-change': {
        if (msg.userId !== userId) {
          setPresenceUsers((prev) =>
            prev.map((u) =>
              u.userId === msg.userId ? { ...u, language: msg.languageId as number } : u
            )
          );
        }
        break;
      }
      case 'chat': {
        onChatMessage?.({
          id: (msg.id as string) ?? `${Date.now()}-${Math.random()}`,
          roomId: roomId,
          userId: msg.userId as string,
          username: msg.username as string,
          content: msg.content as string,
          createdAt: (msg.createdAt as string) ?? new Date().toISOString(),
        });
        break;
      }
      case 'problem-changed': {
        onProblemChanged?.(msg.slug as string, msg.problemId as string, msg.title as string | undefined);
        break;
      }
      case 'execution-start': {
        const feedItem: ExecutionFeedItem = {
          id: `${msg.submissionId}-start`,
          type: 'start',
          submissionId: msg.submissionId as string,
          userId: msg.userId as string,
          username: msg.username as string,
          timestamp: Date.now(),
        };
        setExecutionFeed((prev) => [feedItem, ...prev].slice(0, 20));
        break;
      }
      case 'execution-complete': {
        const feedItem: ExecutionFeedItem = {
          id: `${msg.submissionId}-complete`,
          type: 'complete',
          submissionId: msg.submissionId as string,
          userId: msg.userId as string,
          username: msg.username as string,
          status: msg.status as string,
          testsPassed: msg.testsPassed as number,
          testsTotal: msg.testsTotal as number,
          timeMs: msg.timeMs as number | undefined,
          timestamp: Date.now(),
        };
        setExecutionFeed((prev) => [feedItem, ...prev.filter((f) => f.id !== `${msg.submissionId}-start`)].slice(0, 20));
        break;
      }
      case 'submission-result': {
        onSubmissionResult?.({
          userId: msg.userId as string,
          username: msg.username as string,
          status: msg.status as string,
          problemId: msg.problemId as string,
          problemTitle: msg.problemTitle as string | undefined,
          timeMs: msg.timeMs as number | undefined,
          languageId: msg.languageId as number | undefined,
        });
        break;
      }
      case 'reaction': {
        const reaction: RoomReaction = {
          id: `${msg.userId}-${Date.now()}`,
          userId: msg.userId as string,
          username: msg.username as string,
          emoji: msg.emoji as string,
          timestamp: Date.now(),
        };
        setReactions((prev) => [...prev, reaction]);
        // Auto-clear after 3s
        setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== reaction.id)), 3000);
        break;
      }
      case 'timer-start': {
        onTimerStart?.(msg.endTime as string);
        break;
      }
      case 'mode-change': {
        onModeChange?.(msg.mode as RoomMode);
        break;
      }
      case 'pong': {
        // heartbeat acknowledged
        break;
      }
    }
  }, [userId, roomId, language, onCodeUpdate, onProblemChanged, onChatMessage, onPresenceUpdate, onTimerStart, onModeChange, onSubmissionResult]);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const BASE_WS = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
      .replace(/^http/, 'ws');
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('vyro_token') ?? '')
      : '';

    const ws = new WebSocket(`${BASE_WS}/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen = () => {
      if (!isMounted.current) return;
      setWsStatus('connected');
      reconnectCount.current = 0;

      // Announce presence
      ws.send(JSON.stringify({
        type: 'presence',
        userId,
        username,
        color: myColor,
        language,
      }));

      // Heartbeat — refresh presence TTL every 10s
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', userId }));
        }
      }, 10_000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (!isMounted.current) return;
      setWsStatus('disconnected');
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);

      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectCount.current, 30_000);
      reconnectCount.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setWsStatus('error');
    };
  }, [roomId, userId, username, myColor, language, handleMessage]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (codeDebounce.current) clearTimeout(codeDebounce.current);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return {
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
    clearReaction,
    clearFeedItem,
  };
}
