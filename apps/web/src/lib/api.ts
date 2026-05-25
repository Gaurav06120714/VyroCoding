const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vyro_token');
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...init } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    );
    url += `?${qs.toString()}`;
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const json = await response.json() as { error?: string; message?: string };
      message = json.error ?? json.message ?? message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { username: string; email: string; password: string }) =>
    request<{ data: { id: string; username: string; email: string; token: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ data: { id: string; username: string; email: string; token: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () =>
    request<{ data: { id: string; username: string; email: string; rating: number; problemsSolved: number } }>('/auth/me'),
};

// ─── Problems ────────────────────────────────────────────────────────────────

export const problemsApi = {
  list: (params?: { difficulty?: string; tag?: string; search?: string; page?: number }) =>
    request<{
      data: {
        items: Array<{
          id: string;
          slug: string;
          title: string;
          difficulty: string;
          tags: string[];
          acceptanceRate: number;
        }>;
        total: number;
        hasMore: boolean;
      };
    }>('/problems', { params: params as Record<string, string | number | boolean> }),
  get: (slug: string) =>
    request<{ data: import('@vyro/types').Problem }>(`/problems/${slug}`),
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  list: (params?: { status?: string }) =>
    request<{ data: import('@vyro/types').Room[] }>('/rooms', {
      params: params as Record<string, string | number | boolean>,
    }),
  get: (id: string) =>
    request<{ data: import('@vyro/types').Room & { participants: import('@vyro/types').RoomParticipant[] } }>(`/rooms/${id}`),
  create: (body: import('@vyro/types').CreateRoomRequest) =>
    request<{ data: import('@vyro/types').Room }>('/rooms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  join: (id: string) =>
    request<{ data: { joined: boolean } }>(`/rooms/${id}/join`, { method: 'POST' }),
  leave: (id: string) =>
    request<{ data: { left: boolean } }>(`/rooms/${id}/leave`, { method: 'DELETE' }),
  delete: (id: string) =>
    request<{ data: { deleted: boolean } }>(`/rooms/${id}`, { method: 'DELETE' }),
  problems: (id: string) =>
    request<{ data: Array<{ id: string; slug: string; title: string; difficulty: string }> }>(`/rooms/${id}/problems`),
};

// ─── Execute ────────────────────────────────────────────────────────────────

export const executeApi = {
  run: (body: import('@vyro/types').ExecuteRequest) =>
    request<{ data: import('@vyro/types').ExecutionResult }>('/execute/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submit: (body: import('@vyro/types').SubmitRequest) =>
    request<{ data: { submissionId: string } }>('/execute/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getSubmission: (id: string) =>
    request<{
      data: {
        id: string;
        status: string;
        stdout: string | null;
        stderr: string | null;
        timeMs: number | null;
        memoryKb: number | null;
      };
    }>(`/execute/submissions/${id}`),
};

// ─── Leaderboard ───────────────────────────────────────────────────────────

export const leaderboardApi = {
  global: (params?: { page?: number; pageSize?: number }) =>
    request<{ data: { items: import('@vyro/types').LeaderboardEntry[]; total: number } }>(
      '/leaderboard',
      { params: params as Record<string, string | number | boolean> }
    ),
};

// ─── Contests ────────────────────────────────────────────────────────────────

export const contestsApi = {
  list: () =>
    request<{ data: import('@vyro/types').Contest[] }>('/contests'),
  get: (id: string) =>
    request<{ data: import('@vyro/types').Contest }>(`/contests/${id}`),
  leaderboard: (id: string) =>
    request<{ data: import('@vyro/types').LeaderboardEntry[] }>(`/contests/${id}/leaderboard`),
  join: (id: string) =>
    request<{ data: { joined: boolean } }>(`/contests/${id}/join`, { method: 'POST' }),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  rating: number;
  problemsSolved: number;
  createdAt: string;
  accepted: number;
  wrong: number;
  totalSubmissions: number;
  acceptanceRate: number;
  recentSubmissions: Array<{
    id: string;
    status: string;
    languageId: number;
    timeMs: number | null;
    memoryKb: number | null;
    createdAt: string;
    problem: { slug: string; title: string; difficulty: string };
  }>;
}

export const usersApi = {
  getProfile: (username: string) =>
    request<{ data: UserProfile }>(`/users/${username}`),
};

// ─── Problem submissions ──────────────────────────────────────────────────────

export interface ProblemSubmission {
  id: string;
  status: string;
  languageId: number;
  timeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
  code: string;
}

export const submissionsApi = {
  forProblem: (slug: string) =>
    request<{ data: ProblemSubmission[] }>(`/problems/${slug}/submissions`),
};

// ─── Room active problem ──────────────────────────────────────────────────────

export const roomsApi2 = {
  setActiveProblem: (roomId: string, problemId: string) =>
    request<{ data: { problemId: string; slug: string } }>(`/rooms/${roomId}/active-problem`, {
      method: 'PATCH',
      body: JSON.stringify({ problemId }),
    }),
  scoreboard: (roomId: string) =>
    request<{
      data: Array<{
        id: string;
        status: string;
        time_ms: number | null;
        language_id: number;
        created_at: string;
        username: string;
        user_id: string;
      }>;
    }>(`/rooms/${roomId}/scoreboard`),
  setTimer: (roomId: string, durationMinutes: number) =>
    request<{ data: { endTime: string } }>(`/rooms/${roomId}/timer`, {
      method: 'PATCH',
      body: JSON.stringify({ durationMinutes }),
    }),
  setStatus: (roomId: string, status: string) =>
    request<{ data: { status: string } }>(`/rooms/${roomId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ─── Execute run-all ──────────────────────────────────────────────────────────

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  timeMs: number | null;
  error?: string;
}

export const executeApiExt = {
  runAll: (body: { code: string; languageId: number; problemId: string }) =>
    request<{ data: TestCaseResult[] }>('/execute/run-all', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () =>
    request<{ data: { totalUsers: number; totalProblems: number; totalSubmissions: number; totalRooms: number } }>('/admin/stats'),
  problems: () =>
    request<{ data: Array<{ id: string; title: string; slug: string; difficulty: string; tags: string[]; created_at: string }> }>('/admin/problems'),
  createProblem: (body: {
    title: string; slug: string; difficulty: string; description: string;
    tags: string[]; starterCode: Record<string, string>;
    testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
    constraints?: string[];
  }) => request<{ data: { id: string } }>('/admin/problems', { method: 'POST', body: JSON.stringify(body) }),
  updateProblem: (id: string, body: Partial<{
    title: string; slug: string; difficulty: string; description: string;
    tags: string[]; starterCode: Record<string, string>;
    testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
    constraints: string[];
  }>) => request<{ data: { updated: boolean } }>(`/admin/problems/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProblem: (id: string) =>
    request<{ data: { deleted: boolean } }>(`/admin/problems/${id}`, { method: 'DELETE' }),
  rooms: () =>
    request<{ data: Array<{ id: string; name: string; status: string; host_username: string; participant_count: string; created_at: string }> }>('/admin/rooms'),
  deleteRoom: (id: string) =>
    request<{ data: { deleted: boolean } }>(`/admin/rooms/${id}`, { method: 'DELETE' }),
  submissions: () =>
    request<{ data: Array<{ id: string; status: string; language_id: number; created_at: string; username: string; problem_title: string }> }>('/admin/submissions'),
};

// ─── Languages ───────────────────────────────────────────────────────────────

export interface LanguageEntry {
  id: number;
  name: string;
  monacoId: string;
  version: string;
  starterTemplate: string;
}

export const languagesApi = {
  list: () => request<{ data: LanguageEntry[] }>('/languages'),
};

// ─── Auth extras ─────────────────────────────────────────────────────────────

export const authApiExt = {
  forgotPassword: (email: string) =>
    request<{ data: { resetToken?: string; message: string } }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ data: { message: string } }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
};
