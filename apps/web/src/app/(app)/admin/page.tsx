'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Plus, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { adminApi } from '@/lib/api';
import { LANGUAGE_NAMES, type Language } from '@vyro/types';

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: string[];
  created_at: string;
}

interface AdminRoom {
  id: string;
  name: string;
  status: string;
  host_username: string;
  participant_count: string;
  created_at: string;
}

interface Submission {
  id: string;
  status: string;
  language_id: number;
  created_at: string;
  username: string;
  problem_title: string;
}

interface Stats {
  totalUsers: number;
  totalProblems: number;
  totalSubmissions: number;
  totalRooms: number;
}

type Tab = 'problems' | 'rooms' | 'submissions';

const STATUS_COLORS: Record<string, string> = {
  accepted: '#27a644',
  wrong_answer: '#cf2d56',
  runtime_error: '#cf2d56',
  compile_error: '#f5a623',
  time_limit_exceeded: '#f5a623',
};

function ProblemModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Problem | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [slug, setSlug]         = useState(initial?.slug ?? '');
  const [difficulty, setDiff]   = useState(initial?.difficulty ?? 'easy');
  const [description, setDesc]  = useState('');
  const [tags, setTags]         = useState((initial?.tags ?? []).join(', '));
  const [starterCode, setStart] = useState('{}');
  const [testCases, setTests]   = useState('[]');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      let parsedTags: string[] = [];
      let parsedStart: Record<string, string> = {};
      let parsedTests: Array<{ input: string; expectedOutput: string }> = [];

      try { parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean); } catch { parsedTags = []; }
      try { parsedStart = JSON.parse(starterCode) as Record<string, string>; } catch { setError('Invalid starter code JSON'); setSaving(false); return; }
      try { parsedTests = JSON.parse(testCases) as Array<{ input: string; expectedOutput: string }>; } catch { setError('Invalid test cases JSON'); setSaving(false); return; }

      if (initial) {
        await adminApi.updateProblem(initial.id, { title, slug, difficulty, description, tags: parsedTags, starterCode: parsedStart, testCases: parsedTests });
      } else {
        await adminApi.createProblem({ title, slug, difficulty, description, tags: parsedTags, starterCode: parsedStart, testCases: parsedTests });
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-surface1 border border-hairline rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink">{initial ? 'Edit Problem' : 'Create Problem'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface2 text-ink-subtle transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-subtle mb-1 block">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Two Sum" />
            </div>
            <div>
              <label className="text-xs text-ink-subtle mb-1 block">Slug</label>
              <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="two-sum" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-subtle mb-1 block">Difficulty</label>
              <select className="input" value={difficulty} onChange={(e) => setDiff(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-subtle mb-1 block">Tags (comma-separated)</label>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="array, hash-map" />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-subtle mb-1 block">Description (Markdown)</label>
            <textarea className="input min-h-[100px] resize-y" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Given an array of integers..." />
          </div>
          <div>
            <label className="text-xs text-ink-subtle mb-1 block">Starter Code (JSON: language-id keys)</label>
            <textarea className="input min-h-[80px] font-mono text-xs resize-y" value={starterCode} onChange={(e) => setStart(e.target.value)} placeholder={'{"63": "// JS code here"}'} />
          </div>
          <div>
            <label className="text-xs text-ink-subtle mb-1 block">Test Cases (JSON array)</label>
            <textarea className="input min-h-[100px] font-mono text-xs resize-y" value={testCases} onChange={(e) => setTests(e.target.value)} placeholder={'[{"input": "2 7 11 15\\n9", "expectedOutput": "0 1"}]'} />
          </div>
          {error && <p className="text-xs text-hard">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm px-4 h-9">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4 h-9 flex items-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {initial ? 'Save Changes' : 'Create Problem'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [tab, setTab]               = useState<Tab>('problems');
  const [stats, setStats]           = useState<Stats | null>(null);
  const [problems, setProblems]     = useState<Problem[]>([]);
  const [rooms, setRooms]           = useState<AdminRoom[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editProblem, setEditProblem] = useState<Problem | null>(null);

  const isAdmin = user?.username === 'Gannu';

  useEffect(() => {
    if (!isAdmin) { router.replace('/dashboard'); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p, r, sub] = await Promise.all([
        adminApi.stats(),
        adminApi.problems(),
        adminApi.rooms(),
        adminApi.submissions(),
      ]);
      setStats(s.data);
      setProblems(p.data);
      setRooms(r.data);
      setSubmissions(sub.data);
    } catch (e) {
      console.error('Admin load error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm('Delete this problem?')) return;
    try {
      await adminApi.deleteProblem(id);
      setProblems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Delete this room?')) return;
    try {
      await adminApi.deleteRoom(id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-ink">Admin Panel</h1>
          <p className="text-sm text-ink-subtle mt-0.5">Manage problems, rooms, and submissions.</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Users', value: stats.totalUsers },
              { label: 'Problems', value: stats.totalProblems },
              { label: 'Submissions', value: stats.totalSubmissions },
              { label: 'Rooms', value: stats.totalRooms },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface1 border border-hairline rounded-xl p-4">
                <p className="text-xs text-ink-subtle">{label}</p>
                <p className="text-2xl font-bold text-ink mt-1">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-hairline mb-5">
          {(['problems', 'rooms', 'submissions'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'text-ink border-primary' : 'text-ink-subtle border-transparent hover:text-ink-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Problems tab */}
        {tab === 'problems' && (
          <div>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => { setEditProblem(null); setModalOpen(true); }}
                className="btn-primary text-sm flex items-center gap-1.5 h-9 px-4"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Problem
              </button>
            </div>
            <div className="bg-surface1 border border-hairline rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs text-ink-subtle">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Slug</th>
                    <th className="text-left px-4 py-3 font-medium">Difficulty</th>
                    <th className="text-left px-4 py-3 font-medium">Tags</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={p.id} className="border-b border-hairline last:border-0 hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 text-ink font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-ink-subtle font-mono text-xs">{p.slug}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${p.difficulty === 'easy' ? 'text-easy' : p.difficulty === 'medium' ? 'text-medium' : 'text-hard'}`}>
                          {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.tags ?? []).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface2 text-ink-subtle">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setEditProblem(p); setModalOpen(true); }}
                            className="text-xs px-2.5 py-1 rounded-md border border-hairline text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProblem(p.id)}
                            className="p-1.5 rounded-md text-ink-tertiary hover:text-hard hover:bg-surface2 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {problems.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-tertiary">No problems yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rooms tab */}
        {tab === 'rooms' && (
          <div className="bg-surface1 border border-hairline rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-ink-subtle">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Host</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Participants</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3 text-ink font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-ink-subtle">{r.host_username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${r.status === 'active' ? 'text-easy' : r.status === 'waiting' ? 'text-medium' : 'text-ink-subtle'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">{r.participant_count}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteRoom(r.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-hard hover:bg-surface2 transition-colors float-right"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-tertiary">No rooms.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Submissions tab */}
        {tab === 'submissions' && (
          <div className="bg-surface1 border border-hairline rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-ink-subtle">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Problem</th>
                  <th className="text-left px-4 py-3 font-medium">Language</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0 hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3 text-ink font-medium">{s.username}</td>
                    <td className="px-4 py-3 text-ink-subtle">{s.problem_title}</td>
                    <td className="px-4 py-3 text-ink-subtle text-xs">
                      {LANGUAGE_NAMES[s.language_id as Language] ?? `Lang ${s.language_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {s.status === 'accepted'
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-easy" />
                          : s.status === 'processing'
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" />
                          : <XCircle className="w-3.5 h-3.5" style={{ color: STATUS_COLORS[s.status] ?? '#8a8f98' }} />}
                        <span className="text-xs" style={{ color: STATUS_COLORS[s.status] ?? '#8a8f98' }}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-subtle text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-tertiary">No submissions.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <ProblemModal
          initial={editProblem}
          onClose={() => { setModalOpen(false); setEditProblem(null); }}
          onSave={loadData}
        />
      )}
    </div>
  );
}
