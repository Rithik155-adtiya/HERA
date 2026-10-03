import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { configApi } from '../api/config';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { LoadingState } from '../components/ui';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, refreshUser, loading } = useAuth();
  const [name, setName] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHostelId(user.hostelId ?? '');
      setBlockId(user.blockId ?? '');
      setRoomId(user.roomId ?? '');
    }
  }, [user]);

  const { data: hostels } = useQuery({ queryKey: ['hostels'], queryFn: configApi.hostels });
  const { data: blocks } = useQuery({
    queryKey: ['blocks', hostelId],
    queryFn: () => configApi.blocks(hostelId || undefined),
    enabled: !!hostelId,
  });
  const { data: rooms } = useQuery({
    queryKey: ['rooms', blockId],
    queryFn: () => configApi.rooms(blockId || undefined),
    enabled: !!blockId,
  });

  const save = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        name,
        hostelId: hostelId || undefined,
        blockId: blockId || undefined,
        roomId: roomId || undefined,
      }),
    onSuccess: async () => {
      toast.success('Profile updated');
      await refreshUser();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (loading) return <LoadingState label="Loading profile..." />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UserIcon size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{user.name}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-600">
            {user.role}
          </span>
        </div>
      </div>

      <form
        className="card space-y-4 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Edit Profile</h2>
        <div>
          <label htmlFor="pf-name" className="label">
            Full name
          </label>
          <input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>

        {user.role === 'student' && (
          <>
            <div>
              <label htmlFor="pf-hostel" className="label">
                Hostel
              </label>
              <select
                id="pf-hostel"
                className="input"
                value={hostelId}
                onChange={(e) => {
                  setHostelId(e.target.value);
                  setBlockId('');
                  setRoomId('');
                }}
              >
                <option value="">Select hostel</option>
                {hostels?.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            {hostelId && (
              <div>
                <label htmlFor="pf-block" className="label">
                  Block
                </label>
                <select
                  id="pf-block"
                  className="input"
                  value={blockId}
                  onChange={(e) => {
                    setBlockId(e.target.value);
                    setRoomId('');
                  }}
                >
                  <option value="">Select block</option>
                  {blocks?.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {blockId && (
              <div>
                <label htmlFor="pf-room" className="label">
                  Room
                </label>
                <select id="pf-room" className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Select room</option>
                  {rooms?.map((r) => (
                    <option key={r._id} value={r._id}>
                      Room {r.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
