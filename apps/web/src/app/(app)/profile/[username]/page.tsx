'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Calendar, Code2, CheckCircle2, XCircle } from 'lucide-react';
import { LANGUAGE_NAMES, type Language } from '@vyro/types';
import { usersApi, type UserProfile } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    usersApi.getProfile(username).then((res) => {
      setProfile(res.data);
      setLoading(false);
    }).catch((err: Error) => {
      if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Loader2 className="w-6 h-6 animate-spin text-ink-subtle" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <p className="text-sm text-ink-subtle">User not found.</p>
      </div>
    );
  }

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-canvas p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-full bg-[rgba(94,106,210,0.2)] border border-[rgba(130,143,255,0.3)] flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-[#828fff]">
            {profile.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink leading-tight">{profile.username}</h1>
          <p className="text-sm text-ink-subtle flex items-center gap-1.5 mt-1">
            <Calendar className="w-3.5 h-3.5" />
            Joined {joinDate}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-3xl font-bold gradient-text">{profile.rating.toLocaleString()}</p>
          <p className="text-xs text-ink-subtle mt-0.5">Rating</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="lg-card p-5 text-center">
          <p className="text-2xl font-bold text-ink">{profile.problemsSolved}</p>
          <p className="text-xs text-ink-subtle mt-1 flex items-center justify-center gap-1">
            <Code2 className="w-3.5 h-3.5" />
            Problems Solved
          </p>
        </div>
        <div className="lg-card p-5 text-center">
          <p className="text-2xl font-bold text-ink">{profile.acceptanceRate}%</p>
          <p className="text-xs text-ink-subtle mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Acceptance Rate
          </p>
        </div>
        <div className="lg-card p-5 text-center">
          <p className="text-2xl font-bold text-ink">{profile.totalSubmissions}</p>
          <p className="text-xs text-ink-subtle mt-1">Total Submissions</p>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="lg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline">
          <h2 className="text-sm font-semibold text-ink">Recent Submissions</h2>
        </div>
        {profile.recentSubmissions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ink-tertiary">No submissions yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle px-5 py-2.5">Problem</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle px-5 py-2.5">Status</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle px-5 py-2.5 hidden md:table-cell">Language</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle px-5 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentSubmissions.map((sub) => {
                const accepted = sub.status === 'accepted';
                return (
                  <tr key={sub.id} className="border-b border-hairline last:border-b-0 hover:bg-surface2 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium text-ink`}>{sub.problem.title}</span>
                        <Badge variant={sub.problem.difficulty as 'easy' | 'medium' | 'hard'}>
                          {sub.problem.difficulty.charAt(0).toUpperCase() + sub.problem.difficulty.slice(1)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${accepted ? 'text-easy' : 'text-hard'}`}>
                        {accepted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {accepted ? 'Accepted' : sub.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="text-xs text-ink-subtle">
                        {LANGUAGE_NAMES[sub.languageId as Language] ?? `Lang ${sub.languageId}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-tertiary">
                      {timeAgo(sub.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
