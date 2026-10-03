import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { configApi } from '../../api/config';
import { Modal, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import toast from 'react-hot-toast';

export default function AdminTaxonomy() {
  const queryClient = useQueryClient();
  const [deptOpen, setDeptOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const categories = useQuery({ queryKey: ['categories'], queryFn: configApi.categories });
  const departments = useQuery({ queryKey: ['departments'], queryFn: configApi.departments });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  };
  const onError = (err: unknown) => toast.error(getErrorMessage(err));

  const createDept = useMutation({
    mutationFn: configApi.createDepartment,
    onSuccess: () => {
      toast.success('Department created');
      setDeptOpen(false);
      invalidate();
    },
    onError,
  });

  const createCat = useMutation({
    mutationFn: configApi.createCategory,
    onSuccess: () => {
      toast.success('Category created');
      setCatOpen(false);
      invalidate();
    },
    onError,
  });

  if (categories.isLoading || departments.isLoading) return <LoadingState label="Loading configuration..." />;
  if (categories.isError) return <ErrorState message={getErrorMessage(categories.error)} onRetry={() => void categories.refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Categories &amp; Departments</h1>
        <p className="text-sm text-slate-500">
          Database-driven configuration — the AI can only pick from these values.
        </p>
      </div>

      <section aria-labelledby="cat-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="cat-heading" className="text-lg font-semibold text-slate-900">
            Complaint Categories
          </h2>
          <button type="button" className="btn-primary" onClick={() => setCatOpen(true)}>
            <Plus size={16} /> Category
          </button>
        </div>
        {!categories.data || categories.data.length === 0 ? (
          <EmptyState title="No categories configured." description="Create categories so complaints can be classified." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.data.map((c) => (
              <li key={c._id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{c.code}</span>
                </div>
                {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                <p className="mt-2 text-xs text-brand-600">
                  Default dept:{' '}
                  {c.defaultDepartment && typeof c.defaultDepartment === 'object'
                    ? c.defaultDepartment.name
                    : c.defaultDepartmentId
                      ? 'assigned'
                      : 'none'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dept-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="dept-heading" className="text-lg font-semibold text-slate-900">
            Departments
          </h2>
          <button type="button" className="btn-primary" onClick={() => setDeptOpen(true)}>
            <Plus size={16} /> Department
          </button>
        </div>
        {!departments.data || departments.data.length === 0 ? (
          <EmptyState title="No departments configured." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.data.map((d) => (
              <li key={d._id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{d.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{d.code}</span>
                </div>
                {d.description && <p className="mt-1 text-sm text-slate-500">{d.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeptModal open={deptOpen} onClose={() => setDeptOpen(false)} submitting={createDept.isPending} onSubmit={(v) => createDept.mutate(v)} />
      <CatModal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        departments={departments.data ?? []}
        submitting={createCat.isPending}
        onSubmit={(v) => createCat.mutate(v)}
      />
    </div>
  );
}

function DeptModal({
  open,
  onClose,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (v: { name: string; code: string; description?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  React.useEffect(() => {
    if (open) {
      setName('');
      setCode('');
      setDescription('');
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Create Department">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, code, description: description || undefined });
        }}
      >
        <div>
          <label htmlFor="dm-name" className="label">Name</label>
          <input id="dm-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="dm-code" className="label">Code</label>
          <input id="dm-code" className="input" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label htmlFor="dm-desc" className="label">Description</label>
          <textarea id="dm-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function CatModal({
  open,
  onClose,
  departments,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  departments: Array<{ _id: string; name: string }>;
  submitting: boolean;
  onSubmit: (v: { name: string; code: string; description?: string; defaultDepartmentId?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [dept, setDept] = useState('');

  React.useEffect(() => {
    if (open) {
      setName('');
      setCode('');
      setDescription('');
      setDept('');
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Create Category">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, code, description: description || undefined, defaultDepartmentId: dept || undefined });
        }}
      >
        <div>
          <label htmlFor="cm-name" className="label">Name</label>
          <input id="cm-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cm-code" className="label">Code</label>
          <input id="cm-code" className="input" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label htmlFor="cm-desc" className="label">Description</label>
          <textarea id="cm-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cm-dept" className="label">Default department</label>
          <select id="cm-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
