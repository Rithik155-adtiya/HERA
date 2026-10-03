import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { configApi } from '../../api/config';
import { Pagination, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { page, role, search }],
    queryFn: () => configApi.users({ page, limit: 20, role: role || undefined, search: search || undefined }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<{ role: string; isActive: boolean }> }) =>
      configApi.updateUser(id, input),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">Manage roles and account status.</p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <select
          className="input sm:w-48"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="warden">Wardens</option>
          <option value="admin">Admins</option>
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {isLoading ? (
        <LoadingState label="Loading users..." />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No users found." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Joined</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1 text-xs"
                        value={u.role}
                        onChange={(e) => update.mutate({ id: u._id, input: { role: e.target.value } })}
                        aria-label={`Role for ${u.name}`}
                      >
                        <option value="student">Student</option>
                        <option value="warden">Warden</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={u.isActive ? 'btn-secondary py-1 text-xs' : 'btn-primary py-1 text-xs'}
                        onClick={() => update.mutate({ id: u._id, input: { isActive: !u.isActive } })}
                      >
                        {u.isActive ? 'Active — deactivate' : 'Inactive — activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
