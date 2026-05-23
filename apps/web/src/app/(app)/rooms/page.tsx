'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users, Lock, Globe, Trash2, BookOpen } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { roomsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Room } from '@vyro/types';

interface RoomProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
}

function CreateRoomModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName]                       = useState('');
  const [isPublic, setIsPublic]               = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await roomsApi.create({ name: name.trim(), isPublic, maxParticipants });
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lg-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="lg-strong w-full max-w-md p-8">
        <h2 className="text-xl font-semibold text-white mb-1">Create a Room</h2>
        <p className="text-sm text-white/45 mb-2">Set up a collaborative coding session</p>
        <div className="flex items-center gap-2 mb-5 text-xs text-white/35">
          <BookOpen className="w-3.5 h-3.5" />
          Auto-assigns 5 easy · 3 medium · 2 hard problems
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-[11px] text-sm" style={{
            background: 'rgba(207,45,86,0.12)',
            border: '1px solid rgba(207,45,86,0.25)',
            color: '#cf2d56',
          }}>{error}</div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.4px] mb-1.5">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LeetCode practice"
              required
              className="lg-input h-11 px-4 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.4px] mb-1.5">Max Participants</label>
            <select
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
              className="lg-input h-11 px-4 text-sm"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} participants</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-2 px-3 py-2 rounded-[11px] border text-sm transition-colors ${
                isPublic
                  ? 'bg-[rgba(94,106,210,0.2)] border-[rgba(130,143,255,0.3)] text-[#828fff]'
                  : 'bg-white/5 border-white/[0.12] text-white/50'
              }`}
            >
              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isPublic ? 'Public' : 'Private'}
            </button>
            <p className="text-xs text-white/30">{isPublic ? 'Anyone can join' : 'Invite only'}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading} className="flex-1">Create Room</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomProblemsModal({ roomId, roomName, onClose }: { roomId: string; roomName: string; onClose: () => void }) {
  const [problems, setProblems] = useState<RoomProblem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomsApi.problems(roomId).then((res) => {
      setProblems(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [roomId]);

  const byDiff = (d: string) => problems.filter((p) => p.difficulty === d);

  return (
    <div className="lg-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="lg-strong w-full max-w-lg p-8 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">{roomName}</h2>
            <p className="text-sm text-white/40">Problem set · {problems.length} problems</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-[10px] animate-pulse" />)}
          </div>
        ) : (
          ['easy', 'medium', 'hard'].map((diff) => {
            const items = byDiff(diff);
            if (!items.length) return null;
            return (
              <div key={diff} className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.88px] mb-2" style={{
                  color: diff === 'easy' ? '#27a644' : diff === 'medium' ? '#f5a623' : '#cf2d56'
                }}>
                  {diff} · {items.length}
                </p>
                <div className="space-y-1.5">
                  {items.map((p) => (
                    <Link
                      key={p.id}
                      href={`/problems/${p.slug}`}
                      onClick={onClose}
                      className="flex items-center justify-between px-4 py-2.5 rounded-[10px] hover:bg-white/[0.06] transition-colors group"
                    >
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{p.title}</span>
                      <Badge variant={p.difficulty as 'easy' | 'medium' | 'hard'}>
                        {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}

        <div className="mt-6 pt-5 border-t border-white/[0.07]">
          <Link href={`/rooms/${roomId}`} className="lg-btn-primary w-full flex items-center justify-center h-10 text-sm" onClick={onClose}>
            Enter Room
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [rooms, setRooms]       = useState<Room[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewRoom, setPreviewRoom] = useState<{ id: string; name: string } | null>(null);

  function loadRooms() {
    roomsApi.list({ status: 'waiting' }).then((res) => {
      setRooms(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { loadRooms(); }, []);

  function handleCreated(room: Room) {
    setShowCreate(false);
    router.push(`/rooms/${room.id}`);
  }

  async function handleDelete(e: React.MouseEvent, roomId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this room? This cannot be undone.')) return;
    setDeletingId(roomId);
    try {
      await roomsApi.delete(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch {
      alert('Failed to delete room');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="p-8 max-w-6xl mx-auto">

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[40px] font-semibold tracking-[-1px] text-white leading-none mb-1">Rooms</h1>
            <p className="text-sm text-white/50">Join an active room or create your own</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />Create Room
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="lg-card p-6 space-y-3">
                <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                <div className="h-3 bg-white/10 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="lg-card p-16 text-center">
            <Users className="w-10 h-10 text-white/30 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-1">No active rooms</h3>
            <p className="text-sm text-white/45 mb-6">Be the first to create a coding room!</p>
            <Button variant="primary" onClick={() => setShowCreate(true)}>Create Room</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const isFull = (room.participantCount ?? 0) >= room.maxParticipants;
              const isHost = user?.id === room.hostId;
              return (
                <div key={room.id} className="lg-card p-6 flex flex-col">

                  {/* Header */}
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-semibold text-white truncate flex-1 mr-2">{room.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {room.isPublic
                        ? <Globe className="w-4 h-4 text-white/30 mt-0.5" />
                        : <Lock className="w-4 h-4 text-white/30 mt-0.5" />
                      }
                      {isHost && (
                        <button
                          onClick={(e) => handleDelete(e, room.id)}
                          disabled={deletingId === room.id}
                          className="p-1 rounded-[6px] text-white/25 hover:text-hard hover:bg-[rgba(207,45,86,0.12)] transition-colors disabled:opacity-40"
                          title="Delete room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Host */}
                  <p className="text-xs text-white/35 mb-3">
                    Host: <span className="text-white/55">{room.host?.username ?? '—'}</span>
                  </p>

                  {/* Problem set summary */}
                  <button
                    onClick={() => setPreviewRoom({ id: room.id, name: room.name })}
                    className="flex items-center gap-1.5 text-xs text-[#828fff]/70 hover:text-[#828fff] transition-colors mb-4 w-fit"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    10 problems · 5E · 3M · 2H
                  </button>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto mb-3">
                    <span className="text-xs text-white/40">
                      {room.participantCount ?? 0} / {room.maxParticipants} online
                    </span>
                    <span className={`text-xs font-medium rounded-full px-3 py-0.5 ${
                      isFull
                        ? 'bg-[rgba(207,45,86,0.15)] text-[#cf2d56]'
                        : 'bg-[rgba(39,166,68,0.15)] text-easy'
                    }`}>
                      {isFull ? 'Full' : 'Open'}
                    </span>
                  </div>

                  <Link href={`/rooms/${room.id}`} className="block">
                    <Button variant="secondary" className="w-full" disabled={isFull}>
                      {isFull ? 'Room Full' : 'Join Room'}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {showCreate && (
        <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {previewRoom && (
        <RoomProblemsModal
          roomId={previewRoom.id}
          roomName={previewRoom.name}
          onClose={() => setPreviewRoom(null)}
        />
      )}
    </div>
  );
}
