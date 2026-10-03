import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { configApi } from '../../api/config';
import { Modal, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';

export default function AdminHostels() {
  const queryClient = useQueryClient();
  const [hostelOpen, setHostelOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [selectedHostel, setSelectedHostel] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');

  const hostels = useQuery({ queryKey: ['hostels'], queryFn: configApi.hostels });
  const blocks = useQuery({
    queryKey: ['blocks', selectedHostel],
    queryFn: () => configApi.blocks(selectedHostel || undefined),
    enabled: !!selectedHostel,
  });
  const rooms = useQuery({
    queryKey: ['rooms', selectedBlock],
    queryFn: () => configApi.rooms(selectedBlock || undefined),
    enabled: !!selectedBlock,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hostels'] });
    queryClient.invalidateQueries({ queryKey: ['blocks'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  const onError = (err: unknown) => toast.error(getErrorMessage(err));

  const createHostel = useMutation({
    mutationFn: configApi.createHostel,
    onSuccess: () => {
      toast.success('Hostel created');
      setHostelOpen(false);
      invalidate();
    },
    onError,
  });

  const createBlock = useMutation({
    mutationFn: configApi.createBlock,
    onSuccess: () => {
      toast.success('Block created');
      setBlockOpen(false);
      invalidate();
    },
    onError,
  });

  const createRoom = useMutation({
    mutationFn: configApi.createRoom,
    onSuccess: () => {
      toast.success('Room created');
      setRoomOpen(false);
      invalidate();
    },
    onError,
  });

  if (hostels.isLoading) return <LoadingState label="Loading hostels..." />;
  if (hostels.isError) return <ErrorState message={getErrorMessage(hostels.error)} onRetry={() => void hostels.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hostels, Blocks &amp; Rooms</h1>
          <p className="text-sm text-slate-500">All location data used by registration and complaints.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => setHostelOpen(true)}>
            <Plus size={16} /> Hostel
          </button>
          <button type="button" className="btn-secondary" onClick={() => setBlockOpen(true)} disabled={!selectedHostel}>
            <Plus size={16} /> Block
          </button>
          <button type="button" className="btn-secondary" onClick={() => setRoomOpen(true)} disabled={!selectedBlock}>
            <Plus size={16} /> Room
          </button>
        </div>
      </div>

      {!hostels.data || hostels.data.length === 0 ? (
        <EmptyState title="No hostels yet." description="Create your first hostel to get started." />
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="sel-hostel" className="label">
              Browse hostel
            </label>
            <select
              id="sel-hostel"
              className="input sm:w-80"
              value={selectedHostel}
              onChange={(e) => {
                setSelectedHostel(e.target.value);
                setSelectedBlock('');
              }}
            >
              <option value="">Select hostel</option>
              {hostels.data.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>

          {selectedHostel && (
            <div>
              <label htmlFor="sel-block" className="label">
                Browse block
              </label>
              <select
                id="sel-block"
                className="input sm:w-80"
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
              >
                <option value="">Select block</option>
                {blocks.data?.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedHostel && blocks.data && blocks.data.length > 0 && (
            <section className="card p-4" aria-label="Blocks">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Blocks</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {blocks.data.map((b) => (
                  <li key={b._id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{b.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{b.code}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {selectedBlock && (
            <section className="card p-4" aria-label="Rooms">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rooms</h2>
              {!rooms.data || rooms.data.length === 0 ? (
                <p className="text-sm text-slate-500">No rooms in this block yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {rooms.data.map((r) => (
                    <li key={r._id} className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm">
                      <span className="font-medium text-slate-800">{r.roomNumber}</span>
                      <span className="block text-xs text-slate-400">cap {r.capacity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <FormModal
        open={hostelOpen}
        title="Create Hostel"
        submitting={createHostel.isPending}
        onClose={() => setHostelOpen(false)}
        fields={[
          { name: 'name', label: 'Hostel name', required: true },
          { name: 'code', label: 'Code (e.g. BHA)', required: true },
        ]}
        onSubmit={(v) => createHostel.mutate({ name: v.name, code: v.code })}
      />

      <FormModal
        open={blockOpen}
        title="Create Block"
        submitting={createBlock.isPending}
        onClose={() => setBlockOpen(false)}
        fields={[
          { name: 'name', label: 'Block name (e.g. Block A)', required: true },
          { name: 'code', label: 'Code (e.g. A)', required: true },
        ]}
        onSubmit={(v) => createBlock.mutate({ hostelId: selectedHostel, name: v.name, code: v.code })}
      />

      <FormModal
        open={roomOpen}
        title="Create Room"
        submitting={createRoom.isPending}
        onClose={() => setRoomOpen(false)}
        fields={[
          { name: 'roomNumber', label: 'Room number', required: true },
          { name: 'capacity', label: 'Capacity', required: true, type: 'number' },
        ]}
        onSubmit={(v) =>
          createRoom.mutate({ blockId: selectedBlock, roomNumber: v.roomNumber, capacity: Number(v.capacity) || 1 })
        }
      />
    </div>
  );
}

function FormModal({
  open,
  title,
  fields,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  fields: Array<{ name: string; label: string; required?: boolean; type?: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) setValues({});
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`fm-${f.name}`} className="label">
              {f.label}
            </label>
            <input
              id={`fm-${f.name}`}
              type={f.type ?? 'text'}
              className="input"
              required={f.required}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
