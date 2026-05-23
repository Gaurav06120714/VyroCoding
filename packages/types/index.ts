// ─── Enums ────────────────────────────────────────────────────────────────────

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export enum SubmissionStatus {
  Pending = 'pending',
  Processing = 'processing',
  Accepted = 'accepted',
  WrongAnswer = 'wrong_answer',
  TimeLimitExceeded = 'time_limit_exceeded',
  MemoryLimitExceeded = 'memory_limit_exceeded',
  RuntimeError = 'runtime_error',
  CompileError = 'compile_error',
}

export enum RoomStatus {
  Waiting = 'waiting',
  Active = 'active',
  Ended = 'ended',
}

export enum ContestStatus {
  Upcoming = 'upcoming',
  Active = 'active',
  Ended = 'ended',
}

export enum Language {
  JavaScript = 93,
  Python = 71,
  Cpp = 54,
  Java = 62,
  TypeScript = 74,
  Go = 95,
  Rust = 73,
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  [Language.JavaScript]: 'JavaScript',
  [Language.Python]: 'Python 3',
  [Language.Cpp]: 'C++',
  [Language.Java]: 'Java',
  [Language.TypeScript]: 'TypeScript',
  [Language.Go]: 'Go',
  [Language.Rust]: 'Rust',
};

export const LANGUAGE_MONACO_MAP: Record<Language, string> = {
  [Language.JavaScript]: 'javascript',
  [Language.Python]: 'python',
  [Language.Cpp]: 'cpp',
  [Language.Java]: 'java',
  [Language.TypeScript]: 'typescript',
  [Language.Go]: 'go',
  [Language.Rust]: 'rust',
};

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  rating: number;
  problemsSolved: number;
  createdAt: string;
}

export interface UserWithToken extends User {
  token: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface StarterCode {
  [languageId: number]: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  examples: Example[];
  constraints: string[];
  starterCode: StarterCode;
  testCases: TestCase[];
  tags: string[];
  acceptanceRate?: number;
  createdAt: string;
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  roomId?: string;
  languageId: Language;
  code: string;
  status: SubmissionStatus;
  stdout?: string;
  stderr?: string;
  timeMs?: number;
  memoryKb?: number;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  host?: Pick<User, 'id' | 'username'>;
  problemId?: string;
  problem?: Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty'>;
  isPublic: boolean;
  maxParticipants: number;
  status: RoomStatus;
  participantCount?: number;
  createdAt: string;
}

export interface RoomParticipant {
  roomId: string;
  userId: string;
  user?: Pick<User, 'id' | 'username'>;
  joinedAt: string;
  languageId?: Language;
}

export interface Contest {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: ContestStatus;
  problems?: ContestProblem[];
  participantCount?: number;
  createdAt: string;
}

export interface ContestProblem {
  contestId: string;
  problemId: string;
  problem?: Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty'>;
  points: number;
  orderIndex: number;
}

export interface ContestSubmission {
  id: string;
  contestId: string;
  userId: string;
  problemId: string;
  score: number;
  submittedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  problemsSolved: number;
  score?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface ExecutionResult {
  token: string;
  status: {
    id: number;
    description: string;
  };
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  message?: string;
  timeMs?: number;
  memoryKb?: number;
  submissionStatus: SubmissionStatus;
}

// ─── API Request / Response shapes ────────────────────────────────────────────

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateRoomRequest {
  name: string;
  problemId?: string;
  isPublic?: boolean;
  maxParticipants?: number;
}

export interface ExecuteRequest {
  code: string;
  languageId: Language;
  problemId?: string;
  stdin?: string;
}

export interface SubmitRequest {
  code: string;
  languageId: Language;
  problemId: string;
  roomId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── WebSocket message types ───────────────────────────────────────────────────

export type WsMessageType =
  | 'chat:message'
  | 'chat:history'
  | 'room:user_joined'
  | 'room:user_left'
  | 'room:users'
  | 'code:run_result'
  | 'ping'
  | 'pong';

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
}
